import { Building2, GitBranch, ShieldCheck, Users } from 'lucide-react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { organizationTree, rolePermissions, workspace } from '../../lib/panel-data';
import { departments, locations, positions } from '../../../../packages/shared/mock-data';
import type { Department, Position } from '../../../../packages/shared/types';

export default function OrganizationPage() {
  const departmentColumns: Column<Department>[] = [
    { header: 'Отдел', accessor: (row) => <span className="font-black text-slate-900">{row.name}</span> },
    { header: 'Компания', accessor: () => workspace.company },
    { header: 'Руководитель', accessor: () => 'Назначается' },
    { header: 'Доступ', accessor: () => <StatusBadge tone="success">Активен</StatusBadge> }
  ];

  const positionColumns: Column<Position>[] = [
    { header: 'Должность', accessor: (row) => <span className="font-black text-slate-900">{row.name}</span> },
    { header: 'Отдел', accessor: (row) => departments.find((department) => department.id === row.department_id)?.name ?? '—' },
    { header: 'Штат', accessor: () => '0 сотрудников' },
    { header: 'Статус', accessor: () => <StatusBadge tone="success">Используется</StatusBadge> }
  ];

  return (
    <div>
      <PageHeader title="Организация" subtitle="Tenant, филиалы, отделы, должности и роли доступа в одной структуре.">
        <div className="flex flex-wrap gap-2">
          <button className="control">Пригласить пользователя</button>
          <button className="primary-control">Добавить отдел</button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Компания" value={workspace.company} trend={`БИН ${workspace.bin}`} tone="info" icon={<Building2 size={22} />} />
        <StatCard label="Филиалы" value={locations.length} trend="Нет филиалов" tone="success" icon={<GitBranch size={22} />} />
        <StatCard label="Отделы" value={departments.length} trend={`${positions.length} должностей`} tone="info" icon={<Users size={22} />} />
        <StatCard label="Роли" value="7" trend="RBAC и ограничения по филиалам" tone="success" icon={<ShieldCheck size={22} />} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        {organizationTree.map((node) => (
          <div key={node.name} className="card p-5">
            <p className="text-sm font-bold text-slate-500">{node.children} подразделений</p>
            <h2 className="mt-2 text-lg font-black text-slate-900">{node.name}</h2>
            <p className="mt-3 text-sm text-slate-500">{node.employees} сотрудников с активными графиками.</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-900">Отделы</h2>
          <DataTable columns={departmentColumns} data={departments} />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-900">Должности</h2>
          <DataTable columns={positionColumns} data={positions} />
        </section>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-black text-slate-900">Матрица ролей</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Роль', 'Сотрудники', 'Отчеты', 'Биллинг', 'Интеграции', 'Биометрия'].map((item) => (
                  <th key={item} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{item}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rolePermissions.map((role) => (
                <tr key={role.role}>
                  <td className="px-4 py-3 font-black text-slate-900">{role.role}</td>
                  <Permission allowed={role.employees} />
                  <Permission allowed={role.reports} />
                  <Permission allowed={role.billing} />
                  <Permission allowed={role.integrations} />
                  <Permission allowed={role.biometrics} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Permission({ allowed }: { allowed: boolean }) {
  return <td className="px-4 py-3"><StatusBadge tone={allowed ? 'success' : 'neutral'}>{allowed ? 'Да' : 'Нет'}</StatusBadge></td>;
}
