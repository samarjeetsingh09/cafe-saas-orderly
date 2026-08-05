"use client";

import { useState } from "react";
import type { QrTableDTO } from "@/lib/owner-qr";
import { qrSvg, qrMatrix, zipStore, qrPdf } from "@/lib/qr";
import { Modal } from "@/components/owner/Modal";

/**
 * QR codes tab — ported verbatim from plan/bella-admin-console.html's "QR
 * codes" tab (Phase H #4). Real per-table tokens/scans replace the mock
 * `QRS` array. Per plan/START-HERE.md: view/download/ZIP/PDF/print/request
 * more tables only — no generate, regenerate, pause, resume, edit or
 * delete, in this UI or as an API route. Table codes are HQ's to issue.
 *
 * The prototype's QR analytics box also broke scans down by today/week/
 * month; `cafe_tables.scans` is a lifetime counter only, so that breakdown
 * is dropped rather than fabricated (Rule 2) — see NOTES.md.
 */
const REASONS = ["New tables added", "Outdoor seating", "Damaged code replacement", "Second floor / new section"];

/** Downloaded/printed files are standalone (no CSS vars available), so a tenant's theme colours
 *  have to be baked in as literals here — reused from `tenants.theme` rather than Bëlla's own
 *  values, found during the Phase J Rule 2 pass (a second cafe's sticker was showing Bëlla's
 *  colours). */
export type QrSheetTheme = { cardBg: string; cardInk: string; cardMuted: string };
export const DEFAULT_QR_SHEET_THEME: QrSheetTheme = { cardBg: "#f3e7d3", cardInk: "#22291f", cardMuted: "#5a6355" };

/** sRGB relative luminance (WCAG) — used only to tell a tenant's two palette poles apart. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const chan = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Blend two hexes — `t` = 0 gives `a`, 1 gives `b`. Emits a hex because these values
 *  land in standalone SVG files, where `color-mix()` is not worth betting a print run on. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round((((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t));
  return "#" + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("");
}

/**
 * A QR sticker is dark-on-light or it does not scan, so the card's two colours are
 * chosen by luminance rather than by which token is named what: whichever of the
 * tenant's `bg`/`ink` poles is lighter becomes the card, the other becomes its ink.
 * The previous version hardcoded the opposite mapping (`ink` = card, `bg` = ink),
 * which only held for a dark-palette cafe — a light-themed tenant got a near-black
 * card with near-black modules on it. If the tenant's own pair is too low-contrast
 * to be safe, the frozen default pair is used instead; a readable code beats an
 * on-brand one.
 */
export function pickSheetTheme(theme?: Record<string, unknown>): QrSheetTheme {
  const bg = safeHexOrDefault(theme?.bg, "");
  const ink = safeHexOrDefault(theme?.ink, "");
  if (!bg || !ink || contrastRatio(bg, ink) < 7) return DEFAULT_QR_SHEET_THEME;
  const [cardBg, cardInk] = luminance(bg) > luminance(ink) ? [bg, ink] : [ink, bg];
  return { cardBg, cardInk, cardMuted: mixHex(cardInk, cardBg, 0.42) };
}

