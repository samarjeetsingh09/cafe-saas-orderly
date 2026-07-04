/**
 * Reserved slugs — cafe slugs must never shadow an app route.
 * DESIGN_SYSTEM.md Section 3. Checked at cafe creation (admin portal).
 */
export const RESERVED_SLUGS = new Set([
  "admin",
  "owner",
  "api",
  "order",
  "menu",
  "t",
  "login",
  "logout",
  "about",
  "pricing",
  "support",
  "contact",
  "terms",
  "privacy",
  "static",
  "favicon.ico",
  "_next",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidCafeSlug(slug: string): boolean {
  return (
    slug.length >= 3 &&
    slug.length <= 40 &&
    SLUG_PATTERN.test(slug) &&
    !RESERVED_SLUGS.has(slug)
  );
}
