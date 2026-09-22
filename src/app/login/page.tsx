import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { Wordmark } from '@/components/Wordmark';
import { enterDemo, signIn } from '@/actions/auth';
import { getSession } from '@/lib/session';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo/seed';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col justify-center bg-paper px-5 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Wordmark size="lg" />
        <h1 className="h-display mt-8">Sign in</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Your leads, quotes, crew and payments in one place.
        </p>

        <div className="card card-pad mt-6">
          <AuthForm action={signIn} submitLabel="Sign in">
            <label className="block">
              <span className="field-label">Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input input-lg"
                placeholder="you@company.com"
              />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input input-lg"
              />
            </label>
          </AuthForm>
        </div>

        <div className="card mt-4 border-dashed p-4">
          <p className="eyebrow">Try it with real data</p>
          <p className="mt-1.5 text-sm text-ink-muted">
            Ridgeline Lawn &amp; Landscape — a demo company mid-season, with 90 days of history and
            a full day of work ahead of it.
          </p>
          <form action={enterDemo} className="mt-3">
            <button type="submit" className="btn btn-secondary w-full">
              Open the demo company
            </button>
          </form>
          <p className="mt-2 text-xs text-ink-faint">
            Or sign in as <span className="font-medium text-ink-muted">{DEMO_EMAIL}</span> /{' '}
            <span className="font-medium text-ink-muted">{DEMO_PASSWORD}</span>
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          No account yet?{' '}
          <Link href="/signup" className="font-semibold text-field underline underline-offset-2">
            Start free
          </Link>
        </p>
      </div>
    </main>
  );
}
