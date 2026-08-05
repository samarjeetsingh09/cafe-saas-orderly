"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui/Modal";
import { useToast } from "./ui/Toast";

export function SaveAsTemplateButton({ tenantId, defaultName }: { tenantId: string; defaultName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${defaultName} template`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/cafes/${tenantId}/save-as-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Failed");
    setOpen(false);
    toast.push(`Template "${name}" saved`, "ok");
    router.push("/admin/templates");
  }

  return (
    <>
      <button className="hq-btn" data-size="sm" onClick={() => setOpen(true)}>
        Save as template
      </button>
      <Modal
        open={open}
        title="Save this cafe as a template"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="primary" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save template"}
            </button>
          </>
        }
      >
        <div className="hq-note">Copies the theme, menu and default settings.</div>
        <Field label="Template name" error={error ?? undefined}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
