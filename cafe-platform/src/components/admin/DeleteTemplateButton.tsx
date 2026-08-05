"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";

export function DeleteTemplateButton({ templateId, disabled }: { templateId: string; disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // A real dialog rather than window.confirm: a native confirm blocks the
  // whole page and cannot be styled or dismissed by Escape consistently.
  const [open, setOpen] = useState(false);

  async function del() {
    setBusy(true);
    const res = await fetch(`/api/admin/templates/${templateId}`, { method: "DELETE" });
    setBusy(false);
    setOpen(false);
    if (!res.ok) return toast.push((await res.json().catch(() => ({}))).error ?? "Delete failed", "danger");
    toast.push("Template deleted", "ok");
    router.refresh();
  }

  return (
    <>
      <button
        className="hq-btn"
        data-variant="danger"
        data-size="sm"
        disabled={disabled || busy}
        title={disabled ? "In use by at least one cafe" : undefined}
        onClick={() => setOpen(true)}
      >
        Delete
      </button>
      <Modal
        open={open}
        title="Delete this template?"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="danger" disabled={busy} onClick={del}>
              {busy ? "Deleting…" : "Delete template"}
            </button>
          </>
        }
      >
        <div className="hq-note" data-tone="danger">
          Cafes already provisioned from it keep their theme and menu — only the starting point disappears.
        </div>
      </Modal>
    </>
  );
}
