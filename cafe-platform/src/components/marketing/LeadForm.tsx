"use client";

import { useState } from "react";

const FIELD =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Landing-page lead capture → POST /api/leads. */
export function LeadForm() {
  const [form, setForm] = useState({ name: "", phone: "", cafeName: "", city: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-success/30 bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6 text-success" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="mt-4 text-xl font-semibold text-foreground">Got it — we&apos;ll call you</h3>
        <p className="mt-2 text-sm text-muted">
          Expect a call or WhatsApp within a day. We&apos;ll plan your menu and tables together.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">
          Your name
          <input
            type="text"
            required
            maxLength={80}
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={FIELD}
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Mobile number
          <input
            type="tel"
            required
            inputMode="numeric"
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            title="10-digit Indian mobile number"
            autoComplete="tel-national"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
            className={FIELD}
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Cafe name
          <input
            type="text"
            required
            maxLength={80}
            value={form.cafeName}
            onChange={(e) => setForm({ ...form, cafeName: e.target.value })}
            className={FIELD}
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          City <span className="font-normal text-muted">(optional)</span>
          <input
            type="text"
            maxLength={80}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className={FIELD}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="mt-5 w-full cursor-pointer rounded-xl bg-primary px-6 py-4 text-base font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-50"
      >
        {sending ? "Sending…" : "Request a call back"}
      </button>
      <p className="mt-3 text-center text-xs text-muted">No spam. One call to understand your cafe, that&apos;s it.</p>
    </form>
  );
}
