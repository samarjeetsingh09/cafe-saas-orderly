"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import "@/styles/menu-phone.css";

/**
 * The hero's thesis: the actual thing a diner sees after they scan.
 *
 * Structurally this is the real customer ordering app
 * (`components/customer/OrderingApp`) at phone scale — the same category
 * rail, veg/non-veg kitchen switch, size pills, sold-out state, cart bar
 * and totals sheet. It wears the *marketing* palette (cream/brown/amber,
 * Fraunces + Geist) rather than the ordering app's dark green, because this
 * is OrderLy's shop window; a real cafe's screen wears that cafe's own
 * theme, which is what `/demo` shows.
 *
 * It never calls the order API — these dishes belong to no real cafe and no
 * real table — so the sheet hands off to `/demo`, which resolves a live
 * table and opens the genuine app.
 */

const money = (rupees: number) => "₹" + rupees.toLocaleString("en-IN");
const GST_PERCENT = 5;

/* The ordering app's own decorative category line-art (OrderingApp's `ART`). */
type ArtKey = "leaf" | "plate" | "bowl" | "cake" | "cup" | "pizza";

function Art({ art }: { art: ArtKey }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const };
  switch (art) {
    case "leaf":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" {...p}>
          <path d="M32 8C16 20 14 40 32 56 50 40 48 20 32 8Z" />
          <path d="M32 12v42" />
          <path d="M32 24l-9-6M32 32l-11-7M32 40l-9-6M32 24l9-6M32 32l11-7M32 40l9-6" />
        </svg>
      );
    case "plate":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" {...p}>
          <circle cx="32" cy="32" r="21" />
          <circle cx="32" cy="32" r="14" />
          <path d="M25 30c3-4 11-4 14 0M26 37c4 3 9 3 12 0" />
        </svg>
      );
    case "bowl":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" {...p}>
          <path d="M10 30h44c0 12-10 22-22 22S10 42 10 30Z" />
          <path d="M6 30h52" />
          <path d="M26 20c0-4 4-4 4-8M36 20c0-4 4-4 4-8" />
        </svg>
      );
    case "cake":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" {...p}>
          <path d="M14 34h36v16H14z" />
          <path d="M14 34c4-6 32-6 36 0" />
          <path d="M22 26c0-4 3-4 3-7M32 24c0-4 3-4 3-7M42 26c0-4 3-4 3-7" />
          <path d="M10 50h44" />
        </svg>
      );
    case "cup":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" {...p}>
          <path d="M16 22h28v16c0 8-6 14-14 14s-14-6-14-14z" />
          <path d="M44 26h6a5 5 0 0 1 0 10h-6" />
          <path d="M24 12c0 4-3 4-3 7M34 12c0 4-3 4-3 7" />
        </svg>
      );
    case "pizza":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" {...p} strokeLinejoin="round">
          <path d="M32 10 54 50a44 44 0 0 1-44 0Z" />
          <path d="M14 42a44 44 0 0 0 36 0" />
          <circle cx="32" cy="30" r="2.4" />
          <circle cx="25" cy="40" r="2.4" />
          <circle cx="39" cy="40" r="2.4" />
        </svg>
      );
  }
}

type Variant = { label: string; price: number };
type Dish = {
  id: string;
  name: string;
  description: string;
  variants: Variant[];
  tag?: string;
  soldOut?: boolean;
};
type Cat = { id: string; name: string; art: ArtKey; veg: boolean; dishes: Dish[] };

/** Sample menu for a fictional cafe — this preview belongs to no tenant. */
const CAFE_NAME = "Bay Leaf";
const CAFE_TAGLINE = "All-day botanical kitchen";
const TABLE_LABEL = "07";

