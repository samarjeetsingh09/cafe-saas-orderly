"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { Badge, TableWrap, Empty, shortDate } from "./ui";

export type StaffRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  station: string | null;
  active: boolean;
  createdAt: string;
};

type Reset = { fullName: string; email: string; password: string };

/**
 * Cafe staff table with the two support-desk actions the capability matrix
 * has listed since Phase I but nothing implemented: reset a password, and
 * switch an account off. The reset result is held in component state only —
 * it is never re-fetchable, so the modal is the one chance to copy it.
 */
export function StaffTable({ tenantId, users, canManage }: { tenantId: string; users: StaffRow[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<StaffRow | null>(null);
  const [reset, setReset] = useState<Reset | null>(null);
  const [copied, setCopied] = useState(false);

  async function doReset(u: StaffRow) {
    setBusy(u.id);
    const res = await fetch(`/api/admin/cafes/${tenantId}/users/${u.id}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    setConfirmReset(null);
    if (!res.ok) return toast.push(data.error ?? "Reset failed", "danger");
    setReset({ fullName: data.fullName, email: data.email, password: data.password });
    setCopied(false);
  }

  async function toggleActive(u: StaffRow) {
    setBusy(u.id);
    const res = await fetch(`/api/admin/cafes/${tenantId}/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.push(data.error ?? "Failed", "danger");
    toast.push(`${u.fullName} ${u.active ? "deactivated" : "reactivated"}`, "ok");
    router.refresh();
  }

  if (users.length === 0) return <Empty title="No staff accounts">This cafe has no logins yet.</Empty>;

  return (
    <>
      <TableWrap>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Added</th>
            <th>Status</th>
            {canManage && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} data-rail={u.active ? "ok" : undefined}>
              <td>
                <b style={{ fontWeight: 500 }}>{u.fullName}</b>
                {u.station && <span className="sub">{u.station} station</span>}
              </td>
              <td className="mono" style={{ color: "var(--hq-text-2)" }}>
                {u.email}
              </td>
              <td>{u.role}</td>
              <td className="mono" style={{ color: "var(--hq-text-3)" }}>
                {shortDate(u.createdAt)}
              </td>
              <td>
                <Badge tone={u.active ? "ok" : "neutral"} dot>
                  {u.active ? "Active" : "Inactive"}
                </Badge>
              </td>
              {canManage && (
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="hq-btn" data-size="sm" disabled={busy === u.id} onClick={() => setConfirmReset(u)}>
                      Reset password
                    </button>
                    <button className="hq-btn" data-size="sm" data-variant={u.active ? "danger" : undefined} disabled={busy === u.id} onClick={() => toggleActive(u)}>
                      {u.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Modal
        open={confirmReset !== null}
        title={`Reset password for ${confirmReset?.fullName ?? ""}`}
        onClose={() => setConfirmReset(null)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setConfirmReset(null)}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="primary" disabled={busy !== null} onClick={() => confirmReset && doReset(confirmReset)}>
              {busy ? "Resetting…" : "Generate new password"}
            </button>
          </>
        }
      >
        <div className="hq-note" data-tone="warn">
          Their current password stops working immediately. The new one is shown once — you will have to read it out to them.
        </div>
        <div className="hq-copy">
          <span className="k">Account</span>
          <span className="v mono">{confirmReset?.email}</span>
        </div>
      </Modal>

      <Modal
        open={reset !== null}
        title="New password — shown once"
        onClose={() => setReset(null)}
        footer={
          <button className="hq-btn" data-variant="primary" onClick={() => setReset(null)}>
            Done
          </button>
        }
      >
        <div className="hq-note" data-tone="ok">
          Password reset for <b>{reset?.fullName}</b>. Nothing stores the plaintext — close this and it is gone.
        </div>
        <div className="hq-copy">
          <span className="k">Email</span>
          <span className="v mono">{reset?.email}</span>
        </div>
        <div className="hq-copy">
          <span className="k">Password</span>
          <span className="v mono">{reset?.password}</span>
          <button
            className="hq-btn"
            data-size="sm"
            onClick={() => {
              if (reset) navigator.clipboard.writeText(reset.password);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </Modal>
    </>
  );
}
