/**
 * Miniature of what a cafe on this template actually looks like — a menu card
 * and an order chip rendered in the template's own tokens, not a swatch row.
 * Swatches tell you the colours exist; this tells you whether they work
 * together, which is the only question a template card has to answer.
 *
 * Server-safe (no hooks): the templates list is a server component.
 */
export function TemplatePreview({ theme, name }: { theme: Record<string, string>; name: string }) {
  const t = {
    bg: theme.bg ?? "#1d2520",
    surface: theme.surface ?? "#28322a",
    ink: theme.ink ?? "#f3e7d3",
    accent: theme.accent ?? "#e3b878",
    veg: theme.veg ?? "#7fb069",
    radius: theme.radius ?? "12px",
    fontDisplay: theme.fontDisplay ?? "Georgia",
    fontBody: theme.fontBody ?? "system-ui",
  };

  return (
    <div style={{ background: t.bg, padding: 12, borderRadius: "var(--hq-r-sm)", fontFamily: t.fontBody, display: "grid", gap: 8 }} aria-hidden="true">
      <div style={{ color: t.ink, fontFamily: t.fontDisplay, fontSize: 13, opacity: 0.9 }}>{name}</div>
      <div style={{ background: t.surface, borderRadius: t.radius, padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: t.ink, fontFamily: t.fontDisplay, fontSize: 12 }}>Margherita</span>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: t.veg, flex: "none" }} />
        </div>
        <div style={{ color: t.accent, fontSize: 12, fontWeight: 600, marginTop: 3 }}>₹445</div>
      </div>
      <div style={{ background: t.accent, color: t.bg, borderRadius: t.radius, padding: "5px 0", textAlign: "center", fontSize: 11, fontWeight: 600 }}>Place order</div>
    </div>
  );
}
