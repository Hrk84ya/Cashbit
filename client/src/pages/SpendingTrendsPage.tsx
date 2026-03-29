import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTrends } from '../hooks/useAnalytics';
import { useCategories } from '../hooks/useCategories';
import { ChartSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function defaultRange() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function SpendingTrendsPage() {
  const defaults = defaultRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('month');
  const [categoryId, setCategoryId] = useState('');
  const { data: categories } = useCategories();
  const { data: trends, isLoading } = useTrends({ startDate, endDate, groupBy, categoryId: categoryId || undefined });
  const chartData = trends?.trends.map((t) => ({ period: groupBy === 'month' ? t.period.slice(0, 7) : t.period.slice(0, 10), Income: parseFloat(t.income), Expenses: parseFloat(t.expenses) })) ?? [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Spending Trends</h1>
        <p className="text-muted-foreground mt-1">Analyze your financial patterns over time</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-4">
            <div><label className="text-sm font-medium mb-1.5 block">Start Date</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1.5 block">End Date</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1.5 block">Group By</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"><option value="month">Month</option><option value="week">Week</option></select>
            </div>
            <div><label className="text-sm font-medium mb-1.5 block">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"><option value="">All Categories</option>{categories?.map((cat) => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}</select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <ChartSkeleton /> : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '13px' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Income" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expenses" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No trend data for the selected range" icon="📊" />}
        </CardContent>
      </Card>
    </div>
  );
}
