"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Badge, Empty, StatStrip, Stat, dateTime, ago, TICKET_STATE, type Tone } from "./ui";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import type { HqTicketListRow, HqTicketDetail, SlaState } from "@/lib/hq-support";

/**
 * Header counters, derived here rather than in `lib/hq-support.ts`: that
 * module imports Prisma, and a value import from a client component would
 * drag the client into the browser bundle. Types are erased, so importing
 * them from there is free.
 */
function inboxCounts(rows: HqTicketListRow[]) {
  const open = rows.filter((r) => r.state !== "resolved");
  const answered = rows
    .filter((r) => r.responseHours !== null)
    .map((r) => r.responseHours as number)
    .sort((a, b) => a - b);
  return {
    open: open.length,
    unassigned: open.filter((r) => !r.assigneeId).length,
    breached: open.filter((r) => r.sla === "breached").length,
    dueSoon: open.filter((r) => r.sla === "due_soon").length,
    high: open.filter((r) => r.priority === "high").length,
    medianResponseHours: answered.length ? answered[Math.floor(answered.length / 2)] : null,
  };
}

const SLA_TONE: Record<SlaState, Tone> = {
  met: "ok",
  late: "warn",
  due_soon: "warn",
  open: "neutral",
  breached: "danger",
};
const SLA_LABEL: Record<SlaState, string> = {
  met: "In SLA",
  late: "Answered late",
  due_soon: "Due soon",
  open: "Waiting",
  breached: "SLA breached",
};

type HqUser = { id: string; fullName: string };

/**
 * Support inbox with §10 triage. The list is a client-side cache refreshed
 * after every mutation rather than a router refresh, so replying to a ticket
 * doesn't scroll the reading pane back to the top mid-conversation.
 */
