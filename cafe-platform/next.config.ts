import type { NextConfig } from "next";

/**
 * Private-network origins the dev server will serve `/_next/*` to.
 *
 * Next blocks cross-origin requests to dev-only assets by default, which is
 * right — but it means a phone opening the customer menu over the LAN gets
 * the server-rendered HTML and then a 403 on every client chunk, so the page
 * appears and then does nothing. Listing this machine's own address would
 * work until the next hotspot reconnect hands out a different one, so the
 * RFC 1918 ranges are listed instead: still private-only, but stable across
 * reconnects.
 *
 * The matcher globs one segment per `*` (see Next's `isCsrfOriginAllowed`),
 * so each range has to spell its octets out. Development-only by definition —
 * this option is not read in a production build.
 */
const privateNetworkOrigins = [
  "192.168.*.*",
  "10.*.*.*",
  // 172.16.0.0/12 — includes the blocks phone hotspots hand out (172.20.10.x on iOS).
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: privateNetworkOrigins,
};

export default nextConfig;
