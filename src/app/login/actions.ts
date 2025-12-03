'use server';

import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/server';

const signUpSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  adminCode: z.string().optional(),
});

type SignUpSchema = z.infer<typeof signUpSchema>;

export async function signUp(data: SignUpSchema): Promise<{ error?: string, role?: string }> {
  const validation = signUpSchema.safeParse(data);
  if (!validation.success) {
    return { error: 'Invalid data provided.' };
  }

  const { name, email, password, adminCode } = validation.data;
  const adminRegistrationCode = process.env.ADMIN_REGISTRATION_CODE;

  let role = 'BASIC';

  if (adminCode) {
    if (!adminRegistrationCode) {
        return { error: "Server configuration error: Admin registration is not enabled." };
    }
    if (adminCode === adminRegistrationCode) {
        role = 'ADMIN';
    } else {
        return { error: 'Invalid Admin Code.' };
    }
  }

  try {
    try {
        await adminAuth.getUserByEmail(email);
        return { error: 'An account with this email already exists.' };
    } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
            throw error;
        }
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });

    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    await adminDb.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      displayName: name,
      email: userRecord.email,
      role: role,
      createdAt: new Date().toISOString(),
    });

    return { role };
  } catch (error: any) {
    console.error('Error during sign up:', error);
    return { error: 'An error occurred during sign up. Please try again.' };
  }
}
