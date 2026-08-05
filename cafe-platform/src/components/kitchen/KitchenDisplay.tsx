"use client";

import { useEffect, useState } from "react";
import type { BoardOrderDTO } from "@/lib/owner-board";
import type { KitchenMenuGroup } from "@/lib/kitchen";
import { useLiveOrders } from "@/hooks/useLiveOrders";

/**
 * Kitchen display — ported verbatim from plan/bella-kitchen-display.html
 * (Phase G). Mock `tickets`/`render()` are replaced by `useLiveOrders` (the
 * same hook the console board uses — Rule: one sync path); `fire`/`markReady`/
 * `recall` all go through the existing `PATCH /api/orders/[id]/stage`
 * (Phase D) — a kitchen profile is already permitted `new→preparing`,
 * `preparing→ready` and the `ready→preparing` recall by
 * `lib/order-machine.ts`'s `canAdvance`, so Phase G needed zero new
 * stage-mutation endpoints.
 *
 * Per-item "done" ticks and the progress bar are **local-only UI state**,
 * matching the prototype exactly (its own `it.done` is never sent to a
 * backend either) — `OrderItem.plated` exists in the schema but is
 * deliberately left unwired here; see NOTES.md.
 *
 * "Picked up" is also local-only: it just clears a ticket off *this*
 * screen's ready rail. The order's real stage stays `ready` until a waiter
 * marks it `served` from the console (already built, Phase D) — kitchen
 * staff aren't permitted that transition (`canAdvance`), so there's nothing
 * for this button to call.
 */

const STAGE_LABEL: Record<string, string> = { new: "Not started", preparing: "Cooking" };
const ageMin = (placedAt: string, tickMs: number) => Math.max(0, Math.floor((tickMs - new Date(placedAt).getTime()) / 60000));
const waitMin = (readyAt: string, tickMs: number) => Math.max(0, Math.floor((tickMs - new Date(readyAt).getTime()) / 60000));
function heat(ageMinutes: number): "" | "w-amber" | "w-red" {
  return ageMinutes >= 14 ? "w-red" : ageMinutes >= 7 ? "w-amber" : "";
}

