from io import BytesIO

from openpyxl import Workbook

from app.schemas.timesheet import TimesheetResponse

MAX_EXPORT_ROWS = 100_000
MAX_EXPORT_CELLS = 2_000_000


def neutralize_formula(value):
    if not isinstance(value, str):
        return value
    normalized = "".join(character for character in value if character in "\t\n\r" or ord(character) >= 32)
    if normalized.startswith(("=", "+", "-", "@")):
        return "'" + normalized
    return normalized


def render_timesheet_xlsx(data: TimesheetResponse, *, max_rows: int = MAX_EXPORT_ROWS) -> bytes:
    rows = 1
    cells = 4
    for employee in data.employees:
        rows += len(employee.days) + 1
        cells += len(employee.days) * 7
        if rows > max_rows or cells > MAX_EXPORT_CELLS:
            raise ValueError("timesheet export is too large")
    workbook = Workbook(write_only=False)
    sheet = workbook.active
    sheet.title = "Timesheet"
    sheet.append(["Employee", "Date", "Status", "Check in", "Check out", "Worked minutes", "Late minutes", "Overtime minutes"])
    for employee in data.employees:
        for day in employee.days:
            sheet.append(
                [
                    neutralize_formula(employee.full_name),
                    neutralize_formula(day.date),
                    neutralize_formula(day.status),
                    neutralize_formula(day.check_in),
                    neutralize_formula(day.check_out),
                    day.worked_minutes,
                    day.late_minutes,
                    day.overtime_minutes,
                ]
            )
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()
