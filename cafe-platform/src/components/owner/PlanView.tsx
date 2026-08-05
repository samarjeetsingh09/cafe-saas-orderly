"use client";

import { useState } from "react";
import type { PlanDTO, SubscriptionDTO, InvoiceDTO } from "@/lib/owner-plan";
import { Modal } from "@/components/owner/Modal";

/**
 * Plan tab — ported verbatim from bella-admin-console.html's "Plan" tab
 * (Phase H #6). Real `Plan`/`Subscription`/`Invoice` rows replace the mock
 * `PLANS`/`SUB`/`INVOICES`. Per plan/START-HERE.md: a plan-change button
 * never charges or mutates the subscription — it only raises a support
 * ticket (`POST /api/plan/change`), whichever direction.
 *
 * The prototype's masked-card display and "Change payment method" flow had
 * no real backing store (no card was ever actually vaulted) — rather than
 * fabricate a card number, this points at the Support tab instead.
 */
const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");

// Platform-level product copy (same for every tenant) — not "cafe data" (Rule 2).
const FEATURE_LABELS: Record<string, string> = {
  core_ordering: "Digital menu + live order board, cash & UPI at the table",
  split_kitchen: "Split veg / non-veg kitchens",
  analytics: "Sales reports & exports",
  whatsapp_bill: "WhatsApp bill to customer",
  custom_pricing: "Custom pricing & dedicated account manager",
};
const PLAN_TAGLINES: Record<string, string> = {
  starter: "One small cafe, one kitchen, just get ordering going.",
  growth: "Two kitchens, more tables, and you want to see the numbers daily.",
  pro: "More than one outlet, or 200+ orders a day.",
  enterprise: "Custom footprint — talk to us about what you need.",
};

export function PlanView({
  plans,
  subscription,
  invoices,
  canManage,
  daysLeft,
}: {
  plans: PlanDTO[];
  subscription: SubscriptionDTO | null;
  invoices: InvoiceDTO[];
  canManage: boolean;
  daysLeft: number;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [changeTarget, setChangeTarget] = useState<PlanDTO | null>(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const current = plans.find((p) => p.id === subscription?.planId);

  async function confirmChange(target: PlanDTO) {
    const res = await fetch("/api/plan/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: target.id }),
    });
    setChangeTarget(null);
    if (!res.ok) return flash("Couldn't send the request");
    flash(`Request sent — support will follow up about ${target.name}`);
  }

  return (
    <section>
      <h2 className="title">Your plan</h2>
      <p className="sub-t">Billing and what each tier unlocks</p>

      {current && subscription && (
        <div className="planbar">
          <div className="pb-main">
            <div className="pb-name">{current.name}</div>
            <div className="pb-sub">
              Active since {new Date(subscription.currentStart).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })} · up to{" "}
              {current.maxTables} tables
            </div>
          </div>
          <span className="renew">
            {subscription.cancelAtEnd ? "Ends" : "Renews"} in {daysLeft} days ·{" "}
            {new Date(subscription.currentEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
          </span>
          <div className="pb-amt">
            <b>{money(current.pricePaise)}</b>
            <small>per month + GST</small>
          </div>
        </div>
      )}

      <h4 className="blockh">Plans</h4>
      <div className="plans">
        {plans.map((p) => {
          const isCurrent = p.id === current?.id;
          const dir = current && p.sortOrder > current.sortOrder ? "Upgrade" : "Switch";
          return (
            <div className={`plan${isCurrent ? " current" : ""}`} key={p.id}>
              {p.id === "growth" && !isCurrent && <span className="ribbon">Most cafes</span>}
              {isCurrent && <span className="ribbon">Current</span>}
              <h5>{p.name}</h5>
              <div className="tagline">{PLAN_TAGLINES[p.id] ?? ""}</div>
              <div className="amt">
                {p.pricePaise ? money(p.pricePaise) : "Custom"}
                {p.pricePaise ? <small> /mo</small> : null}
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{FEATURE_LABELS[f] ?? f}</li>
                ))}
              </ul>
              {canManage ? (
                <button className={`pbtn${isCurrent ? " on" : ""}`} disabled={isCurrent} onClick={() => setChangeTarget(p)}>
                  {isCurrent ? "You're on this" : `${dir} to ${p.name}`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="card">
          <h4>Invoices</h4>
          {invoices.length ? (
            invoices.map((i) => (
              <div className="inv" key={i.id}>
                <div>
                  <div>{i.number}</div>
                  <div className="t">
                    {new Date(i.issuedOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} ·{" "}
                    {i.status === "paid" ? "Paid" : i.status === "due" ? "Due" : "Failed"}
                  </div>
                </div>
                <div className="r">
                  <b>{money(i.amountPaise)}</b>
                  <button className="dl" onClick={() => flash(`${i.number} — invoice download isn't wired up yet`)}>
                    PDF
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="muted-note">No invoices yet.</p>
          )}
        </div>
        <div className="card">
          <h4>Payment method</h4>
          <p className="muted-note">
            {subscription?.currentEnd
              ? `We'll email the invoice on the ${new Date(subscription.currentEnd).getDate()}th of every month.`
              : "Billing details aren't set up yet."}
          </p>
          <button className="ghost-btn" onClick={() => setCardModalOpen(true)}>
            Update payment details
          </button>
        </div>
      </div>

      <Modal open={!!changeTarget} onClose={() => setChangeTarget(null)}>
        {changeTarget && current && (
          <>
            <h3>
              {changeTarget.sortOrder > current.sortOrder ? "Upgrade" : "Switch"} to {changeTarget.name}?
            </h3>
            <p className="hint">
              {current.name} → {changeTarget.name} · {changeTarget.pricePaise ? `${money(changeTarget.pricePaise)} per month + GST` : "custom pricing"}
            </p>
            <div className="reqbox">
              <p>This sends a request to support — nothing is charged automatically, and someone will follow up to make the switch.</p>
              <div className="reqline">
                <span>Table codes</span>
                <b>
                  {current.maxTables} → {changeTarget.maxTables}
                </b>
              </div>
              <div className="reqline">
                <span>Monthly</span>
                <b>
                  {money(current.pricePaise)} → {changeTarget.pricePaise ? money(changeTarget.pricePaise) : "custom"}
                </b>
              </div>
            </div>
            <div className="mact">
              <button className="cancel" onClick={() => setChangeTarget(null)}>
                Not now
              </button>
              <button className="save" onClick={() => confirmChange(changeTarget)}>
                Send request
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={cardModalOpen} onClose={() => setCardModalOpen(false)}>
        <h3>Update payment details</h3>
        <p className="hint">For security we don&rsquo;t take card details here</p>
        <div className="reqbox">
          <p>Raise a query from the Support tab and we&rsquo;ll send a secure link to update your payment method — nothing touches this dashboard.</p>
        </div>
        <div className="mact">
          <button className="cancel" style={{ flex: 1 }} onClick={() => setCardModalOpen(false)}>
            Close
          </button>
        </div>
      </Modal>

      <div className={`toast${toast ? " show" : ""}`}>{toast ?? ""}</div>
    </section>
  );
}
