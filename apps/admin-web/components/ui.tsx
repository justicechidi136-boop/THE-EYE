import type { ReactNode } from "react";

export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-muted">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-normal text-ink">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent = "ink",
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: "ink" | "eye" | "eyeOrange";
}) {
  const accentClass = accent === "eye" ? "text-eye" : accent === "eyeOrange" ? "text-eyeOrange" : "text-ink";
  return (
    <article className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <strong className={`mt-2 block text-2xl ${accentClass}`}>{value}</strong>
      {detail ? <span className="mt-2 block text-xs text-muted">{detail}</span> : null}
    </article>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "danger" | "warning" | "success" | "info" | "neutral";
  title?: string;
}) {
  const styles = {
    danger: "border-danger/30 bg-danger/10 text-danger",
    warning: "border-warning/30 bg-warning/10 text-warning",
    success: "border-success/30 bg-success/10 text-success",
    info: "border-info/30 bg-info/10 text-info",
    neutral: "border-line bg-surfaceMuted text-muted",
  }[tone];
  return (
    <span title={title} className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${styles}`}>
      {children}
    </span>
  );
}

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {aside}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
