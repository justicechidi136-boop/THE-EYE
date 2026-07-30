import Link from "next/link";

export function QuickLinkCard({
  href,
  title,
  description,
}: Readonly<{ href: string; title: string; description?: string }>) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-line bg-surfaceMuted px-4 py-3 transition-colors hover:border-eye hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye"
    >
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
    </Link>
  );
}
