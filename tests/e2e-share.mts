import { SignJWT } from "jose";
import fs from "node:fs";
import sharp from "sharp";

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = "https://inzpo-butlerjake-gmailcoms-projects.vercel.app";
const token = await new SignJWT({ sub: "owner" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
  .sign(new TextEncoder().encode(process.env.AUTH_SESSION_SECRET!));
const cookie = `inzpo_session=${token}`;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 200, b: 100 } } }).png().toBuffer();

// 1. authenticated image share → 303 to /capture?saved=
const fd = new FormData();
fd.append("image", new Blob([new Uint8Array(png)], { type: "image/png" }), "shared.png");
const authed = await fetch(`${BASE}/share`, { method: "POST", body: fd, headers: { Cookie: cookie }, redirect: "manual" });
const loc = authed.headers.get("location") ?? "";
check("authed image share → /capture?saved=", authed.status === 303 && loc.includes("/capture?saved="), loc);
const savedId = loc.match(/saved=([^&]+)/)?.[1];

// 2. authenticated URL share (text scan fallback: no url param, url inside text)
const fd2 = new FormData();
fd2.append("text", "check this out https://example.com/share-probe nice");
const authed2 = await fetch(`${BASE}/share`, { method: "POST", body: fd2, headers: { Cookie: cookie }, redirect: "manual" });
const loc2 = authed2.headers.get("location") ?? "";
check("authed link share (text scan) → saved", authed2.status === 303 && loc2.includes("/capture?saved="), loc2);

// 3. unauthenticated image share → stash + login redirect with shareToken
const fd3 = new FormData();
fd3.append("image", new Blob([new Uint8Array(png)], { type: "image/png" }), "cold.png");
const cold = await fetch(`${BASE}/share`, { method: "POST", body: fd3, redirect: "manual" });
const loc3 = cold.headers.get("location") ?? "";
let stashKey = "";
try {
  const next = new URL(loc3, BASE).searchParams.get("next") ?? "";
  stashKey = new URL(next, BASE).searchParams.get("shareToken") ?? "";
} catch {}
let stashExists = false;
if (stashKey.startsWith("tmp/")) {
  const headMod = await import("@aws-sdk/client-s3");
  const { r2 } = await import("../lib/r2");
  const HeadObjectCommand = headMod.HeadObjectCommand;
  stashExists = await r2()
    .send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: stashKey }))
    .then(() => true)
    .catch(() => false);
}
check("cold-start image share stashes + login redirect", cold.status === 303 && loc3.includes("/login") && stashExists, `${stashKey} exists=${stashExists}`);

// 4. unauthenticated link share → login redirect preserving prefill
const cold2 = await fetch(`${BASE}/share?url=https%3A%2F%2Fexample.com%2Fcold-link`, { method: "POST", redirect: "manual" });
const loc4 = cold2.headers.get("location") ?? "";
check("cold-start link share preserves prefill", cold2.status === 303 && loc4.includes("capture%3Furl%3D") , loc4.slice(0, 120));

// cleanup: shared items + the stash object
if (savedId) {
  const { deleteItem } = await import("../lib/items");
  await deleteItem(savedId);
}
const loc2Id = loc2.match(/saved=([^&]+)/)?.[1];
if (loc2Id) {
  const { deleteItem } = await import("../lib/items");
  await deleteItem(loc2Id);
}
if (stashKey.startsWith("tmp/")) {
  const { r2, DeleteObjectCommand } = await import("../lib/r2");
  await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: stashKey }));
  console.log("stash cleaned:", stashKey);
}

if (failures > 0) {
  console.log(`FAILED: ${failures}`);
  process.exit(1);
}
console.log("SHARE TARGET HTTP PROBES PASS");