const CATS: Cat[] = [
  {
    id: "small-plates",
    name: "Small Plates",
    art: "leaf",
    veg: true,
    dishes: [
      {
        id: "truffle-toast",
        name: "Truffle Mushroom Toast",
        description: "Sourdough, wild mushrooms, a shave of truffle.",
        variants: [{ label: "Plate", price: 280 }],
        tag: "House favourite",
      },
      {
        id: "paneer-skewers",
        name: "Paneer Tikka Skewers",
        description: "Char-grilled, smoky marinade, mint chutney.",
        variants: [
          { label: "4 pc", price: 240 },
          { label: "8 pc", price: 420 },
        ],
      },
    ],
  },
  {
    id: "bowls",
    name: "Bowls",
    art: "bowl",
    veg: true,
    dishes: [
      {
        id: "hummus-bowl",
        name: "Burnt Garlic Hummus",
        description: "Warm pita, olive oil, za'atar.",
        variants: [{ label: "Bowl", price: 230 }],
      },
      {
        id: "kitchari",
        name: "Kitchari of the Day",
        description: "Ghee-tempered rice and lentils, seasonal veg.",
        variants: [{ label: "Bowl", price: 210 }],
        soldOut: true,
      },
    ],
  },
  {
    id: "brews",
    name: "Brews",
    art: "cup",
    veg: true,
    dishes: [
      {
        id: "masala-chai",
        name: "Masala Chai",
        description: "Assam leaf, whole spices, simmered in milk.",
        variants: [
          { label: "Cutting", price: 40 },
          { label: "Full", price: 60 },
        ],
      },
      {
        id: "basque",
        name: "Basque Cheesecake",
        description: "Burnt top, molten centre, sea salt.",
        variants: [{ label: "Slice", price: 280 }],
      },
    ],
  },
  {
    id: "grill",
    name: "From the Grill",
    art: "plate",
    veg: false,
    dishes: [
      {
        id: "chicken-65",
        name: "Chicken 65",
        description: "Curry-leaf tempered, fiery red, lime on the side.",
        variants: [{ label: "Plate", price: 280 }],
      },
      {
        id: "prawns",
        name: "Lemon Butter Prawns",
        description: "Pan-seared, garlic butter, charred lemon.",
        variants: [{ label: "6 pc", price: 420 }],
      },
    ],
  },
  {
    id: "slices",
    name: "Slices",
    art: "pizza",
    veg: false,
    dishes: [
      {
        id: "pepperoni",
        name: "Chicken Pepperoni",
        description: "Thin crust, aged mozzarella, chilli honey.",
        variants: [
          { label: '9"', price: 380 },
          { label: '12"', price: 520 },
        ],
      },
    ],
  },
];

const VEG_CATS = CATS.filter((c) => c.veg);
const NONVEG_CATS = CATS.filter((c) => !c.veg);

type Line = { key: string; name: string; size: string; price: number; qty: number; veg: boolean };

