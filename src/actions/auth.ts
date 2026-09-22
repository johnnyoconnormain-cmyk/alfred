'use server';

import { redirect } from 'next/navigation';
import { mutate, one } from '@/lib/db';
import type { User } from '@/lib/db/types';
import { isValidEmail, normalizeEmail, validatePassword, verifyPassword } from '@/lib/auth';
import { createSession, destroySession } from '@/lib/session';
import { emailTaken, provisionBusiness } from '@/lib/onboarding';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemo } from '@/lib/demo/seed';

export interface FormState {
  error?: string;
  ok?: boolean;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const user = one<User>('SELECT * FROM users WHERE lower(email) = ? AND active = 1', [email]);
  // Same message either way — a login form should not confirm which emails exist.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: 'That email and password do not match.' };
  }

  await createSession(user.id);
  redirect(user.role === 'crew' ? '/crew' : '/dashboard');
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessName = String(formData.get('businessName') ?? '').trim();
  const ownerName = String(formData.get('ownerName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!businessName) return { error: 'What is the business called?' };
  if (!ownerName) return { error: 'Enter your name.' };
  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (emailTaken(email)) return { error: 'That email is already registered. Try signing in.' };

  const { user } = await mutate(() =>
    provisionBusiness({
      businessName,
      ownerName,
      email,
      password,
      phone: String(formData.get('phone') ?? '') || undefined,
      city: String(formData.get('city') ?? '') || undefined,
      state: String(formData.get('state') ?? '') || undefined,
    }),
  );

  await createSession(user.id);
  redirect('/dashboard');
}

/** One-click entry into the seeded demo tenant. Builds it on first use. */
export async function enterDemo(): Promise<void> {
  await mutate(() => seedDemo());
  const user = one<User>('SELECT * FROM users WHERE lower(email) = ?', [normalizeEmail(DEMO_EMAIL)]);
  if (!user || !verifyPassword(DEMO_PASSWORD, user.password_hash)) {
    redirect('/login?error=demo');
  }
  await createSession(user.id);
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect('/login');
}
