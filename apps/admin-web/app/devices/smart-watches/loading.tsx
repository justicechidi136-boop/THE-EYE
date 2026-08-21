export default function SmartWatchesLoading() {
  return (
    <div role="status" aria-live="polite" className="grid gap-4 p-4 sm:p-6 lg:p-8">
      <div className="h-10 w-64 animate-pulse rounded-md bg-surfaceMuted" />
      <div className="h-24 animate-pulse rounded-lg border border-line bg-surface" />
      <div className="h-80 animate-pulse rounded-lg border border-line bg-surface" />
      <span className="sr-only">Loading smartwatch management</span>
    </div>
  );
}
