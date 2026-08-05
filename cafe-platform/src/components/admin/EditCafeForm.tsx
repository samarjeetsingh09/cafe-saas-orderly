"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeEditor, DEFAULT_THEME, type ThemeTokens } from "./ThemeEditor";
import { Card, Empty, dateTime } from "./ui";
import { Field } from "./ui/Modal";
import { useToast } from "./ui/Toast";

type Tenant = {
  id: string;
  name: string;
  tagline: string | null;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  gstPercent: number;
  splitKitchen: boolean;
  theme: Record<string, string>;
  logoUrl: string | null;
};

export type ThemeVersionRow = { id: string; savedAt: string; savedBy: string | null; theme: Record<string, string> };

export function EditCafeForm({ tenant, versions }: { tenant: Tenant; versions: ThemeVersionRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(tenant.name);
  const [tagline, setTagline] = useState(tenant.tagline ?? "");
  const [phone, setPhone] = useState(tenant.phone ?? "");
  const [address, setAddress] = useState(tenant.address ?? "");
  const [gstNumber, setGstNumber] = useState(tenant.gstNumber ?? "");
  const [gstPercent, setGstPercent] = useState(tenant.gstPercent);
  const [splitKitchen, setSplitKitchen] = useState(tenant.splitKitchen);
  const [theme, setTheme] = useState<ThemeTokens>({ ...DEFAULT_THEME, ...tenant.theme } as ThemeTokens);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/cafes/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        tagline: tagline || null,
        phone: phone || null,
        address: address || null,
        gstNumber: gstNumber || null,
        gstPercent,
        splitKitchen,
        theme,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? "Failed to save";
      setError(msg);
      return toast.push(msg, "danger");
    }
    toast.push("Saved — previous theme kept in history", "ok");
    router.refresh();
  }

  async function revert(versionId: string) {
    setReverting(versionId);
    const res = await fetch(`/api/admin/cafes/${tenant.id}/theme-revert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    setReverting(null);
    if (!res.ok) return toast.push((await res.json().catch(() => ({}))).error ?? "Revert failed", "danger");
    const restored = versions.find((v) => v.id === versionId);
    if (restored) setTheme({ ...DEFAULT_THEME, ...restored.theme } as ThemeTokens);
    toast.push("Theme reverted", "ok");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card title="Contact & settings">
        <div className="hq-formgrid">
          <Field label="Name">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Tagline">
            <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </Field>
          <Field label="Phone">
            <input type="text" className="mono" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Address">
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="GST number">
            <input type="text" className="mono" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
          </Field>
          <Field label="GST %">
            <input type="number" step="0.01" value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))} />
          </Field>
          <label className="hq-check span2">
            <input type="checkbox" checked={splitKitchen} onChange={(e) => setSplitKitchen(e.target.checked)} />
            <span>
              Split kitchen
              <span className="sub">Separate veg / non-veg stations.</span>
            </span>
          </label>
        </div>
      </Card>

      <Card title="Branding" sub="Saving snapshots the current theme into history first">
        <ThemeEditor value={theme} onChange={setTheme} />
      </Card>

      <Card title="Theme history" sub="Last 10 saves — newest first">
        {versions.length === 0 ? (
          <Empty title="No history yet">The first time this cafe&rsquo;s theme is saved, the version it replaced lands here.</Empty>
        ) : (
          <div style={{ display: "grid", gap: 7 }}>
            {versions.map((v) => (
              <div
                key={v.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  border: "1px solid var(--hq-line-soft)",
                  borderRadius: "var(--hq-r-sm)",
                  padding: "7px 9px",
                }}
              >
                <span style={{ display: "flex", gap: 3, flex: "none" }}>
                  {(["bg", "surface", "accent", "accent2", "ink"] as const).map((k) => (
                    <span
                      key={k}
                      title={`${k}: ${v.theme[k] ?? "—"}`}
                      style={{ width: 16, height: 16, borderRadius: 4, background: v.theme[k] ?? "transparent", border: "1px solid var(--hq-line)" }}
                    />
                  ))}
                </span>
                <span className="mono" style={{ fontSize: 12 }}>
                  {dateTime(v.savedAt)}
                </span>
                <span style={{ fontSize: 11, color: "var(--hq-text-3)", flex: "1 1 auto" }}>{v.savedBy ?? "unknown"}</span>
                <button className="hq-btn" data-size="sm" disabled={reverting !== null} onClick={() => revert(v.id)}>
                  {reverting === v.id ? "Reverting…" : "Revert to this"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {error && (
        <div className="hq-note" data-tone="danger">
          {error}
        </div>
      )}
      <div>
        <button className="hq-btn" data-variant="primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
