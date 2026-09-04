import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { OperationalAccountForm } from "../../../components/users/operational-account-form";
import { PageHeader } from "../../../components/ui";
import { getAdminSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export default async function NewOperationalAccountPage() {
  const session = await getAdminSession();
  if (!session?.permissions?.includes("user:manage")) redirect("/users");

  return (
    <AppShell>
      <PageHeader eyebrow="Identity and access" title="Create operational account" />
      <Link href="/users" className="mb-4 inline-block text-sm font-semibold text-eye hover:underline">Back to users</Link>
      <div className="border-t border-line pt-6">
        <OperationalAccountForm />
      </div>
    </AppShell>
  );
}
