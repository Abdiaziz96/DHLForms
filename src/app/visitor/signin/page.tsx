import { Suspense } from 'react';

import { KeyContacts } from '@/components/KeyContacts';
import { Screen, ScreenHeader } from '@/components/ScreenHeader';
import { VisitorForm } from '@/components/VisitorForm';

export const metadata = { title: 'Sign in' };

/**
 * Sign in.
 *
 * This stays a server component so the shell and a real loading state are on
 * screen before any of the form's JavaScript arrives — a visitor standing at a
 * barrier on a slow connection sees the page immediately rather than a blank.
 *
 * The form reads `?purpose=delivering|collecting`, and `useSearchParams()` forces
 * a client-side bailout in Next 15. Without the Suspense boundary below, that
 * bailout would take the whole route out of the static shell.
 */
export default function SignInPage() {
  return (
    <>
      <ScreenHeader
        title="Sign in"
        subtitle="Your name, your company and your signature."
        backHref="/visitor"
        backLabel="Visitor"
        right={<KeyContacts context="general" />}
      />
      <Screen>
        <Suspense fallback={<SignInSkeleton />}>
          <VisitorForm />
        </Suspense>
      </Screen>
    </>
  );
}

/** Shaped like the form it replaces, so nothing jumps when the real one arrives. */
function SignInSkeleton() {
  return (
    <div role="status" aria-busy className="grid gap-4">
      <span className="sr-only">Loading the sign-in form</span>
      <div className="h-[104px] animate-pulse rounded-card border-2 border-line bg-card" aria-hidden />
      <div className="h-[168px] animate-pulse rounded-card border-2 border-line bg-card" aria-hidden />
      <div className="h-[232px] animate-pulse rounded-card border-2 border-line bg-card" aria-hidden />
    </div>
  );
}
