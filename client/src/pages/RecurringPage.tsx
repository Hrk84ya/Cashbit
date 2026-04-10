import { useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, CalendarClock, Repeat } from 'lucide-react';
import { useRecurring, type RecurringPattern } from '../hooks/useRecurring';
import MoneyDisplay from '../components/MoneyDisplay';
import { CardSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function RecurringPage() {
  const { data: patterns, isLoading } = useRecurring();
  const isEmpty = !isLoading && (!patterns || patterns.length === 0);

  const expenses = patterns?.filter((p) => p.type === 'EXPENSE') ?? [];
  const income = patterns?.filter((p) => p.type === 'INCOME') ?? [];
  const totalMonthlyExpense = expenses
    .filter((p) => p.frequency === 'monthly')
    .reduce((sum, p) => sum + parseFloat(p.averageAmount), 0);
  const totalMonthlyIncome = income
    .filter((p) => p.frequency === 'monthly')
    .reduce((sum, p) => sum + parseFloat(p.averageAmount), 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recurring Transactions</h1>
        <p className="text-muted-foreground mt-1">
          Auto-detected subscriptions and repeating bills from the last 6 months
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isEmpty ? (
        <EmptyState
          message="No recurring patterns detected yet. Keep adding transactions and patterns will appear automatically."
          icon="🔄"
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <SummaryCard
              label="Monthly Subscriptions"
              value={totalMonthlyExpense.toFixed(2)}
              subtitle={`${expenses.filter((p) => p.frequency === 'monthly').length} detected`}
              variant="expense"
            />
            <SummaryCard
              label="Recurring Income"
              value={totalMonthlyIncome.toFixed(2)}
              subtitle={`${income.filter((p) => p.frequency === 'monthly').length} detected`}
              variant="income"
            />
            <SummaryCard
              label="Total Patterns"
              count={patterns!.length}
              subtitle="across all frequencies"
              variant="neutral"
            />
            <SummaryCard
              label="Weekly Recurring"
              count={patterns!.filter((p) => p.frequency === 'weekly').length}
              subtitle="weekly patterns"
              variant="neutral"
            />
          </div>

          {/* Expense patterns */}
          {expenses.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                Recurring Expenses
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expenses.map((p, i) => (
                  <PatternCard key={i} pattern={p} />
                ))}
              </div>
            </section>
          )}

          {/* Income patterns */}
          {income.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success" />
                Recurring Income
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {income.map((p, i) => (
                  <PatternCard key={i} pattern={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  count,
  subtitle,
  variant,
}: {
  label: string;
  value?: string;
  count?: number;
  subtitle: string;
  variant: 'expense' | 'income' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="mt-2">
          {value !== undefined ? (
            <MoneyDisplay
              value={value}
              className={`text-2xl font-bold ${variant === 'expense' ? 'text-destructive' : variant === 'income' ? 'text-success' : 'text-foreground'}`}
            />
          ) : (
            <span className="text-2xl font-bold">{count}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function PatternCard({ pattern }: { pattern: RecurringPattern }) {
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
                  <span className="text-xs text-muted-foreground">
                    {pattern.occurrences}x
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <MoneyDisplay
                value={pattern.averageAmount}
                currency={pattern.currency}
                className={`font-semibold ${pattern.type === 'EXPENSE' ? 'text-destructive' : 'text-success'}`}
              />
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
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
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Transaction History
            </p>
            <div className="space-y-1.5">
              {pattern.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{formatDate(tx.date)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {tx.paymentMethod.replace('_', ' ')}
                    </span>
                    <MoneyDisplay
                      value={tx.amount}
                      currency={pattern.currency}
                      className="font-medium tabular-nums"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
