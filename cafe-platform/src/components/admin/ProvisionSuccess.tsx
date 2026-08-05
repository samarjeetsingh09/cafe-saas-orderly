"use client";

import { useState } from "react";
import Link from "next/link";
import { qrPdf, zipStore, qrSvg } from "@/lib/qr";
import { Card } from "./ui";

type Result = {
  tenantId: string;
  slug: string;
  tenantName: string;
  tableCount: number;
  tables: { label: string; qrToken: string }[];
  credentials: { role: string; fullName: string; email: string; password: string }[];
};

function saveBlob(bytes: Uint8Array, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="hq-copy">
      <span className="k">{label}</span>
      <span className="v mono">{value}</span>
      <button
        className="hq-btn"
        data-size="sm"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function ProvisionSuccess({ result, tenantName }: { result: Result; tenantName: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlFor = (qrToken: string) => `${origin}/t/${qrToken}`;

  function downloadZip() {
    const enc = new TextEncoder();
    const files = result.tables.map((t) => ({ name: `${result.slug}-table-${t.label}.svg`, data: enc.encode(qrSvg(urlFor(t.qrToken), 300)) }));
    saveBlob(zipStore(files), `${result.slug}-qr-codes-${result.tables.length}-tables.zip`, "application/zip");
  }
  function downloadPdf() {
    const list = result.tables.map((t) => ({ label: t.label, url: urlFor(t.qrToken) }));
    saveBlob(qrPdf(list, tenantName), `${result.slug}-qr-print-sheet.pdf`, "application/pdf");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="hq-note" data-tone="ok" style={{ fontSize: 13 }}>
        <b>{tenantName} is live.</b> {result.tableCount} tables provisioned with real QR tokens.
      </div>

      <div className="hq-grid2">
        <Card title="URLs">
          <div style={{ display: "grid", gap: 6 }}>
            <CopyField label="Customer (table 01)" value={result.tables[0] ? urlFor(result.tables[0].qrToken) : "—"} />
            <CopyField label="Console" value={`${origin}/owner/login`} />
            <CopyField label="Kitchen" value={`${origin}/kitchen`} />
          </div>
        </Card>

        <Card title="QR codes" sub="Real tokens — printable now">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="hq-btn" onClick={downloadZip}>
              Download ZIP ({result.tables.length} SVGs)
            </button>
            <button className="hq-btn" onClick={downloadPdf}>
              Download print PDF
            </button>
          </div>
        </Card>
      </div>

      <Card title="Staff credentials" sub="Shown once — copy them now">
        <div style={{ display: "grid", gap: 10 }}>
          {result.credentials.map((c, i) => (
            <div key={i} style={{ border: "1px solid var(--hq-line-soft)", borderRadius: "var(--hq-r-sm)", padding: 8, display: "grid", gap: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--hq-text-3)" }}>
                {c.role} — {c.fullName}
              </div>
              <CopyField label="Email" value={c.email} />
              <CopyField label="Password" value={c.password} />
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Link href={`/admin/cafes/${result.tenantId}`} className="hq-btn" data-variant="primary">
          View cafe
        </Link>
        <Link href="/admin/cafes" className="hq-btn">
          Back to cafes
        </Link>
      </div>
      <p style={{ fontSize: 11, color: "var(--hq-text-3)" }}>
        To set up the menu, use &ldquo;Login as owner&rdquo; from the cafe&rsquo;s detail page — the same real console every cafe uses, not a separate HQ menu builder.
      </p>
    </div>
  );
}
