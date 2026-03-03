import { createClient } from './server';

/**
 * Verifies the current user's auth and role from Supabase session.
 * Used in Server Actions to replace Firebase adminAuth.verifyIdToken().
 *
 * @returns User data with role, or throws an error if unauthorized.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized: No valid session.');
  }

  const role = (user.app_metadata?.user_role as 'ADMIN' | 'FORNECEDOR') || null;
  const assignedCountries: string[] = user.app_metadata?.assigned_countries || [];

  return { user, role, assignedCountries };
}

/**
 * Verifies the current user is an ADMIN.
 * Throws if not authenticated or not an admin.
 */
export async function requireAdmin() {
  const { user, role, assignedCountries } = await requireAuth();

  if (role !== 'ADMIN') {
    throw new Error('Forbidden: Admin access required.');
  }

  return { user, role, assignedCountries };
}
