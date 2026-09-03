import { chromium } from "playwright";
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = "https://inzpo-butlerjake-gmailcoms-projects.vercel.app";
fs.mkdirSync(".impeccable/review", { recursive: true });
const browser = await chromium.launch();

for (const [name, vp] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]] as const) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill('input[name="passphrase"]', process.env.AUTH_PASSPHRASE!);
  await page.click('button[type="submit"]');
  await page.waitForURL(BASE + "/");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `.impeccable/review/${name}-wall.png`, fullPage: false });
  await page.goto(BASE + "/capture");
  await page.fill('input[name="url"]', "https://www.joshwcomeau.com/animation/css-transitions/");
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `.impeccable/review/${name}-capture.png`, fullPage: false });
  await ctx.close();
}
await browser.close();
console.log("shots done");
