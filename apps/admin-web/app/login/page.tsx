import { AppShell } from "../../components/app-shell";
import { PageHeader, Panel, StatusBadge } from "../../components/ui";
import { roleScope } from "../../lib/mock-data";

const roles = Object.keys(roleScope);

export default function LoginPage() {
  return (
    <AppShell>
      <PageHeader eyebrow="Secure access" title="Admin login" action={<StatusBadge tone="info">JWT + refresh token ready</StatusBadge>} />
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Sign in">
          <form className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Email or phone number
              <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="admin@theeye.gov" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Password
              <input className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye" placeholder="Password" type="password" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Role context
              <select className="h-11 rounded-md border border-line px-3 outline-none focus:border-eye">
                {roles.map((role) => <option key={role}>{role}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button className="rounded-md bg-eye px-4 py-3 text-sm font-semibold text-white">Email login</button>
              <button className="rounded-md border border-line px-4 py-3 text-sm font-semibold">Phone OTP</button>
              <button className="rounded-md border border-line px-4 py-3 text-sm font-semibold">Google</button>
            </div>
          </form>
        </Panel>
        <Panel title="Access scopes">
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(roleScope).map(([role, scope]) => (
              <div key={role} className="rounded-lg border border-line bg-slate-50 p-3">
                <p className="font-semibold">{role}</p>
                <p className="mt-1 text-sm text-muted">{scope}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
