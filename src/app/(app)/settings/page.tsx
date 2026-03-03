'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock } from 'lucide-react';
import { validateWebhookUrl } from '@/lib/validate-webhook-url';

export default function SettingsPage() {
  const { user, isAdmin, loading: isLoading } = useAuth();
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [name, setName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingWebhook, setLoadingWebhook] = useState(true);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || user.user_metadata?.full_name || '');
    }
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchWebhookUrl = async () => {
      setLoadingWebhook(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'webhook_url')
        .single();

      if (data?.value) {
        const url = typeof data.value === 'string' ? data.value : data.value.url || '';
        setWebhookUrl(url);
      }
      setLoadingWebhook(false);
    };

    fetchWebhookUrl();
  }, [isAdmin]);

  const handleSaveWebhook = async () => {
    if (!isAdmin) return;

    // Allow saving empty URL (to clear the webhook)
    if (webhookUrl.trim()) {
      const validation = validateWebhookUrl(webhookUrl);
      if (!validation.valid) {
        toast({
          variant: 'destructive',
          title: 'Invalid Webhook URL',
          description: validation.error,
        });
        return;
      }
    }

    setSavingWebhook(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('settings')
        .upsert(
          { key: 'webhook_url', value: { url: webhookUrl }, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;

      toast({
        title: "Success",
        description: "Webhook URL saved successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to save webhook URL: ${error.message}`,
      });
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (newPassword && newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Passwords do not match.",
      });
      return;
    }

    setSavingProfile(true);
    try {
      const supabase = createClient();
      const updates: { data?: { name: string }; password?: string } = {};

      if (name !== (user.user_metadata?.name || '')) {
        updates.data = { name };
      }

      if (newPassword) {
        updates.password = newPassword;
      }

      if (updates.data || updates.password) {
        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update profile: ${error.message}`,
      });
    } finally {
      setSavingProfile(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and webhooks.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>Update your personal information and password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Profile
            </Button>
          </CardFooter>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Tracking Webhook</CardTitle>
              <CardDescription>
                Enter the URL to receive tracking number updates. A POST request will be sent with order details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingWebhook ? (
                <div className="flex justify-center items-center h-10">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://example.com/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveWebhook} disabled={savingWebhook}>
                {savingWebhook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Webhook
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="flex flex-col items-center justify-center text-center p-8 bg-black/30 border-red-500/20">
            <Lock className="h-8 w-8 text-red-500 mb-4" />
            <CardTitle className="text-xl">Restricted Access</CardTitle>
            <CardDescription className="mt-2">
              Webhook management is an exclusive feature for Admins only.
            </CardDescription>
          </Card>
        )}
      </div>
    </div>
  );
}
