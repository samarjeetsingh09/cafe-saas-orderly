/**
 * Static replica of the real customer menu inside a phone frame — the
 * landing hero shows the actual product surface (same tokens, same FSSAI
 * marks, same cart bar), not a stock mockup.
 */

function Mark({ veg }: { veg: boolean }) {
  const ring = veg ? "border-success" : "border-error";
  const dot = veg ? "bg-success" : "bg-error";
  return (
    <span aria-hidden="true" className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-2 ${ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
    </span>
  );
}

const ROWS: { name: string; price: string; veg: boolean; soldOut?: boolean }[] = [
  { name: "Masala Chai", price: "₹40", veg: true },
  { name: "Cold Coffee", price: "₹120", veg: true },
  { name: "Paneer Tikka", price: "₹220", veg: true },
  { name: "Chicken 65", price: "₹260", veg: false },
  { name: "French Fries", price: "₹110", veg: true, soldOut: true },
];

export function PhoneDemo() {
  return (
    <div
      aria-label="Preview of the customer menu"
      role="img"
      className="mx-auto w-[290px] rounded-[2.2rem] border-[10px] border-[#2b2016] bg-background shadow-2xl select-none"
    >
      <div className="overflow-hidden rounded-[1.6rem]">
        {/* header */}
        <div className="bg-primary px-4 pt-5 pb-3 text-white">
          <p className="text-[10px] tracking-wider uppercase opacity-70">Table 5</p>
          <p className="text-lg font-semibold">Sunrise Cafe</p>
        </div>
        {/* category chips */}
        <div className="flex gap-1.5 overflow-hidden border-b border-border bg-surface px-3 py-2">
          {["Beverages", "Snacks", "Mains"].map((c, i) => (
            <span
              key={c}
              className={`rounded-full px-3 py-1 text-[11px] font-medium whitespace-nowrap ${
                i === 0 ? "bg-secondary text-white" : "bg-background text-muted"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
        {/* items */}
        <ul className="divide-y divide-border bg-surface">
          {ROWS.map((r) => (
            <li key={r.name} className={`flex items-center gap-2.5 px-4 py-3 ${r.soldOut ? "opacity-50" : ""}`}>
              <Mark veg={r.veg} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{r.name}</span>
              <span className="text-[13px] font-semibold text-foreground tabular-nums">{r.price}</span>
              {r.soldOut ? (
                <span className="text-[10px] font-semibold text-error uppercase">Sold out</span>
              ) : (
                <span className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-bold text-white">ADD</span>
              )}
            </li>
          ))}
        </ul>
        {/* cart bar */}
        <div className="flex items-center justify-between bg-accent px-4 py-3 text-white">
          <span className="text-[12px] font-medium">2 items · ₹160</span>
          <span className="text-[12px] font-bold">View Cart →</span>
        </div>
      </div>
    </div>
  );
}