function sheetSvg(brandName: string, table: QrTableDTO, url: string, theme: QrSheetTheme): string {
  const inner = qrSvg(url, 300, theme.cardInk, theme.cardBg).replace(/^<svg[^>]*>|<\/svg>$/g, "");
  const dim = qrMatrix(url).length + 6; // matches qrSvg's own viewBox (module count + 3-module quiet zone each side)
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520">
  <rect width="420" height="520" fill="${theme.cardBg}"/>
  <text x="210" y="66" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="44" fill="${theme.cardInk}">${esc(brandName)}</text>
  <text x="210" y="92" text-anchor="middle" font-family="Helvetica,Arial" font-size="11" letter-spacing="4" fill="${theme.cardMuted}">SCAN &middot; ORDER &middot; RELAX</text>
  <g transform="translate(60,120) scale(${300 / dim})">${inner}</g>
  <text x="210" y="470" text-anchor="middle" font-family="Helvetica,Arial" font-size="12" letter-spacing="3" fill="${theme.cardMuted}">TABLE</text>
  <text x="210" y="502" text-anchor="middle" font-family="Helvetica,Arial" font-size="34" font-weight="bold" fill="${theme.cardInk}">${esc(table.label)}</text>
</svg>`;
}

/** `#rrggbb` only — SVG `fill` also accepts `rgba()`, but the theme's `inkDim` etc. are already
 *  that shape if ever wired in; this just guards against garbage falling through to a print file. */
function safeHexOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function saveBlob(bytes: Uint8Array, name: string, mime: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export function QrCodes({
  tenantName,
  tenantSlug,
  origin,
  tables,
  theme,
}: {
  tenantName: string;
  tenantSlug: string;
  origin: string;
  tables: QrTableDTO[];
  theme?: Record<string, unknown>;
}) {
  const [filterQ, setFilterQ] = useState<"all" | "live" | "paused">("all");
  const [viewTable, setViewTable] = useState<QrTableDTO | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [printOnly, setPrintOnly] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const sheetTheme = pickSheetTheme(theme);
  // The on-screen sheet takes the same three colours as the downloaded file, so
  // what the owner is looking at is what comes out of the printer. The stylesheet
  // can't do this itself: picking the lighter pole needs luminance, not a var().
  const sheetStyle = { background: sheetTheme.cardBg, color: sheetTheme.cardInk };
  const brandStyle = { color: sheetTheme.cardInk };
  const mutedStyle = { color: sheetTheme.cardMuted };

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }
  const urlFor = (t: QrTableDTO) => `${origin}/t/${t.qrToken}`;

  const live = tables.filter((t) => t.active).length;
  const totalScans = tables.reduce((s, t) => s + t.scans, 0);
  const top = [...tables].sort((a, b) => b.scans - a.scans)[0];

  const rows = tables.filter((t) => filterQ === "all" || (filterQ === "live" ? t.active : !t.active));

  function downloadOne(t: QrTableDTO) {
    const ok = saveBlob(new TextEncoder().encode(sheetSvg(tenantName, t, urlFor(t), sheetTheme)), `${tenantSlug}-table-${t.label}.svg`, "image/svg+xml");
    flash(ok ? `Table ${t.label} downloaded` : "Download blocked by the browser");
  }
  function downloadZip() {
    const enc = new TextEncoder();
    const files = tables.map((t) => ({ name: `${tenantSlug}-table-${t.label}.svg`, data: enc.encode(sheetSvg(tenantName, t, urlFor(t), sheetTheme)) }));
    const ok = saveBlob(zipStore(files), `${tenantSlug}-qr-codes-${tables.length}-tables.zip`, "application/zip");
    flash(ok ? `${tables.length} codes downloaded as ZIP` : "Download blocked by the browser");
  }
  function downloadPdf() {
    const list = tables.map((t) => ({ label: t.label, url: urlFor(t) }));
    const ok = saveBlob(qrPdf(list, tenantName), `${tenantSlug}-qr-print-sheet.pdf`, "application/pdf");
    flash(ok ? "Print sheet downloaded" : "Download blocked by the browser");
  }
  function printOne(t: QrTableDTO) {
    setPrintOnly(t.id);
    requestAnimationFrame(() => {
      window.print();
      setPrintOnly(null);
    });
  }
  function printAll() {
    setPrintOnly(null);
    requestAnimationFrame(() => window.print());
  }

  return (
    <section className="print-target">
      <h2 className="title">QR codes</h2>
      <p className="sub-t">Prepared, printed and managed for you — nothing to set up</p>
      <div className="stats">
        <div className="stat">
          <em>Total tables</em>
          <b>{tables.length}</b>
          <div className="sub">covers on the floor</div>
        </div>
        <div className="stat gold">
          <em>Active QR codes</em>
          <b>{live}</b>
          <div className="sub">{tables.length - live} disabled</div>
        </div>
        <div className="stat">
          <em>Total scans</em>
          <b>{totalScans.toLocaleString("en-IN")}</b>
          <div className="sub">across all tables</div>
        </div>
        <div className="stat">
          <em>Most scanned</em>
          <b>{top ? `Table ${top.label}` : "—"}</b>
          <div className="sub">{top ? `${top.scans.toLocaleString("en-IN")} scans` : ""}</div>
        </div>
      </div>

      <div className="bar">
        <button className="chip" aria-pressed={filterQ === "all"} onClick={() => setFilterQ("all")}>
          All
        </button>
        <button className="chip" aria-pressed={filterQ === "live"} onClick={() => setFilterQ("live")}>
          Live
        </button>
        <button className="chip" aria-pressed={filterQ === "paused"} onClick={() => setFilterQ("paused")}>
          Paused
        </button>
        <div className="spacer" />
        <button className="chip" onClick={downloadZip}>
          Download ZIP
        </button>
        <button className="chip" onClick={downloadPdf}>
          Download print PDF
        </button>
        <button className="chip" onClick={printAll}>
          Print all
        </button>
        <button className="chip add-c" onClick={() => setReqOpen(true)}>
          + Request more tables
        </button>
      </div>

      <div className="qgrid">
        {rows.length ? (
          rows.map((t) => (
            <div key={t.id} className={`qcard${t.active ? "" : " paused"}${printOnly && printOnly !== t.id ? " noprint" : ""}`}>
              <div className="qhead">
                <span className="qno">Table {t.label}</span>
                <span className={`sb${t.active ? " on" : " off"}`}>
                  <i />
                  {t.active ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="qsheet" style={sheetStyle}>
                <div className="qbrand" style={brandStyle}>
                  {tenantName}
                </div>
                <div className="qtag" style={mutedStyle}>
                  Scan · Order · Relax
                </div>
                <div dangerouslySetInnerHTML={{ __html: qrSvg(urlFor(t), 168, sheetTheme.cardInk, sheetTheme.cardBg) }} />
                <div className="qfoot" style={mutedStyle}>
                  Table
                  <b style={brandStyle}>{t.label}</b>
                </div>
              </div>
              <div className="qmeta">
                <div className="mline">
                  <span>Issued</span>
                  <b>{new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</b>
                </div>
                <div className="mline">
                  <span>Total scans</span>
                  <b>{t.scans.toLocaleString("en-IN")}</b>
                </div>
                <div className="qmg">
                  <span className="sb mg">
                    <i />
                    Managed for you
                  </span>
                </div>
              </div>
              <div className="qacts">
                <button onClick={() => setViewTable(t)}>View</button>
                <button onClick={() => downloadOne(t)}>Download</button>
                <button onClick={() => printOne(t)}>Print</button>
              </div>
            </div>
          ))
        ) : (
          <div className="qempty">
            <b>No QR codes available</b>
            Your table codes haven&rsquo;t been issued yet.
            <br />
            Please contact support and we&rsquo;ll set them up.
          </div>
        )}
      </div>
      <p className="qnote">Table codes are issued and maintained for you. Need more tables, or a replacement for a damaged code? Send a request and we&rsquo;ll handle it.</p>

      <Modal open={!!viewTable} onClose={() => setViewTable(null)}>
        {viewTable && (
          <>
            <div className="qview">
              <h3>Table {viewTable.label}</h3>
              <p className="hint">
                {viewTable.active ? "Active" : "Disabled"} · issued{" "}
                {new Date(viewTable.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <div className="qsheet big" style={sheetStyle}>
                <div className="qbrand" style={brandStyle}>
                  {tenantName}
                </div>
                <div className="qtag" style={mutedStyle}>
                  Scan · Order · Relax
                </div>
                <div dangerouslySetInnerHTML={{ __html: qrSvg(urlFor(viewTable), 210, sheetTheme.cardInk, sheetTheme.cardBg) }} />
                <div className="qfoot" style={mutedStyle}>
                  Table
                  <b style={brandStyle}>{viewTable.label}</b>
                </div>
              </div>
              <span className="sb mg">
                <i />
                Secure table QR
              </span>
              <div className="anal" style={{ gridTemplateColumns: "1fr" }}>
                <div>
                  <b>{viewTable.scans.toLocaleString("en-IN")}</b>
                  <em>Total scans</em>
                </div>
              </div>
            </div>
            <div className="mact">
              <button className="cancel" onClick={() => setViewTable(null)}>
                Close
              </button>
              <button className="save" onClick={() => downloadOne(viewTable)}>
                Download
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={reqOpen} onClose={() => setReqOpen(false)}>
        <RequestTablesForm currentCount={tables.length} onClose={() => setReqOpen(false)} onSent={() => flash("Sent to support")} />
      </Modal>

      <div className={`toast${toast ? " show" : ""}`}>{toast ?? ""}</div>
    </section>
  );
}

function RequestTablesForm({ currentCount, onClose, onSent }: { currentCount: number; onClose: () => void; onSent: () => void }) {
  const [total, setTotal] = useState(currentCount + 4);
  const [reasonIdx, setReasonIdx] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const bad = !(total > currentCount);

  async function send() {
    setBusy(true);
    const extra = total - currentCount;
    const body = `${REASONS[reasonIdx]}. Requesting ${currentCount} → ${total} tables — ${extra} new code${extra > 1 ? "s" : ""} needed.${notes.trim() ? " " + notes.trim() : ""}`;
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "QR code / tables", subject: `Request: ${extra} more table code${extra > 1 ? "s" : ""} (${currentCount} → ${total})`, body }),
    });
    setBusy(false);
    if (!res.ok) return;
    onClose();
    onSent();
  }

  return (
    <>
      <h3>Request more tables</h3>
      <p className="hint">We issue the codes — request goes straight to support</p>
      <label className="fld">
        <em>Current tables</em>
        <input value={currentCount} disabled />
      </label>
      <label className="fld">
        <em>Requested total tables</em>
        <input type="number" inputMode="numeric" value={total} onChange={(e) => setTotal(Number(e.target.value) || 0)} />
      </label>
      <div className={`err${bad ? " show" : ""}`}>Must be more than your current table count.</div>
      <label className="fld">
        <em>Reason</em>
        <div className="tpick">
          {REASONS.map((r, i) => (
            <button key={r} aria-pressed={i === reasonIdx} onClick={() => setReasonIdx(i)}>
              {r}
            </button>
          ))}
        </div>
      </label>
      <label className="fld">
        <em>Notes</em>
        <textarea style={{ height: 84 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where to place them, when you need them by…" />
      </label>
      <div className="mact">
        <button className="cancel" onClick={onClose}>
          Cancel
        </button>
        <button className="save" disabled={bad || busy} onClick={send}>
          Submit request
        </button>
      </div>
    </>
  );
}
