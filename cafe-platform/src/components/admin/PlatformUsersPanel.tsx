"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { Badge, TableWrap, Empty, dateTime, shortDate } from "./ui";

export type PlatformUserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLE_TONE: Record<string, "brand" | "info" | "neutral"> = { super_admin: "brand", ops: "info", support: "neutral" };
const ROLE_HINT: Record<string, string> = {
  super_admin: "Everything, including billing, deletion and this screen.",
  ops: "Provision, edit and impersonate. No billing or platform users.",
  support: "Inbox, impersonation and read-only everywhere else.",
};

/** HQ staff CRUD (HQ-PORTAL-SPEC.md §13). Rendered only for super_admin. */
export function PlatformUsersPanel({ users, currentUserId }: { users: PlatformUserRow[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PlatformUserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ fullName: string; email: string; password: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ops");

  function openAdd() {
    setFullName("");
    setEmail("");
    setRole("ops");
    setError(null);
    setAdding(true);
  }

  function openEdit(u: PlatformUserRow) {
    setFullName(u.fullName);
    setRole(u.role);
    setError(null);
    setEditing(u);
  }

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/platform-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, role }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    setAdding(false);
    setCredential({ fullName: data.fullName, email: data.email, password: data.password });
    router.refresh();
  }

  async function patch(u: PlatformUserRow, body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/platform-users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      toast.push(data.error ?? "Failed", "danger");
      return false;
    }
    if (data.password) setCredential({ fullName: data.fullName, email: data.email, password: data.password });
    else toast.push(successMsg, "ok");
    router.refresh();
    return true;
  }

  return (
    <>
      <div className="hq-toolbar" style={{ justifyContent: "flex-end", marginBottom: 0, padding: "10px 14px 0" }}>
        <button className="hq-btn" data-variant="accent" data-size="sm" onClick={openAdd}>
          + Add HQ user
        </button>
      </div>

      {users.length === 0 ? (
        <Empty title="No HQ accounts">That should be impossible — you are signed in as one.</Empty>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last login</th>
              <th>Added</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-rail={u.active ? (u.role === "super_admin" ? "info" : "ok") : undefined}>
                <td>
                  <b style={{ fontWeight: 500 }}>{u.fullName}</b>
                  {u.id === currentUserId && <span className="sub">you</span>}
                </td>
                <td className="mono" style={{ color: "var(--hq-text-2)" }}>
                  {u.email}
                </td>
                <td>
                  <Badge tone={ROLE_TONE[u.role] ?? "neutral"}>{u.role}</Badge>
                </td>
                <td className="mono" style={{ color: "var(--hq-text-3)" }}>
                  {u.lastLoginAt ? dateTime(u.lastLoginAt) : "never"}
                </td>
                <td className="mono" style={{ color: "var(--hq-text-3)" }}>
                  {shortDate(u.createdAt)}
                </td>
                <td>
                  <Badge tone={u.active ? "ok" : "neutral"} dot>
                    {u.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="hq-btn" data-size="sm" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    <button className="hq-btn" data-size="sm" disabled={busy} onClick={() => patch(u, { resetPassword: true }, "Password reset")}>
                      Reset password
                    </button>
                    <button
                      className="hq-btn"
                      data-size="sm"
                      data-variant={u.active ? "danger" : undefined}
                      disabled={busy || u.id === currentUserId}
                      title={u.id === currentUserId ? "You cannot deactivate your own account" : undefined}
                      onClick={() => patch(u, { active: !u.active }, u.active ? "Account deactivated" : "Account reactivated")}
                    >
                      {u.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal
        open={adding}
        title="Add an HQ user"
        onClose={() => setAdding(false)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="primary" disabled={busy || !fullName || !email} onClick={create}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </>
        }
      >
        <Field label="Full name">
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" className="mono" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role" hint={ROLE_HINT[role]}>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ops">ops</option>
            <option value="support">support</option>
            <option value="super_admin">super_admin</option>
          </select>
        </Field>
        {error && (
          <div className="hq-note" data-tone="danger">
            {error}
          </div>
        )}
      </Modal>

      <Modal
        open={editing !== null}
        title={`Edit ${editing?.fullName ?? ""}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="hq-btn"
              data-variant="primary"
              disabled={busy}
              onClick={async () => {
                if (!editing) return;
                if (await patch(editing, { fullName, role }, "Account updated")) setEditing(null);
              }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <Field label="Full name">
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Role" hint={ROLE_HINT[role]}>
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={editing?.id === currentUserId}>
            <option value="ops">ops</option>
            <option value="support">support</option>
            <option value="super_admin">super_admin</option>
          </select>
        </Field>
        {editing?.id === currentUserId && <div className="hq-note">You cannot change your own role — ask another super admin.</div>}
        {error && (
          <div className="hq-note" data-tone="danger">
            {error}
          </div>
        )}
      </Modal>

      <Modal
        open={credential !== null}
        title="Password — shown once"
        onClose={() => setCredential(null)}
        footer={
          <button className="hq-btn" data-variant="primary" onClick={() => setCredential(null)}>
            Done
          </button>
        }
      >
        <div className="hq-note" data-tone="ok">
          For <b>{credential?.fullName}</b>. Nothing stores the plaintext — close this and it is gone.
        </div>
        <div className="hq-copy">
          <span className="k">Email</span>
          <span className="v mono">{credential?.email}</span>
        </div>
        <div className="hq-copy">
          <span className="k">Password</span>
          <span className="v mono">{credential?.password}</span>
          <button className="hq-btn" data-size="sm" onClick={() => credential && navigator.clipboard.writeText(credential.password)}>
            Copy
          </button>
        </div>
      </Modal>
    </>
  );
}
