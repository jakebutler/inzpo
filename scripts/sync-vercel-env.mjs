import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const kickoff = fs.readFileSync("/Volumes/rexy/GitHub/inzpo/HITL_kickoff_items.md", "utf8");
const getToken = (name) => kickoff.split("\n").find((l) => l.startsWith(name + "="))?.split("=")[1]?.trim();
const VT = getToken("VERCEL_ACCESS_TOKEN");
const VP = getToken("VERCEL_PROJECT_ID");

const wanted = ["R2_BUCKET", "AUTH_PASSPHRASE", "AUTH_SESSION_SECRET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const obsolete = ["CLOUDFLARE_TOKEN", "CLOUDFLARE_ACCESS_KEY_ID", "CLOUDFLARE_SECRET_ACCESS_KEY", "CLOUDFLARE_JURISDICTION_SPECIFIC_ENDPOINTS", "VERCEL_PROJECT_ID", "VERCEL_ACCESS_TOKEN"];

const existing = await (await fetch(`https://api.vercel.com/v9/projects/${VP}/env`, {
  headers: { Authorization: `Bearer ${VT}` },
})).json();
const existingKeys = new Set((existing.envs ?? []).map((e) => e.key));

for (const key of wanted) {
  const value = env[key];
  if (!value) { console.error(`MISSING locally: ${key}`); continue; }
  if (existingKeys.has(key)) {
    // update: need env id
    const e = existing.envs.find((x) => x.key === key);
    const res = await fetch(`https://api.vercel.com/v10/projects/${VP}/env/${e.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${VT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview", "development"] }),
    });
    console.log(key, res.ok ? "UPDATED" : JSON.stringify(await res.json()));
  } else {
    const res = await fetch(`https://api.vercel.com/v10/projects/${VP}/env`, {
      method: "POST",
      headers: { Authorization: `Bearer ${VT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview", "development"] }),
    });
    console.log(key, res.ok ? "CREATED" : JSON.stringify(await res.json()));
  }
}

for (const key of obsolete) {
  const e = (existing.envs ?? []).find((x) => x.key === key);
  if (!e) continue;
  const res = await fetch(`https://api.vercel.com/v9/projects/${VP}/env/${e.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${VT}` },
  });
  console.log(key, res.ok ? "REMOVED" : JSON.stringify(await res.json()));
}

const check = await (await fetch(`https://api.vercel.com/v9/projects/${VP}/env`, {
  headers: { Authorization: `Bearer ${VT}` },
})).json();
console.log("keys now:", (check.envs ?? []).map((e) => e.key).sort().join(", "));
