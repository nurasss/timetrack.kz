import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Timetrack.kz — Учёт рабочего времени',
    template: '%s | Timetrack.kz',
  },
  description:
    'Timetrack.kz — современный сервис учёта рабочего времени для казахстанских компаний. Геолокация, фото-подтверждение, автоматический табель и отчёты.',
  keywords: ['учёт рабочего времени', 'табель', 'геолокация', 'Казахстан', 'B2B', 'HR'],
  openGraph: {
    title: 'Timetrack.kz',
    description: 'Учёт рабочего времени сотрудников без бумажных табелей',
    locale: 'ru_KZ',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-screen">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: 'font-sans text-sm',
              success: 'border-l-4 border-emerald-500',
              error: 'border-l-4 border-red-500',
            },
          }}
        />
      </body>
    </html>
  );
}
