import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';

import './globals.css';
import { APP_NAME, APP_TAGLINE, SITE_NAME } from '@/lib/site';
import { EmergencyBar } from '@/components/EmergencyBar';
import { ServiceWorker } from '@/components/ServiceWorker';
import { SyncBanner } from '@/components/SyncBanner';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${SITE_NAME}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, statusBarStyle: 'default', title: APP_NAME },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // never block zoom — this is a legibility-critical interface
  themeColor: '#e9ecef',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh antialiased">
        {/* Skip link: the emergency bar is first in the tab order on purpose. */}
        <a
          href="#main"
          className="sr-only-focusable absolute left-3 top-3 z-50 rounded bg-ink px-3 py-2 text-sm font-semibold text-card"
        >
          Skip to content
        </a>
        <EmergencyBar />
        <SyncBanner />
        <div id="main">{children}</div>
        <ServiceWorker />
      </body>
    </html>
  );
}
