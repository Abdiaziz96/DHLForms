import { Suspense } from 'react';

import { AdminLoginForm } from '@/components/AdminLoginForm';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';

export const metadata = { title: 'Office sign-in' };

export default function AdminLoginPage() {
  return (
    <>
      <ScreenHeader
        title="Office sign-in"
        subtitle="The office view holds every driver name, registration and visitor on site, so it is password protected."
        backHref="/"
        backLabel="Start"
      />
      <Screen>
        <div className="max-w-sm">
          <Suspense
            fallback={
              <div className="grid gap-4">
                <div className="h-[70px] animate-pulse rounded-tile bg-card-sunk" />
                <div className="h-[52px] animate-pulse rounded-tile bg-card-sunk" />
              </div>
            }
          >
            <AdminLoginForm />
          </Suspense>

          <p className="mt-6 text-[12.5px] leading-relaxed text-ink-faint">
            Drivers, warehouse staff and visitors do not need this password, and never see this screen. It is only for
            the office view and the export.
          </p>
        </div>
      </Screen>
    </>
  );
}
