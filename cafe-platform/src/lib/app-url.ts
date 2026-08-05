import { headers } from "next/headers";
import { networkInterfaces } from "node:os";

/**
 * The origin baked into table QR codes.
 *
 * A QR is printed once and lives on a table for months, so the URL inside it
 * has to be one a stranger's phone can actually reach — it can't just echo
 * whichever host the owner happened to have in their address bar when the
 * page rendered. That was the old behaviour (`headers().get("host")` used
 * directly), and it meant a console opened on `localhost:3000` produced codes
 * pointing at `localhost`, which on a phone resolves to the phone itself.
 *
 * Order of preference:
 *   1. `NEXT_PUBLIC_APP_URL`, unless it is a loopback address — that is the
 *      production domain, and .env.example has always said it is what gets
 *      baked into QR codes. The loopback exception exists because the shipped
 *      default is `http://localhost:3000`, which would reintroduce the bug on
 *      every dev machine that never edited it.
 *   2. The request's own host, when it is not loopback — an owner browsing
 *      the console over the LAN or a tunnel gets codes for that same origin.
 *   3. In development only, the machine's LAN address, so codes generated
 *      from `localhost` still scan from a phone on the same Wi-Fi.
 */
export async function getQrOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && !isLoopback(hostOf(configured))) return configured;

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? (isLoopback(host) ? "http" : "https");

  if (isLoopback(host) && process.env.NODE_ENV === "development") {
    const lan = lanAddress();
    if (lan) return `http://${lan}${portOf(host)}`;
  }

  return `${proto}://${host}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function portOf(host: string): string {
  const i = host.lastIndexOf(":");
  return i > host.lastIndexOf("]") ? host.slice(i) : "";
}

function isLoopback(host: string): boolean {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name === "localhost" || name === "::1" || name.startsWith("127.");
}

/**
 * First real IPv4 on this machine. Virtual adapters are skipped by name —
 * a WSL or Hyper-V bridge has a perfectly valid non-internal address that no
 * phone on the Wi-Fi can route to, and on Windows it often enumerates first.
 */
const VIRTUAL_ADAPTER = /vethernet|wsl|hyper-v|virtualbox|vmware|docker|loopback|bluetooth|tailscale|zerotier/i;

function lanAddress(): string | null {
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (VIRTUAL_ADAPTER.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return null;
}
