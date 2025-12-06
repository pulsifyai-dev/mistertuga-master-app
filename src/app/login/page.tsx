'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import { signUp } from './actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons/logo';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const signUpSchema = z.object({
  name: z.string().min(1, { message: 'Name is required.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
  adminCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginSchema = z.infer<typeof loginSchema>;
type SignUpSchema = z.infer<typeof signUpSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const loginForm = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpSchema>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', adminCode: '' },
  });

  const handleLogin = async (data: LoginSchema) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      await userCredential.user.getIdToken(true); 
      router.push('/'); 
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (data: SignUpSchema) => {
    setLoading(true);
    const result = await signUp(data);
    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: result.error,
      });
      setLoading(false);
    } else {
      toast({
        title: 'Sign Up Successful',
        description: 'Please log in with your new account.',
      });
      try {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        await userCredential.user.getIdToken(true);
        router.push('/'); 
      } catch(e: any) {
         toast({
          variant: 'destructive',
          title: 'Login Failed after Sign Up',
          description: e.message || 'An unexpected error occurred.',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500 rounded-full blur-[100px] opacity-10 z-0"></div>

      <div className="relative z-10 flex flex-col items-center">
        
        {/* 💡 CORREÇÃO: Removido o quadrado "MT" com gradiente. */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <h1 className="font-headline text-5xl font-extrabold text-white">
            MisterTuga App
          </h1>
        </div>
        
        <Tabs defaultValue="login" className="w-full max-w-md">
          {/* TabsList com p-1 para criar o "rail" premium */}
          <TabsList className="grid w-full grid-cols-2 bg-neutral-900/80 border border-white/10 shadow-lg rounded-xl p-1">
            <TabsTrigger 
              value="login" 
              className="data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-colors hover:bg-white/5 rounded-lg"
            >
              Login
            </TabsTrigger>
            <TabsTrigger 
              value="signup" 
              className="data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-colors hover:bg-white/5 rounded-lg"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card className="bg-neutral-800 border border-white/10 text-white shadow-lg rounded-xl mt-4">
              <CardHeader>
                {/* 'Welcome Back' em branco */}
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
                    {/* Botão com gradiente roxo mais escuro */}
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
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="signup">
            <Card className="bg-neutral-800 border border-white/10 text-white shadow-lg rounded-xl mt-4">
              <CardHeader>
                {/* 'Create an Account' em branco */}
                <CardTitle className="font-headline text-2xl text-white">Create an Account</CardTitle>
                <CardDescription className="text-gray-400">Join our platform to get started.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...signUpForm}>
                  <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                     <FormField
                      control={signUpForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="new.user@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
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
                    <FormField
                      control={signUpForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="adminCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Code (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter code if you are an admin" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Botão com gradiente roxo mais escuro */}
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-purple-900 to-purple-700 hover:from-purple-800 hover:to-purple-600 transition-colors" 
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign Up
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}