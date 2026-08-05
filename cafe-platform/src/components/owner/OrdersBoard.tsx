"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProfileRole } from "@prisma/client";
import type { BoardOrderDTO, BoardStats } from "@/lib/owner-board";
import { NEXT, BACK, STAGE_LABEL, NEXT_ACTION_LABEL, canAdvance } from "@/lib/order-machine";
import { can } from "@/lib/permissions";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { TakeOrderModal } from "@/components/owner/TakeOrderModal";
import { Modal } from "@/components/owner/Modal";

/**
 * Live orders board — ported verbatim from plan/bella-admin-console.html's
 * "Live orders" tab (Phase D). Mock `orders`/`renderBoard()`/`advance()` are
 * replaced by real props + `PATCH /api/orders/[id]/stage` and
 * `/api/orders/[id]/settle`; the fake `setInterval` clock-tick that
 * re-rendered ticket ages every 30s is kept as-is (Rule 1 allows it).
 *
 * Order state itself comes from `useLiveOrders` (Phase E) — a click here
 * applies its own optimistic patch through the same state SSE events land
 * in, and a second open window sees the change within a second.
 */
const STAGES = ["new", "preparing", "ready", "served"] as const;
const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
const ageMin = (placedAt: string, tickMs: number) => Math.max(0, Math.floor((tickMs - new Date(placedAt).getTime()) / 60000));

