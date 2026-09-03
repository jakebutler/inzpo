if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { fetchPage } = await import("../lib/fetch-url");
const page = await fetchPage("https://www.joshwcomeau.com/animation/css-transitions/");
console.log("html length:", page.html.length);
const [{ default: metascraper }, t, d, i] = await Promise.all([
  import("metascraper"),
  import("metascraper-title"),
  import("metascraper-description"),
  import("metascraper-image"),
]);
try {
  const scrape = metascraper([t.default(), d.default(), i.default()]);
  const meta = await scrape({ url: page.finalUrl, html: page.html });
  console.log("meta:", JSON.stringify(meta).slice(0, 300));
} catch (e) {
  console.log("SCRAPE ERROR:", e instanceof Error ? e.message : e);
}
