/**
 * Customer session cookie: set when an order is placed, read by the
 * confirmation page. Confirmation URL + this cookie must BOTH match —
 * an unguessable URL alone is not sufficient (Security doc 3.2 Risk 2).
 */
export const CUSTOMER_COOKIE = "customer_session";
