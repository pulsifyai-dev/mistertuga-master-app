'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginSchema = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const { toast } = useToast();

  const loginForm = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleLogin = async (data: LoginSchema) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: error.message,
        });
        setLoading(false);
        return;
      }

      // Full page navigation ensures middleware picks up the new session cookie
      // and redirects to the correct dashboard based on user role
      window.location.href = '/';
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your email address.' });
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        setResetSent(true);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send reset email.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500 rounded-full blur-[100px] opacity-10 z-0"></div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 flex flex-col items-center gap-2">
          <h1 className="font-headline text-5xl font-extrabold text-white">
            MisterTuga App
          </h1>
        </div>

        {mode === 'login' ? (
          <Card className="w-full max-w-md bg-neutral-800 border border-white/10 text-white shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-white">Welcome Back</CardTitle>
              <CardDescription className="text-gray-400">Enter your credentials to access your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="user@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-900 to-purple-700 hover:from-purple-800 hover:to-purple-600 transition-colors"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Login
                  </Button>
                </form>
              </Form>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setResetSent(false); setResetEmail(''); }}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Forgot your password?
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-md bg-neutral-800 border border-white/10 text-white shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-white">Reset Password</CardTitle>
              <CardDescription className="text-gray-400">
                {resetSent
                  ? 'Check your email for the reset link.'
                  : 'Enter your email and we\'ll send you a reset link.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSent ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                    <p className="text-sm text-green-300">
                      Password reset email sent to <strong>{resetEmail}</strong>. Check your inbox.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setMode('login'); setResetSent(false); }}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="reset-email" className="text-sm font-medium">Email</label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="user@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleResetPassword}
                    className="w-full bg-gradient-to-r from-purple-900 to-purple-700 hover:from-purple-800 hover:to-purple-600 transition-colors"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setMode('login')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
