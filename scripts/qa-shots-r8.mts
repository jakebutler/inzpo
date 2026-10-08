/**
 * Cold Chromium recapture. QA_BASE must be an immutable Preview deployment URL.
 * QA_BASE=https://<deployment>.vercel.app OUT=/workspace/inzpo/r8-live npx tsx scripts/qa-shots-r8.mts
 * No storage state, credentials, or videos are written. Pin-drop stills: e2e-pin-drop.mts.
 * Local import/compile smoke check (no browser/network/files): npx tsx scripts/qa-shots-r8.mts --check
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { captureGuardIssues, cssRgbToHex } from "../lib/qa-capture-guard.ts";

const BASE = (process.env.QA_BASE ?? "").replace(/\/+$/, "");
const OUT = process.env.OUT ?? "";
const EMAIL = process.env.E2E_EMAIL ?? "inzpo+clerk_test@example.com";
const CODE = process.env.E2E_CODE ?? "424242";
const PHOTOS = ["IMG_6505", "IMG_6208", "IMG_5859"] as const;
const ROLES = ["primary", "secondary", "accent", "background", "surface", "text"] as const;
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "375x667", width: 375, height: 667 },
] as const;
type Viewport = (typeof VIEWPORTS)[number];
type Check = { label: string; pass: boolean; detail?: unknown };
type Item = {
  photo: string; viewport: string; itemPath?: string;
  uploadMs?: number; uploadWait?: { screenshotMs: number; visible: boolean; durationMs: number | null };
  briefMs?: number; briefCharacters?: number;
  revealFrames?: { targetMs: number; actualMs: number; file: string }[];
  roles?: Record<string, string>;
  overlap?: unknown; linkContrast?: unknown; altTitle?: unknown;
  mediaCodes: { path: string; status: number | null; source: string }[];
};
const report = {
  guard: { pass: 0, fail: 0, checks: [] as Check[] },
  checks: [] as Check[], failures: [] as string[], items: [] as Item[],
  wall: [] as { viewport: string; untitledCount: number; texts: string[] }[],
  files: [] as string[],
  timingNotes: "Upload and brief times start at file-input submission and first result DOM respectively. Reveal targets use the first [data-photo-fold] insertion; actual screenshot start offsets are recorded (screenshots may exceed the target spacing).",
};
const states = new WeakMap<Page, { staticFails: string[]; documentStatus?: number }>();
const artifact = (name: string) => path.join(OUT, name);
const safePath = (url: string) => { try { return new URL(url).pathname; } catch { return "invalid URL"; } };
function errorText(error: unknown): string {
  // Playwright errors can contain filled values and URLs. Never print call logs or credentials.
  return (error instanceof Error ? error.message : String(error)).split("\n")[0]!
    .split(EMAIL).join("[email]").split(CODE).join("[code]")
    .replace(/https?:\/\/[^\s)]+/g, "[URL]");
}
function check(label: string, pass: boolean, detail?: unknown): void {
  report.checks.push({ label, pass, detail });
  if (!pass) report.failures.push(label);
}
async function attempt(label: string, work: () => Promise<void>): Promise<void> {
  try { await work(); } catch (error) { check(label, false, errorText(error)); }
}

function watch(page: Page, item?: Item): void {
  const state: { staticFails: string[]; documentStatus?: number } = { staticFails: [] };
  states.set(page, state);
  page.on("response", response => {
    const request = response.request();
    const pathname = safePath(response.url());
    if (request.resourceType() === "document" && request.frame() === page.mainFrame()) state.documentStatus = response.status();
    if ((pathname.includes("/_next/static") || request.resourceType() === "stylesheet") && response.status() !== 200) {
      state.staticFails.push(`${response.status()} ${pathname}`);
    }
    if (item && request.resourceType() === "image" && pathname.startsWith("/media/")) {
      item.mediaCodes.push({ path: pathname, status: response.status(), source: "browser" });
    }
  });
  page.on("requestfailed", request => {
    const pathname = safePath(request.url());
    if (pathname.includes("/_next/static") || request.resourceType() === "stylesheet") state.staticFails.push(`request failed ${pathname}`);
    if (item && request.resourceType() === "image" && pathname.startsWith("/media/")) {
      item.mediaCodes.push({ path: pathname, status: null, source: "browser request failed" });
    }
  });
}

async function guard(page: Page, label: string, allowStatus = [200]): Promise<void> {
  try {
    await page.evaluate(() => document.fonts.ready);
    const raw = await page.evaluate(() => {
      const sheets = [...document.styleSheets];
      let ruleCount = 0;
      const sheetIssues: string[] = [];
      for (const [index, sheet] of sheets.entries()) {
        try {
          const count = sheet.cssRules.length;
          ruleCount += count;
          if (!count) sheetIssues.push(`stylesheet ${index} has no rules`);
        } catch { sheetIssues.push(`stylesheet ${index} rules inaccessible`); }
      }
      const wear = document.querySelector("[data-kit-wear]");
      const style = getComputedStyle(document.documentElement);
      const faces = [...document.fonts];
      const fontOK = (variable: string, family: string) => {
        // next/font renames families. Check the actual primary CSS family and its loaded face;
        // fonts.check on a nonexistent plain family alone would incorrectly return true.
        const primary = style.getPropertyValue(variable).trim().split(",")[0]?.trim() || family;
        const unquoted = primary.replace(/["']/g, "");
        return document.fonts.check(`18px ${primary}`) && faces.some(face =>
          face.family.replace(/["']/g, "") === unquoted && face.status === "loaded");
      };
      return {
        sheetCount: sheets.length, ruleCount, sheetIssues,
        backgroundColor: getComputedStyle(wear ?? document.body).backgroundColor,
        kitWear: Boolean(wear), errorDocument: document.documentElement.id === "__next_error__",
        fraunces: fontOK("--font-fraunces", "Fraunces"), geist: fontOK("--font-geist", "Geist"),
      };
    });
    const state = states.get(page)!;
    const issues = captureGuardIssues({ ...raw, staticFails: state.staticFails,
      backgroundHex: cssRgbToHex(raw.backgroundColor),
      documentStatus: state.documentStatus !== undefined && allowStatus.includes(state.documentStatus) ? 200 : state.documentStatus,
    });
    issues.push(...raw.sheetIssues);
    if (state.documentStatus === undefined) issues.push("main document status missing");
    report.guard[issues.length ? "fail" : "pass"]++;
    report.guard.checks.push({ label, pass: !issues.length, detail: issues });
    if (issues.length) report.failures.push(`guard: ${label}: ${issues.join("; ")}`);
  } catch (error) {
    report.guard.fail++;
    report.guard.checks.push({ label, pass: false, detail: errorText(error) });
    report.failures.push(`guard: ${label}: ${errorText(error)}`);
  }
}
async function screenshot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.screenshot({ path: artifact(name), fullPage, animations: "allow", timeout: 30_000 });
  report.files.push(name);
}
async function shot(page: Page, name: string, fullPage = false, allowStatus = [200]): Promise<void> {
  // Save evidence even when the guard fails.
  await guard(page, name, allowStatus);
  await screenshot(page, name, fullPage);
}
async function goto(page: Page, pathname: string): Promise<void> {
  await page.goto(`${BASE}${pathname}`, { waitUntil: "load" });
}
async function signIn(page: Page): Promise<void> {
  await goto(page, "/login");
  await page.locator("#email").waitFor();
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded), undefined, { timeout: 30_000 });
  await page.fill("#email", EMAIL);
  await page.locator('button[type="submit"]').click();
  await page.locator("#code").waitFor({ timeout: 30_000 });
  await page.fill("#code", CODE);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => url.pathname === "/capture", { timeout: 45_000 });
}
async function flow(browser: Browser, vp: Viewport, label: string, authenticated: boolean,
  work: (page: Page) => Promise<void>, item?: Item): Promise<void> {
  await attempt(label, async () => {
    // A new route-less context has no HTTP cache, service worker, cookies, or local storage
    // from any preceding flow. Block service workers so they cannot supply cached assets.
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "no-preference", serviceWorkers: "block" });
    try {
      await context.addInitScript(() => {
        const style = document.createElement("style");
        style.textContent = "nextjs-portal{display:none!important}";
        const install = () => { if (document.head && !style.isConnected) document.head.append(style); };
        const win = window as unknown as { r8ResultStart?: number; r8BriefStart?: number; r8WaitStart?: number; r8WaitEnd?: number };
        const observer = new MutationObserver(() => {
          install();
          if (document.querySelector("[data-photo-fold]") && win.r8ResultStart === undefined) win.r8ResultStart = performance.now();
          if (document.querySelector("[data-upload-wait]") && win.r8WaitStart === undefined) win.r8WaitStart = performance.now();
          if (win.r8WaitStart !== undefined && !document.querySelector("[data-upload-wait]") && win.r8WaitEnd === undefined) win.r8WaitEnd = performance.now();
          const brief = document.querySelector("[data-brief-text]");
          if (brief?.textContent?.trim() && !/chewing on it|couldn't|tap to retry/i.test(brief.textContent) && win.r8BriefStart === undefined) win.r8BriefStart = performance.now();
        });
        observer.observe(document, { childList: true, subtree: true, characterData: true });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      page.setDefaultNavigationTimeout(60_000);
      watch(page, item);
      try {
        if (authenticated) await signIn(page);
        await work(page);
      } finally {
        if (item) check(`${label} all media responses HTTP 200 at flow end`, item.mediaCodes.length > 0 && item.mediaCodes.every(code => code.status === 200), item.mediaCodes);
        // Includes late resource failures and flows that failed before a screenshot.
        await guard(page, `${label} final`, label.startsWith("404") ? [404] : [200]);
      }
    } finally { await context.close(); }
  });
}

async function savedChecks(page: Page, item: Item): Promise<void> {
  await attempt(`${item.photo} ${item.viewport} saved overlap measurement`, async () => {
    await page.waitForFunction(expectedCharacters => {
      const brief = document.querySelector("[data-brief-text]");
      const caption = document.querySelector("[data-saved-caption]");
      return Boolean(brief && brief.textContent?.trim().length === expectedCharacters && getComputedStyle(brief).opacity === "1" &&
        caption?.textContent?.trim() === "Saved. Baku is full.");
    }, item.briefCharacters, { timeout: 15_000 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    item.overlap = await page.evaluate(() => {
      const brief = document.querySelector("[data-brief-text]");
      const caption = document.querySelector("[data-saved-caption]");
      const bar = document.querySelector("[data-save-bar]");
      const rect = (r: DOMRect) => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
      const barRect = bar?.getBoundingClientRect();
      const range = document.createRange();
      if (brief) range.selectNodeContents(brief);
      const lines = brief ? [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0) : [];
      const last = lines.at(-1);
      const captionRect = caption?.getBoundingClientRect();
      const clear = (r?: DOMRect) => Boolean(r && barRect && r.top >= 0 && r.bottom <= innerHeight &&
        !(r.left < barRect.right && r.right > barRect.left && r.top < barRect.bottom && r.bottom > barRect.top));
      return { pass: clear(last) && clear(captionRect) && caption?.textContent?.trim() === "Saved. Baku is full.",
        lastLine: last ? rect(last) : null, caption: captionRect ? rect(captionRect) : null,
        saveBar: barRect ? rect(barRect) : null, briefCharacters: brief?.textContent?.trim().length ?? 0,
        captionText: caption?.textContent?.trim() ?? null };
    });
    check(`${item.photo} ${item.viewport} saved brief/caption clear of save bar`, (item.overlap as { pass: boolean }).pass, item.overlap);
  });
  await attempt(`${item.photo} ${item.viewport} saved link contrast measurement`, async () => {
    item.linkContrast = await page.locator("[data-save-bar] a").evaluate(link => {
      const rgba = (value: string) => {
        const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
        if (numbers.length < 3) throw new Error("Unsupported computed colour");
        return [numbers[0]!, numbers[1]!, numbers[2]!, numbers[3] ?? 1];
      };
      const foreground = getComputedStyle(link).color;
      const layers: { colour: string; opacity: number }[] = [];
      for (let node: Element | null = link; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        layers.push({ colour: style.backgroundColor, opacity: Number(style.opacity) });
        if (style.backgroundImage !== "none" || Number(style.opacity) !== 1) throw new Error("Non-solid/opacity contrast needs manual verification");
      }
      // Composite every transparent background over the browser's opaque canvas.
      let background = [255, 255, 255];
      for (const layer of layers.reverse()) {
        const c = rgba(layer.colour);
        background = background.map((v, i) => c[i]! * c[3]! + v * (1 - c[3]!));
      }
      const fg = rgba(foreground);
      const ink = background.map((v, i) => fg[i]! * fg[3]! + v * (1 - fg[3]!));
      const luminance = (rgb: number[]) => rgb.map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const a = luminance(ink), b = luminance(background);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return { foreground, backgroundRGB: background, computedBackgrounds: layers, ratio, minimum: 4.5, pass: ratio >= 4.5, text: link.textContent?.trim() };
    });
    check(`${item.photo} ${item.viewport} saved collection link contrast >= 4.5`, (item.linkContrast as { pass: boolean }).pass, item.linkContrast);
  });
  await attempt(`${item.photo} ${item.viewport} saved alt/title measurement`, async () => {
    const image = page.locator("[data-photo-fold] img:not([data-photo-lqip])").first();
    const title = (await page.locator("[data-saved-header] h1").innerText()).trim();
    const alt = await image.getAttribute("alt");
    item.altTitle = { alt, title, pass: Boolean(title) && alt === title };
    check(`${item.photo} ${item.viewport} photo alt equals visible title`, (item.altTitle as { pass: boolean }).pass, item.altTitle);
  });
}

async function upload(page: Page, photo: string, vp: Viewport, item: Item): Promise<void> {
  const prefix = `r8_${photo}_${vp.name}`;
  await goto(page, "/capture");
  await page.getByRole("button", { name: "Pick a photo" }).waitFor();
  const start = Date.now();
  // Arm the DOM waiter before submission, and attach a rejection handler immediately.
  const result = page.waitForFunction(() => {
    const win = window as unknown as { r8ResultStart?: number };
    return location.pathname.startsWith("/items/") && win.r8ResultStart !== undefined;
  }, undefined, { timeout: 120_000 }).then(() => null, error => error);
  // File selection itself submits CaptureForm; no synthetic API upload or submit button.
  await page.locator('input[type="file"][accept*="heic"]').first()
    .setInputFiles(path.join(process.cwd(), `public/sample/${photo}.jpg`));
  const delay = 500 - (Date.now() - start);
  if (delay > 0) await page.waitForTimeout(delay);
  item.uploadWait = { screenshotMs: Date.now() - start, visible: await page.locator("[data-upload-wait]").isVisible(), durationMs: null };
  await attempt(`${prefix} upload wait screenshot`, () => screenshot(page, `${prefix}_upload-wait.png`));
  await guard(page, `${prefix} upload wait`);
  check(`${prefix} upload wait visible at ~500ms`, item.uploadWait.visible, item.uploadWait);
  const resultError = await result;
  if (resultError) throw resultError;
  item.uploadMs = Date.now() - start;
  item.itemPath = safePath(page.url());
  const timings = await page.evaluate(() => {
    const win = window as unknown as { r8ResultStart: number; r8WaitStart?: number; r8WaitEnd?: number };
    return { elapsed: performance.now() - win.r8ResultStart, wait: win.r8WaitStart !== undefined && win.r8WaitEnd !== undefined ? win.r8WaitEnd - win.r8WaitStart : null };
  });
  item.uploadMs -= timings.elapsed;
  item.uploadWait.durationMs = timings.wait;
  check(`${prefix} upload wait duration recorded`, timings.wait !== null && timings.wait >= 0, timings.wait);
  if (vp.name === "390x844") {
    item.revealFrames = [];
    for (const targetMs of [0, 100, 300, 600]) {
      const elapsed = await page.evaluate(() => performance.now() - (window as unknown as { r8ResultStart: number }).r8ResultStart);
      if (elapsed < targetMs) await page.waitForTimeout(targetMs - elapsed);
      const actualMs = await page.evaluate(() => performance.now() - (window as unknown as { r8ResultStart: number }).r8ResultStart);
      const file = `${prefix}_reveal-${String(targetMs).padStart(3, "0")}ms.png`;
      await attempt(`${file} screenshot`, () => screenshot(page, file));
      item.revealFrames.push({ targetMs, actualMs, file });
    }
    // Guard after the timed sequence to avoid delaying its first frame with font checks.
    await guard(page, `${prefix} reveal sequence`);
  }
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>("[data-photo-fold] img:not([data-photo-lqip])");
    const bands = [...document.querySelectorAll("[data-role]")];
    return image?.complete && image.naturalWidth > 0 && getComputedStyle(image).opacity === "1" &&
      bands.length === 6 && bands.every(band => getComputedStyle(band).opacity === "1");
  }, undefined, { timeout: 45_000 });
  await shot(page, `${prefix}_result.png`);
  await shot(page, `${prefix}_result_full.png`, true);
  await attempt(`${prefix} brief ready`, async () => {
    await page.waitForFunction(() => {
      const brief = document.querySelector("[data-brief-text]");
      return Boolean(brief?.textContent?.trim() && !/chewing on it|couldn't|tap to retry/i.test(brief.textContent) && getComputedStyle(brief).opacity === "1");
    }, undefined, { timeout: 60_000 });
    item.briefMs = await page.evaluate(() => {
      const win = window as unknown as { r8ResultStart: number; r8BriefStart: number };
      return win.r8BriefStart - win.r8ResultStart;
    });
    item.briefCharacters = (await page.locator("[data-brief-text]").innerText()).trim().length;
    await page.locator("[data-brief-text]").scrollIntoViewIfNeeded();
    await shot(page, `${prefix}_brief.png`);
  });
  await attempt(`${prefix} roles`, async () => {
    const bands = await page.locator("[data-role]").evaluateAll(nodes => nodes.map(node => ({
      role: node.getAttribute("data-role")!, hex: node.getAttribute("data-hex"), empty: node.classList.contains("inzpo-band-empty"),
    })));
    item.roles = Object.fromEntries(bands.map(b => [b.role, b.empty || b.hex === "" ? "EMPTY" : b.hex ?? "MISSING"]));
    check(`${prefix} six roles and consistent empty markers`, bands.length === 6 && ROLES.every(role => bands.some(b => b.role === role)) &&
      bands.every(b => b.empty ? b.hex === "" : /^#[\da-f]{6}$/i.test(b.hex ?? "")), bands);
    for (const role of ROLES.filter(role => item.roles![role] === "EMPTY")) {
      await page.locator(`[data-role="${role}"]`).scrollIntoViewIfNeeded();
      await shot(page, `${prefix}_empty-${role}.png`);
    }
  });
  await attempt(`${prefix} media`, async () => {
    const urls = await page.locator("img").evaluateAll(nodes => [...new Set(nodes.flatMap(node => {
      const img = node as HTMLImageElement;
      return [img.src, img.currentSrc];
    }).filter(Boolean))]);
    const media = urls.filter(url => safePath(url).startsWith("/media/"));
    check(`${prefix} has media images`, media.length > 0);
    for (const url of media) {
      await attempt(`${prefix} media ${safePath(url)}`, async () => {
        const response = await page.request.get(url, { timeout: 60_000 });
        item.mediaCodes.push({ path: safePath(url), status: response.status(), source: "authenticated GET" });
        check(`${prefix} media ${safePath(url)} HTTP 200`, response.status() === 200);
        await response.dispose();
      });
    }
    check(`${prefix} all observed media responses HTTP 200`, item.mediaCodes.length > 0 && item.mediaCodes.every(code => code.status === 200), item.mediaCodes);
  });
  await attempt(`${prefix} saved flow`, async () => {
    if (!item.briefCharacters) throw new Error("Cannot check saved long brief: brief never became ready");
    await page.locator("[data-save-bar]").getByRole("button", { name: /^Save to / }).click();
    const sheet = page.getByRole("dialog");
    await sheet.waitFor();
    const choices = sheet.locator("button").filter({ has: page.locator("span:not(.sr-only)") });
    if (await choices.count()) {
      const preferred = sheet.getByRole("button", { name: "r8 live", exact: true });
      await (await preferred.count() ? preferred : choices.first()).click();
      await page.locator("[data-save-bar]").getByRole("button", { name: "Save", exact: true }).click();
    } else {
      await sheet.getByRole("button", { name: "+ New collection", exact: true }).click();
      await sheet.getByRole("textbox", { name: "New collection name" }).fill("r8 live");
      await sheet.getByRole("button", { name: "Create", exact: true }).click();
    }
    await page.waitForURL(url => url.searchParams.get("saved") === "1", { timeout: 60_000 });
    // Caption lasts only two seconds: measure it immediately, before font/screenshot waits.
    await attempt(`${prefix} saved checks`, () => savedChecks(page, item));
    await shot(page, `${prefix}_saved.png`);
    await shot(page, `${prefix}_saved_full.png`, true);
    const link = page.locator("[data-save-bar] a");
    const href = await link.getAttribute("href");
    check(`${prefix} collection link includes collection`, Boolean(href && new URL(href, BASE).searchParams.get("c")));
    await link.click();
    await page.waitForURL(url => url.pathname === "/" && Boolean(url.searchParams.get("c")), { timeout: 45_000 });
    await shot(page, `${prefix}_collection.png`);
  });
}

async function writeReports(): Promise<void> {
  const roles: Record<string, Record<string, Record<string, string>>> = {};
  for (const item of report.items) (roles[item.photo] ??= {})[item.viewport] = item.roles ?? {};
  const rolesMarkdown = ["| Photo | Viewport | Role | Hex |", "| --- | --- | --- | --- |",
    ...report.items.flatMap(item => ROLES.map(role => `| ${item.photo} | ${item.viewport} | ${role} | ${item.roles?.[role] ?? "NOT CAPTURED"} |`))].join("\n") + "\n";
  const markdown = [
    `Capture guard: ${report.guard.pass} passed, ${report.guard.fail} failed. Checks: ${report.checks.filter(c => c.pass).length} passed, ${report.checks.filter(c => !c.pass).length} failed.`,
    "", report.timingNotes, "", "| Photo | Viewport | Upload ms | Wait ms | Brief ms | Brief characters |", "| --- | --- | --- | --- | --- | --- |",
    ...report.items.map(item => `| ${item.photo} | ${item.viewport} | ${item.uploadMs?.toFixed(0) ?? "MISSING"} | ${item.uploadWait?.durationMs?.toFixed(0) ?? "MISSING"} | ${item.briefMs?.toFixed(0) ?? "MISSING"} | ${item.briefCharacters ?? "MISSING"} |`),
    "", rolesMarkdown,
    ...report.items.flatMap(item => [
      `${item.photo} ${item.viewport}:`,
      `- Upload wait: ${JSON.stringify(item.uploadWait ?? null)}`,
      `- Reveal frames: ${JSON.stringify(item.revealFrames ?? [])}`,
      `- Overlap: ${JSON.stringify(item.overlap ?? null)}`,
      `- Collection link contrast: ${JSON.stringify(item.linkContrast ?? null)}`,
      `- Alt equals title: ${JSON.stringify(item.altTitle ?? null)}`,
      `- Media codes: ${JSON.stringify(item.mediaCodes)}`, "",
    ]),
    `Wall untitled check: ${JSON.stringify(report.wall)}`, "",
    "Checks:", "", ...report.checks.map(c => `- ${c.pass ? "PASS" : "FAIL"} ${c.label}${c.detail === undefined ? "" : `: ${JSON.stringify(c.detail)}`}`),
    "", "Failures:", "", ...(report.failures.length ? report.failures.map(f => `- ${f}`) : ["None."]), "",
    "Pin-drop before/after stills are produced separately by scripts/e2e-pin-drop.mts.", "",
  ].join("\n");
  await writeFile(artifact("r8_roles.json"), JSON.stringify(roles, null, 2) + "\n");
  await writeFile(artifact("r8_roles.md"), rolesMarkdown);
  await writeFile(artifact("r8_qa.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(artifact("r8_qa.md"), markdown);
}
async function main(): Promise<void> {
  if (!BASE || !OUT) throw new Error("QA_BASE (immutable Preview URL) and OUT are required");
  const url = new URL(BASE);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("QA_BASE must be an HTTPS deployment origin without credentials, path, query, or fragment");
  }
  await mkdir(OUT, { recursive: true });
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    for (const vp of VIEWPORTS) {
      await flow(browser, vp, `login ${vp.name}`, false, async page => {
        await goto(page, "/login");
        await page.locator("#email").waitFor();
        await shot(page, `r8_login_${vp.name}.png`);
      });
      await flow(browser, vp, `capture empty ${vp.name}`, true, async page => {
        await goto(page, "/capture");
        await page.getByRole("button", { name: "Pick a photo" }).waitFor();
        await shot(page, `r8_capture-empty_${vp.name}.png`);
      });
      for (const photo of PHOTOS) {
        const item: Item = { photo, viewport: vp.name, mediaCodes: [] };
        report.items.push(item);
        console.log(`Capturing ${photo} ${vp.name}`);
        await flow(browser, vp, `${photo} ${vp.name}`, true, page => upload(page, photo, vp, item), item);
        await writeReports();
      }
      await flow(browser, vp, `wall ${vp.name}`, true, async page => {
        await goto(page, "/");
        await shot(page, `r8_wall_${vp.name}.png`);
        const texts = await page.locator(".inzpo-kit-card figcaption").allTextContents();
        const untitledCount = texts.filter(text => text.trim() === "Untitled kit").length;
        report.wall.push({ viewport: vp.name, untitledCount, texts });
        check(`wall ${vp.name} no Untitled kit cards`, untitledCount === 0, untitledCount);
      });
      await flow(browser, vp, `404 ${vp.name}`, false, async page => {
        await goto(page, "/does-not-exist-r8");
        check(`404 ${vp.name} status`, states.get(page)?.documentStatus === 404);
        await shot(page, `r8_404_${vp.name}.png`, false, [404]);
      });
    }
  } catch (error) { check("runner", false, errorText(error)); }
  finally {
    if (browser) await attempt("browser close", () => browser!.close());
    await writeReports();
  }
  console.log(`Guard ${report.guard.pass} passed/${report.guard.fail} failed; ${report.failures.length} failures. Reports: r8_qa.json, r8_qa.md, r8_roles.json, r8_roles.md`);
  if (report.failures.length) process.exitCode = 1;
}
if (process.argv.includes("--check")) {
  console.log("r8 capture script imports successfully; no browser, URL, or output used.");
} else {
  main().catch(error => { console.error(errorText(error)); process.exitCode = 1; });
}
