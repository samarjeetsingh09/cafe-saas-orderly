import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay REST helpers — no SDK, plain fetch with basic auth.
 * Keys live server-side only; the checkout key id is handed to the client
 * per-request from the create-order response, never via NEXT_PUBLIC env.
 */

const API_BASE = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys are not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

/** Creates a Razorpay order; amount in paise. Returns the Razorpay order id. */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes,
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay order create failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Lists payments for a Razorpay order — used by the admin reconcile action. */
export async function fetchRazorpayPayments(
  razorpayOrderId: string,
): Promise<{ items: { id: string; status: string }[] }> {
  const res = await fetch(`${API_BASE}/orders/${razorpayOrderId}/payments`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    throw new Error(`Razorpay payments fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Constant-time webhook signature check (Security doc 5.7). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
