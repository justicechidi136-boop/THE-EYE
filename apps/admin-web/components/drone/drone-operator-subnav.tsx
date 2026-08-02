"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type OperatorSubnavProps = {
  id: string;
  canReadDocuments?: boolean;
  canReadSafety?: boolean;
  canReadAudit?: boolean;
};

const baseItems = [
  { label: "Overview", slug: "", exact: true },
  { label: "Edit", slug: "edit" },
  { label: "Qualifications", slug: "qualifications" },
  { label: "Missions", slug: "missions" },
] as const;

function linkClass(active: boolean) {
  return `rounded-md px-3 py-2 text-sm transition-colors ${
    active ? "bg-eye/10 font-semibold text-eye" : "text-muted hover:bg-surfaceMuted hover:text-ink"
  }`;
}

export function DroneOperatorSubnav({ id, canReadDocuments = false, canReadSafety = false, canReadAudit = false }: OperatorSubnavProps) {
  const pathname = usePathname();
  const prefix = `/drone-surveillance/operators/${encodeURIComponent(id)}`;
  const items = [
    ...baseItems.map((item) => ({ label: item.label, href: item.slug ? `${prefix}/${item.slug}` : prefix, exact: "exact" in item ? item.exact : false })),
    ...(canReadDocuments ? [{ label: "Documents", href: `${prefix}/documents`, exact: false }] : []),
    ...(canReadSafety ? [{ label: "Safety", href: `${prefix}/safety`, exact: false }] : []),
    ...(canReadAudit ? [{ label: "Audit", href: `${prefix}/audit`, exact: false }] : []),
  ];

  return (
    <nav className="mb-5 flex flex-wrap gap-2 rounded-lg border border-line bg-surface p-2" aria-label="Drone operator sections">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
