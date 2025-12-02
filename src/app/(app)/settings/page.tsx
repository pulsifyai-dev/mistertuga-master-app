'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!firestore) return;

    const fetchWebhookUrl = async () => {
      setLoading(true);
      const settingsRef = doc(firestore, "settings", "tracking");
      const docSnap = await getDoc(settingsRef);
      if (docSnap.exists()) {
        setWebhookUrl(docSnap.data().url || '');
      }
      setLoading(false);
    };

    fetchWebhookUrl();
  }, [firestore]);

  const handleSaveWebhook = async () => {
    if (!firestore) return;
    setSaving(true);
    try {
      const settingsRef = doc(firestore, "settings", "tracking");
      await setDoc(settingsRef, { url: webhookUrl });
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
      setSaving(false);
    }
  };
  
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
              <Input id="name" placeholder="Your name" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" placeholder="••••••••" />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label  >
              <Input id="confirm-password" type="password" placeholder="••••••••" />
            </div>
          </CardContent>
          <CardFooter>
            <Button>Save Profile</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracking Webhook</CardTitle>
            <CardDescription>
              Enter the URL to receive tracking number updates. A POST request will be sent with order details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
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
            <Button onClick={handleSaveWebhook} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Webhook
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
