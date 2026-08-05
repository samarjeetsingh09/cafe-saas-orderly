"use client";

import { useEffect, useState } from "react";
import type { CustomerCategoryDTO } from "@/lib/menu";
import type { BoardOrderDTO } from "@/lib/owner-board";
import { Modal } from "@/components/owner/Modal";

/**
 * "Take an order" — the waiter POS modal, ported verbatim from
 * plan/bella-admin-console.html's `takeOrderForm()` (Phase H #2). Sends
 * `channel: 'staff'` + `tableId` to the same `POST /api/orders` the QR
 * customer flow uses (`lib/orders.ts`'s `createOrder`) — the ticket reaches
 * the kitchen exactly the way a QR order does.
 */
const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");

type CartLine = { variantId: string; itemName: string; variantLabel: string; pricePaise: number; qty: number };

export function TakeOrderModal({
  open,
  onClose,
  presetTable,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  presetTable?: { id: string; label: string };
  onPlaced: (order: BoardOrderDTO) => void;
}) {
  const [categories, setCategories] = useState<CustomerCategoryDTO[] | null>(null);
  const [gstPercent, setGstPercent] = useState(5);
  const [tables, setTables] = useState<{ id: string; label: string }[] | null>(null);
  const [tableId, setTableId] = useState<string | undefined>(presetTable?.id);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [note, setNote] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "online" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseed the picker to whichever table card opened this
    setTableId(presetTable?.id);
    if (categories) return;
    Promise.all([fetch("/api/menu").then((r) => r.json()), fetch("/api/tables").then((r) => r.json())]).then(([menuData, tableData]) => {
      setCategories(menuData.categories ?? []);
      setGstPercent(menuData.gstPercent ?? 5);
      setTables(tableData.tables ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setCart({});
    setNote("");
    setPayMethod(null);
    setError(null);
  }

  function addVariant(itemName: string, variantId: string, variantLabel: string, pricePaise: number) {
    setCart((prev) => {
      const existing = prev[variantId];
      if (existing) return { ...prev, [variantId]: { ...existing, qty: existing.qty + 1 } };
      return { ...prev, [variantId]: { variantId, itemName, variantLabel, pricePaise, qty: 1 } };
    });
  }
  function bump(variantId: string, delta: number) {
    setCart((prev) => {
      const line = prev[variantId];
      if (!line) return prev;
      const qty = line.qty + delta;
      if (qty <= 0) {
        const next = { ...prev };
        delete next[variantId];
        return next;
      }
      return { ...prev, [variantId]: { ...line, qty } };
    });
  }

  const lines = Object.values(cart);
  const subtotalPaise = lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
  const taxPaise = Math.round((subtotalPaise * gstPercent) / 100);
  const grandPaise = subtotalPaise + taxPaise;
  const canSend = lines.length > 0 && !!tableId && !!payMethod && !submitting;

  async function send() {
    if (!canSend) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "staff",
          tableId,
          items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, note: null })),
          payMethod,
          note: note.trim() || null,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that order");
        return;
      }
      onPlaced(data.order);
      reset();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      wide
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <h3>Take an order</h3>
      <p className="hint">Punch it in for the customer — the ticket reaches the kitchen exactly like a QR order</p>
      <div className="po">
        <div>
          <label className="fld" style={{ marginBottom: 8 }}>
            <em>Menu</em>
          </label>
          <div className="po-menu">
            {!categories ? (
              <div className="po-empty">Loading…</div>
            ) : (
              categories
                .filter((c) => c.items.length)
                .map((cat) => (
                  <div key={cat.id}>
                    <div className="po-grp">
                      <i className={`dot${cat.isVeg ? "" : " nv"}`} />
                      {cat.name}
                    </div>
                    {cat.items.map((item) => (
                      <div className={`po-row${item.available ? "" : " off"}`} key={item.id}>
                        <div className="nm">
                          {item.name}
                          {item.variants.length > 1 && <div className="vlabel">{item.variants.map((v) => v.label).join(" · ")}</div>}
                        </div>
                        {item.available ? (
                          <div className="po-v">
                            {item.variants.map((v) => {
                              const q = cart[v.id]?.qty ?? 0;
                              return (
                                <button key={v.id} className="po-add" onClick={() => addVariant(item.name, v.id, v.label, v.pricePaise)}>
                                  {item.variants.length > 1 ? `${v.label} ` : ""}
                                  {money(v.pricePaise)}
                                  {q ? <span className="q">{q}</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="sold">86&rsquo;d</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))
            )}
          </div>
        </div>
        <div className="po-side">
          <h6>Table</h6>
          <div className="tnum">
            {(tables ?? []).map((t) => (
              <button key={t.id} aria-pressed={t.id === tableId} onClick={() => setTableId(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ height: 14 }} />
          <h6>Order</h6>
          <div className="po-cart">
            {lines.length ? (
              lines.map((l) => (
                <div className="po-line" key={l.variantId}>
                  <div className="t">
                    {l.itemName}
                    <small>
                      {l.variantLabel} · {money(l.pricePaise)}
                    </small>
                  </div>
                  <div className="qbtns">
                    <button onClick={() => bump(l.variantId, -1)}>−</button>
                    <span>{l.qty}</span>
                    <button onClick={() => bump(l.variantId, 1)}>+</button>
                  </div>
                  <div className="amt">{money(l.pricePaise * l.qty)}</div>
                </div>
              ))
            ) : (
              <div className="po-empty">Tap items on the left — they&rsquo;ll add up here.</div>
            )}
          </div>
          {lines.length ? (
            <div className="po-tot">
              <div>
                <span>Subtotal</span>
                <span>{money(subtotalPaise)}</span>
              </div>
              <div>
                <span>GST {gstPercent}%</span>
                <span>{money(taxPaise)}</span>
              </div>
              <div className="g">
                <span>Total</span>
                <span>{money(grandPaise)}</span>
              </div>
            </div>
          ) : null}
          <label className="fld">
            <em>Note for the kitchen</em>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Less spicy, no onion…" />
          </label>
          <h6 style={{ marginTop: 4 }}>Payment</h6>
          <div className="pick">
            <button aria-pressed={payMethod === "cash"} onClick={() => setPayMethod("cash")}>
              Cash at table
            </button>
            <button aria-pressed={payMethod === "online"} onClick={() => setPayMethod("online")}>
              Paid online
            </button>
          </div>
        </div>
      </div>
      {error ? <p className="error-note" style={{ marginTop: 10 }}>{error}</p> : null}
      <div className="mact">
        <button
          className="cancel"
          onClick={() => {
            reset();
            onClose();
          }}
        >
          Cancel
        </button>
        <button className="save" disabled={!canSend} onClick={send}>
          {lines.length ? `Send to kitchen · ${money(grandPaise)}` : "Send to kitchen"}
        </button>
      </div>
    </Modal>
  );
}
