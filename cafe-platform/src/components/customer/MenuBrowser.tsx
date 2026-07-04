"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CafeMenuDTO, MenuItemDTO } from "@/lib/menu";

/**
 * Customer menu — DESIGN_SYSTEM.md Section 4.1.
 * List-first rows, FSSAI-style veg/non-veg marks, sticky category chips,
 * sticky cart bar → bottom-sheet cart → name/phone gate (M3).
 * Ordering mode only when a valid table token is present.
 */

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const priceLabel = (n: number) => `₹${inr.format(n)}`;

/** FSSAI-style marker: bordered square with a dot — green veg, red non-veg. */
function VegMark({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? "border-success" : "border-error";
  const dot = isVeg ? "bg-success" : "bg-error";
  return (
    <span
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${color}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
    </span>
  );
}

type CartLine = { item: MenuItemDTO; qty: number };

type Props = {
  menu: CafeMenuDTO;
  /** Present only when reached via a table QR — enables ordering. */
  table?: { token: string; number: string };
  /** Fresh per page load (Security doc 3.2 Risk 1). */
  sessionToken?: string;
};

export function MenuBrowser({ menu, table, sessionToken }: Props) {
  const router = useRouter();
  const ordering = Boolean(table && sessionToken);

  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [sheet, setSheet] = useState<"none" | "cart" | "details">("none");
  const [activeCat, setActiveCat] = useState(menu.categories[0]?.id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const lines = useMemo(() => [...cart.values()], [cart]);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const totalAmount = lines.reduce((s, l) => s + l.qty * l.item.price, 0);
  const detailsValid = name.trim().length > 0 && /^\d{10}$/.test(phone);

  function changeQty(item: MenuItemDTO, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(item.id);
      const qty = (line?.qty ?? 0) + delta;
      if (qty <= 0) next.delete(item.id);
      else next.set(item.id, { item, qty });
      return next;
    });
  }

  function jumpTo(catId: string) {
    setActiveCat(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function placeOrder() {
    if (!detailsValid || placing || !table || !sessionToken) return;
    setPlacing(true);
    setPlaceError(null);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken: table.token,
          sessionToken,
          customerName: name.trim(),
          customerPhone: phone,
          paymentMode: "cash",
          items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.confirmationToken) {
        router.push(`/order/status/${data.confirmationToken}`);
        return;
      }
      setPlaceError(data?.error ?? "Could not place your order. Please try again.");
    } catch {
      setPlaceError("No connection. Check your network and try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background pb-24">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-5">
        <h1 className="text-xl font-bold text-primary">{menu.cafeName}</h1>
        {table ? (
          <span className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-white">
            Table {table.number}
          </span>
        ) : (
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            Menu only
          </span>
        )}
      </header>

      {/* Sticky category chips */}
      <nav
        aria-label="Menu categories"
        className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur [scrollbar-width:none]"
      >
        {menu.categories.map((c) => (
          <button
            key={c.id}
            onClick={() => jumpTo(c.id)}
            className={`min-h-11 shrink-0 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
              activeCat === c.id
                ? "bg-secondary text-white"
                : "border border-border bg-surface text-foreground hover:border-secondary"
            }`}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {/* Sections */}
      <main className="flex flex-col gap-6 px-4 pt-4">
        {menu.categories.map((cat) => (
          <section
            key={cat.id}
            ref={(el) => {
              sectionRefs.current[cat.id] = el;
            }}
            className="scroll-mt-16"
            aria-labelledby={`cat-${cat.id}`}
          >
            <h2 id={`cat-${cat.id}`} className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              {cat.name}
            </h2>
            <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
              {cat.items.map((item) => {
                const qty = cart.get(item.id)?.qty ?? 0;
                const soldOut = !item.isAvailable;
                return (
                  <li key={item.id} className={`flex gap-3 p-4 ${soldOut ? "opacity-60" : ""}`}>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <VegMark isVeg={item.isVeg} />
                        <span className="truncate font-medium">{item.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-foreground">
                        {priceLabel(item.price)}
                      </span>
                      {item.description && (
                        <p className="line-clamp-2 text-sm text-muted">{item.description}</p>
                      )}
                      {soldOut && <span className="text-sm font-medium text-error">Sold out</span>}
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2">
                      {item.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photoUrl}
                          alt={item.name}
                          loading="lazy"
                          className="h-16 w-16 rounded-xl object-cover"
                        />
                      )}
                      {ordering &&
                        (soldOut ? null : qty === 0 ? (
                          <button
                            onClick={() => changeQty(item, 1)}
                            className="min-h-11 cursor-pointer rounded-lg border border-accent px-5 font-semibold text-accent transition-colors duration-200 hover:bg-accent hover:text-white"
                          >
                            Add
                          </button>
                        ) : (
                          <QtyStepper
                            qty={qty}
                            onChange={(d) => changeQty(item, d)}
                            label={item.name}
                          />
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {!ordering && (
          <p className="pb-6 text-center text-sm text-muted">
            To order, scan the QR code on your table.
          </p>
        )}
      </main>

      {/* Sticky cart bar */}
      {ordering && totalQty > 0 && sheet === "none" && (
        <button
          onClick={() => setSheet("cart")}
          className="fixed inset-x-0 bottom-0 z-20 mx-auto flex min-h-14 w-full max-w-md cursor-pointer items-center justify-between bg-accent px-5 text-white shadow-lg transition-colors duration-200 hover:bg-accent/90"
        >
          <span className="font-medium">
            {totalQty} {totalQty === 1 ? "item" : "items"} · {priceLabel(totalAmount)}
          </span>
          <span className="font-semibold">View cart →</span>
        </button>
      )}

      {/* Bottom sheets */}
      {sheet !== "none" && (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col justify-end">
          <button
            aria-label="Close"
            onClick={() => setSheet("none")}
            className="absolute inset-0 cursor-pointer bg-black/40"
          />
          <div className="relative max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-5 pb-8 shadow-xl">
            {sheet === "cart" && (
              <>
                <h2 className="mb-4 text-lg font-bold">Your order</h2>
                <ul className="flex flex-col divide-y divide-border">
                  {lines.map(({ item, qty }) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <VegMark isVeg={item.isVeg} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-sm text-muted tabular-nums">
                          {priceLabel(item.price)} each
                        </p>
                      </div>
                      <QtyStepper qty={qty} onChange={(d) => changeQty(item, d)} label={item.name} />
                      <span className="w-16 text-right font-semibold tabular-nums">
                        {priceLabel(item.price * qty)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-lg font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{priceLabel(totalAmount)}</span>
                </div>
                <button
                  onClick={() => setSheet("details")}
                  disabled={totalQty === 0}
                  className="mt-4 min-h-12 w-full cursor-pointer rounded-xl bg-primary font-semibold text-white transition-colors duration-200 hover:bg-primary/90 disabled:cursor-default disabled:opacity-50"
                >
                  Continue
                </button>
              </>
            )}

            {sheet === "details" && (
              <>
                <h2 className="mb-1 text-lg font-bold">Almost done</h2>
                <p className="mb-4 text-sm text-muted">
                  Your name and number help the staff find your order.
                </p>
                {placeError && (
                  <p role="alert" className="mb-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                    {placeError}
                  </p>
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cust-name" className="text-sm font-medium">
                      Your name
                    </label>
                    <input
                      id="cust-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                      className="min-h-12 rounded-lg border border-border bg-surface px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cust-phone" className="text-sm font-medium">
                      Phone number
                    </label>
                    <input
                      id="cust-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                      placeholder="10-digit number"
                      className="min-h-12 rounded-lg border border-border bg-surface px-3 outline-none placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <p className="text-sm text-muted">Pay with cash at your table.</p>
                  <button
                    onClick={placeOrder}
                    disabled={!detailsValid || placing}
                    className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white transition-colors duration-200 hover:bg-primary/90 disabled:cursor-default disabled:opacity-50"
                  >
                    {placing && (
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                      />
                    )}
                    {placing ? "Placing order…" : `Place order · ${priceLabel(totalAmount)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QtyStepper({
  qty,
  onChange,
  label,
}: {
  qty: number;
  onChange: (delta: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center rounded-lg border border-accent">
      <button
        aria-label={`Remove one ${label}`}
        onClick={() => onChange(-1)}
        className="min-h-11 w-10 cursor-pointer font-bold text-accent transition-colors duration-150 hover:bg-accent/10"
      >
        −
      </button>
      <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        aria-label={`Add one ${label}`}
        onClick={() => onChange(1)}
        className="min-h-11 w-10 cursor-pointer font-bold text-accent transition-colors duration-150 hover:bg-accent/10"
      >
        +
      </button>
    </div>
  );
}
