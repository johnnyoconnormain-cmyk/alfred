import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import { ensureReady } from '@/lib/db';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Archivo({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Groundwork — run your landscaping business from one place',
    template: '%s · Groundwork',
  },
  description:
    'Turn leads into booked jobs, automate follow-ups, manage your crew, collect payments, and keep every customer in one system.',
};

export const viewport: Viewport = {
  themeColor: '#12130f',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // On a serverless host the database has to be fetched before anything can read
  // it, and this is the one component every page renders inside.
  await ensureReady();

  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
