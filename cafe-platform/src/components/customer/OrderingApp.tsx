"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CustomerCategoryDTO, ArtKey } from "@/lib/menu";
import type { BoardOrderDTO } from "@/lib/owner-board";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { useMenuAvailability } from "@/hooks/useMenuAvailability";
import { addSavedOrderId, keepSavedOrderIds, readSavedOrderIds } from "@/lib/saved-order";

/**
 * Customer ordering app — ported verbatim from
 * plan/bella-ordering-prototype_1.html (Phase F). Mock `MENU`/`state.cart`
 * are replaced by `categories` (server-fetched) + real component state;
 * `confirmOrder()`'s fake random id is replaced by `POST /api/orders`; the
 * tracker's fake `setInterval` auto-advance is replaced by SSE
 * (`OrderTrackerSheet` below, via `useLiveOrders`).
 *
 * The prototype's tap-to-change table picker is dropped on purpose — the
 * URL's `/t/[token]` already resolves the table server-side and nothing
 * lets a customer just type in a different one (that's the whole point of
 * per-table tokens, BUILD-SPEC.md §"URL: .../t/{qr_token}").
 */

const ART: Record<ArtKey, string> = {
  leaf: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M32 8C16 20 14 40 32 56 50 40 48 20 32 8Z"/><path d="M32 12v42"/><path d="M32 24l-9-6M32 32l-11-7M32 40l-9-6M32 24l9-6M32 32l11-7M32 40l9-6"/></svg>`,
  plate: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="32" cy="32" r="21"/><circle cx="32" cy="32" r="14"/><path d="M25 30c3-4 11-4 14 0M26 37c4 3 9 3 12 0"/></svg>`,
  pizza: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M32 10 54 50a44 44 0 0 1-44 0Z"/><path d="M14 42a44 44 0 0 0 36 0"/><circle cx="32" cy="30" r="2.4"/><circle cx="25" cy="40" r="2.4"/><circle cx="39" cy="40" r="2.4"/></svg>`,
  bowl: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M10 30h44c0 12-10 22-22 22S10 42 10 30Z"/><path d="M6 30h52"/><path d="M26 20c0-4 4-4 4-8M36 20c0-4 4-4 4-8"/></svg>`,
  cake: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M14 34h36v16H14z"/><path d="M14 34c4-6 32-6 36 0"/><path d="M22 26c0-4 3-4 3-7M32 24c0-4 3-4 3-7M42 26c0-4 3-4 3-7"/><path d="M10 50h44"/></svg>`,
  cup: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M16 22h28v16c0 8-6 14-14 14s-14-6-14-14z"/><path d="M44 26h6a5 5 0 0 1 0 10h-6"/><path d="M24 12c0 4-3 4-3 7M34 12c0 4-3 4-3 7"/></svg>`,
};

const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

type CartLine = {
  itemId: string;
  itemName: string;
  itemIsVeg: boolean;
  variantId: string;
  variantLabel: string;
  pricePaise: number;
  qty: number;
};
type Cart = Record<string, CartLine>;
type SheetView = "closed" | "cart" | "pay" | "upi" | "placed";
type PayMethod = "cash" | "online";

