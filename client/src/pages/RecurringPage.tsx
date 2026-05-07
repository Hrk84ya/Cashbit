import { useState } from 'react';
import {
  RefreshCw, ChevronDown, ChevronUp, CalendarClock, Repeat,
  Plus, Pause, Play, SkipForward, Trash2, Check, X, Edit2,
} from 'lucide-react';
import { useRecurring, type RecurringPattern } from '../hooks/useRecurring';
import {
  useRecurringRules, useCreateRule, useUpdateRule, useDeleteRule,
  useSkipNext, usePendingTransactions, useConfirmTransaction,
  useDismissTransaction, useConfirmAllPending, useGeneratePending,
  type RecurringRule, type CreateRuleData,
} from '../hooks/useRecurringRules';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../components/Toast';
import MoneyDisplay from '../components/MoneyDisplay';
import { CardSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateInput(iso: string): string {
  return new Date(iso).toISOString().split('T')[0];
}

type TabType = 'rules' | 'detected' | 'pending';

export default function RecurringPage() {
  const [tab, setTab] = useState<TabType>('rules');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmPatternData, setConfirmPatternData] = useState<Partial<CreateRuleData> | null>(null);

  const { data: rules, isLoading: rulesLoading } = useRecurringRules();
  const { data: patterns, isLoading: patternsLoading } = useRecurring();
  const { data: pending, isLoading: pendingLoading } = usePendingTransactions();
  const generatePending = useGeneratePending();

  const activeRules = rules?.filter((r) => r.status === 'ACTIVE') ?? [];
  const pausedRules = rules?.filter((r) => r.status === 'PAUSED') ?? [];
  const pendingCount = pending?.length ?? 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring Transactions</h1>
          <p className="text-muted-foreground mt-1">
            Manage subscriptions, automate repeating bills, and confirm pending entries
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generatePending.mutate()}
            disabled={generatePending.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${generatePending.isPending ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button size="sm" onClick={() => { setShowCreateForm(true); setConfirmPatternData(null); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <TabButton active={tab === 'rules'} onClick={() => setTab('rules')}>
          Rules {rules && `(${rules.length})`}
        </TabButton>
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pending {pendingCount > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{pendingCount}</Badge>}
        </TabButton>
        <TabButton active={tab === 'detected'} onClick={() => setTab('detected')}>
          Detected
        </TabButton>
      </div>

      {/* Create/Edit Form Modal */}
      {(showCreateForm || confirmPatternData) && (
        <RuleForm
          initialData={confirmPatternData ?? undefined}
          onClose={() => { setShowCreateForm(false); setConfirmPatternData(null); }}
        />
      )}

      {/* Tab Content */}
      {tab === 'rules' && (
        <RulesTab
          activeRules={activeRules}
          pausedRules={pausedRules}
          isLoading={rulesLoading}
        />
      )}

      {tab === 'pending' && (
        <PendingTab pending={pending ?? []} isLoading={pendingLoading} />
      )}

      {tab === 'detected' && (
        <DetectedTab
          patterns={patterns ?? []}
          isLoading={patternsLoading}
          onConfirm={(pattern) => {
            setConfirmPatternData({
              description: pattern.description,
              amount: pattern.averageAmount,
              type: pattern.type,
              categoryId: pattern.categoryId,
              frequency: pattern.frequency === 'monthly' ? 'MONTHLY' : 'WEEKLY',
              startDate: formatDateInput(pattern.lastDate),
            });
          }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Rules Tab ───────────────────────────────────────────────────────────────

function RulesTab({ activeRules, pausedRules, isLoading }: {
  activeRules: RecurringRule[];
  pausedRules: RecurringRule[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><CardSkeleton /><CardSkeleton /></div>;
  }

  if (activeRules.length === 0 && pausedRules.length === 0) {
    return <EmptyState message="No recurring rules yet. Create one or confirm a detected pattern." icon="🔄" />;
  }

  return (
    <div className="space-y-6">
      {activeRules.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success" />
            Active Rules ({activeRules.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRules.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
          </div>
        </section>
      )}

      {pausedRules.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            Paused Rules ({pausedRules.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pausedRules.map((rule) => <RuleCard key={rule.id} rule={rule} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function RuleCard({ rule }: { rule: RecurringRule }) {
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const skipNext = useSkipNext();
  const { showToast } = useToast();
  const isPaused = rule.status === 'PAUSED';

  const handleToggleStatus = () => {
    const newStatus = isPaused ? 'ACTIVE' : 'PAUSED';
    updateRule.mutate({ id: rule.id, status: newStatus }, {
      onSuccess: () => showToast(`Rule ${newStatus === 'ACTIVE' ? 'resumed' : 'paused'}`),
      onError: () => showToast('Failed to update rule', 'error'),
    });
  };

  const handleSkip = () => {
    skipNext.mutate(rule.id, {
      onSuccess: () => showToast('Next occurrence skipped'),
      onError: () => showToast('Failed to skip', 'error'),
    });
  };

  const handleDelete = () => {
    if (confirm('Delete this recurring rule? This cannot be undone.')) {
      deleteRule.mutate(rule.id, {
        onSuccess: () => showToast('Rule deleted'),
        onError: () => showToast('Failed to delete rule', 'error'),
      });
    }
  };

  return (
    <Card className={isPaused ? 'opacity-60' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: rule.category.color + '20', color: rule.category.color }}
            >
              {rule.category.icon}
            </span>
            <div className="min-w-0">
              <p className="font-medium truncate">{rule.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{rule.category.name}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  <Repeat className="h-2.5 w-2.5 mr-0.5" />
                  {rule.frequency.toLowerCase()}
                </Badge>
                {isPaused && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Paused</Badge>}
              </div>
            </div>
          </div>
          <MoneyDisplay
            value={rule.amount}
            currency={rule.currency}
            className={`font-semibold shrink-0 ${rule.type === 'EXPENSE' ? 'text-destructive' : 'text-success'}`}
          />
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            Next: {formatDate(rule.nextDueDate)}
          </span>
          {rule.endDate && (
            <span className="flex items-center gap-1">
              Ends: {formatDate(rule.endDate)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t">
          <Button variant="ghost" size="sm" onClick={handleToggleStatus} disabled={updateRule.isPending}>
            {isPaused ? <Play className="h-3.5 w-3.5 mr-1" /> : <Pause className="h-3.5 w-3.5 mr-1" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          {!isPaused && (
            <Button variant="ghost" size="sm" onClick={handleSkip} disabled={skipNext.isPending}>
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              Skip Next
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleteRule.isPending} className="text-destructive hover:text-destructive ml-auto">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Pending Tab ─────────────────────────────────────────────────────────────

function PendingTab({ pending, isLoading }: { pending: any[]; isLoading: boolean }) {
  const confirmTx = useConfirmTransaction();
  const dismissTx = useDismissTransaction();
  const confirmAll = useConfirmAllPending();
  const { showToast } = useToast();

  if (isLoading) {
    return <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>;
  }

  if (pending.length === 0) {
    return <EmptyState message="No pending transactions. All caught up!" icon="✅" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pending.length} transaction{pending.length !== 1 ? 's' : ''} awaiting confirmation
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => confirmAll.mutate(undefined, {
            onSuccess: (data) => showToast(`${data.confirmed} transactions confirmed`),
            onError: () => showToast('Failed to confirm all', 'error'),
          })}
          disabled={confirmAll.isPending}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Confirm All
        </Button>
      </div>

      <div className="space-y-2">
        {pending.map((tx) => (
          <Card key={tx.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: tx.category.color + '20', color: tx.category.color }}
                >
                  {tx.category.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description || tx.category.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Auto-generated
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <MoneyDisplay
                  value={tx.amount}
                  currency={tx.currency}
                  className={`font-semibold text-sm ${tx.type === 'EXPENSE' ? 'text-destructive' : 'text-success'}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-success hover:text-success"
                  onClick={() => confirmTx.mutate(tx.id, {
                    onSuccess: () => showToast('Transaction confirmed'),
                    onError: () => showToast('Failed to confirm', 'error'),
                  })}
                  disabled={confirmTx.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => dismissTx.mutate(tx.id, {
                    onSuccess: () => showToast('Transaction dismissed'),
                    onError: () => showToast('Failed to dismiss', 'error'),
                  })}
                  disabled={dismissTx.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Detected Tab ────────────────────────────────────────────────────────────

function DetectedTab({ patterns, isLoading, onConfirm }: {
  patterns: RecurringPattern[];
  isLoading: boolean;
  onConfirm: (pattern: RecurringPattern) => void;
}) {
  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><CardSkeleton /><CardSkeleton /></div>;
  }

  if (patterns.length === 0) {
    return <EmptyState message="No recurring patterns detected yet. Keep adding transactions and patterns will appear automatically." icon="🔍" />;
  }

  const expenses = patterns.filter((p) => p.type === 'EXPENSE');
  const income = patterns.filter((p) => p.type === 'INCOME');

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        These patterns were auto-detected from your last 6 months of transactions. Click "Create Rule" to automate them.
      </p>

      {expenses.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            Recurring Expenses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expenses.map((p, i) => <DetectedPatternCard key={i} pattern={p} onConfirm={onConfirm} />)}
          </div>
        </section>
      )}

      {income.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success" />
            Recurring Income
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {income.map((p, i) => <DetectedPatternCard key={i} pattern={p} onConfirm={onConfirm} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function DetectedPatternCard({ pattern, onConfirm }: { pattern: RecurringPattern; onConfirm: (p: RecurringPattern) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full text-left p-5 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: pattern.categoryColor + '20', color: pattern.categoryColor }}
              >
                {pattern.categoryIcon}
              </span>
              <div className="min-w-0">
                <p className="font-medium truncate">{pattern.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{pattern.categoryName}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    <Repeat className="h-2.5 w-2.5 mr-0.5" />
                    {pattern.frequency}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{pattern.occurrences}x</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <MoneyDisplay
                value={pattern.averageAmount}
                currency={pattern.currency}
                className={`font-semibold ${pattern.type === 'EXPENSE' ? 'text-destructive' : 'text-success'}`}
              />
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Last: {formatDate(pattern.lastDate)}
            </span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Next expected: {formatDate(pattern.nextExpectedDate)}
            </span>
          </div>
        </button>

        {expanded && (
          <div className="border-t px-5 py-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">Transaction History</p>
            <div className="space-y-1.5 mb-3">
              {pattern.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{formatDate(tx.date)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{tx.paymentMethod.replace('_', ' ')}</span>
                    <MoneyDisplay value={tx.amount} currency={pattern.currency} className="font-medium tabular-nums" />
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onConfirm(pattern); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Rule
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Rule Form ───────────────────────────────────────────────────────────────

function RuleForm({ initialData, onClose }: { initialData?: Partial<CreateRuleData>; onClose: () => void }) {
  const { data: categories } = useCategories();
  const createRule = useCreateRule();
  const { showToast } = useToast();

  const [form, setForm] = useState<CreateRuleData>({
    description: initialData?.description ?? '',
    amount: initialData?.amount ?? '',
    type: initialData?.type ?? 'EXPENSE',
    categoryId: initialData?.categoryId ?? '',
    frequency: initialData?.frequency ?? 'MONTHLY',
    paymentMethod: initialData?.paymentMethod,
    startDate: initialData?.startDate ?? new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateRuleData = {
      ...form,
      endDate: form.endDate || undefined,
    };
    createRule.mutate(payload, {
      onSuccess: () => {
        showToast('Recurring rule created');
        onClose();
      },
      onError: () => showToast('Failed to create rule', 'error'),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {initialData ? 'Create Rule from Pattern' : 'New Recurring Rule'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g., Netflix subscription"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as 'INCOME' | 'EXPENSE' })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="">Select category</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Frequency</label>
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value as 'WEEKLY' | 'MONTHLY' })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Payment Method</label>
            <select
              value={form.paymentMethod ?? 'OTHER'}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="OTHER">Other</option>
              <option value="CARD">Card</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Start Date</label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">End Date (optional)</label>
            <Input
              type="date"
              value={form.endDate ?? ''}
              onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
            />
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createRule.isPending}>
              {createRule.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
