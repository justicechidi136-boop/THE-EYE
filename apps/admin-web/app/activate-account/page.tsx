import { AccountActivationForm } from "../../components/users/account-activation-form";

export default async function ActivateAccountPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-base px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-lg">
        <p className="text-sm font-semibold text-eye">THE EYE</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Activate operational account</h1>
        <p className="mt-2 text-sm text-muted">Create your password to finish activation. This secure link can be used once.</p>
        <div className="mt-6"><AccountActivationForm token={token} /></div>
      </section>
    </main>
  );
}
