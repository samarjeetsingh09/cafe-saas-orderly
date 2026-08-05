"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { rupees } from "./ui";

export type EditableSubscription = {
  tenantId: string;
  tenantName: string;
  planId: string;
  planName: string;
  listPricePaise: number;
  pricePaise: number;
  overridden: boolean;
  status: string;
  currentEnd: string;
  cancelAtEnd: boolean;
};

/**
 * Change-plan / override-price dialog. Gated on `changeSubscription`
 * (super_admin) at the call site *and* in the route — hiding the button is
 * not the control, it just keeps the table honest for ops and support.
 */
export function SubscriptionEditor({ sub, plans }: { sub: EditableSubscription; plans: { id: string; name: string; pricePaise: number }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [planId, setPlanId] = useState(sub.planId);
  const [status, setStatus] = useState(sub.status);
  const [currentEnd, setCurrentEnd] = useState(sub.currentEnd.slice(0, 10));
  const [cancelAtEnd, setCancelAtEnd] = useState(sub.cancelAtEnd);
  const [override, setOverride] = useState(sub.overridden);
  const [overrideRupees, setOverrideRupees] = useState(Math.round(sub.pricePaise / 100));

  const selectedPlan = plans.find((p) => p.id === planId);
  const effectivePaise = override ? overrideRupees * 100 : (selectedPlan?.pricePaise ?? sub.listPricePaise);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/billing/${sub.tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId,
        status,
        currentEnd: new Date(currentEnd).toISOString(),
        cancelAtEnd,
        priceOverrideRupees: override ? overrideRupees : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setOpen(false);
    toast.push(data.unchanged ? "Nothing changed" : `${sub.tenantName}'s subscription updated`, data.unchanged ? "neutral" : "ok");
    router.refresh();
  }

  return (
    <>
      <button className="hq-btn" data-size="sm" onClick={() => setOpen(true)}>
        Change
      </button>
      <Modal
        open={open}
        title={`${sub.tenantName} — subscription`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="primary" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <Field label="Plan">
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {rupees(p.pricePaise)}/mo
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" hint="Only active and past_due count towards MRR.">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="trialing">trialing</option>
            <option value="active">active</option>
            <option value="past_due">past_due</option>
            <option value="cancelled">cancelled</option>
          </select>
        </Field>
        <Field label="Period ends">
          <input type="date" value={currentEnd} onChange={(e) => setCurrentEnd(e.target.value)} />
        </Field>
        <label className="hq-check">
          <input type="checkbox" checked={cancelAtEnd} onChange={(e) => setCancelAtEnd(e.target.checked)} />
          <span>
            Cancel at period end
            <span className="sub">Keeps serving until the date above, then stops.</span>
          </span>
        </label>
        <label className="hq-check">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          <span>
            Override the price for this cafe
            <span className="sub">A negotiated rate. Never changes the plan for anyone else.</span>
          </span>
        </label>
        {override && (
          <Field label="Negotiated price (₹/month)">
            <input type="number" min={0} value={overrideRupees} onChange={(e) => setOverrideRupees(Number(e.target.value))} />
          </Field>
        )}
        <div className="hq-note" data-tone={effectivePaise === 0 ? "warn" : "info"}>
          MRR contribution after saving: <b className="mono">{status === "active" || status === "past_due" ? `${rupees(effectivePaise)}/mo` : "₹0 — not billable in this status"}</b>
        </div>
        {error && (
          <div className="hq-note" data-tone="danger">
            {error}
          </div>
        )}
      </Modal>
    </>
  );
}
