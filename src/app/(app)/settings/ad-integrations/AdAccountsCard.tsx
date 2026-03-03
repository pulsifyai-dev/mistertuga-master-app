'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  listAdAccounts,
  createAdAccount,
  deleteAdAccount,
  toggleAdAccount,
  testAdAccountConnection,
  syncAdAccountSpend,
  type AdAccount,
} from '../ad-actions';
import type { AdPlatform } from '@/lib/ad-clients';

const PLATFORM_LABELS: Record<AdPlatform, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
};

const PLATFORM_COLORS: Record<AdPlatform, string> = {
  google_ads: 'text-blue-400',
  meta_ads: 'text-indigo-400',
};

export function AdAccountsCard() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState<AdPlatform>('meta_ads');
  const [newAccountId, setNewAccountId] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    const result = await listAdAccounts();
    if (result.success) setAccounts(result.accounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAccounts();
    else setLoading(false);
  }, [isAdmin, fetchAccounts]);

  const handleAdd = async () => {
    if (!newAccountId.trim()) return;
    setSaving(true);
    const result = await createAdAccount({
      platform: newPlatform,
      account_id: newAccountId.trim(),
      account_name: newName.trim() || undefined,
    });
    if (result.success) {
      toast({ title: 'Ad account added' });
      setAddOpen(false);
      setNewAccountId('');
      setNewName('');
      fetchAccounts();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this ad account? All associated spend data will be permanently removed.')) return;
    const result = await deleteAdAccount(id);
    if (result.success) {
      toast({ title: 'Ad account removed' });
      fetchAccounts();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await toggleAdAccount(id, active);
    fetchAccounts();
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    const result = await testAdAccountConnection(id);
    if (result.success) {
      toast({ title: 'Connection successful' });
    } else {
      toast({ title: 'Connection failed', description: result.error, variant: 'destructive' });
    }
    setTesting(null);
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    const result = await syncAdAccountSpend(id);
    if (result.success) {
      toast({ title: `Synced ${result.synced} days of spend data` });
      fetchAccounts();
    } else {
      toast({ title: 'Sync failed', description: result.error, variant: 'destructive' });
    }
    setSyncing(null);
  };

  if (!isAdmin) return null;

  return (
    <Card className="border-white/10 bg-black/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              Ad Integrations
            </CardTitle>
            <CardDescription>Connect Google Ads and Meta Ads to track ad spend.</CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-purple-600 text-white hover:bg-purple-500">
                <Plus className="h-4 w-4 mr-1" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Ad Account</DialogTitle>
                <DialogDescription>
                  API tokens must be set as environment variables. Only the account ID is stored here.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={newPlatform} onValueChange={(v) => setNewPlatform(v as AdPlatform)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google_ads">Google Ads</SelectItem>
                      <SelectItem value="meta_ads">Meta Ads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-id">Account ID</Label>
                  <Input
                    id="account-id"
                    placeholder={newPlatform === 'meta_ads' ? 'e.g. 123456789' : 'e.g. 123-456-7890'}
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-name">Display Name (optional)</Label>
                  <Input
                    id="account-name"
                    placeholder="e.g. MisterTuga PT"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={saving || !newAccountId.trim()} className="bg-purple-600 text-white hover:bg-purple-500">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No ad accounts configured. Add one to start tracking ad spend.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acct) => (
              <div
                key={acct.id}
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${PLATFORM_COLORS[acct.platform]}`}>
                      {PLATFORM_LABELS[acct.platform]}
                    </span>
                    <span className="text-xs text-muted-foreground">{acct.account_id}</span>
                    {acct.account_name && (
                      <Badge variant="outline" className="text-[10px] h-5">{acct.account_name}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {acct.last_sync_at ? (
                      <>
                        <span>Last sync: {new Date(acct.last_sync_at).toLocaleDateString()}</span>
                        {acct.last_sync_status === 'success' && (
                          <Wifi className="h-3 w-3 text-green-400" />
                        )}
                        {acct.last_sync_status === 'error' && (
                          <WifiOff className="h-3 w-3 text-red-400" />
                        )}
                        {acct.last_sync_status === 'pending' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      </>
                    ) : (
                      <span>Never synced</span>
                    )}
                    {acct.last_sync_error && (
                      <span className="text-red-400 truncate max-w-[200px]">{acct.last_sync_error}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={acct.is_active}
                    onCheckedChange={(v) => handleToggle(acct.id, v)}
                    className="mr-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-blue-500/20"
                    onClick={() => handleTest(acct.id)}
                    disabled={testing === acct.id}
                    title="Test connection"
                  >
                    {testing === acct.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-purple-500/20"
                    onClick={() => handleSync(acct.id)}
                    disabled={syncing === acct.id}
                    title="Sync now"
                  >
                    {syncing === acct.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                    onClick={() => handleDelete(acct.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          API tokens are read from environment variables (GOOGLE_ADS_*, META_ADS_*). They are never stored in the database.
        </p>
      </CardContent>
    </Card>
  );
}
