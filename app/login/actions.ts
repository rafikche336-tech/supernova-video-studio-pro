'use server';

import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/lib/auth';

/** Only ever redirect to a path on this site — never to `//evil.com`. */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/studio';
  }
  return value;
}

export async function signInWithGitHub(formData: FormData): Promise<void> {
  await signIn('github', { redirectTo: safeNext(formData.get('next')) });
}

export async function signInAsGuest(formData: FormData): Promise<void> {
  await signIn('guest', { redirectTo: safeNext(formData.get('next')) });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}

export async function goToStudio(): Promise<void> {
  redirect('/studio');
}
