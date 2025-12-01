'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2 } from 'lucide-react';

type Webhook = {
  id: number;
  url: string;
  country: string;
};

const europeanCountries = [
    { code: "PT", name: "Portugal" },
    { code: "DE", name: "Germany" },
    { code: "ES", name: "Spain" },
    { code: "FR", name: "France" },
    { code: "IT", name: "Italy" },
    { code: "NL", name: "Netherlands" },
    { code: "BE", name: "Belgium" },
    { code: "AT", name: "Austria" },
    { code: "CH", name: "Switzerland" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    { id: new Date().getTime(), url: '', country: '' }
  ]);

  const addWebhook = () => {
    setWebhooks([...webhooks, { id: new Date().getTime(), url: '', country: '' }]);
  };

  const handleWebhookChange = (id: number, field: 'url' | 'country', value: string) => {
    setWebhooks(webhooks.map(hook => (hook.id === id ? { ...hook, [field]: value } : hook)));
  };

  const removeWebhook = (id: number) => {
    if (webhooks.length > 1) {
        setWebhooks(webhooks.filter(hook => hook.id !== id));
    }
  };

  const handleSaveWebhooks = () => {
    console.log("Saving Webhooks:", webhooks);
    // Logic to save to Firestore will be added here
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
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Manage your webhook URLs for notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="flex items-center gap-2">
                <Input
                  placeholder="https://example.com/webhook"
                  value={webhook.url}
                  onChange={(e) => handleWebhookChange(webhook.id, 'url', e.target.value)}
                  className="flex-grow"
                />
                <Select
                  value={webhook.country}
                  onValueChange={(value) => handleWebhookChange(webhook.id, 'country', value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent>
                    {europeanCountries.map(country => (
                        <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeWebhook(webhook.id)} disabled={webhooks.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addWebhook}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Another Webhook
            </Button>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveWebhooks}>Save Webhooks</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
