'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserPlus, Shield, Truck, Plus, Pencil, Trash2, Eye, Mail } from 'lucide-react';
import { validateWebhookUrl } from '@/lib/validate-webhook-url';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createUser, listUsers } from './actions';
import { listEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from './email-actions';
import { TEMPLATE_PLACEHOLDERS, renderTemplate } from '@/app/(app)/exchanges/types';
import type { EmailTemplate } from '@/app/(app)/exchanges/types';
import { AdAccountsCard } from './ad-integrations/AdAccountsCard';
import { ExpenseCatalogCard } from './expense-catalog/ExpenseCatalogCard';

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

  // User management state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'FORNECEDOR'>('FORNECEDOR');
  const [newUserCountries, setNewUserCountries] = useState<string[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; name: string; role: string; assigned_countries: string[]; created_at: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const result = await listUsers();
    if (result.success) setUsers(result.users);
    setLoadingUsers(false);
  };

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    const result = await listEmailTemplates();
    if (result.success) setEmailTemplates(result.templates as EmailTemplate[]);
    setLoadingTemplates(false);
  }, []);

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateSubject('');
    setTemplateBody('');
    setIsTemplateDialogOpen(true);
  };

  const openEditTemplate = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateSubject(t.subject_template);
    setTemplateBody(t.body_template);
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateName || !templateSubject || !templateBody) {
      toast({ variant: 'destructive', title: 'Error', description: 'All fields are required.' });
      return;
    }
    setSavingTemplate(true);
    const payload = { name: templateName, subject_template: templateSubject, body_template: templateBody };
    const result = editingTemplate
      ? await updateEmailTemplate(editingTemplate.id, payload)
      : await createEmailTemplate(payload);

    if (result.success) {
      toast({ title: editingTemplate ? 'Template Updated' : 'Template Created' });
      setIsTemplateDialogOpen(false);
      fetchTemplates();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setSavingTemplate(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    const result = await deleteEmailTemplate(id);
    if (result.success) {
      toast({ title: 'Template Deleted' });
      fetchTemplates();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'All fields are required.' });
      return;
    }
    setAddingUser(true);
    try {
      const result = await createUser({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
        assignedCountries: newUserRole === 'FORNECEDOR' ? newUserCountries : ['PT', 'ES', 'DE'],
      });
      if (result.success) {
        toast({ title: 'User Created', description: `${newUserEmail} added as ${newUserRole}.` });
        setIsAddUserOpen(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('FORNECEDOR');
        setNewUserCountries([]);
        fetchUsers();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create user.' });
    } finally {
      setAddingUser(false);
    }
  };

  const toggleCountry = (code: string) => {
    setNewUserCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

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
    fetchUsers();
    fetchTemplates();
  }, [isAdmin, fetchTemplates]);

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

      {/* User Management — ADMIN only */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Add and manage platform users.</CardDescription>
            </div>
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>Create a new user account. They can log in immediately.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-user-name">Name</Label>
                    <Input id="new-user-name" placeholder="John Doe" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-email">Email</Label>
                    <Input id="new-user-email" type="email" placeholder="user@example.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-password">Password</Label>
                    <Input id="new-user-password" type="password" placeholder="Min. 6 characters" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'ADMIN' | 'FORNECEDOR')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">
                          <div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Admin</div>
                        </SelectItem>
                        <SelectItem value="FORNECEDOR">
                          <div className="flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Supplier</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUserRole === 'FORNECEDOR' && (
                    <div className="space-y-2">
                      <Label>Assigned Countries</Label>
                      <div className="flex gap-2">
                        {['PT', 'ES', 'DE'].map((code) => (
                          <Button
                            key={code}
                            type="button"
                            size="sm"
                            variant={newUserCountries.includes(code) ? 'default' : 'outline'}
                            onClick={() => toggleCountry(code)}
                            className="px-3"
                          >
                            {code}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={handleAddUser} disabled={addingUser}>
                    {addingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No users found.</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs text-purple-300">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs text-blue-300">
                          <Truck className="h-3 w-3" /> Supplier
                        </span>
                      )}
                      {u.assigned_countries?.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {u.assigned_countries.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Email Templates — ADMIN only */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" /> Email Templates
              </CardTitle>
              <CardDescription>Manage templates for exchange communications.</CardDescription>
            </div>
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openNewTemplate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Email Template'}</DialogTitle>
                  <DialogDescription>
                    Use {'{{placeholders}}'} for dynamic content.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="tmpl-name">Name</Label>
                    <Input id="tmpl-name" placeholder="e.g. Exchange Confirmation" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tmpl-subject">Subject</Label>
                    <Input id="tmpl-subject" placeholder="Re: Exchange for order {{order_number}}" value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tmpl-body">Body</Label>
                    <Textarea id="tmpl-body" placeholder="Dear {{customer_name}},&#10;&#10;Your exchange request..." className="min-h-[150px]" value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Placeholders: {TEMPLATE_PLACEHOLDERS.join(', ')}
                  </p>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSaveTemplate} disabled={savingTemplate} className="bg-purple-600 text-white hover:bg-purple-500">
                    {savingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingTemplate ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingTemplates ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : emailTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No email templates yet. Create one to start sending emails from the Exchanges page.
              </p>
            ) : (
              <div className="space-y-2">
                {emailTemplates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{t.subject_template}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewTemplate(previewTemplate?.id === t.id ? null : t)} aria-label="Preview template">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(t)} aria-label="Edit template">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => handleDeleteTemplate(t.id)} aria-label="Delete template">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {/* Preview panel */}
                {previewTemplate && (
                  <div className="rounded-lg border border-purple-500/30 bg-black/30 p-4 space-y-2 mt-3">
                    <h4 className="text-sm font-medium text-purple-400">Preview: {previewTemplate.name}</h4>
                    <p className="text-xs"><span className="text-muted-foreground">Subject:</span> {renderTemplate(previewTemplate.subject_template, { customer_name: 'John Doe', customer_email: 'john@example.com', order_number: 'PT#12345', reason: 'Wrong size', status: 'approved' })}</p>
                    <div className="rounded-md bg-black/40 p-3 text-xs whitespace-pre-wrap">
                      {renderTemplate(previewTemplate.body_template, { customer_name: 'John Doe', customer_email: 'john@example.com', order_number: 'PT#12345', reason: 'Wrong size', status: 'approved' })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Ad Integrations — ADMIN only */}
      {isAdmin && <AdAccountsCard />}
      {/* Expense Catalog — ADMIN only */}
      {isAdmin && <ExpenseCatalogCard />}
    </div>
  );
}
