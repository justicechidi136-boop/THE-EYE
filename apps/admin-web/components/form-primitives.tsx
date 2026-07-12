import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-eye text-white hover:bg-eyeDeep",
  secondary: "border border-line bg-surface text-ink hover:bg-surfaceMuted",
  danger: "border border-danger/30 bg-surface text-danger hover:bg-danger/10",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye disabled:cursor-not-allowed disabled:opacity-60 ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FormField({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <label className="grid gap-2 text-sm font-medium text-ink" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {hint ? (
        <span id={hintId} className="text-xs font-normal text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" className="text-xs font-normal text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const fieldClassName =
  "h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors focus-visible:border-eye focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-eye/30 disabled:cursor-not-allowed disabled:opacity-60";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={fieldClassName} {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={fieldClassName} {...props} />;
}

export function InlineAlert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "info" | "success" | "warning";
}) {
  const styles = {
    error: "border-danger/30 bg-danger/10 text-danger",
    info: "border-info/30 bg-info/10 text-info",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
  }[tone];

  return (
    <p role="alert" className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surfaceMuted px-4 py-8 text-center">
      <img src="/brand/the-eye-logomark-transparent.png" alt="" aria-hidden="true" className="mx-auto mb-3 h-10 w-auto opacity-80" />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
    </div>
  );
}

export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-sm text-muted" role="status" aria-live="polite">
      <img src="/brand/the-eye-logomark-transparent.png" alt="" aria-hidden="true" className="h-8 w-auto opacity-80" />
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-eye"
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function TableScrollHint() {
  return <p className="mb-3 text-xs text-muted lg:hidden">Swipe horizontally to view all table columns.</p>;
}