export function OrderingApp({
  tenantName,
  tenantTagline,
  tenantSlug,
  tableLabel,
  qrToken,
  gstPercent,
  categories: initialCategories,
}: {
  tenantName: string;
  tenantTagline: string | null;
  tenantSlug: string;
  tableLabel: string;
  qrToken: string;
  gstPercent: number;
  categories: CustomerCategoryDTO[];
}) {
  const categories = useMenuAvailability(initialCategories, qrToken);
  const vegCats = useMemo(() => categories.filter((c) => c.isVeg), [categories]);
  const nonvegCats = useMemo(() => categories.filter((c) => !c.isVeg), [categories]);
  const [diet, setDiet] = useState<"veg" | "nonveg">(vegCats.length ? "veg" : "nonveg");
  const openCats = diet === "veg" ? vegCats : nonvegCats;

  const [activeCatId, setActiveCatId] = useState<string | undefined>(openCats[0]?.id);
  const activeCat = openCats.find((c) => c.id === activeCatId) ?? openCats[0];

  const [sizePick, setSizePick] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<Cart>({});
  const [sheet, setSheet] = useState<SheetView>("closed");
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** Every order this phone is still following, newest first. */
  const [tracked, setTracked] = useState<BoardOrderDTO[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const activeOrder = tracked.find((o) => o.id === activeOrderId) ?? tracked[0] ?? null;

  /**
   * Re-read every saved order from the server. The saved ids are the only
   * thing that survives a reload; the orders themselves are always the
   * server's answer, and ones it no longer recognises (reseeded database,
   * cancelled at the counter) are dropped from storage here rather than
   * lingering as a button that opens nothing.
   */
  const refreshTracked = useCallback(async (): Promise<BoardOrderDTO[]> => {
    const ids = readSavedOrderIds(qrToken);
    if (ids.length === 0) return [];

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/orders/${id}?qrToken=${qrToken}`);
          if (res.ok) {
            const { order } = (await res.json()) as { order: BoardOrderDTO };
            return order.stage === "cancelled" ? { id, drop: true } : order;
          }
          // 404 = gone for good. Anything else (500, offline) might be
          // transient, so keep the id and try again next time.
          return { id, drop: res.status === 404 };
        } catch {
          return { id, drop: false };
        }
      }),
    );

    const orders = results.filter((r): r is BoardOrderDTO => !("drop" in r));
    const kept = results.filter((r) => !("drop" in r) || !r.drop).map((r) => r.id);
    if (kept.length !== ids.length) keepSavedOrderIds(qrToken, kept);
    return orders;
  }, [qrToken]);

  /**
   * Rehydrate on arrival — Back button, reload, phone locked and the tab
   * evicted. Deliberately does *not* pop the sheet open: the customer chose
   * to be on the menu, so this only lights up the "Check progress" button and
   * lets them decide.
   */
  useEffect(() => {
    let cancelled = false;
    refreshTracked().then((orders) => {
      if (!cancelled) setTracked(orders);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshTracked]);

  function switchKitchen(side: "veg" | "nonveg") {
    if (side === diet) return;
    const cats = side === "veg" ? vegCats : nonvegCats;
    setDiet(side);
    setActiveCatId(cats[0]?.id);
  }

  const lines = Object.values(cart);
  const subtotalPaise = lines.reduce((s, l) => s + l.pricePaise * l.qty, 0);
  const taxPaise = Math.round((subtotalPaise * gstPercent) / 100);
  const grandPaise = subtotalPaise + taxPaise;
  const count = lines.reduce((s, l) => s + l.qty, 0);

  function addToCart(catId: string, itemId: string, itemName: string, itemIsVeg: boolean, variantIdx: number) {
    const cat = categories.find((c) => c.id === catId);
    const item = cat?.items.find((i) => i.id === itemId);
    const variant = item?.variants[variantIdx];
    if (!variant) return;
    setCart((prev) => {
      const existing = prev[variant.id];
      if (existing) return { ...prev, [variant.id]: { ...existing, qty: existing.qty + 1 } };
      return {
        ...prev,
        [variant.id]: {
          itemId,
          itemName,
          itemIsVeg,
          variantId: variant.id,
          variantLabel: variant.label,
          pricePaise: variant.pricePaise,
          qty: 1,
        },
      };
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

  function closeSheet() {
    setSheet("closed");
  }

  function openCart() {
    if (!count) return;
    setSheet("cart");
  }

  /**
   * Reopen the tracker from the "Check progress" button. Re-reads first:
   * while the sheet is closed nothing is subscribed to SSE, so the cached
   * stages can be minutes stale — the customer would open it and see "In the
   * kitchen" for food already on their table.
   */
  async function openTracker() {
    if (tracked.length === 0 || reopening) return;
    setReopening(true);
    try {
      const orders = await refreshTracked();
      setTracked(orders);
      if (orders.length === 0) return;
      if (!orders.some((o) => o.id === activeOrderId)) setActiveOrderId(orders[0].id);
    } catch {
      // Offline — fall through and show the last known state rather than
      // stranding them on the menu with a dead button.
    } finally {
      setReopening(false);
    }
    setSheet("placed");
  }

  /**
   * "Order something else" — clears the cart for another round. The order
   * already in the kitchen keeps being tracked; the next one is *added*
   * alongside it, not swapped in, because a customer who orders dessert
   * halfway through must not lose sight of the mains.
   */
  function startNewOrder() {
    setCart({});
    setNote("");
    setPayMethod(null);
    setErrorMsg(null);
    setIdempotencyKey(crypto.randomUUID());
    setSheet("closed");
  }

  async function confirmOrder() {
    if (!payMethod || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const phone = INDIAN_MOBILE.test(customerPhone) ? customerPhone : null;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "qr",
          qrToken,
          items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, note: null })),
          payMethod,
          note: note.trim() || null,
          customerName: customerName.trim() || null,
          customerPhone: phone,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      let order: BoardOrderDTO = data.order;
      if (payMethod === "online") {
        const payRes = await fetch(`/api/orders/${order.id}/mock-pay`, { method: "PATCH" });
        if (payRes.ok) {
          const payData = await payRes.json();
          order = { ...order, payStatus: payData.payStatus };
        }
      }
      // Persist before rendering: if anything below throws, the customer can
      // still find the order again.
      addSavedOrderId(qrToken, order.id);
      setTracked((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      setActiveOrderId(order.id);
      setSheet("placed");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ordering">
      <header>
        <div className="brand-mark">
          <svg viewBox="0 0 64 64" fill="none" stroke="var(--accent)" strokeWidth={1.4} strokeLinecap="round">
            <path d="M40 20c-6 2-12 7-16 13-3 4-4 8-4 12" />
            <path d="M40 20c6-1 10 1 12 5s1 9-3 11-9 1-11-3" />
            <path d="M38 33l14 9M38 33l6 15" />
            <path d="M20 45c-5 2-9 6-11 11" />
          </svg>
          <div className="brand">{tenantName}</div>
        </div>
        <div className="brand-sub">{tenantTagline ?? "Table Ordering"}</div>

        {(vegCats.length > 0 && nonvegCats.length > 0) && (
          <>
            <div className="switch" data-side={diet} role="group" aria-label="Choose kitchen">
              <div className="glide" />
              <button data-side="veg" aria-pressed={diet === "veg"} onClick={() => switchKitchen("veg")}>
                <i className="dot" />
                Veg
              </button>
              <button data-side="nonveg" aria-pressed={diet === "nonveg"} onClick={() => switchKitchen("nonveg")}>
                <i className="dot nv" />
                Non-veg
              </button>
            </div>
            <p className="kitchen-note">Showing the {diet === "veg" ? "veg" : "non-veg"} kitchen</p>
          </>
        )}

        <div className="table-chip">
          Table <b>{tableLabel}</b>
        </div>
      </header>

      <nav className="cats" aria-labelledby="cats-head">
        <h2 className="cats-head" id="cats-head">
          Categories
        </h2>
        <div className="cats-track" role="tablist" aria-labelledby="cats-head">
          {openCats.map((c) => (
            <button key={c.id} className="cat" role="tab" aria-selected={c.id === activeCat?.id} onClick={() => setActiveCatId(c.id)}>
              <div className="cat-art" dangerouslySetInnerHTML={{ __html: ART[c.art] }} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="wrap">
        {activeCat ? (
          <>
            <div className="script-head">
              <div className="rule" />
              <h2>{activeCat.name}</h2>
              <div className="rule" />
            </div>
            <div>
              {activeCat.items.map((it) => {
                const si = sizePick[it.id] ?? 0;
                const variant = it.variants[si];
                const inCart = variant ? cart[variant.id] : undefined;
                return (
                  <article className="dish" key={it.id}>
                    <div className="dish-art" dangerouslySetInnerHTML={{ __html: ART[activeCat.art] }} />
                    <div className="dish-body">
                      <div className="dish-title">
                        <span className="marks">
                          <i className={`dot${it.isVeg ? "" : " nv"}`} />
                        </span>
                        <h3>{it.name}</h3>
                      </div>
                      {it.description ? <p>{it.description}</p> : null}
                      {it.variants.length > 1 ? (
                        <div className="sizes">
                          {it.variants.map((v, x) => (
                            <button
                              key={v.id}
                              className="size"
                              aria-pressed={x === si}
                              onClick={() => setSizePick((prev) => ({ ...prev, [it.id]: x }))}
                            >
                              {v.label} · {money(v.pricePaise)}
                            </button>
                          ))}
                        </div>
                      ) : variant ? (
                        <div className="price">{money(variant.pricePaise)}</div>
                      ) : null}
                      {!it.available ? (
                        <div className="soldout">Sold out today</div>
                      ) : inCart ? (
                        <div className="stepper">
                          <button aria-label="Remove one" onClick={() => bump(variant!.id, -1)}>
                            −
                          </button>
                          <span>{inCart.qty}</span>
                          <button aria-label="Add one" onClick={() => bump(variant!.id, 1)}>
                            +
                          </button>
                        </div>
                      ) : (
                        <button className="add" disabled={!variant} onClick={() => addToCart(activeCat.id, it.id, it.name, it.isVeg, si)}>
                          Add to order
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="note-line">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Takes 10–15 minutes
            </div>
          </>
        ) : (
          <div className="empty">
            <b>Nothing here yet</b>
            This kitchen&apos;s menu is being restocked.
          </div>
        )}
      </main>

      {/* Sits above the cart bar rather than replacing it — a customer can be
          adding a second round while the first is still cooking. */}
      <div className={`trackbar${tracked.length > 0 && sheet === "closed" ? " show" : ""}${count > 0 ? " lifted" : ""}`}>
        <button
          type="button"
          className="trackbar-btn"
          onClick={openTracker}
          disabled={reopening}
          tabIndex={tracked.length > 0 && sheet === "closed" ? 0 : -1}
          aria-hidden={tracked.length === 0 || sheet !== "closed"}
        >
          <i className="pulse" aria-hidden="true" />
          {reopening ? "Checking…" : "Check progress"}
          {/* One order: name it. Several: count them, because a single code
              would silently imply the others aren't being followed. */}
          {tracked.length > 1 ? (
            <em>{tracked.length} orders</em>
          ) : tracked.length === 1 ? (
            <em>{tracked[0].code}</em>
          ) : null}
        </button>
      </div>

      <div className={`cartbar${count > 0 ? " show" : ""}`}>
        <div className="cartbar-inner" onClick={openCart}>
          <div>
            <small>
              {count} {count === 1 ? "item" : "items"}
            </small>
            <strong>{money(grandPaise)}</strong>
          </div>
          <div className="go">Review order →</div>
        </div>
      </div>

      {/* The tracker used to trap the sheet open (no scrim dismiss) because
          closing it lost the order forever. It's dismissible now — the
          Check progress button brings it back. */}
      <div className={`scrim${sheet !== "closed" ? " show" : ""}`} onClick={closeSheet} />
      <section className={`sheet${sheet !== "closed" ? " show" : ""}`} aria-modal="true" role="dialog">
        <div className="grab" />
        <div className="sheet-inner">
          {sheet === "cart" && (
            <CartSheet
              lines={lines}
              subtotalPaise={subtotalPaise}
              taxPaise={taxPaise}
              grandPaise={grandPaise}
              gstPercent={gstPercent}
              note={note}
              onNoteChange={setNote}
              onBump={bump}
              onBack={closeSheet}
              onNext={() => setSheet("pay")}
            />
          )}
          {sheet === "pay" && (
            <PaySheet
              tableLabel={tableLabel}
              count={count}
              grandPaise={grandPaise}
              customerName={customerName}
              customerPhone={customerPhone}
              payMethod={payMethod}
              submitting={submitting}
              errorMsg={errorMsg}
              onNameChange={setCustomerName}
              onPhoneChange={setCustomerPhone}
              onPickPay={(m) => {
                setPayMethod(m);
                setErrorMsg(null);
              }}
              onBack={() => setSheet("cart")}
              onPlace={() => (payMethod === "online" ? setSheet("upi") : confirmOrder())}
            />
          )}
          {sheet === "upi" && (
            <UpiSheet tenantSlug={tenantSlug} grandPaise={grandPaise} submitting={submitting} errorMsg={errorMsg} onPaid={confirmOrder} onBack={() => setSheet("pay")} />
          )}
          {sheet === "placed" && activeOrder && (
            <OrderTrackerSheet
              /* Remount per order: `useLiveOrders` seeds from its initial
                 value and subscribes to one order's stream, so switching
                 tabs has to rebuild both. */
              key={activeOrder.id}
              initialOrder={activeOrder}
              allOrders={tracked}
              qrToken={qrToken}
              onSelect={setActiveOrderId}
              onStartNew={startNewOrder}
              onClose={closeSheet}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function CartSheet({
  lines,
  subtotalPaise,
  taxPaise,
  grandPaise,
  gstPercent,
  note,
  onNoteChange,
  onBump,
  onBack,
  onNext,
}: {
  lines: CartLine[];
  subtotalPaise: number;
  taxPaise: number;
  grandPaise: number;
  gstPercent: number;
  note: string;
  onNoteChange: (v: string) => void;
  onBump: (variantId: string, delta: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <h3>Your order</h3>
      {lines.map((l) => (
        <div className="line" key={l.variantId}>
          <div>
            <div className="nm">{l.itemName}</div>
            <div className="sz">
              {l.variantLabel} · {money(l.pricePaise)}
            </div>
            <div className="mini">
              <button onClick={() => onBump(l.variantId, -1)}>−</button>
              <span>{l.qty}</span>
              <button onClick={() => onBump(l.variantId, 1)}>+</button>
            </div>
          </div>
          <div className="amt">{money(l.pricePaise * l.qty)}</div>
        </div>
      ))}
      <div className="totals">
        <div>
          <span>Subtotal</span>
          <span>{money(subtotalPaise)}</span>
        </div>
        <div>
          <span>GST {gstPercent}%</span>
          <span>{money(taxPaise)}</span>
        </div>
        <div className="grand">
          <span>Total</span>
          <span>{money(grandPaise)}</span>
        </div>
      </div>
      <label className="fld">
        <em>Note for the kitchen</em>
        <textarea value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="Less spicy, no onion, birthday plating…" />
      </label>
      <button className="cta" onClick={onNext}>
        Choose payment
      </button>
      <button className="ghost" onClick={onBack}>
        Add more items
      </button>
    </>
  );
}

function PaySheet({
  tableLabel,
  count,
  grandPaise,
  customerName,
  customerPhone,
  payMethod,
  submitting,
  errorMsg,
  onNameChange,
  onPhoneChange,
  onPickPay,
  onBack,
  onPlace,
}: {
  tableLabel: string;
  count: number;
  grandPaise: number;
  customerName: string;
  customerPhone: string;
  payMethod: PayMethod | null;
  submitting: boolean;
  errorMsg: string | null;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onPickPay: (m: PayMethod) => void;
  onBack: () => void;
  onPlace: () => void;
}) {
  return (
    <>
      <h3>Payment</h3>
      <p className="center muted">
        Table {tableLabel} · {count} items · <b style={{ color: "var(--accent)" }}>{money(grandPaise)}</b>
      </p>
      <label className="fld">
        <em>Name</em>
        <input value={customerName} onChange={(e) => onNameChange(e.target.value)} placeholder="For the server to call out" />
      </label>
      <label className="fld">
        <em>Phone (optional)</em>
        <input value={customerPhone} onChange={(e) => onPhoneChange(e.target.value)} inputMode="numeric" placeholder="Bill on WhatsApp" />
      </label>
      <div className="pay">
        <button aria-pressed={payMethod === "cash"} onClick={() => onPickPay("cash")}>
          <b>Pay by cash</b>
          <small>Settle at the table when the bill arrives</small>
        </button>
        <button aria-pressed={payMethod === "online"} onClick={() => onPickPay("online")}>
          <b>Pay online</b>
          <small>UPI · card · wallet, right now</small>
        </button>
      </div>
      <button className="cta" disabled={!payMethod || submitting} onClick={onPlace}>
        {payMethod === "online" ? `Pay ${money(grandPaise)}` : "Place order · pay at table"}
      </button>
      {errorMsg ? <p className="error-note">{errorMsg}</p> : null}
      <button className="ghost" onClick={onBack}>
        Back to order
      </button>
    </>
  );
}

function UpiSheet({
  tenantSlug,
  grandPaise,
  submitting,
  errorMsg,
  onPaid,
  onBack,
}: {
  tenantSlug: string;
  grandPaise: number;
  submitting: boolean;
  errorMsg: string | null;
  onPaid: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <h3>Scan to pay</h3>
      <div className="qr" dangerouslySetInnerHTML={{ __html: qrArt() }} />
      <p className="center muted">
        {tenantSlug}@upi · {money(grandPaise)}
        <br />
        Prototype — payment is simulated.
      </p>
      <div className="upi-row">
        <i>UPI</i>
        <i>Card</i>
        <i>Wallet</i>
        <i>Net banking</i>
      </div>
      <button className="cta" disabled={submitting} onClick={onPaid}>
        I&apos;ve paid
      </button>
      {errorMsg ? <p className="error-note">{errorMsg}</p> : null}
      <button className="ghost" onClick={onBack}>
        Choose another method
      </button>
    </>
  );
}

const TRACKER_STEPS: { stage: "new" | "preparing" | "ready" | "served"; label: string; sub: string }[] = [
  { stage: "new", label: "Order received", sub: "Just now" },
  { stage: "preparing", label: "In the kitchen", sub: "Chef has your ticket" },
  { stage: "ready", label: "Plating up", sub: "Final touches" },
  { stage: "served", label: "At your table", sub: "Enjoy" },
];

/** Short label for the order-switcher tabs — the tracker's own step names. */
const STAGE_SHORT: Record<string, string> = {
  new: "Received",
  preparing: "In kitchen",
  ready: "Plating",
  served: "Served",
  cancelled: "Cancelled",
};

function OrderTrackerSheet({
  initialOrder,
  allOrders,
  qrToken,
  onSelect,
  onStartNew,
  onClose,
}: {
  initialOrder: BoardOrderDTO;
  allOrders: BoardOrderDTO[];
  qrToken: string;
  onSelect: (id: string) => void;
  onStartNew: () => void;
  onClose: () => void;
}) {
  const streamUrl = `/api/stream?orderId=${initialOrder.id}&qrToken=${qrToken}`;
  const { orders } = useLiveOrders([initialOrder], streamUrl);
  const order = orders.find((o) => o.id === initialOrder.id) ?? initialOrder;
  const stageIndex = TRACKER_STEPS.findIndex((s) => s.stage === order.stage);

  /* Only the open tab is on SSE — the stream is scoped to a single order id.
     The other tabs show whatever the last re-read returned, which is refreshed
     every time the sheet is opened. */
  const tabs = allOrders.map((o) => (o.id === order.id ? order : o));

  const paidLine =
    order.payMethod === "cash"
      ? "Pay by cash at the table when your bill arrives."
      : order.payStatus === "paid"
        ? "Paid online. Your receipt is on its way."
        : "Confirming your payment…";

  return (
    <>
      {tabs.length > 1 && (
        <div className="track-tabs" role="tablist" aria-label="Your orders">
          {tabs.map((o) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              className="track-tab"
              aria-selected={o.id === order.id}
              onClick={() => onSelect(o.id)}
            >
              <b>{o.code}</b>
              <small>{STAGE_SHORT[o.stage] ?? o.stage}</small>
            </button>
          ))}
        </div>
      )}

      <div className="center">
        <div className="tick-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </div>
        <h3 style={{ margin: "0 0 10px" }}>Order placed</h3>
        <div className="oid">
          {order.code} · Table {order.tableLabel}
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          {paidLine}
          <br />
          Ready in about 10–15 minutes.
        </p>
        <p className="muted" style={{ marginTop: 10 }}>
          Close this any time — <b>Check progress</b> at the bottom of the menu brings it back.
        </p>
      </div>
      <div className="track">
        {TRACKER_STEPS.map((s, i) => (
          <div className={`step${i <= stageIndex ? " on" : ""}`} key={s.stage}>
            <div className="rail">
              <div className="bead" />
              <div className="stem" />
            </div>
            <div className="txt">
              <b>{s.label}</b>
              <small>{s.sub}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="totals">
        <div className="grand">
          <span>Total {order.payMethod === "cash" ? "due" : "paid"}</span>
          <span>{money(order.totalPaise)}</span>
        </div>
      </div>
      <button className="cta" onClick={onClose}>
        Back to the menu
      </button>
      <button className="ghost" onClick={onStartNew}>
        Order something else
      </button>
    </>
  );
}

/** Deterministic decorative "QR" pattern — the prototype's own generator, not real payment data. */
function qrArt(): string {
  let cells = "";
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const on = finder ? x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5) : (x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0;
      if (on) cells += `<rect x="${x * 6}" y="${y * 6}" width="6" height="6"/>`;
    }
  }
  // Cells are left unfilled here — `.ordering .qr svg { fill: var(--bg) }` colours
  // them, so the pattern stays legible against the --ink plate on any theme.
  return `<svg viewBox="0 0 126 126">${cells}</svg>`;
}
