'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/actions/auth';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
      {pending ? 'One moment…' : label}
    </button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state.error ? (
        <p
          role="alert"
          className="rounded border border-status-critical/25 bg-[#fbeceb] px-3 py-2 text-sm text-status-critical"
        >
          {state.error}
        </p>
      ) : null}
      <Submit label={submitLabel} />
    </form>
  );
}
