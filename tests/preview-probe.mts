import { SignJWT } from "jose";
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const token = await new SignJWT({ sub: "owner" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + 3600).sign(new TextEncoder().encode(process.env.AUTH_SESSION_SECRET!));
const res = await fetch("https://inzpo-butlerjake-gmailcoms-projects.vercel.app/api/preview", {
  method: "POST",
  headers: { Cookie: `inzpo_session=${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://www.joshwcomeau.com/animation/css-transitions/" }),
});
console.log(res.status, (await res.text()).slice(0, 300));
