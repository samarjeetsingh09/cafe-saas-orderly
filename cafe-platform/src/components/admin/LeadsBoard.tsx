"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal, Field } from "@/components/admin/ui/Modal";
import { useToast } from "@/components/admin/ui/Toast";
import { Badge, Empty } from "@/components/admin/ui";
import { LEAD_STAGES, STAGE_LABEL } from "@/lib/hq-lead-stages";
import type { LeadDTO } from "@/lib/hq-leads";
import type { SalesLeadStage } from "@prisma/client";

const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  walk_in: "Walk-in",
  instagram: "Instagram",
};

const EMPTY_FORM = { cafeName: "", ownerName: "", phone: "", email: "", city: "", source: "website", notes: "", nextFollowUp: "" };

export function LeadsBoard({ initial }: { initial: LeadDTO[] }) {
  const router = useRouter();
  const toast = useToast();
  const [leads, setLeads] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<SalesLeadStage | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<LeadDTO | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  async function move(id: string, stage: SalesLeadStage) {
    const before = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l))); // optimistic
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      setLeads(before);
      toast.push("Couldn't move that lead", "danger");
      return;
    }
    toast.push(`Moved to ${STAGE_LABEL[stage]}`, "ok");
    router.refresh();
  }

  async function create() {
    setBusy(true);
    const res = await fetch("/api/admin/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, email: form.email || undefined, nextFollowUp: form.nextFollowUp || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.push((await res.json().catch(() => ({}))).error ?? "Couldn't add that lead", "danger");
      return;
    }
    const { lead } = await res.json();
    setLeads((ls) => [
      { ...lead, nextFollowUp: lead.nextFollowUp, createdAt: lead.createdAt, ownerUserName: null } as LeadDTO,
      ...ls,
    ]);
    setNewOpen(false);
    setForm(EMPTY_FORM);
    toast.push("Lead added", "ok");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
    setBusy(false);
    setLeads((ls) => ls.filter((l) => l.id !== id));
    setDetail(null);
    toast.push("Lead removed");
    router.refresh();
  }

  const overdue = (iso: string | null) => iso !== null && new Date(iso) < new Date();

  return (
    <>
      <div className="hq-toolbar">
        <span className="grow" />
        <button className="hq-btn" data-variant="accent" onClick={() => setNewOpen(true)}>
          Add lead
        </button>
      </div>

      {leads.length === 0 ? (
        <div className="hq-card">
          <Empty
            title="Pipeline is empty"
            action={
              <button className="hq-btn" data-variant="accent" onClick={() => setNewOpen(true)}>
                Add the first lead
              </button>
            }
          >
            Track cafes you&rsquo;re talking to before they&rsquo;re provisioned. Drag a card between columns as the deal moves.
          </Empty>
        </div>
      ) : (
        <div className="hq-board">
          {LEAD_STAGES.map((stage) => {
            const col = leads.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                className={`hq-col${dropCol === stage ? " drop-active" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropCol(stage);
                }}
                onDragLeave={() => setDropCol((c) => (c === stage ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropCol(null);
                  if (dragging) move(dragging, stage);
                  setDragging(null);
                }}
              >
                <h3>
                  {STAGE_LABEL[stage]}
                  <span className="num">{col.length}</span>
                </h3>
                <div className="stack">
                  {col.map((l) => (
                    <article
                      key={l.id}
                      className="hq-lead"
                      draggable
                      onDragStart={() => setDragging(l.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => setDetail(l)}
                    >
                      <b>{l.cafeName}</b>
                      <div className="who">
                        {l.ownerName} · <span className="mono">{l.phone}</span>
                      </div>
                      <div className="foot">
                        <span>{l.city ?? (l.source ? SOURCE_LABEL[l.source] : "—")}</span>
                        {l.nextFollowUp ? (
                          <Badge tone={overdue(l.nextFollowUp) ? "danger" : "neutral"}>
                            {new Date(l.nextFollowUp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </Badge>
                        ) : l.tenantId ? (
                          <Badge tone="ok">Provisioned</Badge>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {col.length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--hq-text-3)", padding: "8px 2px" }}>Drop a card here</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={newOpen}
        title="Add a lead"
        onClose={() => setNewOpen(false)}
        footer={
          <>
            <button className="hq-btn" onClick={() => setNewOpen(false)}>
              Cancel
            </button>
            <button
              className="hq-btn"
              data-variant="accent"
              disabled={busy || !form.cafeName || !form.ownerName || !form.phone}
              onClick={create}
            >
              {busy ? "Adding…" : "Add lead"}
            </button>
          </>
        }
      >
        <Field label="Cafe name">
          <input value={form.cafeName} onChange={(e) => setForm({ ...form, cafeName: e.target.value })} autoFocus />
        </Field>
        <Field label="Owner name">
          <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Email" hint="Optional">
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="City">
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="Source">
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {Object.entries(SOURCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Next follow-up">
          <input type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </Modal>

      <Modal
        open={!!detail}
        title={detail?.cafeName ?? ""}
        onClose={() => setDetail(null)}
        footer={
          detail && (
            <>
              <button className="hq-btn" data-variant="danger" disabled={busy} onClick={() => remove(detail.id)}>
                Remove
              </button>
              <span style={{ flex: 1 }} />
              {detail.tenantId ? (
                <Link href={`/admin/cafes/${detail.tenantId}`} className="hq-btn" data-variant="primary">
                  Open cafe
                </Link>
              ) : (
                <Link
                  href={`/admin/cafes/new?leadId=${detail.id}&name=${encodeURIComponent(detail.cafeName)}&owner=${encodeURIComponent(detail.ownerName)}&phone=${encodeURIComponent(detail.phone)}&email=${encodeURIComponent(detail.email ?? "")}`}
                  className="hq-btn"
                  data-variant="accent"
                >
                  Convert to cafe
                </Link>
              )}
            </>
          )
        }
      >
        {detail && (
          <dl className="hq-dl">
            <div>
              <dt>Owner</dt>
              <dd>{detail.ownerName}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd className="mono">{detail.phone}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd className="mono">{detail.email ?? "—"}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{detail.city ?? "—"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{detail.source ? SOURCE_LABEL[detail.source] : "—"}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{STAGE_LABEL[detail.stage]}</dd>
            </div>
            <div>
              <dt>Owned by</dt>
              <dd>{detail.ownerUserName ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt>Next follow-up</dt>
              <dd>{detail.nextFollowUp ? new Date(detail.nextFollowUp).toLocaleDateString("en-IN") : "Not set"}</dd>
            </div>
            {detail.notes && (
              <div style={{ display: "block" }}>
                <dt style={{ marginBottom: 4 }}>Notes</dt>
                <dd style={{ textAlign: "left" }}>{detail.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </>
  );
}
