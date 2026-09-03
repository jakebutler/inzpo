// Usage: node tests/mint-cookie.mjs  -> prints the session cookie header value
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";
for (const line of fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const token = await new SignJWT({ sub: "owner" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(Math.floor(Date.now() / 1000) + 7200)
  .sign(new TextEncoder().encode(process.env.AUTH_SESSION_SECRET!));
process.stdout.write(`inzpo_session=${token}`);
