import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonthSelectorProps { value: string; onChange: (value: string) => void; }

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthSelector({ value, onChange }: MonthSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <input type="month" value={value} onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer" aria-label="Select month" />
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(shiftMonth(value, 1))} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
