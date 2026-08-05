"use client";

import { useState } from "react";
import type { TicketDTO } from "@/lib/owner-support";
import { Modal } from "@/components/owner/Modal";

/**
 * Support tab — ported verbatim from bella-admin-console.html's "Support"
 * tab (Phase H #7). Real `Ticket`/`TicketMessage` rows replace the mock
 * `TICKETS` array. `state: 'with_us'` (support has replied, waiting on the
 * cafe) is only ever set from the HQ side — Phase I, not built yet — so
 * that stat will read 0 until then; the plumbing is already correct.
 */
const TOPICS = ["QR code / tables", "Menu & pricing", "Orders & kitchen", "Payments & settlement", "Something is broken", "Something else"];
const STATE_LABEL: Record<string, string> = { open: "Open", with_us: "With us", resolved: "Resolved" };

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} hr ago`;
  return `${Math.floor(m / 1440)} d ago`;
}
function lastMessageAt(t: TicketDTO): string {
  return t.messages[t.messages.length - 1]?.at ?? t.createdAt;
}

export function SupportView({ initialTickets }: { initialTickets: TicketDTO[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [filterH, setFilterH] = useState<"all" | "open" | "resolved">("all");
  const [openTicketId, setOpenTicketId] = useState<string | undefined>(initialTickets[0]?.id);
  const [newOpen, setNewOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const openCount = tickets.filter((t) => t.state !== "resolved").length;
  const withUs = tickets.filter((t) => t.state === "with_us").length;
  const resolvedCount = tickets.filter((t) => t.state === "resolved").length;

  const list = tickets
    .filter((t) => filterH === "all" || (filterH === "open" ? t.state !== "resolved" : t.state === "resolved"))
    .sort((a, b) => new Date(lastMessageAt(b)).getTime() - new Date(lastMessageAt(a)).getTime());

  const openTicket = tickets.find((t) => t.id === openTicketId);

  function updateTicket(id: string, patch: Partial<TicketDTO>) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function sendReply() {
    if (!openTicket || !reply.trim() || busy) return;
    setBusy(true);
    const res = await fetch(`/api/support/tickets/${openTicket.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply.trim() }),
    });
    setBusy(false);
    if (!res.ok) return flash("Couldn't send");
    const { message } = await res.json();
    updateTicket(openTicket.id, { state: "open", messages: [...openTicket.messages, message] });
    setReply("");
    flash("Sent");
  }

  async function setState(id: string, state: "open" | "resolved") {
    const res = await fetch(`/api/support/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (!res.ok) return flash("Couldn't update");
    updateTicket(id, { state });
    flash(state === "resolved" ? "Marked resolved" : "Reopened");
  }

  return (
    <section>
      <h2 className="title">Support</h2>
      <p className="sub-t">Raise anything — a bug, a new table code, a menu change. It lands on our desk instantly.</p>
      <div className="stats">
        <div className="stat">
          <em>Open queries</em>
          <b>{openCount}</b>
          <div className="sub">{tickets.length} all time</div>
        </div>
        <div className="stat gold">
          <em>Replied by us</em>
          <b>{withUs}</b>
          <div className="sub">waiting on you</div>
        </div>
        <div className="stat">
          <em>Typical reply</em>
          <b>&lt; 2 hr</b>
          <div className="sub">10 AM – 9 PM, all week</div>
        </div>
        <div className="stat">
          <em>Resolved</em>
          <b>{resolvedCount}</b>
          <div className="sub">closed queries</div>
        </div>
      </div>

      <div className="bar">
        <button className="chip" aria-pressed={filterH === "all"} onClick={() => setFilterH("all")}>
          All
        </button>
        <button className="chip" aria-pressed={filterH === "open"} onClick={() => setFilterH("open")}>
          Open
        </button>
        <button className="chip" aria-pressed={filterH === "resolved"} onClick={() => setFilterH("resolved")}>
          Resolved
        </button>
        <div className="spacer" />
        <button className="chip add-c" onClick={() => setNewOpen(true)}>
          + New query
        </button>
      </div>

      <div className="split">
        <div>
          {list.length ? (
            list.map((t) => {
              const last = t.messages[t.messages.length - 1];
              return (
                <div className="tk" key={t.id} aria-current={t.id === openTicketId} onClick={() => setOpenTicketId(t.id)}>
                  <div className="tk-h">
                    <b>{t.subject}</b>
                    <span className={`pill ${t.state}`}>{STATE_LABEL[t.state]}</span>
                  </div>
                  <div className="tk-prev">
                    {last?.authorKind === "support" ? <b style={{ color: "var(--accent)", fontWeight: 500 }}>We replied: </b> : null}
                    {last?.body}
                  </div>
                  <div className="tk-meta">
                    {t.code} · {t.topic}
                    {t.priority === "high" ? (
                      <>
                        {" "}
                        · <span className="pill p-high">Urgent</span>
                      </>
                    ) : null}{" "}
                    · {timeAgo(lastMessageAt(t))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="th-empty">No queries here.</div>
          )}
        </div>

        <div className="card">
          {!openTicket ? (
            <div className="th-empty">Pick a query on the left to see the conversation.</div>
          ) : (
            <>
              <div className="th-h">
                <div>
                  <h5>{openTicket.subject}</h5>
                  <div className="sub">
                    {openTicket.code} · {openTicket.topic} · raised {timeAgo(openTicket.createdAt)}
                  </div>
                </div>
                <span className={`pill ${openTicket.state}`}>{STATE_LABEL[openTicket.state]}</span>
              </div>
              <div className="msgs">
                {openTicket.messages.map((m) => (
                  <div className={`msg ${m.authorKind}`} key={m.id}>
                    <div className="who">{m.authorKind === "support" ? "Support" : "You"}</div>
                    <div className="bub">{m.body}</div>
                    <div className="t">{timeAgo(m.at)}</div>
                  </div>
                ))}
              </div>
              {openTicket.state === "resolved" ? (
                <div className="reply">
                  <button style={{ width: "100%", padding: "12px 16px" }} onClick={() => setState(openTicket.id, "open")}>
                    Reopen this query
                  </button>
                </div>
              ) : (
                <>
                  <div className="reply">
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add to this query…" />
                    <button disabled={!reply.trim() || busy} onClick={sendReply}>
                      Send
                    </button>
                  </div>
                  <button className="tiny" style={{ marginTop: 10 }} onClick={() => setState(openTicket.id, "resolved")}>
                    Mark as resolved
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)}>
        <NewQueryForm
          onClose={() => setNewOpen(false)}
          onCreated={(t) => {
            setTickets((prev) => [t, ...prev]);
            setOpenTicketId(t.id);
            flash(`${t.code} sent`);
          }}
        />
      </Modal>

      <div className={`toast${toast ? " show" : ""}`}>{toast ?? ""}</div>
    </section>
  );
}

function NewQueryForm({ onClose, onCreated }: { onClose: () => void; onCreated: (t: TicketDTO) => void }) {
  const [topicIdx, setTopicIdx] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [busy, setBusy] = useState(false);
  const ok = subject.trim() && body.trim();

  async function send() {
    setBusy(true);
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: TOPICS[topicIdx], subject: subject.trim(), body: body.trim(), priority }),
    });
    setBusy(false);
    if (!res.ok) return;
    const { ticket } = await res.json();
    onClose();
    onCreated({
      id: ticket.id,
      code: ticket.code,
      topic: ticket.topic,
      subject: ticket.subject,
      priority: ticket.priority,
      state: ticket.state,
      createdAt: ticket.createdAt,
      messages: ticket.messages.map((m: { id: string; authorKind: "cafe" | "support"; body: string; at: string }) => m),
    });
  }

  return (
    <>
      <h3>New query</h3>
      <p className="hint">Goes straight to our support desk with your cafe&rsquo;s details attached</p>
      <label className="fld">
        <em>What&rsquo;s it about</em>
        <div className="tpick">
          {TOPICS.map((t, i) => (
            <button key={t} aria-pressed={i === topicIdx} onClick={() => setTopicIdx(i)}>
              {t}
            </button>
          ))}
        </div>
      </label>
      <label className="fld">
        <em>Subject</em>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One line — e.g. Table 9 QR isn't working" autoComplete="off" />
      </label>
      <label className="fld">
        <em>Details</em>
        <textarea style={{ height: 96 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="The more detail, the faster we can fix it" />
      </label>
      <label className="fld">
        <em>How urgent</em>
        <div className="pick">
          <button aria-pressed={priority === "normal"} onClick={() => setPriority("normal")}>
            Normal
          </button>
          <button aria-pressed={priority === "high"} onClick={() => setPriority("high")}>
            Urgent — service is affected
          </button>
        </div>
      </label>
      <div className="mact">
        <button className="cancel" onClick={onClose}>
          Cancel
        </button>
        <button className="save" disabled={!ok || busy} onClick={send}>
          Send query
        </button>
      </div>
    </>
  );
}
