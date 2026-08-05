import Link from "next/link";

/**
 * HQ UI primitives (server-safe — no "use client"; anything interactive lives
 * in its own client file). Styling comes from `src/styles/hq.css`, scoped
 * under `.hq`. These exist so every HQ screen renders the same table, badge
 * and card rather than each page hand-rolling Tailwind utility soup.
 */

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "brand";

/* ── layout ──────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <>
      {back && (
        <Link href={back.href} className="hq-back">
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1 .02 1.06L9.06 10l3.75 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.24a.75.75 0 0 1 0-1.06l4.25-4.24a.75.75 0 0 1 1.04 0Z"
              clipRule="evenodd"
            />
          </svg>
          {back.label}
        </Link>
      )}
      <div className="hq-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children && <div className="acts">{children}</div>}
      </div>
    </>
  );
}

export function Card({
  title,
  sub,
  action,
  flush,
  className,
  children,
}: {
  title?: string;
  sub?: string;
  action?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`hq-card${className ? ` ${className}` : ""}`}>
      {(title || action) && (
        <header>
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {action}
        </header>
      )}
      <div className={`body${flush ? " flush" : ""}`}>{children}</div>
    </section>
  );
}

/* ── stats ───────────────────────────────────────────────────── */

export function StatStrip({ children }: { children: React.ReactNode }) {
  return <div className="hq-strip">{children}</div>;
}

export function Stat({
  label,
  value,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  return (
    <div className="hq-stat" data-tone={tone === "neutral" ? undefined : tone}>
      <em title={label}>{label}</em>
      <b className="num">{value}</b>
      {delta && <div className="delta">{delta}</div>}
    </div>
  );
}

/* ── badges ──────────────────────────────────────────────────── */

export function Badge({ tone = "neutral", dot, children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className="hq-badge" data-tone={tone === "neutral" ? undefined : tone}>
      {dot && <i />}
      {children}
    </span>
  );
}

/** Tenant lifecycle status → tone. Single source so every screen agrees. */
export const STATUS_TONE: Record<string, Tone> = {
  trial: "info",
  active: "ok",
  paused: "warn",
  cancelled: "neutral",
};

/** Ticket state → tone + human label. */
export const TICKET_STATE: Record<string, { tone: Tone; label: string }> = {
  open: { tone: "warn", label: "Open" },
  with_us: { tone: "info", label: "With us" },
  resolved: { tone: "ok", label: "Resolved" },
};

/* ── tables ──────────────────────────────────────────────────── */

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="hq-tablewrap">
      <table className="hq-table">{children}</table>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="hq-empty">
      <b>{title}</b>
      {children}
      {action && <div className="act">{action}</div>}
    </div>
  );
}

/* ── formatting helpers ──────────────────────────────────────── */

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const rupees = (paise: number) => INR.format(Math.round(paise / 100));
export const compactRupees = (paise: number) => {
  const r = paise / 100;
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(1)}Cr`;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(1)}L`;
  if (r >= 1_000) return `₹${(r / 1_000).toFixed(1)}k`;
  return INR.format(Math.round(r));
};

export const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const dateTime = (d: Date | string) =>
  new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** "3m", "5h", "2d" — compact age for SLA/health columns. */
export function ago(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
