"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccountStatus = "Active" | "Suspended" | "Deactivated";
type Action = { label: string; status: AccountStatus; tone: "primary" | "danger" };

function actionsFor(kind: "admin" | "citizen", status: string): Action[] {
  if (status === "Pending activation") return [];
  if (status === "Deactivated") return [{ label: "Reactivate", status: "Active", tone: "primary" }];
  if (kind === "admin") return [{ label: "Deactivate", status: "Deactivated", tone: "danger" }];
  if (status === "Suspended") {
    return [
      { label: "Lift suspension", status: "Active", tone: "primary" },
      { label: "Deactivate", status: "Deactivated", tone: "danger" },
    ];
  }
  return [
    { label: "Suspend", status: "Suspended", tone: "danger" },
    { label: "Deactivate", status: "Deactivated", tone: "danger" },
  ];
}

export function UserAccountActions({ id, kind, status }: { id: string; kind: "admin" | "citizen"; status: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!selected || reason.trim().length < 3) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, status: selected.status, reason: reason.trim() }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Account action failed");
      setSelected(null);
      setReason("");
      setMessage(`${selected.label} completed.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account action failed");
    } finally {
      setSubmitting(false);
    }
  }

  const actions = actionsFor(kind, status);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => { setSelected(action); setMessage(null); }}
            className={action.tone === "danger"
              ? "min-h-11 rounded-md border border-danger/40 px-4 py-2 text-sm font-semibold text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
              : "min-h-11 rounded-md bg-eye px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eye"}
          >
            {action.label}
          </button>
        ))}
      </div>
      {message ? <p className="mt-3 text-sm text-muted" role="status">{message}</p> : null}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-action-title"
            className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-soft"
          >
            <h3 id="account-action-title" className="text-lg font-semibold text-ink">Confirm {selected.label.toLowerCase()}</h3>
            <p className="mt-2 text-sm text-muted">This action changes account access and is recorded in the audit trail.</p>
            <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
              Reason <span className="text-danger">Required</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={500}
                autoFocus
                className="rounded-md border border-line bg-field p-3 text-ink"
                placeholder="Enter the operational reason"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={() => { setSelected(null); setReason(""); }} className="min-h-11 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink">Cancel</button>
              <button type="button" disabled={submitting || reason.trim().length < 3} onClick={submit} className="min-h-11 rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {submitting ? "Applying…" : `Confirm ${selected.label.toLowerCase()}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
