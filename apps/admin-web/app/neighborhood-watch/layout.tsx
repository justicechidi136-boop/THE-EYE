import { getAdminSession } from "../../lib/session";
import { CsocShell } from "../../components/csoc/csoc-shell";

export default async function NeighborhoodWatchLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  return <CsocShell session={session}>{children}</CsocShell>;
}