export function MenuPhone() {
  const [diet, setDiet] = useState<"veg" | "nonveg">("veg");
  const openCats = diet === "veg" ? VEG_CATS : NONVEG_CATS;

  const [activeCatId, setActiveCatId] = useState(VEG_CATS[0].id);
  const activeCat = openCats.find((c) => c.id === activeCatId) ?? openCats[0];

  const [sizePick, setSizePick] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  const lines = useMemo(() => Object.values(cart), [cart]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const tax = Math.round((subtotal * GST_PERCENT) / 100);
  const grand = subtotal + tax;

  function switchKitchen(side: "veg" | "nonveg") {
    if (side === diet) return;
    setDiet(side);
    setActiveCatId((side === "veg" ? VEG_CATS : NONVEG_CATS)[0].id);
  }

  function add(cat: Cat, dish: Dish, variantIdx: number) {
    const variant = dish.variants[variantIdx];
    const key = `${dish.id}:${variantIdx}`;
    setCart((prev) => ({
      ...prev,
      [key]: prev[key]
        ? { ...prev[key], qty: prev[key].qty + 1 }
        : { key, name: dish.name, size: variant.label, price: variant.price, qty: 1, veg: cat.veg },
    }));
  }

  function bump(key: string, delta: number) {
    setCart((prev) => {
      const line = prev[key];
      if (!line) return prev;
      const qty = line.qty + delta;
      const next = { ...prev };
      if (qty <= 0) delete next[key];
      else next[key] = { ...line, qty };
      return next;
    });
  }

  return (
    <div className="menu-phone">
      <div className="mp-frame">
        <div
          className="mp-screen"
          role="group"
          aria-label={`Interactive preview of the ${CAFE_NAME} customer menu`}
        >
          {/* status strip — sells the "this is a phone, at a table" frame */}
          <div className="mp-status" aria-hidden="true">
            <span>7:24 pm</span>
            <span className="mp-bars">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>

          <header className="mp-head">
            <div className="mp-brand-mark">
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
                <path d="M40 20c-6 2-12 7-16 13-3 4-4 8-4 12" />
                <path d="M40 20c6-1 10 1 12 5s1 9-3 11-9 1-11-3" />
                <path d="M38 33l14 9M38 33l6 15" />
                <path d="M20 45c-5 2-9 6-11 11" />
              </svg>
              <div className="mp-brand">{CAFE_NAME}</div>
            </div>
            <div className="mp-brand-sub">{CAFE_TAGLINE}</div>

            <div className="mp-switch" data-side={diet} role="group" aria-label="Choose kitchen">
              <div className="mp-glide" aria-hidden="true" />
              <button type="button" aria-pressed={diet === "veg"} onClick={() => switchKitchen("veg")}>
                <i className="mp-dot" aria-hidden="true" />
                Veg
              </button>
              <button type="button" aria-pressed={diet === "nonveg"} onClick={() => switchKitchen("nonveg")}>
                <i className="mp-dot nv" aria-hidden="true" />
                Non-veg
              </button>
            </div>

            <div className="mp-table-chip">
              <span className="mp-live" aria-hidden="true" />
              Table <b>{TABLE_LABEL}</b>
            </div>
          </header>

          <div className="mp-body">
            <nav className="mp-cats" role="tablist" aria-label="Menu categories">
              {openCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  className="mp-cat"
                  aria-selected={c.id === activeCat.id}
                  onClick={() => setActiveCatId(c.id)}
                >
                  <span className="mp-cat-art">
                    <Art art={c.art} />
                  </span>
                  <span className="mp-cat-label">{c.name}</span>
                </button>
              ))}
            </nav>

            <div className="mp-script-head">
              <span className="mp-rule" aria-hidden="true" />
              <h3>{activeCat.name}</h3>
              <span className="mp-rule" aria-hidden="true" />
            </div>

            <div className="mp-dishes">
              {activeCat.dishes.map((dish) => {
                const si = sizePick[dish.id] ?? 0;
                const variant = dish.variants[si];
                const key = `${dish.id}:${si}`;
                const inCart = cart[key];
                return (
                  <article className="mp-dish" key={dish.id}>
                    <span className="mp-dish-art">
                      <Art art={activeCat.art} />
                    </span>
                    <div className="mp-dish-body">
                      <div className="mp-dish-title">
                        <i className={`mp-dot${activeCat.veg ? "" : " nv"}`} aria-hidden="true" />
                        <h4>{dish.name}</h4>
                        {dish.tag && <span className="mp-tag">{dish.tag}</span>}
                      </div>
                      <p>{dish.description}</p>

                      {dish.variants.length > 1 && (
                        <div className="mp-sizes">
                          {dish.variants.map((v, i) => (
                            <button
                              key={v.label}
                              type="button"
                              className="mp-size"
                              aria-pressed={i === si}
                              onClick={() => setSizePick((p) => ({ ...p, [dish.id]: i }))}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="mp-price">{money(variant.price)}</div>

                      {dish.soldOut ? (
                        <p className="mp-soldout">Sold out today</p>
                      ) : inCart ? (
                        <div className="mp-stepper">
                          <button type="button" aria-label={`Remove one ${dish.name}`} onClick={() => bump(key, -1)}>
                            −
                          </button>
                          <span aria-live="polite">{inCart.qty}</span>
                          <button type="button" aria-label={`Add one ${dish.name}`} onClick={() => bump(key, 1)}>
                            +
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="mp-add" onClick={() => add(activeCat, dish, si)}>
                          Add to order
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <p className="mp-foot-note">Scan · Order · Pay from your seat</p>
          </div>

          {/* cart bar */}
          <div className={`mp-cartbar${count > 0 ? " show" : ""}`}>
            <button
              type="button"
              className="mp-cartbar-inner"
              onClick={() => setSheetOpen(true)}
              tabIndex={count > 0 ? 0 : -1}
              aria-hidden={count === 0}
            >
              <span>
                <small>
                  {count} item{count === 1 ? "" : "s"} added
                </small>
                <strong>{money(subtotal)}</strong>
              </span>
              <span className="mp-go">View order →</span>
            </button>
          </div>

          {/* order sheet */}
          <button
            type="button"
            className={`mp-scrim${sheetOpen ? " show" : ""}`}
            aria-label="Close order summary"
            aria-hidden={!sheetOpen}
            tabIndex={sheetOpen ? 0 : -1}
            onClick={() => setSheetOpen(false)}
          />
          <div className={`mp-sheet${sheetOpen ? " show" : ""}`} aria-hidden={!sheetOpen}>
            <div className="mp-grab" aria-hidden="true" />
            <h3>Your order</h3>

            {lines.map((l) => (
              <div className="mp-line" key={l.key}>
                <div>
                  <div className="mp-nm">{l.name}</div>
                  <div className="mp-sz">{l.size}</div>
                  <div className="mp-mini">
                    <button type="button" aria-label={`Remove one ${l.name}`} onClick={() => bump(l.key, -1)} tabIndex={sheetOpen ? 0 : -1}>
                      −
                    </button>
                    <span>{l.qty}</span>
                    <button type="button" aria-label={`Add one ${l.name}`} onClick={() => bump(l.key, 1)} tabIndex={sheetOpen ? 0 : -1}>
                      +
                    </button>
                  </div>
                </div>
                <div className="mp-amt">{money(l.price * l.qty)}</div>
              </div>
            ))}

            <div className="mp-totals">
              <div>
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div>
                <span>GST {GST_PERCENT}%</span>
                <span>{money(tax)}</span>
              </div>
              <div className="mp-grand">
                <span>Total</span>
                <span>{money(grand)}</span>
              </div>
            </div>

            <Link href="/demo" className="mp-cta" tabIndex={sheetOpen ? 0 : -1}>
              Open the live menu
            </Link>
            <p className="mp-sheet-note">
              This preview doesn&apos;t place a real order. The live menu does — same screen, real table.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
