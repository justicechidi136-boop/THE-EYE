import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveServerApiBaseUrl } from "../../../../lib/public-env";

export const dynamic = "force-dynamic";

type PublicBroadcast = {
  id: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  authorLabel?: string;
  approximateArea?: string | null;
  publishedAt?: string | null;
  statusBanner?: string;
};

async function fetchPublicBroadcast(id: string): Promise<PublicBroadcast | null> {
  const response = await fetch(
    `${resolveServerApiBaseUrl()}/public/broadcasts/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public broadcast is temporarily unavailable");
  const payload = (await response.json()) as { data?: PublicBroadcast };
  return payload.data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const broadcast = await fetchPublicBroadcast(id).catch(() => null);
  return {
    title: broadcast ? `${broadcast.title} | THE EYE` : "Broadcast | THE EYE",
    description: broadcast?.summary ?? "Public safety broadcast from THE EYE",
  };
}

export default async function PublicBroadcastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const broadcast = await fetchPublicBroadcast(id);
  if (!broadcast) notFound();

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-6">
      <article className="mx-auto max-w-2xl rounded-lg border border-line bg-surface p-6 shadow-sm">
        <header className="border-b border-line pb-5">
          <p className="text-sm font-semibold uppercase text-eye">THE EYE public safety</p>
          <h1 className="mt-2 text-2xl font-semibold">{broadcast.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
            <span>{broadcast.statusBanner ?? broadcast.status}</span>
            <span aria-hidden="true">|</span>
            <span>{broadcast.type}</span>
            {broadcast.authorLabel ? (
              <>
                <span aria-hidden="true">|</span>
                <span>{broadcast.authorLabel}</span>
              </>
            ) : null}
          </div>
        </header>
        <section className="py-5">
          <h2 className="text-base font-semibold">Public summary</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{broadcast.summary}</p>
          {broadcast.approximateArea ? (
            <p className="mt-4 text-sm"><span className="font-semibold">Area:</span> {broadcast.approximateArea}</p>
          ) : null}
          {broadcast.publishedAt ? (
            <p className="mt-2 text-sm text-muted">Published {new Date(broadcast.publishedAt).toLocaleString()}</p>
          ) : null}
        </section>
        <footer className="border-t border-line pt-5 text-sm text-muted">
          Sensitive evidence, reporter identity, exact private locations, and internal case data are not shown on public links.
        </footer>
      </article>
    </main>
  );
}
