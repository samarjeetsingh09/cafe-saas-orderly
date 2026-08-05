"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui/Modal";
import { useToast } from "./ui/Toast";

type Props = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  status: string;
  canBilling: boolean; // super_admin: suspend/delete
  canImpersonate: boolean;
  canEdit: boolean;
  size?: "sm" | "md";
};

export function CafeActions({ tenantId, tenantSlug, tenantName, status, canBilling, canImpersonate, canEdit, size = "sm" }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"impersonate" | "clone" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [cloneName, setCloneName] = useState(`${tenantName} copy`);
  const [cloneSlug, setCloneSlug] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const btnSize = size === "sm" ? "sm" : undefined;

  function close() {
    setModal(null);
    setError(null);
  }

  async function suspendToggle() {
    setBusy("suspend");
    setError(null);
    const action = status === "paused" ? "reactivate" : "suspend";
    const res = await fetch(`/api/admin/cafes/${tenantId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? "Failed";
      toast.push(msg, "danger");
      return;
    }
    toast.push(action === "suspend" ? `${tenantName} suspended` : `${tenantName} reactivated`, "ok");
    router.refresh();
  }

  async function impersonate() {
    if (!reason.trim()) return setError("A reason is required");
    setBusy("impersonate");
    setError(null);
    const res = await fetch(`/api/admin/cafes/${tenantId}/impersonate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Failed");
    window.location.href = data.redirectTo ?? "/owner/orders";
  }

  async function clone() {
    setBusy("clone");
    setError(null);
    const res = await fetch(`/api/admin/cafes/${tenantId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cloneName, slug: cloneSlug }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Failed");
    toast.push(`${cloneName} created`, "ok");
    router.push(`/admin/cafes/${data.tenantId}`);
  }

  async function del() {
    setBusy("delete");
    setError(null);
    const res = await fetch(`/api/admin/cafes/${tenantId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugConfirm: deleteConfirm }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Failed");
    toast.push(`${tenantName} deleted — retained 90 days`, "ok");
    router.push("/admin/cafes");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {canImpersonate && status !== "cancelled" && (
        <button className="hq-btn" data-size={btnSize} onClick={() => setModal("impersonate")}>
          Login as owner
        </button>
      )}
      {canEdit && (
        <button className="hq-btn" data-size={btnSize} onClick={() => router.push(`/admin/cafes/${tenantId}/edit`)}>
          Edit
        </button>
      )}
      {canBilling && status !== "cancelled" && (
        <button className="hq-btn" data-size={btnSize} disabled={busy === "suspend"} onClick={suspendToggle}>
          {status === "paused" ? "Reactivate" : "Suspend"}
        </button>
      )}
      {canEdit && status !== "cancelled" && (
        <button className="hq-btn" data-size={btnSize} onClick={() => setModal("clone")}>
          Clone
        </button>
      )}
      {canBilling && status !== "cancelled" && (
        <button className="hq-btn" data-variant="danger" data-size={btnSize} onClick={() => setModal("delete")}>
          Delete
        </button>
      )}

      <Modal
        open={modal === "impersonate"}
        title={`Login as ${tenantName}'s owner`}
        onClose={close}
        footer={
          <>
            <button className="hq-btn" onClick={close}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="primary" disabled={busy === "impersonate"} onClick={impersonate}>
              {busy === "impersonate" ? "Signing in…" : "Continue — 60 minute session"}
            </button>
          </>
        }
      >
        <div className="hq-note">Reason is required and stored in the activity log.</div>
        <Field label="Reason" error={error ?? undefined}>
          <input autoFocus type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. menu setup" />
        </Field>
      </Modal>

      <Modal
        open={modal === "clone"}
        title={`Clone ${tenantName}`}
        onClose={close}
        footer={
          <>
            <button className="hq-btn" onClick={close}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="primary" disabled={busy === "clone" || !cloneSlug} onClick={clone}>
              {busy === "clone" ? "Cloning…" : "Clone cafe"}
            </button>
          </>
        }
      >
        <div className="hq-note">Copies theme, settings, tables and menu. Not orders, staff, tickets or QR tokens.</div>
        <Field label="New cafe name">
          <input type="text" value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
        </Field>
        <Field label="New slug" error={error ?? undefined}>
          <input
            type="text"
            className="mono"
            value={cloneSlug}
            onChange={(e) => setCloneSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder={`${tenantSlug}-2`}
          />
        </Field>
      </Modal>

      <Modal
        open={modal === "delete"}
        title={`Delete ${tenantName}`}
        onClose={close}
        footer={
          <>
            <button className="hq-btn" onClick={close}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="danger" disabled={busy === "delete" || deleteConfirm !== tenantSlug} onClick={del}>
              {busy === "delete" ? "Deleting…" : "Delete cafe"}
            </button>
          </>
        }
      >
        <div className="hq-note" data-tone="danger">
          Soft delete — data retained 90 days. Type <b className="mono">{tenantSlug}</b> to confirm.
        </div>
        <Field label="Confirm slug" error={error ?? undefined}>
          <input type="text" className="mono" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
