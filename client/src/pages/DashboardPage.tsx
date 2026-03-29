import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useSummary, useTrends } from '../hooks/useAnalytics';
import MoneyDisplay from '../components/MoneyDisplay';
import MonthSelector from '../components/MonthSelector';
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const COLORS = ['hsl(262, 83%, 58%)', 'hsl(173, 58%, 39%)', 'hsl(43, 74%, 66%)', 'hsl(27, 87%, 67%)', 'hsl(340, 75%, 55%)', 'hsl(197, 37%, 24%)', 'hsl(142, 76%, 36%)', 'hsl(0, 84%, 60%)'];

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth);
  const { data: summary, isLoading: summaryLoading } = useSummary(month);
  const trendsStart = shiftMonth(month, -5);
  const trendsEnd = shiftMonth(month, 1);
  const { data: trends, isLoading: trendsLoading } = useTrends({ startDate: `${trendsStart}-01`, endDate: `${trendsEnd}-01`, groupBy: 'month' });
  const isEmpty = summary && summary.totalIncome === '0' && summary.totalExpenses === '0';

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your financial overview at a glance</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : isEmpty ? (
        <EmptyState message="No transactions for this month" icon="📊" />
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatCard label="Total Income" value={summary.totalIncome} icon={<TrendingUp className="h-4 w-4" />} trend="up" />
            <StatCard label="Total Expenses" value={summary.totalExpenses} icon={<TrendingDown className="h-4 w-4" />} trend="down" />
            <StatCard label="Net Balance" value={summary.netBalance} icon={<Wallet className="h-4 w-4" />} trend={parseFloat(summary.netBalance) >= 0 ? 'up' : 'down'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Expenses by Category</CardTitle></CardHeader>
              <CardContent>
                {summary.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={summary.byCategory.map((c) => ({ name: c.categoryName, value: parseFloat(c.total) }))}
                        cx="50%" cy="50%" innerRadius={70} outerRadius={100} dataKey="value" paddingAngle={3} strokeWidth={0}
                        label={({ name, value }) => {
                          const total = summary.byCategory.reduce((s, x) => s + parseFloat(x.total), 0);
                          return total > 0 ? `${name} ${((value / total) * 100).toFixed(0)}%` : name;
                        }} labelLine={false}>
                        {summary.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '13px' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No expense data" icon="🍩" />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Income & Expense Trends</CardTitle></CardHeader>
              <CardContent>
                {trendsLoading ? <ChartSkeleton /> : trends && trends.trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trends.trends.map((t) => ({ period: t.period.slice(0, 7), Income: parseFloat(t.income), Expenses: parseFloat(t.expenses) }))}>
                      <defs>
                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '13px' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                      <Area type="monotone" dataKey="Income" stroke="hsl(142, 76%, 36%)" fill="url(#incomeGrad)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="Expenses" stroke="hsl(0, 84%, 60%)" fill="url(#expenseGrad)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No trend data available" icon="📈" />}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon, trend }: { label: string; value: string; icon: React.ReactNode; trend: 'up' | 'down' }) {
  const isPositive = trend === 'up';
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {icon}
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <MoneyDisplay value={value} className={`text-2xl font-bold tracking-tight ${isPositive ? 'text-foreground' : 'text-foreground'}`} />
          <span className={`inline-flex items-center text-xs font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          </span>
        </div>
        {/* Decorative gradient */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 ${isPositive ? 'bg-gradient-to-r from-success/60 to-success/0' : 'bg-gradient-to-r from-destructive/60 to-destructive/0'}`} />
      </CardContent>
    </Card>
  );
}
