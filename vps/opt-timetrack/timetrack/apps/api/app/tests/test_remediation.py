from datetime import UTC, date, datetime, time
from types import SimpleNamespace
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models import LeaveStatus, MarkStatus, MarkType, Role
from app.schemas.attendance import MarkInput
from app.schemas.employee import EmployeePatch
from app.schemas.location import LocationIn, LocationPatch
from app.schemas.schedule import ScheduleIn
from app.schemas.settings import SettingsPayload
from app.services.attendance_calculator import ScheduleView, WorkInterval, pair_marks_by_employee, split_work_interval
from app.services.consent_service import normalize_consent, require_biometric_consent
from app.services.attendance_rules import (
    AttendanceState,
    MarkTransitionError,
    effective_mark_time,
    sequence_state,
    validate_sequence_transition,
)
from app.services.leave_rules import ranges_overlap, validate_leave_transition
from app.services.rbac import has_permission, is_privileged, role_matrix
from app.services.tenant_service import validate_manager_reference, validate_unique_employee_binding
from app.services.timesheet_export import neutralize_formula


def make_mark(mark_type: MarkType, marked_at: datetime, employee_id: str, status=MarkStatus.VALID):
    return SimpleNamespace(
        employee_id=employee_id,
        type=mark_type,
        marked_at=marked_at,
        status=status,
        late_minutes=0,
        idempotency_key=None,
        client_event_id=None,
        client_mark_id=None,
    )


def test_rbac_matrix_keeps_employee_self_service_only():
    matrix = role_matrix()
    assert "employees:write" in matrix[Role.COMPANY_ADMIN.value]
    assert "reports:read" in matrix[Role.HR.value]
    assert "marks:approve" in matrix[Role.MANAGER.value]
    assert matrix[Role.EMPLOYEE.value] == ["self:attendance", "self:requests"]
    assert has_permission(Role.EMPLOYEE, "employees:write") is False
    assert is_privileged(Role.EMPLOYEE) is False


def test_attendance_state_machine_rejects_duplicate_and_unpaired_marks():
    employee_id = str(uuid4())
    first = make_mark(MarkType.CHECK_IN, datetime(2026, 6, 17, 8, tzinfo=UTC), employee_id)
    checkout = make_mark(MarkType.CHECK_OUT, datetime(2026, 6, 17, 17, tzinfo=UTC), employee_id)
    assert sequence_state([first, checkout]) is AttendanceState.OUT
    assert validate_sequence_transition(AttendanceState.OUT, MarkType.CHECK_IN) is AttendanceState.IN
    with pytest.raises(MarkTransitionError):
        validate_sequence_transition(AttendanceState.IN, MarkType.CHECK_IN)
    with pytest.raises(MarkTransitionError):
        validate_sequence_transition(AttendanceState.OUT, MarkType.CHECK_OUT)


def test_attendance_timestamp_is_server_bound_for_online_and_bounded_offline():
    now = datetime(2026, 6, 17, 12, tzinfo=UTC)
    online = effective_mark_time(datetime(2026, 6, 16, 8, tzinfo=UTC), now=now, offline=False)
    assert online == now
    offline = effective_mark_time(
        datetime(2026, 6, 16, 8, tzinfo=UTC),
        now=now,
        offline=True,
        max_backdate_days=7,
    )
    assert offline == datetime(2026, 6, 16, 8, tzinfo=UTC)
    with pytest.raises(ValueError):
        effective_mark_time(datetime(2026, 6, 18, 8, tzinfo=UTC), now=now, offline=False)
    with pytest.raises(ValueError):
        effective_mark_time(datetime(2026, 6, 1, 8, tzinfo=UTC), now=now, offline=True)


def test_payroll_pairs_overnight_and_subtracts_lunch_once():
    employee_id = str(uuid4())
    timezone = ZoneInfo("Asia/Almaty")
    check_in = make_mark(MarkType.CHECK_IN, datetime(2026, 6, 17, 18, tzinfo=UTC), employee_id)
    check_out = make_mark(MarkType.CHECK_OUT, datetime(2026, 6, 17, 20, tzinfo=UTC), employee_id)
    interval = WorkInterval(employee_id, check_in.marked_at, check_out.marked_at, check_in, check_out)
    result = split_work_interval(
        interval,
        timezone=timezone,
        schedule=ScheduleView(
            start_time=time(9),
            end_time=time(18),
            lunch_start=time(13),
            lunch_end=time(14),
            overtime_threshold_minutes=480,
        ),
    )
    assert sum(item.worked_minutes for item in result) == 120
    assert sum(item.overtime_minutes for item in result) == 0
    assert len(pair_marks_by_employee([check_in, check_out, check_in])) == 1


def test_leave_state_machine_and_overlap_rules():
    assert validate_leave_transition(LeaveStatus.PENDING, LeaveStatus.APPROVED) is LeaveStatus.APPROVED
    with pytest.raises(ValueError):
        validate_leave_transition(LeaveStatus.APPROVED, LeaveStatus.REJECTED)
    assert ranges_overlap(date(2026, 6, 1), date(2026, 6, 5), date(2026, 6, 5), date(2026, 6, 8))
    assert not ranges_overlap(date(2026, 6, 1), date(2026, 6, 5), date(2026, 6, 6), date(2026, 6, 8))


def test_validation_rejects_unbounded_coordinates_extra_fields_and_null_patch_values():
    with pytest.raises(ValidationError):
        MarkInput(lat=91, lng=0)
    with pytest.raises(ValidationError):
        LocationIn(name="x", address="x", lat=43, lng=76, radius_meters=0)
    with pytest.raises(ValidationError):
        LocationPatch(name=None)
    with pytest.raises(ValidationError):
        EmployeePatch(full_name=None)
    with pytest.raises(ValidationError):
        ScheduleIn(name="x", start_time="09:00", end_time="18:00", lunch_start="13:00")
    with pytest.raises(ValidationError):
        SettingsPayload(timezone="not/a-timezone")
    with pytest.raises(ValidationError):
        MarkInput(marked_at="2026-06-17T09:00:00", unknown=True)


def test_tenant_manager_self_reference_is_rejected():
    identifier = uuid4()
    with pytest.raises(HTTPException) as error:
        validate_manager_reference(identifier, identifier)
    assert error.value.status_code == 400
    with pytest.raises(HTTPException) as binding_error:
        validate_unique_employee_binding(uuid4(), user_id=uuid4())
    assert binding_error.value.status_code == 409


def test_export_neutralizes_spreadsheet_formulas():
    assert neutralize_formula("=SUM(A1:A2)") == "'=SUM(A1:A2)"
    assert neutralize_formula("ordinary") == "ordinary"


def test_biometric_consent_is_required_for_face_data():
    consent = normalize_consent({"granted": True, "version": "privacy-20260924.1", "granted_at": "2026-09-24T00:00:00+00:00"})
    assert consent is not None
    require_biometric_consent(consent, has_biometric_data=True)
    require_biometric_consent(None, has_biometric_data=False)
    with pytest.raises(HTTPException):
        require_biometric_consent(None, has_biometric_data=True)
    with pytest.raises(HTTPException):
        require_biometric_consent({"granted": True, "granted_at": "2026-09-24T00:00:00+00:00", "revoked_at": "2026-09-25T00:00:00+00:00"}, has_biometric_data=True)