export function OrdersBoard({
  initialStats,
  initialOrders,
  role,
}: {
  initialStats: BoardStats;
  initialOrders: BoardOrderDTO[];
  role: ProfileRole;
}) {
  const { orders, patchLocal } = useLiveOrders(initialOrders);
  const [filterK, setFilterK] = useState<"all" | "veg" | "nonveg">("all");
  const [takeOrderOpen, setTakeOrderOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BoardOrderDTO | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [tickMs, setTickMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTickMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  /**
   * A cancelled ticket is gone as far as this board is concerned —
   * `getBoardData` already filters it out server-side, so dropping it here
   * too keeps a just-cancelled order from lingering in the counters until
   * the next full load (it is neither "served" nor active).
   */
  const liveOrders = useMemo(() => orders.filter((o) => o.stage !== "cancelled"), [orders]);

  const stats: BoardStats = useMemo(() => {
    const active = liveOrders.filter((o) => o.stage !== "served").length;
    const late = liveOrders.filter((o) => o.stage !== "served" && ageMin(o.placedAt, tickMs) > 15).length;
    const tablesRunning = new Set(liveOrders.filter((o) => o.stage !== "served").map((o) => o.tableLabel)).size;
    // Recomputed here, not carried over from the server snapshot, so accepting a
    // ticket moves the figure immediately — same rule as `getBoardData`: a `new`
    // ticket is not a sale yet.
    const todaySalesPaise = liveOrders.filter((o) => o.stage !== "new").reduce((sum, o) => sum + o.totalPaise, 0);
    return { ...initialStats, activeOrders: active, tablesRunning, runningLateCount: late, todaySalesPaise };
  }, [liveOrders, tickMs, initialStats]);

  const visible = useMemo(
    () =>
      liveOrders.filter((o) => {
        if (filterK === "all") return true;
        if (filterK === "veg") return o.station === "veg";
        return o.station === "nonveg" || o.station === "mixed";
      }),
    [liveOrders, filterK]
  );

  async function mutate(orderId: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
    setPendingId(orderId);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error ?? "Something went wrong" };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    } finally {
      setPendingId(null);
    }
  }

  async function advance(order: BoardOrderDTO) {
    const to = NEXT[order.stage];
    if (!to) return;
    const prevStage = order.stage;
    patchLocal(order.id, { stage: to });
    const result = await mutate(order.id, `/api/orders/${order.id}/stage`, { to });
    if (!result.ok) {
      patchLocal(order.id, { stage: prevStage });
      setToast({ msg: result.error ?? "Couldn't update the order", error: true });
      return;
    }
    setToast({ msg: `${order.code} → ${STAGE_LABEL[to]}` });
  }

  async function stepBack(order: BoardOrderDTO) {
    const to = BACK[order.stage];
    if (!to) return;
    const prevStage = order.stage;
    patchLocal(order.id, { stage: to });
    const result = await mutate(order.id, `/api/orders/${order.id}/stage`, { to });
    if (!result.ok) {
      patchLocal(order.id, { stage: prevStage });
      setToast({ msg: result.error ?? "Couldn't update the order", error: true });
    }
  }

  /**
   * Cancel goes through the same `stage` route as every other move — the
   * machine already treats `cancelled` as an owner/manager-only transition
   * (`canAdvance`), so there is no second endpoint and no second rule set.
   * It is confirmed first: the ticket leaves the board for good and cannot
   * be walked back from here.
   */
  async function cancelOrder(order: BoardOrderDTO) {
    const prevStage = order.stage;
    setCancelTarget(null);
    patchLocal(order.id, { stage: "cancelled" });
    const result = await mutate(order.id, `/api/orders/${order.id}/stage`, { to: "cancelled" });
    if (!result.ok) {
      patchLocal(order.id, { stage: prevStage });
      setToast({ msg: result.error ?? "Couldn't cancel the order", error: true });
      return;
    }
    setToast({ msg: `${order.code} cancelled` });
  }

  async function settle(order: BoardOrderDTO) {
    patchLocal(order.id, { payStatus: "paid" });
    const result = await mutate(order.id, `/api/orders/${order.id}/settle`);
    if (!result.ok) {
      patchLocal(order.id, { payStatus: "pending" });
      setToast({ msg: result.error ?? "Couldn't collect", error: true });
      return;
    }
    setToast({ msg: `${order.code} collected — ${money(order.totalPaise)}` });
  }

  return (
    <section>
      <div className="stats">
        <div className="stat">
          <em>Active orders</em>
          <b>{stats.activeOrders}</b>
          <div className="sub">{stats.todayOrders} today</div>
        </div>
        <div className="stat gold">
          <em>Today&apos;s sales</em>
          <b>{money(stats.todaySalesPaise)}</b>
          <div className="sub">incl. {stats.gstPercent}% GST</div>
        </div>
        <div className="stat">
          <em>Tables running</em>
          <b>{stats.tablesRunning}</b>
          <div className="sub">of {stats.totalTables} covers</div>
        </div>
        <div className="stat">
          <em>Running late</em>
          <b className={stats.runningLateCount ? "late" : ""}>{stats.runningLateCount}</b>
          <div className="sub">over 15 min</div>
        </div>
      </div>

      <div className="bar">
        <button className="chip" aria-pressed={filterK === "all"} onClick={() => setFilterK("all")}>
          All kitchens
        </button>
        <button className="chip" aria-pressed={filterK === "veg"} onClick={() => setFilterK("veg")}>
          <i className="dot" />
          Veg
        </button>
        <button className="chip" aria-pressed={filterK === "nonveg"} onClick={() => setFilterK("nonveg")}>
          <i className="dot nv" />
          Non-veg
        </button>
        {can(role, "takeOrder") && (
          <>
            <div className="spacer" />
            <button className="chip add-c" onClick={() => setTakeOrderOpen(true)}>
              + Take an order
            </button>
          </>
        )}
      </div>

      <TakeOrderModal
        open={takeOrderOpen}
        onClose={() => setTakeOrderOpen(false)}
        onPlaced={(order) => setToast({ msg: `${order.code} punched in for table ${order.tableLabel}` })}
      />

      <div className="board">
        {STAGES.map((stage) => {
          const inCol = visible.filter((o) => o.stage === stage).sort((a, b) => a.placedAt.localeCompare(b.placedAt));
          return (
            <div className={`col${stage === "new" ? " new" : ""}`} key={stage}>
              <div className="col-h">
                <span>{STAGE_LABEL[stage]}</span>
                <i>{inCol.length}</i>
              </div>
              {inCol.length ? (
                inCol.map((o) => (
                  <TicketCard
                    key={o.id}
                    order={o}
                    tickMs={tickMs}
                    role={role}
                    busy={pendingId === o.id}
                    onAdvance={() => advance(o)}
                    onBack={() => stepBack(o)}
                    onSettle={() => settle(o)}
                    onCancel={() => setCancelTarget(o)}
                  />
                ))
              ) : (
                <div className="col-empty">
                  {stage === "new" ? (
                    <>
                      No new tickets.
                      <br />
                      Enjoy the quiet.
                    </>
                  ) : (
                    "Nothing here"
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)}>
        {cancelTarget && (
          <>
            <h3>Cancel {cancelTarget.code}?</h3>
            <p className="hint">
              Table {cancelTarget.tableLabel} · {cancelTarget.items.reduce((n, i) => n + i.qty, 0)} item
              {cancelTarget.items.reduce((n, i) => n + i.qty, 0) === 1 ? "" : "s"} · {money(cancelTarget.totalPaise)}
            </p>
            <div className="reqbox">
              <p>The ticket leaves the board and stops counting towards today&rsquo;s sales. It can&rsquo;t be brought back from here.</p>
              {cancelTarget.payStatus === "paid" ? (
                <p style={{ margin: 0 }}>
                  <b>This order is already paid</b> — the refund is yours to handle at the counter.
                </p>
              ) : null}
            </div>
            <div className="mact">
              <button className="cancel" onClick={() => setCancelTarget(null)}>
                Keep order
              </button>
              <button className="save danger" disabled={pendingId === cancelTarget.id} onClick={() => cancelOrder(cancelTarget)}>
                Cancel order
              </button>
            </div>
          </>
        )}
      </Modal>

      <div className={`toast${toast ? " show" : ""}${toast?.error ? " error" : ""}`}>{toast?.msg ?? ""}</div>
    </section>
  );
}

function TicketCard({
  order,
  tickMs,
  role,
  busy,
  onAdvance,
  onBack,
  onSettle,
  onCancel,
}: {
  order: BoardOrderDTO;
  tickMs: number;
  role: ProfileRole;
  busy: boolean;
  onAdvance: () => void;
  onBack: () => void;
  onSettle: () => void;
  onCancel: () => void;
}) {
  const m = ageMin(order.placedAt, tickMs);
  const late = m > 15 && order.stage !== "served";
  const isPaid = order.payStatus === "paid";
  // Online orders sit `payStatus: pending` for the instant between order
  // creation and the mock "I've paid" tap (BUILD-SPEC §9's "confirming
  // payment" window) — don't call that "Paid online" until it actually is.
  const isOnline = order.payMethod === "online";
  const payLabel = isOnline ? (isPaid ? "Paid online" : "Confirming payment…") : "Cash at table";
  const payClass = isOnline && isPaid ? "paid" : "cash";
  const nextTo = NEXT[order.stage];
  const canDoNext = nextTo ? canAdvance(role, order.stage, nextTo) : false;
  const canGoBack = order.stage === "preparing" || order.stage === "ready";
  // Only offered on a ticket nobody has started cooking yet — once it is in
  // the kitchen, "cancel" is a conversation with the pass, not a button.
  const canCancel = order.stage === "new" && canAdvance(role, order.stage, "cancelled");

  return (
    <article className={`tick${late ? " urgent" : ""}`}>
      <div className="t-h">
        <div>
          <div className="t-tbl">
            <i className={`dot${order.station === "veg" ? "" : " nv"}`} />
            Table {order.tableLabel}
          </div>
          <div className="t-id">
            {order.code}
            {order.placedByName ? <span className="by-pill">by {order.placedByName}</span> : null}
          </div>
        </div>
        <div className={`t-age${late ? " late" : ""}`}>
          {m} min{late ? " ⚠" : ""}
        </div>
      </div>
      <div className="t-items">
        {order.items.map((i, idx) => (
          <div className="t-row" key={idx}>
            <b>{i.qty}×</b>
            <span className="nm">
              {i.name}
              <br />
              <span className="sz">{i.variantLabel}</span>
            </span>
          </div>
        ))}
      </div>
      {order.note ? <div className="t-note">{order.note}</div> : null}
      <div className="t-f">
        <div>
          <span className={`pay-pill ${payClass}`}>{payLabel}</span>
          <div className="total">{money(order.totalPaise)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {order.stage !== "served" ? (
            <div className="t-acts">
              {canCancel ? (
                <button className="act danger" disabled={busy} onClick={onCancel}>
                  Cancel
                </button>
              ) : null}
              <button className={`act${order.stage === "new" ? " solid" : ""}`} disabled={busy || !canDoNext} onClick={onAdvance}>
                {NEXT_ACTION_LABEL[order.stage]}
              </button>
            </div>
          ) : isPaid ? (
            <span className="pay-pill paid">Settled</span>
          ) : !isOnline && can(role, "settleCash") ? (
            <button className="act" disabled={busy} onClick={onSettle}>
              Collect {money(order.totalPaise)}
            </button>
          ) : null}
          {canGoBack ? (
            <>
              <br />
              <button className="tiny" disabled={busy} onClick={onBack} style={{ marginTop: 7 }}>
                step back
              </button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
