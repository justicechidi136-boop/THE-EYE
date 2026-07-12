import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { BRAND_ASSETS } from "../../lib/brand";
import { filterCsocNavItems } from "../../lib/csoc/access";
import { CSOC_NAV_ITEMS } from "../../lib/csoc/nav";
import type { AdminRole, AdminSession } from "../../lib/types/admin-views";
import { roleScope } from "../../lib/types/admin-views";
import { ShellNavLink } from "../shell-nav-link";

export function CsocShell({
  children,
  session = null,
}: Readonly<{ children: ReactNode; session?: AdminSession | null }>) {
  const activeRole = (session?.role ?? "State Admin") as AdminRole;
  const scope = roleScope[activeRole] ?? "Signed in admin";
  const navItems = filterCsocNavItems(activeRole, CSOC_NAV_ITEMS);

  return (
    <div className="min-h-screen bg-field text-ink lg:grid lg:grid-cols-[280px_1fr]">
      <a
        href="#csoc-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-soft"
      >
        Skip to main content
      </a>
      <aside
        className="bg-command px-4 py-4 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:px-5 lg:py-5"
        aria-label="Neighborhood Watch console navigation"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/neighborhood-watch" className="block max-w-[180px]" aria-label="CSOC home">
            <Image src={BRAND_ASSETS.lockupDarkBg} alt="The Eye" width={180} height={48} priority className="h-auto w-full" />
          </Link>
        </div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-eye">Community Security Operations</p>
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase text-white/50">Active role</p>
          <p className="mt-1 font-semibold">{activeRole}</p>
          <p className="mt-2 text-sm leading-5 text-white/60">{scope}</p>
          {session?.email ? <p className="mt-2 text-xs text-white/50">{session.email}</p> : null}
        </div>
        <nav className="grid gap-1" aria-label="CSOC primary">
          {navItems.map((item) => (
            <ShellNavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
        <div className="mt-4 border-t border-white/10 pt-3">
          <ShellNavLink href="/" label="← Main Admin" />
          {session ? (
            <form action="/api/auth/logout" method="post" className="mt-1">
              <button
                type="submit"
                className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-400 transition-colors hover:bg-white/10"
              >
                Logout
              </button>
            </form>
          ) : (
            <ShellNavLink href="/login" label="Login" />
          )}
        </div>
      </aside>
      <main id="csoc-main" className="min-w-0 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
