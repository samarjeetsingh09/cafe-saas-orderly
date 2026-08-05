"use client";

import { useEffect, useMemo, useState } from "react";
import { ThemeEditor, DEFAULT_THEME, type ThemeTokens } from "./ThemeEditor";
import { ProvisionSuccess } from "./ProvisionSuccess";
import { Card } from "./ui";
import { Field } from "./ui/Modal";
import type { TemplateDTO } from "@/lib/hq-templates";

type Plan = { id: string; name: string; pricePaise: number; maxTables: number };

/** Prefill carried over from a pipeline lead being converted. */
export type LeadPrefill = { id: string; name: string; owner: string; phone: string; email: string };

type WizardData = {
  name: string;
  slug: string;
  slugTouched: boolean;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  address: string;
  timezone: string;
  gstNumber: string;
  gstPercent: number;
  splitKitchen: boolean;

  logoUrl: string;
  faviconUrl: string;
  theme: ThemeTokens;
  templateId: string;

  planId: string;
  startDate: string;
  endDate: string;
  setupFeeRupees: number;
  trial: boolean;
  trialDays: number;

  acceptCash: boolean;
  acceptCounterUpi: boolean;
  acceptOnline: boolean;
  gateway: string;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  paymentsEnabled: boolean;

  tableCount: number;
  tableStart: number;
};

