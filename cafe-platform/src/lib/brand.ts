/**
 * Marketing brand constants — single swap point when the final brand
 * name/contact is decided (founder: "OrderLy" is a working title).
 */
export const BRAND_NAME = "OrderLy";
export const BRAND_TAGLINE = "Your menu on every table. Zero commission.";
/** The same tagline, split where the hero headline is meant to break —
 *  three lines, one claim each, so the break stays a content decision
 *  rather than whatever the container width happens to produce. */
export const BRAND_TAGLINE_LINES = ["Your menu", "on every table.", "Zero commission."] as const;

/**
 * Which cafe the "Live demo" nav link opens. Kept here rather than inlined
 * into the route so it stays one swap point — point it at a real customer's
 * cafe for a pitch, or drop it entirely and `/demo` falls back to whichever
 * cafe happens to be open (see src/app/demo/page.tsx).
 */
export const DEMO_CAFE_SLUG = "demo-cafe";

/** Founder contact. */
export const CONTACT_PHONE_DISPLAY = "+91 91150 90584";
export const CONTACT_PHONE_TEL = "+919115090584";
export const WHATSAPP_URL = `https://wa.me/919115090584?text=${encodeURIComponent(
  "Hi! I run a cafe and want to know more about OrderLy.",
)}`;
