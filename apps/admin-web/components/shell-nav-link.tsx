"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShellNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-white/15 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