export function KitchenDisplay({
  tenantName,
  initialTickets,
  initialMenu,
  initialStation,
  splitKitchen,
}: {
  tenantName: string;
  initialTickets: BoardOrderDTO[];
  initialMenu: KitchenMenuGroup[];
  initialStation: "veg" | "nonveg";
  splitKitchen: boolean;
}) {
  const { orders: tickets, patchLocal } = useLiveOrders(initialTickets, "/api/stream");
  const [station, setStation] = useState<"veg" | "nonveg">(initialStation);
  const [menu, setMenu] = useState(initialMenu);
  const [plated, setPlated] = useState<Record<string, Set<number>>>({});
  const [pickedUpIds, setPickedUpIds] = useState<Set<string>>(new Set());
  const [doneCount, setDoneCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [tickMs, setTickMs] = useState(() => Date.now());
  const [clock, setClock] = useState("--:--");

  useEffect(() => {
    const id = setInterval(() => setTickMs(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const format = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ticking wall clock, not derived state
    setClock(format());
    const id = setInterval(() => setClock(format()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const mine = splitKitchen ? tickets.filter((t) => t.station === station || t.station === "mixed") : tickets;
  const active = mine.filter((t) => t.stage !== "ready").sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  const readyNow = mine
    .filter((t) => t.stage === "ready" && !pickedUpIds.has(t.id))
    .sort((a, b) => (a.readyAt ?? a.placedAt).localeCompare(b.readyAt ?? b.placedAt));
  const oldest = active.length ? ageMin(active[0].placedAt, tickMs) : 0;

  async function patchStage(order: BoardOrderDTO, to: "preparing" | "ready", extra?: Partial<BoardOrderDTO>) {
    const prevStage = order.stage;
    const prevReadyAt = order.readyAt;
    setBusyId(order.id);
    patchLocal(order.id, { stage: to, ...extra });
    try {
      const res = await fetch(`/api/orders/${order.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      if (!res.ok) {
        patchLocal(order.id, { stage: prevStage, readyAt: prevReadyAt });
        setToast("Couldn't update that ticket");
        return false;
      }
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function fire(order: BoardOrderDTO) {
    if (await patchStage(order, "preparing")) setToast(`Table ${order.tableLabel} started`);
  }

  async function markReady(order: BoardOrderDTO) {
    setPlated((prev) => ({ ...prev, [order.id]: new Set(order.items.map((_, i) => i)) }));
    const ok = await patchStage(order, "ready", { readyAt: new Date().toISOString() });
    if (ok) {
      setDoneCount((c) => c + 1);
      setToast(`Table ${order.tableLabel} ready — call the floor`);
    }
  }

  async function recall(order: BoardOrderDTO) {
    if (await patchStage(order, "preparing")) {
      setDoneCount((c) => Math.max(0, c - 1));
      setToast(`Table ${order.tableLabel} recalled to the pass`);
    }
  }

  function pickedUp(order: BoardOrderDTO) {
    setPickedUpIds((prev) => new Set(prev).add(order.id));
    setToast(`Table ${order.tableLabel} picked up`);
  }

  function toggleItemDone(orderId: string, idx: number) {
    setPlated((prev) => {
      const set = new Set(prev[orderId] ?? []);
      if (set.has(idx)) set.delete(idx);
      else set.add(idx);
      return { ...prev, [orderId]: set };
    });
  }
  function tickAll(order: BoardOrderDTO) {
    setPlated((prev) => ({ ...prev, [order.id]: new Set(order.items.map((_, i) => i)) }));
  }

  async function toggleAvailability(itemId: string, name: string, currentlyAvailable: boolean) {
    setMenu((prev) => prev.map((g) => ({ ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, available: !currentlyAvailable } : i)) })));
    const res = await fetch(`/api/menu/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !currentlyAvailable }),
    });
    if (!res.ok) {
      setMenu((prev) => prev.map((g) => ({ ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, available: currentlyAvailable } : i)) })));
      setToast("Couldn't update the menu");
      return;
    }
    setToast(`${name} ${!currentlyAvailable ? "back on" : "86'd — off the menu"}`);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      setFullscreen(false);
    } else {
      document.documentElement.requestFullscreen?.();
      setFullscreen(true);
    }
  }

  const menuGroups = splitKitchen ? menu.filter((g) => g.isVeg === (station === "veg")) : menu;

  return (
    <div className="kitchen-root">
      <div className="kitchen">
        <div className="rail">
          <div className="brand">
            <span className="n">{tenantName}</span>
            <span className="r">Kitchen</span>
          </div>

          {splitKitchen && (
            <div className="station" data-s={station}>
              <div className="glide" />
              <button aria-pressed={station === "veg"} onClick={() => setStation("veg")}>
                <i className="dot" />
                Veg
              </button>
              <button aria-pressed={station === "nonveg"} onClick={() => setStation("nonveg")}>
                <i className="dot nv" />
                Non-veg
              </button>
            </div>
          )}

          <div className="spacer" />
          <div className="gauge">
            <b>{active.length}</b>
            <em>On the pass</em>
          </div>
          <div className={`gauge${oldest >= 14 ? " hot" : oldest >= 7 ? " warn" : ""}`}>
            <b>{oldest}</b>
            <em>Oldest, min</em>
          </div>
          <div className="gauge">
            <b>{doneCount}</b>
            <em>Done today</em>
          </div>
          <div className="clock">{clock}</div>
          <button className="tool" onClick={() => setSheetOpen(true)}>
            86 list
          </button>
          <button className={`tool${fullscreen ? " on" : ""}`} onClick={toggleFullscreen}>
            Full screen
          </button>
        </div>

        <div className="board">
          {active.length ? (
            active.map((t) => {
              const doneSet = plated[t.id] ?? new Set<number>();
              const doneN = doneSet.size;
              const pct = t.items.length ? Math.round((doneN / t.items.length) * 100) : 0;
              const age = ageMin(t.placedAt, tickMs);
              const h = heat(age);
              return (
                <article className={`tk ${h}${t.stage === "new" ? " new" : ""}`} key={t.id}>
                  <div className="tkh">
                    <div>
                      <div className="tbl">
                        <i className={`dot${t.station === "veg" ? "" : " nv"}`} />
                        Table {t.tableLabel}
                      </div>
                      <div className="id">
                        {t.code} · {STAGE_LABEL[t.stage] ?? t.stage}
                      </div>
                    </div>
                    <div className="age">
                      {age}
                      <small>min</small>
                    </div>
                  </div>
                  <div className="prog">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <div className="items">
                    {t.items.map((item, idx) => {
                      const isDone = doneSet.has(idx);
                      return (
                        <div className={`it${isDone ? " done" : ""}`} key={idx} onClick={() => toggleItemDone(t.id, idx)}>
                          <span className="qty">{item.qty}×</span>
                          <div className="body">
                            <div className="nm">{item.name}</div>
                            <div className="sz">{item.variantLabel}</div>
                          </div>
                          <span className="box">
                            <svg viewBox="0 0 24 24" fill="none" stroke="var(--veg)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 12.5 9.5 18 20 6.5" />
                            </svg>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {t.note ? (
                    <div className="note">
                      <b>Note</b>
                      {t.note}
                    </div>
                  ) : null}
                  <div className="tkf">
                    {t.stage === "new" ? (
                      <button className="go" disabled={busyId === t.id} onClick={() => fire(t)}>
                        Start cooking
                      </button>
                    ) : (
                      <>
                        <button className="go" disabled={busyId === t.id} onClick={() => markReady(t)}>
                          Ready · {doneN}/{t.items.length}
                        </button>
                        {doneN < t.items.length ? (
                          <button className="go ghost" onClick={() => tickAll(t)}>
                            Tick all
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="board-empty">
              <span className="big">All clear</span>
              No pending tickets at this station.
              <br />
              A new order will show up here automatically.
            </div>
          )}
        </div>

        <div className="strip">
          <span className="lbl">Ready to pick up</span>
          {readyNow.length ? (
            readyNow.map((t) => {
              const w = t.readyAt ? waitMin(t.readyAt, tickMs) : 0;
              return (
                <div className="rd" key={t.id}>
                  <div>
                    <b>Table {t.tableLabel}</b>
                    <div className="id">{t.code}</div>
                  </div>
                  {w >= 3 ? <span className="wait">waiting {w}m</span> : null}
                  <button onClick={() => pickedUp(t)}>Picked up</button>
                  <button onClick={() => recall(t)}>Recall</button>
                </div>
              );
            })
          ) : (
            <span className="none">Nothing on the pass right now.</span>
          )}
        </div>

        <div className={`scrim${sheetOpen ? " show" : ""}`} onClick={() => setSheetOpen(false)} />
        <aside className={`sheet${sheetOpen ? " show" : ""}`}>
          <button className="closex" onClick={() => setSheetOpen(false)}>
            ×
          </button>
          <h3>86 list</h3>
          <p className="hint">Something run out? Turn it off here — it disappears from the customer menu instantly and stops new orders.</p>
          {menuGroups.map((g) => (
            <div key={g.categoryId}>
              <div className="grp">{g.categoryName}</div>
              {g.items.map((i) => (
                <div className={`mrow${i.available ? "" : " off"}`} key={i.id}>
                  <span className="n">{i.name}</span>
                  <button className="tog" aria-pressed={i.available} onClick={() => toggleAvailability(i.id, i.name, i.available)} />
                </div>
              ))}
            </div>
          ))}
        </aside>

        <div className={`toast${toast ? " show" : ""}`}>{toast ?? ""}</div>
      </div>
    </div>
  );
}