const DRAFT_KEY = "hq-provision-draft-v1";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function todayISO(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Platform defaults from /admin/settings — the wizard opens on these. */
export type WizardDefaults = {
  defaultGstPercent: number;
  defaultTrialDays: number;
  defaultTableCount: number;
  defaultPlanId: string | null;
  defaultSplitKitchen: boolean;
};

function defaultData(d?: WizardDefaults): WizardData {
  return {
    name: "",
    slug: "",
    slugTouched: false,
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    address: "",
    timezone: "Asia/Kolkata",
    gstNumber: "",
    gstPercent: d?.defaultGstPercent ?? 5,
    splitKitchen: d?.defaultSplitKitchen ?? true,
    logoUrl: "",
    faviconUrl: "",
    theme: DEFAULT_THEME,
    templateId: "",
    planId: d?.defaultPlanId ?? "",
    startDate: todayISO(),
    endDate: todayISO(30),
    setupFeeRupees: 0,
    trial: (d?.defaultTrialDays ?? 14) > 0,
    trialDays: d?.defaultTrialDays ?? 14,
    acceptCash: true,
    acceptCounterUpi: false,
    acceptOnline: false,
    gateway: "razorpay",
    keyId: "",
    keySecret: "",
    webhookSecret: "",
    paymentsEnabled: false,
    tableCount: d?.defaultTableCount ?? 10,
    tableStart: 1,
  };
}

const STEPS = ["Cafe info", "Branding", "Subscription", "Payments", "Tables", "Users", "Review"];

export function ProvisionWizard({
  plans,
  templates,
  initialTemplateId,
  lead,
  defaults,
}: {
  plans: Plan[];
  templates: TemplateDTO[];
  initialTemplateId?: string;
  lead?: LeadPrefill;
  defaults?: WizardDefaults;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => defaultData(defaults));
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof submitProvision>> | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  // Deliberately restored post-mount, not via a lazy useState initializer:
  // this component is server-rendered for the first paint (no localStorage
  // there), so applying the draft only after hydration keeps that first
  // client render matching the server HTML. The resulting one-frame flash
  // of the blank form is the accepted cost — see HQ-PORTAL-SPEC.md §6
  // "survives a refresh".
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    let restored: Partial<WizardData> | null = null;
    if (raw) {
      try {
        restored = JSON.parse(raw) as Partial<WizardData>;
      } catch {
        restored = null;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount, see comment above
    setData((d) => ({ ...d, ...restored, planId: restored?.planId || d.planId || plans[0]?.id || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lead-conversion prefill. Declared *after* the draft restore so it lands on
  // top of it: arriving from "Convert to cafe" means this cafe, not whatever
  // half-finished draft was left in localStorage weeks ago.
  useEffect(() => {
    if (!lead) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from the URL on mount
    setData((d) => ({
      ...d,
      name: lead.name || d.name,
      slug: lead.name ? slugify(lead.name) : d.slug,
      slugTouched: false,
      ownerName: lead.owner || d.ownerName,
      ownerEmail: lead.email || d.ownerEmail,
      ownerPhone: lead.phone || d.ownerPhone,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  // apply template prefill once
  useEffect(() => {
    if (!initialTemplateId) return;
    const t = templates.find((x) => x.id === initialTemplateId);
    if (t) applyTemplate(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId]);

  // persist draft
  useEffect(() => {
    if (result) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  }, [data, result]);

  // Debounced slug availability check — an effect is the right tool here
  // (subscribing to a server-side check as the user types), so the
  // synchronous `setSlugStatus` calls that drive it are intentional.
  useEffect(() => {
    if (!data.slug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced check keyed off data.slug, see comment above
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/cafes/slug-check?slug=${encodeURIComponent(data.slug)}`);
      const j = await res.json().catch(() => ({}));
      if (j.available === true) setSlugStatus("available");
      else if (j.available === false && j.reason) setSlugStatus("invalid");
      else setSlugStatus("taken");
    }, 400);
    return () => clearTimeout(t);
  }, [data.slug]);

  function applyTemplate(t: TemplateDTO) {
    setData((d) => ({ ...d, templateId: t.id, theme: { ...DEFAULT_THEME, ...t.theme }, gstPercent: t.settings.gstPercent, splitKitchen: t.settings.splitKitchen }));
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/uploads/logo", { method: "POST", body: form });
    const j = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return setError(j.error ?? "Upload failed");
    setData((d) => ({ ...d, logoUrl: j.url, faviconUrl: j.faviconUrl }));
  }

  const step1Valid = data.name && slugStatus === "available" && data.ownerName && /\S+@\S+\.\S+/.test(data.ownerEmail) && data.ownerPhone;
  const step3Valid = !!data.planId && !!data.startDate && !!data.endDate;
  const step4Valid = data.acceptCash || data.acceptCounterUpi || data.acceptOnline;
  const step5Valid = data.tableCount >= 1;

  const canNext = [step1Valid, true, step3Valid, step4Valid, step5Valid, true, true][step];

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await submitProvision(data, idempotencyKey);
      // Close the loop on the pipeline: the lead becomes the cafe it turned
      // into. Deliberately not awaited-into-failure — the cafe exists either
      // way, and losing the link is a far smaller problem than showing the
      // operator a "provisioning failed" screen for a cafe that was created.
      if (lead) {
        await fetch(`/api/admin/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "won", tenantId: r.tenantId }),
        }).catch(() => {});
      }
      setResult(r);
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Provisioning failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <ProvisionSuccess result={result} tenantName={data.name} />;
  }

  const slugHint =
    slugStatus === "checking"
      ? "Checking…"
      : slugStatus === "available"
        ? "Available"
        : slugStatus === "taken"
          ? "Already taken"
          : slugStatus === "invalid"
            ? "Reserved or invalid"
            : undefined;

  return (
    <div>
      <ol className="hq-steps">
        {STEPS.map((label, i) => (
          <li key={label} data-state={i === step ? "current" : i < step ? "done" : "todo"}>
            <i>{i < step ? "✓" : i + 1}</i>
            {label}
          </li>
        ))}
      </ol>

      <Card title={STEPS[step]} sub={`Step ${step + 1} of ${STEPS.length}`}>
        {step === 0 && (
          <div className="hq-formgrid">
            <Field label="Cafe name">
              <input
                type="text"
                value={data.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setData((d) => ({ ...d, name, slug: d.slugTouched ? d.slug : slugify(name) }));
                }}
              />
            </Field>
            <Field
              label="Slug"
              hint={slugStatus === "available" || slugStatus === "checking" ? slugHint : undefined}
              error={slugStatus === "taken" || slugStatus === "invalid" ? slugHint : undefined}
            >
              <input
                type="text"
                className="mono"
                value={data.slug}
                onChange={(e) => setData((d) => ({ ...d, slug: slugify(e.target.value), slugTouched: true }))}
              />
            </Field>
            <Field label="Owner name">
              <input type="text" value={data.ownerName} onChange={(e) => setData((d) => ({ ...d, ownerName: e.target.value }))} />
            </Field>
            <Field label="Owner email">
              <input type="email" value={data.ownerEmail} onChange={(e) => setData((d) => ({ ...d, ownerEmail: e.target.value }))} />
            </Field>
            <Field label="Owner phone">
              <input type="text" value={data.ownerPhone} onChange={(e) => setData((d) => ({ ...d, ownerPhone: e.target.value }))} />
            </Field>
            <Field label="Address">
              <input type="text" value={data.address} onChange={(e) => setData((d) => ({ ...d, address: e.target.value }))} />
            </Field>
            <Field label="Timezone">
              <input type="text" value={data.timezone} onChange={(e) => setData((d) => ({ ...d, timezone: e.target.value }))} />
            </Field>
            <Field label="Currency" hint="Fixed for this build">
              <input type="text" value="INR" disabled />
            </Field>
            <Field label="GST number">
              <input type="text" className="mono" value={data.gstNumber} onChange={(e) => setData((d) => ({ ...d, gstNumber: e.target.value }))} />
            </Field>
            <Field label="GST %">
              <input type="number" step="0.01" value={data.gstPercent} onChange={(e) => setData((d) => ({ ...d, gstPercent: Number(e.target.value) }))} />
            </Field>
            <label className="hq-check span2">
              <input type="checkbox" checked={data.splitKitchen} onChange={(e) => setData((d) => ({ ...d, splitKitchen: e.target.checked }))} />
              <span>
                Split kitchen
                <span className="sub">Separate veg / non-veg stations, each with its own display login.</span>
              </span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "grid", gap: 14 }}>
            {templates.length > 0 && (
              <Field label="Start from template" hint="Copies theme, GST % and kitchen layout — you can still edit everything below.">
                <select
                  value={data.templateId}
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) applyTemplate(t);
                    else setData((d) => ({ ...d, templateId: "" }));
                  }}
                  style={{ maxWidth: 280 }}
                >
                  <option value="">None — start blank</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="hq-field">
              <span className="lbl">Logo</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} style={{ fontSize: 12 }} />
              {uploading && <span className="hint">Uploading…</span>}
              {data.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.logoUrl} alt="Logo preview" style={{ marginTop: 8, height: 48, width: 48, borderRadius: 8, objectFit: "cover" }} />
              )}
            </div>

            <ThemeEditor value={data.theme} onChange={(theme) => setData((d) => ({ ...d, theme }))} />
          </div>
        )}

        {step === 2 && (
          <div className="hq-formgrid">
            <Field label="Plan">
              <select value={data.planId} onChange={(e) => setData((d) => ({ ...d, planId: e.target.value }))}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{(p.pricePaise / 100).toLocaleString("en-IN")}/mo, {p.maxTables} tables
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Setup fee (₹)">
              <input type="number" value={data.setupFeeRupees} onChange={(e) => setData((d) => ({ ...d, setupFeeRupees: Number(e.target.value) }))} />
            </Field>
            <Field label="Start date">
              <input type="date" value={data.startDate} onChange={(e) => setData((d) => ({ ...d, startDate: e.target.value }))} />
            </Field>
            <Field label="End date">
              <input type="date" value={data.endDate} onChange={(e) => setData((d) => ({ ...d, endDate: e.target.value }))} />
            </Field>
            <label className="hq-check">
              <input type="checkbox" checked={data.trial} onChange={(e) => setData((d) => ({ ...d, trial: e.target.checked }))} />
              <span>Start on trial</span>
            </label>
            {data.trial && (
              <Field label="Trial length (days)">
                <input type="number" value={data.trialDays} onChange={(e) => setData((d) => ({ ...d, trialDays: Number(e.target.value) }))} />
              </Field>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 4 }}>
            <label className="hq-check">
              <input type="checkbox" checked={data.acceptCash} onChange={(e) => setData((d) => ({ ...d, acceptCash: e.target.checked }))} />
              <span>Accept cash</span>
            </label>
            <label className="hq-check">
              <input type="checkbox" checked={data.acceptCounterUpi} onChange={(e) => setData((d) => ({ ...d, acceptCounterUpi: e.target.checked }))} />
              <span>Accept counter UPI</span>
            </label>
            <label className="hq-check">
              <input type="checkbox" checked={data.acceptOnline} onChange={(e) => setData((d) => ({ ...d, acceptOnline: e.target.checked }))} />
              <span>Accept online payments</span>
            </label>

            {data.acceptOnline && (
              <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
                <div className="hq-note" data-tone="warn">
                  Local dev — no live gateway is ever called; secrets are encrypted at rest with a dummy key.
                </div>
                <div className="hq-formgrid">
                  <Field label="Gateway">
                    <select value={data.gateway} onChange={(e) => setData((d) => ({ ...d, gateway: e.target.value }))}>
                      <option value="razorpay">Razorpay</option>
                      <option value="cashfree">Cashfree</option>
                      <option value="phonepe">PhonePe</option>
                      <option value="payu">PayU</option>
                    </select>
                  </Field>
                  <Field label="Key ID">
                    <input type="text" className="mono" value={data.keyId} onChange={(e) => setData((d) => ({ ...d, keyId: e.target.value }))} />
                  </Field>
                  <Field label="Key secret">
                    <input type="password" value={data.keySecret} onChange={(e) => setData((d) => ({ ...d, keySecret: e.target.value }))} />
                  </Field>
                  <Field label="Webhook secret">
                    <input type="password" value={data.webhookSecret} onChange={(e) => setData((d) => ({ ...d, webhookSecret: e.target.value }))} />
                  </Field>
                  <label className="hq-check span2">
                    <input type="checkbox" checked={data.paymentsEnabled} onChange={(e) => setData((d) => ({ ...d, paymentsEnabled: e.target.checked }))} />
                    <span>Enable online payments immediately</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gap: 12, maxWidth: 320 }}>
            <Field label="Number of tables">
              <input type="number" min={1} max={200} value={data.tableCount} onChange={(e) => setData((d) => ({ ...d, tableCount: Number(e.target.value) }))} />
            </Field>
            <Field label="Starting number">
              <input type="number" min={1} value={data.tableStart} onChange={(e) => setData((d) => ({ ...d, tableStart: Number(e.target.value) }))} />
            </Field>
            <div className="hq-note">
              QR codes (ZIP + print PDF) are generated with real tokens once the cafe is provisioned — download them from the success screen.
            </div>
          </div>
        )}

        {step === 5 && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="hq-note">
              These accounts are created automatically with strong random passwords — shown once, with a copy button, right after provisioning.
            </div>
            <ul style={{ display: "grid", gap: 6 }}>
              <li className="hq-note">
                <b>Owner</b> — {data.ownerName || "—"} · {data.ownerEmail || "—"}
              </li>
              <li className="hq-note">
                <b>Reception / manager</b> — auto-generated login
              </li>
              {data.splitKitchen ? (
                <>
                  <li className="hq-note">
                    <b>Kitchen — Veg</b> — auto-generated login
                  </li>
                  <li className="hq-note">
                    <b>Kitchen — Non-veg</b> — auto-generated login
                  </li>
                </>
              ) : (
                <li className="hq-note">
                  <b>Kitchen</b> — auto-generated login
                </li>
              )}
            </ul>
          </div>
        )}

        {step === 6 && (
          <div style={{ display: "grid", gap: 12 }}>
            {lead && (
              <div className="hq-note" data-tone="info">
                On success this lead is marked <b>Won</b> and linked to the new cafe.
              </div>
            )}
            <dl className="hq-dl">
              <div>
                <dt>Cafe</dt>
                <dd>
                  {data.name} <span className="mono">({data.slug})</span>
                </dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>
                  {data.ownerName} · {data.ownerEmail} · <span className="mono">{data.ownerPhone}</span>
                </dd>
              </div>
              <div>
                <dt>Branding</dt>
                <dd>
                  {data.templateId ? `Template: ${templates.find((t) => t.id === data.templateId)?.name}` : "Custom theme"}
                  {data.logoUrl && " · logo uploaded"}
                </dd>
              </div>
              <div>
                <dt>Subscription</dt>
                <dd>
                  {plans.find((p) => p.id === data.planId)?.name} · <span className="mono">{data.startDate} → {data.endDate}</span>
                  {data.trial && ` · trial ${data.trialDays}d`}
                </dd>
              </div>
              <div>
                <dt>Payments</dt>
                <dd>{[data.acceptCash && "Cash", data.acceptCounterUpi && "Counter UPI", data.acceptOnline && `Online (${data.gateway})`].filter(Boolean).join(", ")}</dd>
              </div>
              <div>
                <dt>Tables</dt>
                <dd className="mono">
                  {data.tableCount} from #{data.tableStart}
                </dd>
              </div>
              <div>
                <dt>Kitchen</dt>
                <dd>{data.splitKitchen ? "Split (veg / non-veg)" : "Single station"}</dd>
              </div>
            </dl>
            {error && (
              <div className="hq-note" data-tone="danger">
                {error}
              </div>
            )}
          </div>
        )}
      </Card>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <button className="hq-btn" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="hq-btn" data-variant="primary" disabled={!canNext} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Next
          </button>
        ) : (
          <button className="hq-btn" data-variant="accent" disabled={submitting} onClick={submit}>
            {submitting ? "Provisioning…" : "Provision cafe"}
          </button>
        )}
      </div>
    </div>
  );
}

