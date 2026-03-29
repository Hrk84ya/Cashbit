import { useState, useCallback, useRef, FormEvent } from 'react';
import { Download, Plus, Pencil, Trash2, Loader2, X, Paperclip } from 'lucide-react';
import { useTransactions, useCreateTransaction, useUpdateTransaction, useDeleteTransaction, useExportTransactions, type TransactionFilters, type CreateTransactionData, type UpdateTransactionData } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../components/Toast';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useUploadReceipt } from '../hooks/useProfile';
import MoneyDisplay from '../components/MoneyDisplay';
import { TableSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'] as const;
function formatDate(iso: string): string { return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' }); }
function toInputDate(iso: string): string { const d = new Date(iso); const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000); return ist.toISOString().slice(0, 10); }
function todayIST(): string { const now = new Date(); const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); return ist.toISOString().slice(0, 10); }

export default function TransactionListPage() {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 20, sortBy: 'date_desc' });
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<UpdateTransactionData & { id: string }>({ id: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useTransactions({ ...filters, search: search || undefined });
  const { data: categories } = useCategories();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const exportMutation = useExportTransactions();
  const uploadReceipt = useUploadReceipt();

  useKeyboardShortcuts({
    onNewTransaction: () => setShowAddForm(true),
    onSearch: () => searchRef.current?.focus(),
  });
  const transactions = data?.transactions ?? [];
  const pagination = data?.pagination;
  const isEmpty = !isLoading && transactions.length === 0;
  const categoryMap = new Map<string, { name: string; color: string }>();
  categories?.forEach((c: any) => categoryMap.set(c.id, { name: c.name, color: c.color }));
  const setFilter = useCallback((patch: Partial<TransactionFilters>) => { setFilters((prev) => ({ ...prev, ...patch, page: 1 })); }, []);
  const startEdit = (tx: any) => { setEditingId(tx.id); setEditData({ id: tx.id, amount: tx.amount, type: tx.type, categoryId: tx.categoryId, date: toInputDate(tx.date), description: tx.description ?? '', paymentMethod: tx.paymentMethod }); };
  const saveEdit = async () => { if (!editingId) return; try { await updateMutation.mutateAsync({ ...editData, id: editingId }); showToast('Transaction updated'); setEditingId(null); } catch { showToast('Failed to update', 'error'); } };
  const handleDelete = async (id: string) => { try { await deleteMutation.mutateAsync(id); showToast('Transaction deleted'); } catch { showToast('Failed to delete', 'error'); } };
  const handleExport = async () => { try { const blob = await exportMutation.mutateAsync({ type: filters.type, categoryId: filters.categoryId, startDate: filters.startDate, endDate: filters.endDate }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url); showToast('CSV exported'); } catch { showToast('Export failed', 'error'); } };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">View and manage all your transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" /> Add Transaction</Button>
          <Button variant="outline" onClick={handleExport} disabled={isEmpty || exportMutation.isPending}>
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
        </div>
      </div>

      {showAddForm && <AddTransactionModal categories={categories ?? []} onClose={() => setShowAddForm(false)}
        onSubmit={async (d) => { try { await createMutation.mutateAsync(d); showToast('Transaction added'); setShowAddForm(false); } catch { showToast('Failed to add', 'error'); } }}
        saving={createMutation.isPending} />}

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3 mb-5">
            <Input ref={searchRef} type="text" placeholder="Search description… (press /)" value={search} onChange={(e) => { setSearch(e.target.value); setFilter({}); }} className="w-48" />
            <select value={filters.type ?? ''} onChange={(e) => setFilter({ type: (e.target.value || undefined) as any })} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">All Types</option><option value="INCOME">Income</option><option value="EXPENSE">Expense</option>
            </select>
            <select value={filters.categoryId ?? ''} onChange={(e) => setFilter({ categoryId: e.target.value || undefined })} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">All Categories</option>
              {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input type="date" value={filters.startDate ?? ''} onChange={(e) => setFilter({ startDate: e.target.value || undefined })} className="w-auto" />
            <Input type="date" value={filters.endDate ?? ''} onChange={(e) => setFilter({ endDate: e.target.value || undefined })} className="w-auto" />
          </div>

          {isLoading ? <TableSkeleton rows={8} /> : isEmpty ? <EmptyState message="No transactions found" icon="💸" /> : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    {['Date', 'Description', 'Category', 'Amount', 'Type', 'Payment', 'Actions'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider ${i === 3 || i === 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y">
                    {transactions.map((tx: any) => editingId === tx.id ? (
                      <tr key={tx.id} className="bg-primary/5">
                        <td className="px-4 py-2"><Input type="date" value={editData.date ?? ''} onChange={(e) => setEditData(p => ({ ...p, date: e.target.value }))} className="h-8 text-xs" /></td>
                        <td className="px-4 py-2"><Input type="text" value={editData.description ?? ''} onChange={(e) => setEditData(p => ({ ...p, description: e.target.value }))} className="h-8 text-xs" /></td>
                        <td className="px-4 py-2"><select value={editData.categoryId ?? ''} onChange={(e) => setEditData(p => ({ ...p, categoryId: e.target.value }))} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs w-full">{categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                        <td className="px-4 py-2"><Input type="number" step="0.01" value={editData.amount ?? ''} onChange={(e) => setEditData(p => ({ ...p, amount: e.target.value }))} className="h-8 text-xs w-24 text-right" /></td>
                        <td className="px-4 py-2"><select value={editData.type ?? ''} onChange={(e) => setEditData(p => ({ ...p, type: e.target.value as any }))} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></select></td>
                        <td className="px-4 py-2"><select value={editData.paymentMethod ?? 'OTHER'} onChange={(e) => setEditData(p => ({ ...p, paymentMethod: e.target.value as any }))} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</select></td>
                        <td className="px-4 py-2 text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={saveEdit} disabled={updateMutation.isPending} className="h-7 text-xs text-success">Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">Cancel</Button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">{formatDate(tx.date)}</td>
                        <td className="px-4 py-3.5 max-w-[200px] truncate font-medium">{tx.description || '—'}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryMap.get(tx.categoryId)?.color ?? '#6B7280' }} />{tx.category?.name ?? '—'}</span></td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap font-semibold tabular-nums">
                          <MoneyDisplay value={tx.amount} currency={tx.currency} className={tx.type === 'INCOME' ? 'text-success' : 'text-destructive'} />
                        </td>
                        <td className="px-4 py-3.5"><Badge variant={tx.type === 'INCOME' ? 'income' : 'expense'}>{tx.type}</Badge></td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{tx.paymentMethod?.replace('_', ' ') ?? '—'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <label className="inline-flex">
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try { await uploadReceipt.mutateAsync({ transactionId: tx.id, file }); showToast('Receipt uploaded'); } catch { showToast('Upload failed', 'error'); }
                              e.target.value = '';
                            }} />
                            <Button size="icon" variant="ghost" className={`h-7 w-7 ${tx.receiptPath ? 'text-primary' : ''}`} asChild><span><Paperclip className="h-3.5 w-3.5" /></span></Button>
                          </label>
                          <Button size="icon" variant="ghost" onClick={() => startEdit(tx)} className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(tx.id)} className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <span className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total)</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setFilters(p => ({ ...p, page: (p.page ?? 1) - 1 }))} disabled={pagination.currentPage <= 1}>Previous</Button>
                    <Button size="sm" variant="outline" onClick={() => setFilters(p => ({ ...p, page: (p.page ?? 1) + 1 }))} disabled={!pagination.hasNextPage}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddTransactionModal({ categories, onClose, onSubmit, saving }: { categories: any[]; onClose: () => void; onSubmit: (d: CreateTransactionData) => Promise<void>; saving: boolean }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [date, setDate] = useState(todayIST());
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'>('OTHER');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => { const e: Record<string, string> = {}; if (!amount || parseFloat(amount) <= 0) e.amount = 'Enter a positive amount'; if (!categoryId) e.categoryId = 'Select a category'; if (!date) e.date = 'Select a date'; setErrors(e); return Object.keys(e).length === 0; };
  const handleSubmit = async (evt: FormEvent) => { evt.preventDefault(); if (!validate()) return; await onSubmit({ amount: parseFloat(amount).toFixed(2), type, categoryId, date, description: description || undefined, paymentMethod }); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <Card className="relative w-full max-w-lg shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-lg font-semibold">Add Transaction</h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 rounded-lg border overflow-hidden">
              <button type="button" onClick={() => setType('EXPENSE')} className={`py-2.5 text-sm font-medium transition-all ${type === 'EXPENSE' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground hover:bg-muted'}`}>Expense</button>
              <button type="button" onClick={() => setType('INCOME')} className={`py-2.5 text-sm font-medium transition-all ${type === 'INCOME' ? 'bg-success/10 text-success' : 'text-muted-foreground hover:bg-muted'}`}>Income</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium mb-1.5 block">Amount</label><Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={errors.amount ? 'border-destructive' : ''} />{errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}</div>
              <div><label className="text-sm font-medium mb-1.5 block">Date</label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={errors.date ? 'border-destructive' : ''} /></div>
            </div>
            <div><label className="text-sm font-medium mb-1.5 block">Category</label><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${errors.categoryId ? 'border-destructive' : 'border-input'}`}><option value="">Select category…</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
            <div><label className="text-sm font-medium mb-1.5 block">Description</label><Input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Grocery shopping" /></div>
            <div><label className="text-sm font-medium mb-1.5 block">Payment Method</label><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</select></div>
            <div className="flex gap-3 pt-2"><Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button><Button type="submit" disabled={saving} className="flex-1">{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Adding…</> : 'Add Transaction'}</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
