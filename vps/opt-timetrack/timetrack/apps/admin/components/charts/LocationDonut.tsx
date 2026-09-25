'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { locationStatus } from '../../../../packages/shared/mock-data';

const colors = ['#29C166', '#4A6CF7', '#F4B400'];

export function LocationDonut() {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={locationStatus} cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={4} dataKey="value">
            {locationStatus.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
