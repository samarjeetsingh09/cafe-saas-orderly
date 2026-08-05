/**
 * Bare CSS bar chart. No charting library — `plan/START-HERE.md` says add no
 * dependencies, and these are single-series counts where a bar row reads
 * faster than an axis-and-legend chart would anyway. Values are exposed via
 * `title` so hovering gives the exact number.
 */
export function BarRow({ bars }: { bars: { value: number; max: number; label: string }[] }) {
  return (
    <div className="hq-bars" role="img" aria-label={bars.map((b) => b.label).join("; ")}>
      {bars.map((b, i) => (
        <div
          key={i}
          className="bar"
          data-peak={b.value === b.max && b.value > 0 ? "true" : undefined}
          style={{ height: `${Math.max(2, (b.value / b.max) * 100)}%` }}
          title={b.label}
        />
      ))}
    </div>
  );
}
