import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import MonthSelector from '../components/MonthSelector';
import MoneyDisplay from '../components/MoneyDisplay';
import { CardSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { useBudgets, useUpsertBudget, useDeleteBudget } from '../hooks/useBudgets';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../components/Toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

function currentMonth(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

interface BudgetItem { id: string; categoryId: string; category: { id: string; name: string; icon: string; color: string }; monthYear: string; limitAmount: string; currency: string; spentAmount: string; }

function progressColor(pct: number): string {
  if (pct >= 100) return 'bg-destructive';
  if (pct >= 75) return 'bg-warning';
  return 'bg-success';
}
function progressText(pct: number): string {
  if (pct >= 100) return 'text-destructive';
  if (pct >= 75) return 'text-warning';
  return 'text-success';
}

function InlineEdit({ budget, month }: { budget: BudgetItem; month: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(budget.limitAmount);
  const inputRef = useRef<HTMLInputElement>(null);
  const upsert = useUpsertBudget();
  const { showToast } = useToast();
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const save = () => { const parsed = parseFloat(value); if (isNaN(parsed) || parsed <= 0) { setValue(budget.limitAmount); setEditing(false); return; } setEditing(false); upsert.mutate({ categoryId: budget.categoryId, monthYear: month, limitAmount: parsed.toFixed(2) }, { onError: () => { setValue(budget.limitAmount); showToast('Failed to update', 'error'); }, onSuccess: () => showToast('Budget updated') }); };
  if (editing) return <Input ref={inputRef} type="number" step="0.01" min="0.01" value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(budget.limitAmount); setEditing(false); } }} className="w-28 h-7 text-xs" />;
  return <button onClick={() => { setValue(budget.limitAmount); setEditing(true); }} className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer"><MoneyDisplay value={budget.limitAmount} currency={budget.currency} /></button>;
}

export default function BudgetManagerPage() {
  const [month, setMonth] = useState(currentMonth);
  const [showAdd, setShowAdd] = useState(false);
  const { data: budgets, isLoading } = useBudgets(month);
  const { data: categories } = useCategories();
  const upsertMutation = useUpsertBudget();
  const deleteMutation = useDeleteBudget();
  const { showToast } = useToast();
  const spent = (b: BudgetItem) => parseFloat(b.spentAmount || '0');
  const limit = (b: BudgetItem) => parseFloat(b.limitAmount || '1');
  const pct = (b: BudgetItem) => Math.round((spent(b) / limit(b)) * 100);
  const budgetedIds = new Set((budgets ?? []).map((b: BudgetItem) => b.categoryId));
  const unbudgeted = (categories ?? []).filter((c: any) => !budgetedIds.has(c.id));

  // Budget alerts — notify when budgets hit 80% or 100%
  const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!budgets?.length) return;
    const newAlerts = new Set(alertedIds);
    for (const b of budgets as BudgetItem[]) {
      const percentage = Math.round((parseFloat(b.spentAmount || '0') / parseFloat(b.limitAmount || '1')) * 100);
      const key100 = `${b.id}-100`;
      const key80 = `${b.id}-80`;
      if (percentage >= 100 && !newAlerts.has(key100)) {
        showToast(`⚠️ ${b.category.name} budget exceeded! (${percentage}%)`, 'error');
        newAlerts.add(key100);
        newAlerts.add(key80);
      } else if (percentage >= 80 && percentage < 100 && !newAlerts.has(key80)) {
        showToast(`${b.category.name} budget at ${percentage}% — approaching limit`, 'error');
        newAlerts.add(key80);
      }
    }
    if (newAlerts.size !== alertedIds.size) setAlertedIds(newAlerts);
  }, [budgets]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground mt-1">Track your spending against monthly limits</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowAdd(true)} disabled={unbudgeted.length === 0}><Plus className="h-4 w-4" /> Add Budget</Button>
          <MonthSelector value={month} onChange={setMonth} />
        </div>
      </div>

      {showAdd && (
        <Card><CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-4">Set a new budget</h3>
          <AddBudgetForm categories={unbudgeted} onSubmit={async (catId, amt) => { try { await upsertMutation.mutateAsync({ categoryId: catId, monthYear: month, limitAmount: amt }); showToast('Budget created'); setShowAdd(false); } catch { showToast('Failed to create', 'error'); } }} onCancel={() => setShowAdd(false)} saving={upsertMutation.isPending} />
        </CardContent></Card>
      )}

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}</div>
      ) : !budgets?.length && !showAdd ? (
        <EmptyState message="No budgets set for this month" icon="💰" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(budgets ?? []).map((b: BudgetItem) => {
            const percentage = pct(b);
            return (
              <Card key={b.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: b.category.color + '18' }}>{b.category.icon}</div>
                      <span className="font-medium text-sm">{b.category.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${progressText(percentage)}`}>{percentage}%</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={async () => { try { await deleteMutation.mutateAsync(b.id); showToast('Budget deleted'); } catch { showToast('Failed to delete', 'error'); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <Progress value={Math.min(percentage, 100)} className="h-2 mb-3" indicatorClassName={progressColor(percentage)} />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground"><MoneyDisplay value={b.spentAmount} currency={b.currency} /> spent</span>
                    <span>of <InlineEdit budget={b} month={month} /></span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddBudgetForm({ categories, onSubmit, onCancel, saving }: { categories: any[]; onSubmit: (catId: string, amt: string) => Promise<void>; onCancel: () => void; saving: boolean }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [limitAmount, setLimitAmount] = useState('');
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!categoryId || !limitAmount || parseFloat(limitAmount) <= 0) return; await onSubmit(categoryId, parseFloat(limitAmount).toFixed(2)); }} className="flex flex-wrap items-end gap-4">
      <div className="flex-1 min-w-[180px]"><label className="text-sm font-medium mb-1.5 block">Category</label><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"><option value="">Select…</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
      <div className="w-40"><label className="text-sm font-medium mb-1.5 block">Monthly Limit</label><Input type="number" step="0.01" min="0.01" value={limitAmount} onChange={(e) => setLimitAmount(e.target.value)} placeholder="5000.00" /></div>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add'}</Button></div>
    </form>
  );
}
