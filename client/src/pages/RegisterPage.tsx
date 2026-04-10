import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Check } from 'lucide-react';
import apiClient, { setAccessToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface FieldErrors { name?: string; email?: string; password?: string; categories?: string; }
interface CategoryPreset { name: string; icon: string; color: string; }

export default function RegisterPage() {
  const [step, setStep] = useState<'info' | 'categories'>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<CategoryPreset[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.get('/auth/categories').then((res) => {
      const cats = res.data.data as CategoryPreset[];
      setAvailableCategories(cats);
      setSelectedCategories(cats.map((c) => c.name));
    }).catch(() => {});
  }, []);

  function validateInfo(): boolean {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleInfoNext(evt: FormEvent) {
    evt.preventDefault();
    if (!validateInfo()) return;
    setStep('categories');
  }

  function toggleCategory(catName: string) {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  }

  async function handleSubmit() {
    if (selectedCategories.length === 0) {
      setErrors({ categories: 'Select at least one category' });
      return;
    }
    setErrors({});
    setServerError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/register', {
        email, name, password, categories: selectedCategories,
      });
      const { accessToken, user } = res.data.data;
      setAccessToken(accessToken);
      login(user, accessToken);
      navigate('/', { replace: true });
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.code === 'DUPLICATE_EMAIL') setServerError('An account with this email already exists');
      else if (data?.code === 'RATE_LIMITED') setServerError('Too many attempts. Please try again later.');
      else setServerError(data?.error || 'Something went wrong.');
      setStep('info');
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/70 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="max-w-md text-primary-foreground relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg">💰</div>
            <span className="text-2xl font-bold tracking-tight">Swipe</span>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">Start your financial journey</h2>
          <p className="text-primary-foreground/80 text-lg leading-relaxed">
            Join thousands of users who manage their money smarter with powerful insights and budgeting tools.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">S</div>
            <span className="text-xl font-bold tracking-tight">Swipe</span>
          </div>

          {step === 'info' ? (
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0">
                <CardTitle className="text-2xl">Create your account</CardTitle>
                <CardDescription>Get started in under a minute</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {serverError && (
                  <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 animate-fade-in">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{serverError}</p>
                  </div>
                )}
                <form onSubmit={handleInfoNext} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="name" className="text-sm font-medium mb-1.5 block">Full name</label>
                    <Input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={errors.name ? 'border-destructive' : ''} />
                    {errors.name && <p className="mt-1.5 text-xs text-destructive">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email address</label>
                    <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={errors.email ? 'border-destructive' : ''} />
                    {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>}
                  </div>
                  <div>
                    <label htmlFor="password" className="text-sm font-medium mb-1.5 block">Password</label>
                    <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" className={errors.password ? 'border-destructive' : ''} />
                    {errors.password && <p className="mt-1.5 text-xs text-destructive">{errors.password}</p>}
                  </div>
                  <Button type="submit" className="w-full">Continue</Button>
                </form>
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">Sign in</Link>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-none bg-transparent">
              <CardHeader className="px-0">
                <CardTitle className="text-2xl">Pick your categories</CardTitle>
                <CardDescription>Choose the ones that fit your spending. You can always add more later.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {errors.categories && (
                  <div className="mb-4 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 animate-fade-in">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{errors.categories}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {availableCategories.map((cat) => {
                    const selected = selectedCategories.includes(cat.name);
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => toggleCategory(cat.name)}
                        className={`flex items-center gap-2.5 rounded-lg border p-3 text-left text-sm font-medium transition-all ${
                          selected
                            ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/30'
                            : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50'
                        }`}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <span className="flex-1 truncate">{cat.name}</span>
                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('info')} className="flex-1">Back</Button>
                  <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? 'Creating…' : 'Create account'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
