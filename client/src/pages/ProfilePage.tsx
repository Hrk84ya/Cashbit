import { useState } from 'react';
import { User, Lock, Globe, Keyboard } from 'lucide-react';
import { useProfile, useUpdateProfile, useChangePassword, useChangeCurrency } from '../hooks/useProfile';
import { useToast } from '../components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardSkeleton } from '../components/LoadingSkeleton';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'];
const TIMEZONES = ['Asia/Kolkata', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'];

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const changeCurrency = useChangeCurrency();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [nameInit, setNameInit] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const [newCurrency, setNewCurrency] = useState('');
  const [convRate, setConvRate] = useState('');

  // Initialize form values when profile loads
  if (profile && !nameInit) {
    setName(profile.name);
    setTimezone(profile.timezone);
    setNewCurrency(profile.preferredCurrency);
    setNameInit(true);
  }

  if (isLoading) return <div className="space-y-6"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /><CardTitle className="text-base">Profile</CardTitle></div>
          <CardDescription>Update your name and timezone</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><label className="text-sm font-medium mb-1.5 block">Email</label><Input value={profile?.email ?? ''} disabled className="bg-muted" /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <Button onClick={async () => { try { await updateProfile.mutateAsync({ name, timezone }); showToast('Profile updated'); } catch { showToast('Failed to update', 'error'); } }}
            disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /><CardTitle className="text-base">Password</CardTitle></div>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><label className="text-sm font-medium mb-1.5 block">Current Password</label><Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} /></div>
          <div><label className="text-sm font-medium mb-1.5 block">New Password (min 8 chars)</label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
          <Button onClick={async () => {
            if (newPw.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
            try { await changePassword.mutateAsync({ currentPassword: currentPw, newPassword: newPw }); showToast('Password changed'); setCurrentPw(''); setNewPw(''); }
            catch (e: any) { showToast(e.response?.data?.error || 'Failed', 'error'); }
          }} disabled={changePassword.isPending || !currentPw || !newPw}>
            {changePassword.isPending ? 'Changing…' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /><CardTitle className="text-base">Currency</CardTitle></div>
          <CardDescription>Change your preferred currency. All existing transactions and budgets will be converted using the rate you provide.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">Current: <span className="font-semibold text-foreground">{profile?.preferredCurrency}</span></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1.5 block">New Currency</label>
              <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium mb-1.5 block">Conversion Rate</label>
              <Input type="number" step="0.0001" min="0.0001" value={convRate} onChange={(e) => setConvRate(e.target.value)} placeholder={`1 ${profile?.preferredCurrency} = ? ${newCurrency}`} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Example: If converting INR to USD and 1 INR = 0.012 USD, enter 0.012</p>
          <Button variant="destructive" onClick={async () => {
            const rate = parseFloat(convRate);
            if (!rate || rate <= 0) { showToast('Enter a valid conversion rate', 'error'); return; }
            if (newCurrency === profile?.preferredCurrency) { showToast('Same currency selected', 'error'); return; }
            try { await changeCurrency.mutateAsync({ currency: newCurrency, conversionRate: rate }); showToast(`Converted to ${newCurrency}`); setConvRate(''); }
            catch (e: any) { showToast(e.response?.data?.error || 'Failed', 'error'); }
          }} disabled={changeCurrency.isPending || !convRate || newCurrency === profile?.preferredCurrency}>
            {changeCurrency.isPending ? 'Converting…' : 'Convert All Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Keyboard className="h-5 w-5 text-primary" /><CardTitle className="text-base">Keyboard Shortcuts</CardTitle></div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[['n', 'New transaction'], ['/', 'Focus search'], ['d', 'Go to Dashboard'], ['t', 'Go to Transactions'], ['b', 'Go to Budgets'], ['Esc', 'Close dialog']].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="inline-flex items-center justify-center h-7 min-w-[28px] px-2 rounded-md border bg-muted text-xs font-mono font-medium">{key}</kbd>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
