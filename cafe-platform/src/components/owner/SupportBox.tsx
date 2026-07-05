"use client";

import { useState } from "react";

export type SupportQueryDTO = {
  id: string;
  message: string;
  status: "open" | "resolved";
  createdAt: string; // ISO
  resolvedAt: string | null;
};

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** Support tab (M6, FR-17): send a question, see past ones with status. */
export function SupportBox({ initialQueries }: { initialQueries: SupportQueryDTO[] }) {
  const [queries, setQueries] = useState(initialQueries);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/owner/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send. Try again.");
        return;
      }
      setQueries((q) => [
        { ...data.query, createdAt: data.query.createdAt, resolvedAt: null },
        ...q,
      ]);
      setMessage("");
      setSent(true);
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="support-message" className="block text-sm font-medium text-slate-700">
          What do you need help with?
        </label>
        <textarea
          id="support-message"
          rows={3}
          required
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Printer not working, change my menu, billing question…"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {error && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {sent && (
          <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Sent. We&apos;ll get back to you on your registered phone number.
          </p>
        )}
        <button
          type="submit"
          disabled={sending}
          className="mt-3 w-full cursor-pointer rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-50 sm:w-auto sm:px-6"
        >
          {sending ? "Sending…" : "Send question"}
        </button>
      </form>

      <h2 className="mt-8 text-sm font-semibold tracking-wider text-slate-500 uppercase">Your questions</h2>
      {queries.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          Nothing asked yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {queries.map((q) => (
            <li key={q.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm whitespace-pre-wrap text-slate-800">{q.message}</p>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                    q.status === "resolved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {q.status === "resolved" ? "Resolved" : "Open"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{dateFmt.format(new Date(q.createdAt))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
