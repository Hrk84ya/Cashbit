import { useState, FormEvent } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useReorderCategories } from '../hooks/useCategories';
import { useToast } from '../components/Toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULT_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6b7280'];
const ICON_OPTIONS = ['🍔', '🚗', '🏠', '💊', '🎬', '🛒', '💰', '📦', '✈️', '📚', '🎮', '🏋️', '🎵', '☕', '🐾', '💡'];

interface CategoryItem { id: string; name: string; icon: string; color: string; isDefault: boolean; userId: string | null; sortOrder: number; }

function SortableCategoryCard({ cat, onEdit, onDelete }: { cat: CategoryItem; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="group">
        <CardContent className="p-4 flex items-center gap-3">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none">
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: cat.color + '18' }}>{cat.icon}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{cat.name}</p><p className="text-xs text-muted-foreground">{cat.isDefault ? 'Default' : 'Custom'}</p></div>
          {!cat.isDefault && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" onClick={onEdit} className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={onDelete} className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
          <div className="w-3 h-3 rounded-full shrink-0 ring-2 ring-background" style={{ backgroundColor: cat.color }} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const reorderMutation = useReorderCategories();
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const allCats = (categories ?? []) as CategoryItem[];
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = allCats.findIndex(c => c.id === active.id);
    const newIndex = allCats.findIndex(c => c.id === over.id);
    const reordered = arrayMove(allCats, oldIndex, newIndex);
    reorderMutation.mutate(reordered.map(c => c.id));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1">Drag to reorder. Manage how you classify transactions.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> New Category</Button>
      </div>

      {showAdd && <CategoryForm onSubmit={async (d) => { try { await createMutation.mutateAsync(d); showToast('Category created'); setShowAdd(false); } catch (e: any) { showToast(e.response?.data?.error || 'Failed', 'error'); } }} onCancel={() => setShowAdd(false)} saving={createMutation.isPending} />}

      {isLoading ? <div className="grid gap-3">{Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}</div> : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allCats.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3">
              {allCats.map((cat) => editingId === cat.id ? (
                <CategoryForm key={cat.id} initial={cat} onSubmit={async (d) => { try { await updateMutation.mutateAsync({ id: cat.id, ...d }); showToast('Updated'); setEditingId(null); } catch (e: any) { showToast(e.response?.data?.error || 'Failed', 'error'); } }} onCancel={() => setEditingId(null)} saving={updateMutation.isPending} />
              ) : (
                <SortableCategoryCard key={cat.id} cat={cat} onEdit={() => setEditingId(cat.id)}
                  onDelete={async () => { try { await deleteMutation.mutateAsync(cat.id); showToast('Deleted'); } catch (e: any) { showToast(e.response?.data?.error || 'Failed', 'error'); } }} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function CategoryForm({ initial, onSubmit, onCancel, saving }: { initial?: { name: string; icon: string; color: string }; onSubmit: (d: { name: string; icon: string; color: string }) => Promise<void>; onCancel: () => void; saving: boolean }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '📦');
  const [color, setColor] = useState(initial?.color ?? '#8b5cf6');
  return (
    <Card><CardContent className="p-5">
      <form onSubmit={async (e: FormEvent) => { e.preventDefault(); if (!name.trim()) return; await onSubmit({ name: name.trim(), icon, color }); }} className="space-y-4">
        <div><label className="text-sm font-medium mb-1.5 block">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Subscriptions" /></div>
        <div><label className="text-sm font-medium mb-1.5 block">Icon</label><div className="flex flex-wrap gap-2">{ICON_OPTIONS.map((ic) => <button key={ic} type="button" onClick={() => setIcon(ic)} className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${icon === ic ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted'}`}>{ic}</button>)}</div></div>
        <div><label className="text-sm font-medium mb-1.5 block">Color</label><div className="flex flex-wrap gap-2">{DEFAULT_COLORS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />)}<input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded-full cursor-pointer border-0 p-0" /></div></div>
        <div className="flex gap-3 pt-1"><Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button><Button type="submit" disabled={saving} className="flex-1">{saving ? 'Saving…' : (initial ? 'Update' : 'Create')}</Button></div>
      </form>
    </CardContent></Card>
  );
}
