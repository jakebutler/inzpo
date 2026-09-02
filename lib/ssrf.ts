import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
    if (lower.startsWith("fe80")) return true; // link-local
    const v4 = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) return isPrivateIp(v4[1]);
    return false;
  }
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname) !== 0) {
    if (isPrivateIp(hostname)) throw new Error(`Blocked private address: ${hostname}`);
    return;
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    throw new Error(`Blocked internal host: ${hostname}`);
  }
  const results = await lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0) throw new Error(`Host does not resolve: ${hostname}`);
  for (const { address } of results) {
    if (isPrivateIp(address)) throw new Error(`Blocked private address for ${hostname}`);
  }
}