async function submitProvision(data: WizardData, idempotencyKey: string) {
  const body = {
    idempotencyKey,
    cafe: {
      name: data.name,
      slug: data.slug,
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail,
      ownerPhone: data.ownerPhone,
      address: data.address || undefined,
      timezone: data.timezone,
      gstNumber: data.gstNumber || undefined,
      gstPercent: data.gstPercent,
    },
    branding: {
      logoUrl: data.logoUrl || undefined,
      faviconUrl: data.faviconUrl || undefined,
      theme: data.theme,
    },
    subscription: {
      planId: data.planId,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      setupFeePaise: Math.round(data.setupFeeRupees * 100),
      trial: data.trial,
      trialEndsAt: data.trial ? new Date(Date.now() + data.trialDays * 86_400_000).toISOString() : undefined,
    },
    payments: {
      acceptCash: data.acceptCash,
      acceptCounterUpi: data.acceptCounterUpi,
      acceptOnline: data.acceptOnline,
      gateway: data.acceptOnline ? data.gateway : undefined,
      keyId: data.acceptOnline ? data.keyId || undefined : undefined,
      keySecret: data.acceptOnline ? data.keySecret || undefined : undefined,
      webhookSecret: data.acceptOnline ? data.webhookSecret || undefined : undefined,
      enabled: data.acceptOnline && data.paymentsEnabled,
    },
    tables: { count: data.tableCount, startingNumber: data.tableStart },
    splitKitchen: data.splitKitchen,
    templateId: data.templateId || undefined,
  };

  const res = await fetch("/api/admin/cafes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Provisioning failed");
  return json as {
    tenantId: string;
    slug: string;
    tenantName: string;
    tableCount: number;
    tables: { label: string; qrToken: string }[];
    credentials: { role: string; fullName: string; email: string; password: string }[];
  };
}
