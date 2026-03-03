'use server';

import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
  role: z.enum(['ADMIN', 'FORNECEDOR']),
  assignedCountries: z.array(z.string()),
});

export async function createUser(input: z.infer<typeof createUserSchema>) {
  // Verify caller is ADMIN
  await requireAdmin();

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { name, email, password, role, assignedCountries } = parsed.data;
  const supabase = createServiceClient();

  // 1. Create auth user with service role (bypasses email confirmation)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  // 2. Insert into public.users table
  const { error: insertError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      name,
      role,
      assigned_countries: assignedCountries,
    });

  if (insertError) {
    // Rollback: delete auth user if public.users insert fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { success: false, error: `User created in auth but failed to save profile: ${insertError.message}` };
  }

  return { success: true };
}

export async function listUsers() {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, assigned_countries, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return { success: false, users: [], error: error.message };
  }

  return { success: true, users: data || [] };
}
