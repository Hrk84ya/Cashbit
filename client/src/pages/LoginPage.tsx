import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import apiClient, { setAccessToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface FieldErrors { email?: string; password?: string; }

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(evt: FormEvent) {
    evt.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { accessToken, user } = res.data.data;
      setAccessToken(accessToken);
      login(user, accessToken);
      navigate('/', { replace: true });
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.code === 'INVALID_CREDENTIALS') setServerError('Invalid email or password');
      else if (data?.code === 'RATE_LIMITED') setServerError('Too many attempts. Please try again later.');
      else setServerError(data?.error || 'Something went wrong.');
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/70 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)]" />
        <div className="max-w-md text-primary-foreground relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg">💰</div>
            <span className="text-2xl font-bold tracking-tight">FinanceTracker</span>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">Take control of your finances</h2>
          <p className="text-primary-foreground/80 text-lg leading-relaxed">
            Track expenses, set budgets, and visualize your spending patterns — all in one beautiful dashboard.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">F</div>
            <span className="text-xl font-bold tracking-tight">FinanceTracker</span>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="px-0">
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription>Sign in to your account to continue</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {serverError && (
                <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 animate-fade-in">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{serverError}</p>
                </div>
              )}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email address</label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''} placeholder="you@example.com" />
                  {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="password" className="text-sm font-medium mb-1.5 block">Password</label>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''} placeholder="••••••••" />
                  {errors.password && <p className="mt-1.5 text-xs text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="font-medium text-primary hover:text-primary/80 transition-colors">Create one</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
