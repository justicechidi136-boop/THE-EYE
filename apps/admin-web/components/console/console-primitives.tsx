import type { ReactNode } from "react";

export function ConsolePageHeader({
  title,
  eyebrow,
  breadcrumbs,
  action,
}: {
  title: string;
  eyebrow?: string;
  breadcrumbs?: string[];
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted">
            {breadcrumbs.join(" / ")}
          </nav>
        ) : null}
        {eyebrow ? <p className="text-sm font-medium text-muted">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-bold tracking-normal text-ink">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function ConsoleMetrics({ items }: { items: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">{item.label}</p>
          <strong className="mt-2 block text-2xl text-ink">{item.value}</strong>
          {item.detail ? <span className="mt-2 block text-xs text-muted">{item.detail}</span> : null}
        </article>
      ))}
    </div>
  );
}

export function ConsoleEmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surfaceMuted px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-2 text-sm text-muted">{detail}</p> : null}
    </div>
  );
}

export function ConsoleLoadingState({ label = "Loading workspace…" }: { label?: string }) {
  return <p className="text-sm text-muted" role="status" aria-live="polite">{label}</p>;
}

export function ConsoleErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
      {message}
    </div>
  );
}

export function ConsolePagination({
  hasMore,
  nextHref,
  previousHref,
}: {
  hasMore?: boolean;
  nextHref?: string;
  previousHref?: string;
}) {
  if (!hasMore && !previousHref) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
      {previousHref ? (
        <a href={previousHref} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-accent">
          Previous
        </a>
      ) : (
        <span />
      )}
      {hasMore && nextHref ? (
        <a href={nextHref} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-accent">
          Next page
        </a>
      ) : null}
    </div>
  );
}
