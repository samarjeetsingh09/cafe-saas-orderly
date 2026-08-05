"use client";

import { useState } from "react";
import type { DayRow } from "@/lib/owner-reports";

/** Reports tab — ported verbatim from bella-admin-console.html's "Reports" tab (Phase H #5). */
const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
const rowTotal = (d: DayRow) => d.cashPaise + d.onlinePaise;
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const fmtDow = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
const fmtDate = (ms: number) => new Date(ms).getDate();

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

export function ReportsView({ initialDays, initialRange }: { initialDays: DayRow[]; initialRange: 7 | 14 | 30 }) {
  const [range, setRange] = useState(initialRange);
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(false);

  async function changeRange(r: 7 | 14 | 30) {
    setRange(r);
    setLoading(true);
    const res = await fetch(`/api/reports?range=${r}`);
    const data = await res.json();
    setDays(data.days ?? []);
    setLoading(false);
  }

  const total = days.reduce((s, d) => s + rowTotal(d), 0);
  const ords = days.reduce((s, d) => s + d.orders, 0);
  const best = days.reduce((a, b) => (rowTotal(b) > rowTotal(a) ? b : a), days[0]);
  const avgDay = days.length ? Math.round(total / days.length) : 0;
  const max = Math.max(1, ...days.map(rowTotal));
  const todayIndex = days.length - 1;

  function downloadCsv() {
    const rows = [["Date", "Day", "Orders", "Cash", "Online", "Total"]];
    [...days].reverse().forEach((d) => {
      rows.push([new Date(d.atMs).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }), fmtDow(d.atMs), String(d.orders), String(Math.round(d.cashPaise / 100)), String(Math.round(d.onlinePaise / 100)), String(Math.round(rowTotal(d) / 100))]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    saveBlob(new TextEncoder().encode(csv), `sales-${range}d.csv`, "text/csv");
  }

  return (
    <section className="print-target">
      <h2 className="title">Reports</h2>
      <p className="sub-t">Day-by-day sales, straight from the orders that came through</p>
      <div className="stats">
        <div className="stat gold">
          <em>Total sales</em>
          <b>{money(total)}</b>
          <div className="sub">last {range} days</div>
        </div>
        <div className="stat">
          <em>Orders</em>
          <b>{ords.toLocaleString("en-IN")}</b>
          <div className="sub">{Math.round(ords / Math.max(1, days.length))} a day</div>
        </div>
        <div className="stat">
          <em>Average bill</em>
          <b>{money(ords ? total / ords : 0)}</b>
          <div className="sub">per order</div>
        </div>
        <div className="stat">
          <em>Best day</em>
          <b>{best ? fmtDay(best.atMs) : "—"}</b>
          <div className="sub">{best ? money(rowTotal(best)) : ""}</div>
        </div>
      </div>

      <div className="bar">
        <button className="chip" aria-pressed={range === 7} onClick={() => changeRange(7)}>
          Last 7 days
        </button>
        <button className="chip" aria-pressed={range === 14} onClick={() => changeRange(14)}>
          14 days
        </button>
        <button className="chip" aria-pressed={range === 30} onClick={() => changeRange(30)}>
          30 days
        </button>
        <div className="spacer" />
        <button className="chip" onClick={downloadCsv}>
          Download CSV
        </button>
        <button className="chip" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, opacity: loading ? 0.5 : 1 }}>
        <h4>Sales per day</h4>
        <div className="chart">
          {days.map((d, i) => {
            const v = rowTotal(d);
            const h = Math.max(4, Math.round((v / max) * 136));
            return (
              <div key={d.dateKey} className={`cbar${d === best ? " best" : ""}${i === todayIndex ? " today" : ""}`} title={`${fmtDay(d.atMs)} · ${money(v)}`}>
                <span className="val">{range > 14 ? "" : `₹${Math.round(v / 100000)}k`}</span>
                <div className="stem2" style={{ height: h }} />
                <span className="lbl">{range > 14 ? fmtDate(d.atMs) : fmtDow(d.atMs)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h4>Day by day</h4>
        <div className="dayscroll">
          <table className="tblx rep">
            <thead>
              <tr>
                <th>Date</th>
                <th>Orders</th>
                <th>Cash</th>
                <th>Online</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d, i) => (
                <tr key={d.dateKey} className={days.length - 1 - i === todayIndex ? "today" : ""}>
                  <td className="dlabel">
                    <b>{fmtDay(d.atMs)}</b>
                    <small>
                      {fmtDow(d.atMs)}
                      {days.length - 1 - i === todayIndex ? " · today, live" : ""}
                    </small>
                  </td>
                  <td className="num">{d.orders}</td>
                  <td className="num">{money(d.cashPaise)}</td>
                  <td className="num">{money(d.onlinePaise)}</td>
                  <td className="g">{money(rowTotal(d))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{ords}</td>
                <td className="num">{money(days.reduce((s, d) => s + d.cashPaise, 0))}</td>
                <td className="num">{money(days.reduce((s, d) => s + d.onlinePaise, 0))}</td>
                <td className="g">{money(total)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ color: "var(--ink-faint)", fontWeight: 300, fontSize: 11.5 }}>
                  Average per day
                </td>
                <td className="g">{money(avgDay)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
