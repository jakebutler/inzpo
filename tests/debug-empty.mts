import { SignJWT } from "jose";
import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const token = await new SignJWT({ sub: "owner" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
  .sign(new TextEncoder().encode(process.env.AUTH_SESSION_SECRET!));
fs.writeFileSync("/tmp/inzpo-cookie.txt", `inzpo_session=${token}`);
console.log("cookie minted");

const f = encodeURIComponent(JSON.stringify({ q: "zzz-no-match", kinds: {}, facetValues: [], freeTags: [], colors: [], sort: "newest" }));
const res = await fetch(`https://inzpo-butlerjake-gmailcoms-projects.vercel.app/?f=${f}`, {
  headers: { Cookie: `inzpo_session=${token}` },
});
const html = await res.text();
console.log("status:", res.status, "| final url:", res.url);
console.log("title:", (html.match(/<title>([^<]*)<\/title>/) ?? [])[1]);
console.log("head snippet:", html.slice(0, 300).replace(/\s+/g, " "));
console.log("has 'Nothing matches.':", html.includes("Nothing matches."));
console.log("has WallGrid empty-state container:", html.includes("col-span-full"));
console.log("has '0 items':", html.includes("0 items"));
console.log("html length:", html.length);

const cookie = fs.readFileSync("/tmp/inzpo-cookie.txt", "utf8");
const probe = await fetch(`https://inzpo-butlerjake-gmailcoms-projects.vercel.app/api/filter-count`, {
  method: "POST",
  headers: { Cookie: cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ f: f }),
  redirect: "manual",
});
console.log("filter-count status:", probe.status);
console.log("filter-count body:", (await probe.text()).slice(0, 120));

const wallProbe = await fetch(`https://inzpo-butlerjake-gmailcoms-projects.vercel.app/`, {
  headers: { Cookie: cookie },
  redirect: "manual",
});
console.log("wall status:", wallProbe.status, wallProbe.headers.get("location") ?? "");
const wallHtml = await wallProbe.text();
fs.writeFileSync("/tmp/wall.html", wallHtml);
console.log("wall html length:", wallHtml.length);
console.log("has '0 items':", wallHtml.includes("0 items"));
console.log("has 'Nothing matches':", wallHtml.includes("Nothing matches"));
console.log("has 'Adjust the filters':", wallHtml.includes("Adjust the filters"));
console.log("has 'columns-2':", wallHtml.includes("columns-2"));
