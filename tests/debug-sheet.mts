import { chromium } from "playwright";
import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = "https://inzpo-butlerjake-gmailcoms-projects.vercel.app";

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.setDefaultTimeout(15000);

await page.goto(BASE + "/login");
await page.fill('input[name="passphrase"]', process.env.AUTH_PASSPHRASE!);
await page.click('button[type="submit"]');
await page.waitForURL(BASE + "/");
await page.click('button:has-text("Filters")');
await page.waitForTimeout(1200);
const scrollInfo = await page.evaluate(() => {
  const scrollers = [...document.querySelectorAll("div")].filter((d) => d.scrollHeight > d.clientHeight + 10);
  return scrollers.map((d) => ({
    cls: (d.className || "").toString().slice(0, 60),
    scrollTop: d.scrollTop,
    scrollHeight: d.scrollHeight,
    clientHeight: d.clientHeight,
  }));
});
console.log("scrollers:", JSON.stringify(scrollInfo, null, 1));
const focused = await page.evaluate(() => {
  const el = document.activeElement;
  return el ? `${el.tagName}: ${(el as HTMLElement).outerHTML.slice(0, 80)}` : "none";
});
console.log("activeElement:", focused);

// how many Style buttons match, and what does Playwright say about actionability?
const domInfo = await page.evaluate(() => {
  const sections = [...document.querySelectorAll("section")].filter((s) => s.querySelector("h3")?.textContent === "Style");
  const out: unknown[] = [];
  for (const s of sections) {
    const chain: string[] = [];
    let el: Element | null = s;
    while (el && el !== document.body) {
      chain.push(`${el.tagName}.${(el.className || "").toString().slice(0, 40)}`);
      el = el.parentElement;
    }
    const btns = [...s.querySelectorAll("button")].filter((b) => b.textContent?.includes("minimal"));
    out.push({
      sectionsWithStyle: true,
      rect: s.getBoundingClientRect().toJSON(),
      buttonRects: btns.map((b) => b.getBoundingClientRect().toJSON()),
      chain,
    });
  }
  return out;
});
console.log("domInfo:", JSON.stringify(domInfo, null, 1));
const btn = page.locator("section", { has: page.locator("h3", { hasText: "Style" }) }).first().locator("button", { hasText: "minimal" }).first();
console.log("count:", await btn.count());
const box = await btn.boundingBox();
console.log("boundingBox:", JSON.stringify(box));
console.log("in viewport:", box && box.y >= 0 && box.y + box.height <= 844);
// what element is at the button's center?
if (box) {
  const at = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? `${el.tagName}.${el.className}`.slice(0, 120) : "none";
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  console.log("elementFromPoint at center:", at);
}
await page.screenshot({ path: "/tmp/sheet-debug.png" });
await browser.close();
