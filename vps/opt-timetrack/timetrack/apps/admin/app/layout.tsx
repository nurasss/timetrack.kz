import './globals.css';
import type { Metadata } from 'next';
import { AppShell } from '../components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Timetrack.kz Admin',
  description: 'Административная панель Timetrack.kz'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
