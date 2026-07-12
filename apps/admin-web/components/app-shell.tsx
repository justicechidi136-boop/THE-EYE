import type { ReactNode } from "react";
import { getAdminSession } from "../lib/session";
import { AppShellFrame } from "./app-shell-frame";

export async function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getAdminSession();
  return <AppShellFrame session={session}>{children}</AppShellFrame>;
}
