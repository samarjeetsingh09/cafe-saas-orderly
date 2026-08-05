"use client";

/**
 * Token editor + live preview (HQ-PORTAL-SPEC.md §6 Step 2 / §12): three real
 * components rendered against the chosen tokens — not a colour swatch grid,
 * so a bad pairing is obvious before go-live. Plain inline styles, not the
 * `:root` CSS-var injection `components/theme.tsx` does for the live cafe
 * console — that targets the whole document and can't be scoped to a
 * preview panel embedded in an HQ form.
 */
export type ThemeTokens = {
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  accent2: string;
  veg: string;
  nonveg: string;
  warn: string;
  radius: string;
  fontDisplay: string;
  fontBody: string;
};

export const DEFAULT_THEME: ThemeTokens = {
  bg: "#1d2520",
  surface: "#28322a",
  ink: "#f3e7d3",
  accent: "#e3b878",
  accent2: "#c9995a",
  veg: "#7fb069",
  nonveg: "#c96a55",
  warn: "#d8a24a",
  radius: "14px",
  fontDisplay: "Georgia",
  fontBody: "system-ui",
};

const FIELDS: { key: keyof ThemeTokens; label: string; type: "color" | "text" }[] = [
  { key: "bg", label: "Background", type: "color" },
  { key: "surface", label: "Surface", type: "color" },
  { key: "ink", label: "Text", type: "color" },
  { key: "accent", label: "Primary accent", type: "color" },
  { key: "accent2", label: "Secondary accent", type: "color" },
  { key: "veg", label: "Veg marker", type: "color" },
  { key: "nonveg", label: "Non-veg marker", type: "color" },
  { key: "warn", label: "Warning", type: "color" },
  { key: "radius", label: "Border radius", type: "text" },
  { key: "fontDisplay", label: "Display font", type: "text" },
  { key: "fontBody", label: "Body font", type: "text" },
];

/** WCAG contrast ratio of ink on bg — HQ-PORTAL-SPEC.md §12 warns below 4.5:1. */
function contrastRatio(hex1: string, hex2: string): number {
  const lum = (hex: string) => {
    const c = hex.replace("#", "");
    if (c.length !== 6) return 0.5;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [l1, l2] = [lum(hex1), lum(hex2)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function ThemeEditor({ value, onChange }: { value: ThemeTokens; onChange: (t: ThemeTokens) => void }) {
  const contrast = contrastRatio(value.ink, value.bg);
  const lowContrast = contrast < 4.5;

  return (
    <div className="hq-grid2">
      <div className="hq-formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {FIELDS.map((f) => (
          <label key={f.key} className="hq-field">
            <span className="lbl">{f.label}</span>
            <span className="hq-swatch">
              {f.type === "color" && (
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(value[f.key]) ? value[f.key] : "#000000"}
                  onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                  aria-label={`${f.label} colour picker`}
                />
              )}
              <input type="text" className="mono" value={value[f.key]} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
            </span>
          </label>
        ))}
        {lowContrast && (
          <p className="hq-note span2" data-tone="warn" style={{ gridColumn: "1 / -1" }}>
            Text/background contrast is {contrast.toFixed(1)}:1 — below the 4.5:1 accessibility minimum.
          </p>
        )}
      </div>

      <div style={{ background: value.bg, fontFamily: value.fontBody, border: "1px solid var(--hq-line)", borderRadius: "var(--hq-r)", padding: 16 }}>
        <p style={{ marginBottom: 12, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: value.ink, opacity: 0.5 }}>
          Live preview
        </p>

        <div className="mb-3 rounded-lg p-3" style={{ background: value.surface, borderRadius: value.radius }}>
          <div className="flex items-center justify-between">
            <span style={{ color: value.ink, fontFamily: value.fontDisplay, fontSize: "1.1rem" }}>Margherita Pizza</span>
            <span className="h-2 w-2 rounded-full" style={{ background: value.veg }} />
          </div>
          <p className="mt-1 text-xs" style={{ color: value.ink, opacity: 0.6 }}>
            San Marzano tomato, fior di latte, basil
          </p>
          <span className="mt-2 inline-block text-sm font-semibold" style={{ color: value.accent }}>
            ₹445
          </span>
        </div>

        <div className="mb-3 rounded-lg p-3" style={{ background: value.surface, borderRadius: value.radius }}>
          <div className="flex items-center justify-between text-xs" style={{ color: value.ink }}>
            <span>Order #B-1042 · Table 07</span>
            <span className="rounded-full px-2 py-0.5" style={{ background: value.nonveg, color: "#fff" }}>
              Non-veg
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: value.warn, opacity: 0.4 }} />
        </div>

        <button
          className="w-full py-2 text-sm font-semibold"
          style={{ background: value.accent, color: value.bg, borderRadius: value.radius, fontFamily: value.fontBody }}
        >
          Place order
        </button>
      </div>
    </div>
  );
}
