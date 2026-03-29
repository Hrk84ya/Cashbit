function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} role="status" aria-label="Loading" />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-3">
      <Shimmer className="h-4 w-24" />
      <Shimmer className="h-8 w-32" />
      <Shimmer className="h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Shimmer className="h-10 w-full" />
      {Array.from({ length: rows }, (_, i) => <Shimmer key={i} className="h-12 w-full" />)}
    </div>
  );
}

export function ChartSkeleton() {
  return <Shimmer className="h-64 w-full" />;
}

export default function LoadingSkeleton({ variant = 'card' }: { variant?: 'card' | 'table' | 'chart' }) {
  switch (variant) {
    case 'table': return <TableSkeleton />;
    case 'chart': return <ChartSkeleton />;
    default: return <CardSkeleton />;
  }
}
