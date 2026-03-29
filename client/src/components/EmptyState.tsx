export default function EmptyState({ message = 'No data to display', icon = '📭' }: { message?: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4" role="img" aria-hidden="true">{icon}</span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
