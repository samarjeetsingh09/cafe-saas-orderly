"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { TableWrap, Empty, rupees } from "./ui";

export type PlanRow = {
  id: string;
  name: string;
  pricePaise: number;
  maxTables: number;
  features: string[];
  sortOrder: number;
  subscriberCount: number;
};

type Draft = { id: string; name: string; priceRupees: number; maxTables: number; features: string; sortOrder: number };

const blank = (): Draft => ({ id: "", name: "", priceRupees: 999, maxTables: 20, features: "", sortOrder: 0 });

/** Plan CRUD (HQ-PORTAL-SPEC.md §13). super_admin only. */
export function PlansPanel({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"new" | "edit" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PlanRow | null>(null);

  function openNew() {
    setDraft(blank());
    setError(null);
    setMode("new");
  }

  function openEdit(p: PlanRow) {
    setDraft({
      id: p.id,
      name: p.name,
      priceRupees: Math.round(p.pricePaise / 100),
      maxTables: p.maxTables,
      features: p.features.join(", "),
      sortOrder: p.sortOrder,
    });
    setError(null);
    setMode("edit");
  }

  async function save() {
    setBusy(true);
    setError(null);
    const features = draft.features
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    const body = { name: draft.name, priceRupees: draft.priceRupees, maxTables: draft.maxTables, features, sortOrder: draft.sortOrder };
    const res =
      mode === "new"
        ? await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draft.id, ...body }) })
        : await fetch(`/api/admin/plans/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    setMode(null);
    toast.push(mode === "new" ? `Plan "${draft.name}" created` : `Plan "${draft.name}" updated`, "ok");
    router.refresh();
  }

  async function remove(p: PlanRow) {
    setBusy(true);
    const res = await fetch(`/api/admin/plans/${p.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setDeleting(null);
    if (!res.ok) return toast.push(data.error ?? "Failed", "danger");
    toast.push(`Plan "${p.name}" deleted`, "ok");
    router.refresh();
  }

  return (
    <>
      <div className="hq-toolbar" style={{ justifyContent: "flex-end", marginBottom: 0, padding: "10px 14px 0" }}>
        <button className="hq-btn" data-variant="accent" data-size="sm" onClick={openNew}>
          + Add plan
        </button>
      </div>

      {plans.length === 0 ? (
        <Empty title="No plans">Provisioning needs at least one plan to put a cafe on.</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Plan</th>
              <th className="r">Price / mo</th>
              <th className="r">Max tables</th>
              <th>Features</th>
              <th className="r">Cafes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} data-rail={p.subscriberCount > 0 ? "ok" : undefined}>
                <td>
                  <b style={{ fontWeight: 500 }}>{p.name}</b>
                  <span className="sub mono">{p.id}</span>
                </td>
                <td className="r num">{rupees(p.pricePaise)}</td>
                <td className="r num">{p.maxTables}</td>
                <td style={{ color: "var(--hq-text-2)", fontSize: 12 }}>{p.features.length ? p.features.join(" · ") : "—"}</td>
                <td className="r num">{p.subscriberCount}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="hq-btn" data-size="sm" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button
                      className="hq-btn"
                      data-size="sm"
                      data-variant="danger"
                      disabled={p.subscriberCount > 0}
                      title={p.subscriberCount > 0 ? "Cafes are on this plan — move them first" : undefined}
                      onClick={() => setDeleting(p)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal
        open={mode !== null}
        title={mode === "new" ? "New plan" : `Edit ${draft.name}`}
        onClose={() => setMode(null)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setMode(null)}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="primary" disabled={busy || !draft.name || !draft.id} onClick={save}>
              {busy ? "Saving…" : mode === "new" ? "Create plan" : "Save"}
            </button>
          </>
        }
      >
        {mode === "new" && (
          <Field label="Plan id" hint="Lowercase, permanent — it is the foreign key subscriptions point at.">
            <input
              type="text"
              className="mono"
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
              placeholder="growth"
            />
          </Field>
        )}
        <Field label="Name">
          <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Price (₹/month)" hint="Re-prices every cafe on this plan that has no negotiated override.">
          <input type="number" min={0} value={draft.priceRupees} onChange={(e) => setDraft({ ...draft, priceRupees: Number(e.target.value) })} />
        </Field>
        <Field label="Max tables">
          <input type="number" min={1} value={draft.maxTables} onChange={(e) => setDraft({ ...draft, maxTables: Number(e.target.value) })} />
        </Field>
        <Field label="Features" hint="Comma separated — shown on the owner's plan tab.">
          <input type="text" value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} />
        </Field>
        <Field label="Sort order">
          <input type="number" min={0} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
        </Field>
        {error && (
          <div className="hq-note" data-tone="danger">
            {error}
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? ""}`}
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="danger" disabled={busy} onClick={() => deleting && remove(deleting)}>
              {busy ? "Deleting…" : "Delete plan"}
            </button>
          </>
        }
      >
        <div className="hq-note" data-tone="danger">
          No cafe is on this plan, so nothing is re-priced. This cannot be undone.
        </div>
      </Modal>
    </>
  );
}
