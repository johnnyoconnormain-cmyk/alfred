import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { Wordmark } from '@/components/Wordmark';
import { signUp } from '@/actions/auth';
import { getSession } from '@/lib/session';

export const metadata = { title: 'Start free' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  if (await getSession()) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col justify-center bg-paper px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <Wordmark size="lg" />
        <h1 className="h-display mt-8">Set up your company</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Takes about a minute. Your rate card, automations and first crew are created with the
          account — you can send a real quote straight away.
        </p>

        <div className="card card-pad mt-6">
          <AuthForm action={signUp} submitLabel="Create account">
            <label className="block">
              <span className="field-label">Business name</span>
              <input name="businessName" required className="input input-lg" placeholder="Ridgeline Lawn & Landscape" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Your name</span>
                <input name="ownerName" required className="input input-lg" placeholder="Mike Alvarez" />
              </label>
              <label className="block">
                <span className="field-label">Phone</span>
                <input name="phone" type="tel" className="input input-lg" placeholder="(724) 555-0148" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">City</span>
                <input name="city" className="input input-lg" placeholder="Wexford" />
              </label>
              <label className="block">
                <span className="field-label">State</span>
                <input name="state" maxLength={2} className="input input-lg" placeholder="PA" />
              </label>
            </div>
            <label className="block">
              <span className="field-label">Email</span>
              <input name="email" type="email" autoComplete="email" required className="input input-lg" />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="input input-lg"
              />
              <span className="mt-1 block text-xs text-ink-faint">At least 8 characters.</span>
            </label>
          </AuthForm>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already set up?{' '}
          <Link href="/login" className="font-semibold text-field underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
