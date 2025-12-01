'use server';

import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/server';

const signUpSchema = z.object({
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

  const { email, password, adminCode } = validation.data;
  const adminRegistrationCode = process.env.ADMIN_REGISTRATION_CODE;

  // Default role is USER
  let role = 'USER';
  // If the admin code is provided and correct, assign ADMIN role
  if (adminRegistrationCode && adminCode === adminRegistrationCode) {
    role = 'ADMIN';
  } else if (adminCode && adminCode !== adminRegistrationCode) {
    // Optional: If you want to return an error for incorrect admin codes
    // return { error: 'Invalid Admin Code.' };
  }

  try {
    // Check if user already exists
    try {
        await adminAuth.getUserByEmail(email);
        return { error: 'An account with this email already exists.' };
    } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
            throw error; // Re-throw unexpected errors
        }
        // If user not found, continue to create user
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      emailVerified: false,
      disabled: false,
    });

    // Set custom claims for role-based access control
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // Store user information in Firestore
    await adminDb.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      role: role,
      createdAt: new Date().toISOString(),
    });

    return { role };
  } catch (error: any) {
    console.error('Error during sign up:', error);
    // Provide a more generic error to the user for security
    return { error: 'An error occurred during sign up. Please try again.' };
  }
}
