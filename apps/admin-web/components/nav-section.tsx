import type { ReactNode } from "react";

export function NavSection({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <section className="border-t border-white/10 pt-2">
      <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-white/50">{label}</p>
      <div className="grid gap-1">{children}</div>
    </section>
  );
}
