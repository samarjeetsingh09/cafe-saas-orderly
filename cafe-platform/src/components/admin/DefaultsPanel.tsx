"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import type { PlatformDefaults } from "@/lib/hq-settings";

/**
 * Platform defaults (HQ-PORTAL-SPEC.md §13). These are not decoration: the
 * provisioning wizard opens on these values and the support inbox measures
 * its SLA against `supportSlaHours`.
 */
export function DefaultsPanel({ defaults, plans }: { defaults: PlatformDefaults; plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return toast.push(data.error ?? "Failed", "danger");
    }
    toast.push("Platform defaults saved", "ok");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="hq-formgrid">
        <Field label="Default GST %" hint="Prefills the provisioning wizard.">
          <input type="number" step="0.01" min={0} max={28} value={v.defaultGstPercent} onChange={(e) => setV({ ...v, defaultGstPercent: Number(e.target.value) })} />
        </Field>
        <Field label="Default trial length (days)">
          <input type="number" min={0} value={v.defaultTrialDays} onChange={(e) => setV({ ...v, defaultTrialDays: Number(e.target.value) })} />
        </Field>
        <Field label="Default table count">
          <input type="number" min={1} value={v.defaultTableCount} onChange={(e) => setV({ ...v, defaultTableCount: Number(e.target.value) })} />
        </Field>
        <Field label="Default plan">
          <select value={v.defaultPlanId ?? ""} onChange={(e) => setV({ ...v, defaultPlanId: e.target.value || null })}>
            <option value="">First plan by sort order</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Support SLA (hours)" hint="A ticket with no reply after this long shows as breaching in the inbox.">
          <input type="number" min={1} max={240} value={v.supportSlaHours} onChange={(e) => setV({ ...v, supportSlaHours: Number(e.target.value) })} />
        </Field>
        <label className="hq-check span2">
          <input type="checkbox" checked={v.defaultSplitKitchen} onChange={(e) => setV({ ...v, defaultSplitKitchen: e.target.checked })} />
          <span>
            New cafes default to a split kitchen
            <span className="sub">Separate veg / non-veg stations, each with its own display login.</span>
          </span>
        </label>
      </div>
      {error && (
        <div className="hq-note" data-tone="danger">
          {error}
        </div>
      )}
      <div>
        <button className="hq-btn" data-variant="primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save defaults"}
        </button>
      </div>
    </div>
  );
}