export function SupportInboxHq({
  initialTickets,
  hqUsers,
  currentUserId,
  slaHours,
}: {
  initialTickets: HqTicketListRow[];
  hqUsers: HqUser[];
  currentUserId: string;
  slaHours: number;
}) {
  const toast = useToast();
  const [tickets, setTickets] = useState(initialTickets);
  const [state, setStateFilter] = useState("");
  const [owner, setOwner] = useState(""); // "", "me", "unassigned", or a user id
  const [priority, setPriority] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HqTicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetResult, setResetResult] = useState<{ fullName: string; email: string; password: string } | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [reason, setReason] = useState("");

  async function refreshList() {
    const res = await fetch("/api/admin/support/tickets");
    const j = await res.json().catch(() => ({ tickets: [] }));
    setTickets(j.tickets ?? []);
  }

  async function openTicket(id: string) {
    setSelectedId(id);
    setLoadingDetail(true);
    const res = await fetch(`/api/admin/support/tickets/${id}`);
    const j = await res.json().catch(() => ({}));
    setLoadingDetail(false);
    setDetail(j.ticket ?? null);
  }

  async function send() {
    if (!selectedId || !reply.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/support/tickets/${selectedId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, internal }),
    });
    setBusy(false);
    if (!res.ok) return toast.push("Could not send", "danger");
    setReply("");
    toast.push(internal ? "Note added" : "Reply sent to the cafe", "ok");
    await Promise.all([openTicket(selectedId), refreshList()]);
  }

  async function patch(body: Record<string, unknown>, msg: string) {
    if (!selectedId) return;
    setBusy(true);
    const res = await fetch(`/api/admin/support/tickets/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.push(data.error ?? "Failed", "danger");
    if (!data.unchanged) toast.push(msg, "ok");
    await Promise.all([openTicket(selectedId), refreshList()]);
  }

  async function resetCafeUser(profileId: string) {
    if (!detail) return;
    setBusy(true);
    const res = await fetch(`/api/admin/cafes/${detail.tenantId}/users/${profileId}/reset-password`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.push(data.error ?? "Reset failed", "danger");
    setResetResult({ fullName: data.fullName, email: data.email, password: data.password });
  }

  async function impersonate() {
    if (!detail || !reason.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/cafes/${detail.tenantId}/impersonate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.push(data.error ?? "Failed", "danger");
    window.location.href = data.redirectTo ?? "/owner/orders";
  }

  const shown = tickets.filter(
    (t) =>
      (!state || t.state === state) &&
      (!priority || t.priority === priority) &&
      (owner === ""
        ? true
        : owner === "me"
          ? t.assigneeId === currentUserId
          : owner === "unassigned"
            ? !t.assigneeId
            : t.assigneeId === owner)
  );

  const counts = inboxCounts(tickets);

  return (
    <>
      <StatStrip>
        <Stat label="Open" value={counts.open} />
        <Stat label="Unassigned" value={counts.unassigned} tone={counts.unassigned > 0 ? "warn" : "neutral"} />
        <Stat label="High priority" value={counts.high} tone={counts.high > 0 ? "warn" : "neutral"} />
        <Stat label="SLA breached" value={counts.breached} tone={counts.breached > 0 ? "danger" : "neutral"} />
        <Stat label="Due soon" value={counts.dueSoon} tone={counts.dueSoon > 0 ? "warn" : "neutral"} />
        <Stat label="Median response" value={counts.medianResponseHours === null ? "—" : `${counts.medianResponseHours}h`} delta={`SLA ${slaHours}h`} />
      </StatStrip>

      <div className="hq-toolbar">
        <select value={state} onChange={(e) => setStateFilter(e.target.value)} aria-label="State filter">
          <option value="">All states</option>
          <option value="open">Open</option>
          <option value="with_us">With us</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Assignee filter">
          <option value="">Anyone</option>
          <option value="me">Mine</option>
          <option value="unassigned">Unassigned</option>
          {hqUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority filter">
          <option value="">Any priority</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
        </select>
        <span style={{ flex: "1 1 auto" }} />
        <span style={{ fontSize: 12, color: "var(--hq-text-3)" }}>
          {shown.length} of {tickets.length}
        </span>
      </div>

      <div className="hq-inbox">
        <Card flush>
          {shown.length === 0 ? (
            <Empty title="No tickets here">Nothing matches these filters.</Empty>
          ) : (
            <div className="hq-inbox-list">
              {shown.map((t) => (
                <button
                  key={t.id}
                  className="hq-tick"
                  aria-current={selectedId === t.id ? "true" : undefined}
                  data-sla={t.state === "resolved" ? undefined : t.sla}
                  onClick={() => openTicket(t.id)}
                >
                  <div className="top">
                    <span className="mono" style={{ fontSize: 11, color: "var(--hq-text-3)" }}>
                      {t.code}
                    </span>
                    <Badge tone={TICKET_STATE[t.state]?.tone ?? "neutral"}>{TICKET_STATE[t.state]?.label ?? t.state}</Badge>
                  </div>
                  <div className="subj">{t.subject}</div>
                  <div className="meta">
                    <span>{t.tenantName}</span>
                    <span>·</span>
                    <span>{t.topic}</span>
                    {t.priority === "high" && <Badge tone="danger">high</Badge>}
                    {t.state !== "resolved" && (t.sla === "breached" || t.sla === "due_soon") && (
                      <Badge tone={SLA_TONE[t.sla]}>{SLA_LABEL[t.sla]}</Badge>
                    )}
                    <span style={{ marginLeft: "auto" }} className="mono">
                      {t.assigneeName ?? "unassigned"} · {ago(t.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card flush>
          {!selectedId && <Empty title="No ticket selected">Pick a ticket on the left to read its thread.</Empty>}
          {selectedId && loadingDetail && <Empty title="Loading…" />}
          {selectedId && detail && !loadingDetail && (
            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--hq-text-3)" }}>
                    {detail.code}
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{detail.subject}</h2>
                  <div style={{ fontSize: 12, color: "var(--hq-text-2)", marginTop: 2 }}>
                    <Link href={`/admin/cafes/${detail.tenantId}`} style={{ color: "inherit" }}>
                      {detail.tenantName}
                    </Link>{" "}
                    · {detail.topic}
                    {detail.openedByName && ` · opened by ${detail.openedByName}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {detail.state !== "resolved" ? (
                    <button className="hq-btn" data-size="sm" disabled={busy} onClick={() => patch({ state: "resolved" }, "Ticket resolved")}>
                      Mark resolved
                    </button>
                  ) : (
                    <button className="hq-btn" data-size="sm" disabled={busy} onClick={() => patch({ state: "open" }, "Ticket reopened")}>
                      Reopen
                    </button>
                  )}
                </div>
              </div>

              <div className="hq-formgrid" style={{ gap: 8 }}>
                <label className="hq-field">
                  <span className="lbl">Assignee</span>
                  <select
                    value={detail.assigneeId ?? ""}
                    disabled={busy}
                    onChange={(e) => patch({ assigneeId: e.target.value || null }, "Assignee updated")}
                  >
                    <option value="">Unassigned</option>
                    {hqUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                        {u.id === currentUserId ? " (me)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="hq-field">
                  <span className="lbl">Priority</span>
                  <select value={detail.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value }, "Priority updated")}>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <div className="hq-field">
                  <span className="lbl">First response</span>
                  <div style={{ fontSize: 13, paddingTop: 5 }}>
                    {detail.firstReplyAt ? (
                      <span className="mono">{dateTime(detail.firstReplyAt)}</span>
                    ) : (
                      <Badge tone={SLA_TONE[tickets.find((t) => t.id === detail.id)?.sla ?? "open"]}>
                        {SLA_LABEL[tickets.find((t) => t.id === detail.id)?.sla ?? "open"]} · opened {ago(detail.createdAt)} ago
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <details style={{ border: "1px solid var(--hq-line-soft)", borderRadius: "var(--hq-r-sm)", padding: "8px 10px" }}>
                <summary style={{ fontSize: 12, cursor: "pointer", color: "var(--hq-text-2)" }}>
                  Quick actions for {detail.tenantName}
                </summary>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="hq-btn" data-size="sm" disabled={busy || detail.tenantStatus === "cancelled"} onClick={() => setImpersonating(true)}>
                      Login as owner
                    </button>
                    <Link href={`/admin/activity?tenantId=${detail.tenantId}`} className="hq-btn" data-size="sm">
                      Recent activity
                    </Link>
                    <Link href={`/admin/cafes/${detail.tenantId}`} className="hq-btn" data-size="sm">
                      Open cafe
                    </Link>
                  </div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {detail.cafeUsers.map((u) => (
                      <div key={u.id} className="hq-copy">
                        <span className="k">{u.role}</span>
                        <span className="v mono">
                          {u.email}
                          {!u.active && " (inactive)"}
                        </span>
                        <button className="hq-btn" data-size="sm" disabled={busy} onClick={() => resetCafeUser(u.id)}>
                          Reset password
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              <div style={{ display: "grid", gap: 7, maxHeight: "42vh", overflowY: "auto" }}>
                {detail.messages.map((m) => (
                  <div key={m.id} className="hq-msg" data-kind={m.internal ? "internal" : m.authorKind}>
                    <div className="who">
                      {m.internal ? "Internal note" : m.authorKind === "support" ? "OrderLy support" : detail.tenantName} · {dateTime(m.at)}
                    </div>
                    {m.body}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={internal ? "Internal note (never visible to the cafe)…" : "Reply — appears in the cafe's Support tab…"}
                  rows={3}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <label className="hq-check">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                    <span>
                      Internal note
                      <span className="sub">HQ-only. Does not stop the SLA clock — the cafe hears nothing.</span>
                    </span>
                  </label>
                  <button className="hq-btn" data-variant="primary" disabled={busy || !reply.trim()} onClick={send}>
                    {internal ? "Add note" : "Send reply"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={impersonating}
        title={`Login as ${detail?.tenantName ?? ""}'s owner`}
        onClose={() => setImpersonating(false)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setImpersonating(false)}>
              Cancel
            </button>
            <button className="hq-btn" data-variant="primary" disabled={busy || !reason.trim()} onClick={impersonate}>
              Continue — 60 minute session
            </button>
          </>
        }
      >
        <div className="hq-note">Reason is required and stored in the activity log.</div>
        <label className="hq-field">
          <span className="lbl">Reason</span>
          <input type="text" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`ticket ${detail?.code ?? ""}`} />
        </label>
      </Modal>

      <Modal
        open={resetResult !== null}
        title="New password — shown once"
        onClose={() => setResetResult(null)}
        footer={
          <button className="hq-btn" data-variant="primary" onClick={() => setResetResult(null)}>
            Done
          </button>
        }
      >
        <div className="hq-note" data-tone="ok">
          Password reset for <b>{resetResult?.fullName}</b>. Nothing stores the plaintext — read it out before closing.
        </div>
        <div className="hq-copy">
          <span className="k">Email</span>
          <span className="v mono">{resetResult?.email}</span>
        </div>
        <div className="hq-copy">
          <span className="k">Password</span>
          <span className="v mono">{resetResult?.password}</span>
          <button className="hq-btn" data-size="sm" onClick={() => resetResult && navigator.clipboard.writeText(resetResult.password)}>
            Copy
          </button>
        </div>
      </Modal>
    </>
  );
}
