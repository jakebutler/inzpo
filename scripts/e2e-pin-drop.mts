/**
 * Real Chromium regression: cold Clerk login, real capture uploads, mouse and CDP
 * touch drags, exact canvas pixels, server-action completion, then persisted DOM.
 *
 * QA_BASE=<preview> OUT=<dir> npx tsx scripts/e2e-pin-drop.mts
 * ITEM_URLS optionally supplies three comma-separated URLs (6505,6208,5859), or
 * a JSON object keyed by IMG_6505 / IMG_6208 / IMG_5859. No stored auth is reused.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type CDPSession, type Page, type Request } from "playwright";

const BASE = (process.env.QA_BASE ?? "").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT ?? "/tmp/inzpo-r8-pin-drop");
const PHOTOS = ["IMG_6505", "IMG_6208", "IMG_5859"] as const;
type Input = "mouse" | "touch";
type Point = { x: number; y: number };
type Saved = { hex: string; pinX: number | null; pinY: number | null; origin: string | null; screen: Point };
type Frame = {
  rect: { x: number; y: number; width: number; height: number };
  naturalWidth: number; naturalHeight: number;
  crop: { vx: number; vy: number; vw: number; vh: number };
  sourcePxPerCssPx: Point;
};
type PinEvent = { type: string; x: number; y: number; pointerType: string };
type Row = {
  photo: string; input: Input; role: string; drop: number; kind: "same-spot" | "move";
  releaseCss: Point | null; releaseSource: Point | null; savedSource: Point | null;
  savedHex: string | null; sourcePixelHex: string | null; pass: boolean; failures: string[];
  before?: Saved; saved?: Saved; frame?: Frame; drawnAfterDrop?: Point;
  events?: PinEvent[]; actionStatuses?: number[];
};
const rows: Row[] = [];
const itemUrls: Partial<Record<Input, Record<string, string>>> = {};
const setupFailures: string[] = [];

function reuseUrls(): Record<string, string> {
  const raw = process.env.ITEM_URLS?.trim();
  if (!raw) return {};
  const values: Record<string, string> = raw.startsWith("{") ? JSON.parse(raw) :
    Object.fromEntries(PHOTOS.map((photo, i) => [photo, raw.split(",")[i]?.trim()]));
  for (const photo of PHOTOS) {
    if (!values[photo]) throw new Error(`ITEM_URLS must contain all three photos; missing ${photo}`);
    values[photo] = new URL(values[photo], `${BASE}/`).href;
    if (new URL(values[photo]).origin !== new URL(BASE).origin) throw new Error("ITEM_URLS must use QA_BASE's origin");
  }
  return values;
}

function pair(point: Point | null) {
  return point ? `${point.x.toFixed(2)}, ${point.y.toFixed(2)}` : "unavailable";
}
function table() {
  return [
    "| Photo | Input | Role / drop | Release CSS px | Release source px | Saved source px | Saved hex | Source pixel hex | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(r => `| ${r.photo} | ${r.input} | ${r.role} / ${r.drop} ${r.kind} | ${pair(r.releaseCss)} | ${pair(r.releaseSource)} | ${pair(r.savedSource)} | ${r.savedHex ?? "unavailable"} | ${r.sourcePixelHex ?? "unavailable"} | ${r.pass ? "PASS" : "FAIL"} |`),
  ].join("\n");
}
async function writeResults() {
  await writeFile(path.join(OUT, "r8_pin-drop.json"), JSON.stringify({ base: BASE, itemUrls, rows, setupFailures }, null, 2) + "\n");
  await writeFile(path.join(OUT, "r8_pin-drop.md"), table() + "\n\n" +
    "Source positions are checked using the crop visible BEFORE the drop. The pin disc is also checked before closing the editor. Closing can pan the crop; reload must preserve the sampled source pixel. Same-spot drops preserve the previous values and send no save action.\n\n" +
    [...setupFailures, ...rows.flatMap(r => r.failures.map(f => `${r.photo} ${r.input} drop ${r.drop}: ${f}`))].map(f => `- ${f}`).join("\n") + "\n");
}

async function signIn(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.locator("#email").waitFor();
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { loaded?: boolean } }).Clerk?.loaded),
    undefined, { timeout: 30_000 });
  await page.fill("#email", "inzpo+clerk_test@example.com");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.locator("#code").waitFor({ timeout: 30_000 });
  await page.fill("#code", "424242");
  await page.locator("#code").press("Enter");
  await page.waitForURL(/\/capture(?:\?|$)/, { timeout: 30_000 });
}

async function ready(page: Page) {
  await page.locator('[data-photo-fold] img:not([data-photo-lqip])').waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('[data-photo-fold] img:not([data-photo-lqip])');
    const band = document.querySelector<HTMLElement>('[data-role]');
    return image?.complete && image.naturalWidth > 0 && band && getComputedStyle(band).opacity === "1";
  });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

async function readSaved(page: Page, role: string): Promise<Saved> {
  return page.evaluate((role) => {
    const pin = document.querySelector<HTMLElement>(`[data-pin="${role}"]`);
    const band = document.querySelector<HTMLElement>(`[data-role="${role}"]`);
    if (!pin || !band) throw new Error("Role or pin missing from DOM");
    const rect = pin.getBoundingClientRect();
    return {
      // The text fallback permits exercising the old Preview, but missing saved
      // coordinates/origin still fail the persistence checks below.
      hex: (band.dataset.hex ?? band.querySelector('[data-swatch-hex]')?.textContent ?? "").trim().toLowerCase(),
      pinX: pin.dataset.pinX !== undefined && pin.dataset.pinX !== "" && Number.isFinite(Number(pin.dataset.pinX)) ? Number(pin.dataset.pinX) : null,
      pinY: pin.dataset.pinY !== undefined && pin.dataset.pinY !== "" && Number.isFinite(Number(pin.dataset.pinY)) ? Number(pin.dataset.pinY) : null,
      origin: pin.dataset.origin ?? null,
      screen: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    };
  }, role);
}

async function readFrame(page: Page): Promise<Frame> {
  return page.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>('[data-photo-fold] img:not([data-photo-lqip])')!;
    const rect = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    if (style.objectFit !== "cover") throw new Error("Expected object-fit:cover");
    const position = style.objectPosition.split(/\s+/);
    if (position.length !== 2 || !position.every(p => p.endsWith("%"))) throw new Error("Expected percentage object-position");
    const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const vw = rect.width / (image.naturalWidth * scale);
    const vh = rect.height / (image.naturalHeight * scale);
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      crop: { vx: (1 - vw) * parseFloat(position[0]!) / 100, vy: (1 - vh) * parseFloat(position[1]!) / 100, vw, vh },
      sourcePxPerCssPx: { x: 1 / scale, y: 1 / scale },
    };
  });
}

async function expectedPixel(page: Page, frame: Frame, point: Point) {
  // Independently derive the pixel from CSS object-fit/object-position, rather
  // than importing the production mapper and repeating its possible mistakes.
  return page.evaluate(({ frame, point }) => {
    const image = document.querySelector<HTMLImageElement>('[data-photo-fold] img:not([data-photo-lqip])')!;
    const { crop, rect, naturalWidth: w, naturalHeight: h } = frame;
    const x = Math.max(0, Math.min(w - 1, Math.round((crop.vx + (point.x - rect.x) / rect.width * crop.vw) * w)));
    const y = Math.max(0, Math.min(h - 1, Math.round((crop.vy + (point.y - rect.y) / rect.height * crop.vh) * h)));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    const rgb = ctx.getImageData(x, y, 1, 1).data;
    const hex = "#" + Array.from(rgb.slice(0, 3), v => v.toString(16).padStart(2, "0")).join("");
    return { source: { x, y }, hex };
  }, { frame, point });
}

async function watchEvents(page: Page) {
  await page.evaluate(() => {
    const win = window as unknown as { pinDropEvents: PinEvent[] };
    win.pinDropEvents = [];
    const image = document.querySelector<HTMLImageElement>('[data-photo-fold] img:not([data-photo-lqip])')!;
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture", "dragstart"]) {
      image.addEventListener(type, (event) => {
        const e = event as PointerEvent;
        win.pinDropEvents.push({ type, x: e.clientX, y: e.clientY, pointerType: e.pointerType ?? "" });
      });
    }
  });
}

async function drag(page: Page, cdp: CDPSession | null, start: Point, release: Point, sameSpot: boolean, frame: Frame) {
  const send = async (type: "touchStart" | "touchMove" | "touchEnd", point: Point) => {
    await cdp!.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] :
      [{ x: point.x, y: point.y, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
  };
  if (cdp) await send("touchStart", start);
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  const target = sameSpot ? { x: start.x + (start.x + 60 < frame.rect.x + frame.rect.width - 20 ? 60 : -60), y: start.y } : release;
  const move = async (a: Point, b: Point) => {
    for (let step = 1; step <= 8; step++) {
      const point = { x: a.x + (b.x - a.x) * step / 8, y: a.y + (b.y - a.y) * step / 8 };
      if (cdp) await send("touchMove", point);
      else await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(16);
    }
  };
  await move(start, target);
  if (sameSpot) await move(target, start);
  if (cdp) await send("touchEnd", release);
  else await page.mouse.up();
}

async function runDrop(page: Page, cdp: CDPSession | null, photo: string, input: Input, role: string, n: number) {
  const row: Row = { photo, input, role, drop: n, kind: n === 1 ? "same-spot" : "move", releaseCss: null,
    releaseSource: null, savedSource: null, savedHex: null, sourcePixelHex: null, pass: false, failures: [] };
  rows.push(row);
  const expect = (ok: boolean, message: string) => { if (!ok) row.failures.push(message); };
  const actions: Promise<number>[] = [];
  const onRequest = (request: Request) => {
    if (request.headers()["next-action"]) actions.push(request.response().then(response => response?.status() ?? 0));
  };
  try {
    await page.locator(`[data-role="${role}"]`).click();
    await page.locator("#token-hex").waitFor();
    await page.waitForTimeout(300);
    const before = await readSaved(page, role);
    const frame = await readFrame(page);
    row.before = before; row.frame = frame;
    if (before.pinX === null || before.pinY === null) throw new Error("Missing source pin for drag start");
    // Start the same-spot regression at the actual source point in this crop,
    // independently of any offset hit area (or a regressed clamped disc).
    const start = {
      x: frame.rect.x + (before.pinX - frame.crop.vx) / frame.crop.vw * frame.rect.width,
      y: frame.rect.y + (before.pinY - frame.crop.vy) / frame.crop.vh * frame.rect.height,
    };
    const positions = [{ x: 0.28, y: 0.32 }, { x: 0.70, y: 0.50 }, { x: 0.42, y: 0.70 }];
    const destination = positions[n - 2];
    const release = destination ? { x: Math.round(frame.rect.x + frame.rect.width * destination.x),
      y: Math.round(frame.rect.y + frame.rect.height * destination.y) } : start;
    row.releaseCss = release;
    const pixel = await expectedPixel(page, frame, release);
    row.releaseSource = pixel.source; row.sourcePixelHex = pixel.hex;
    const prefix = `r8_${photo}_pin-${input}-${n}`;
    await page.screenshot({ path: path.join(OUT, `${prefix}-before.png`) });
    await watchEvents(page);
    page.on("request", onRequest);
    await drag(page, cdp, start, release, n === 1, frame);
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !document.querySelector("[data-token-saving]"), undefined, { timeout: 30_000 });
    await Promise.all(actions);
    row.events = await page.evaluate(() => (window as unknown as { pinDropEvents: PinEvent[] }).pinDropEvents);
    const moves = row.events.filter(e => e.type === "pointermove" && e.pointerType === input);
    const up = row.events.find(e => e.type === "pointerup" && e.pointerType === input);
    expect(moves.length >= (n === 1 ? 16 : 8), `Expected a real ${input} drag; got ${moves.length} moves`);
    expect(Boolean(up && Math.abs(up.x - release.x) <= 0.5 && Math.abs(up.y - release.y) <= 0.5), "Missing pointerup at the release point");
    expect(!row.events.some(e => e.type === "pointercancel" || e.type === "dragstart"), "Pointer stream cancelled or native image drag started");
    const immediate = await readSaved(page, role);
    row.drawnAfterDrop = immediate.screen;
    const afterFrame = await readFrame(page);
    expect(Math.abs(afterFrame.crop.vx - frame.crop.vx) < 1e-6 && Math.abs(afterFrame.crop.vy - frame.crop.vy) < 1e-6,
      "Cover crop re-panned while editing");
    expect(Math.abs(afterFrame.rect.x - frame.rect.x) < 0.5 && Math.abs(afterFrame.rect.y - frame.rect.y) < 0.5,
      "Photo moved during drag");
    if (n !== 1) expect(Math.abs(immediate.screen.x - release.x) <= 2 && Math.abs(immediate.screen.y - release.y) <= 2,
      `Drawn pin ${pair(immediate.screen)} misses release ${pair(release)}`);
    else expect(await page.locator("#token-hex").inputValue() === before.hex, "No-op changed the dialog hex");
    await page.screenshot({ path: path.join(OUT, `${prefix}-after.png`) });
    await page.locator('[role="dialog"] [data-slot="sheet-close"]').click();
    await page.locator("#token-hex").waitFor({ state: "hidden" });
    await page.waitForTimeout(100);
    row.actionStatuses = await Promise.all(actions);
    expect(row.actionStatuses.every(status => status === 200), "Save action did not return HTTP 200");
    expect(n === 1 ? actions.length === 0 : actions.length === 1,
      `Expected ${n === 1 ? "no" : "one"} save action, got ${actions.length}`);
    await page.reload({ waitUntil: "load" });
    await ready(page);
    const saved = await readSaved(page, role);
    row.saved = saved; row.savedHex = saved.hex;
    expect(saved.pinX !== null && saved.pinY !== null && saved.origin !== null, "Saved pin coordinates/origin missing from DOM");
    if (saved.pinX !== null && saved.pinY !== null) {
      row.savedSource = { x: saved.pinX * frame.naturalWidth, y: saved.pinY * frame.naturalHeight };
    }
    if (n === 1) {
      expect(saved.hex === before.hex && saved.pinX === before.pinX && saved.pinY === before.pinY && saved.origin === before.origin,
        "Same-spot drop changed persisted hex, pin coordinates or origin");
    } else {
      expect(Boolean(row.savedSource && Math.abs(row.savedSource.x - pixel.source.x) <= 2 * frame.sourcePxPerCssPx.x &&
        Math.abs(row.savedSource.y - pixel.source.y) <= 2 * frame.sourcePxPerCssPx.y), "Persisted source position misses release by more than 2 CSS px");
      expect(saved.hex === pixel.hex, `Saved hex ${saved.hex} differs from exact source pixel ${pixel.hex}`);
      expect(saved.origin === "sampled", "Real move did not save sampled origin");
    }
  } catch (error) {
    row.failures.push(error instanceof Error ? error.message.split("\n")[0]! : String(error));
    await page.screenshot({ path: path.join(OUT, `r8_${photo}_pin-${input}-${n}-after.png`) }).catch(() => undefined);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.reload({ waitUntil: "load" }).catch(() => undefined);
  } finally {
    page.off("request", onRequest);
    row.pass = row.failures.length === 0;
    console.log(table().split("\n").at(-1));
    await writeResults();
  }
}

async function main() {
  if (!BASE) throw new Error("QA_BASE is required");
  await mkdir(OUT, { recursive: true });
  const reuse = reuseUrls();
  const browser = await chromium.launch({ headless: true });
  console.log(table());
  try {
    for (const input of ["mouse", "touch"] as const) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
        isMobile: input === "touch", hasTouch: input === "touch" });
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      page.setDefaultNavigationTimeout(60_000);
      const cdp = input === "touch" ? await context.newCDPSession(page) : null;
      itemUrls[input] = {};
      try {
        await signIn(page);
        for (const photo of PHOTOS) {
          try {
            if (reuse[photo]) await page.goto(reuse[photo]!, { waitUntil: "load" });
            else {
              await page.goto(`${BASE}/capture`, { waitUntil: "load" });
              await page.getByRole("button", { name: "Pick a photo" }).waitFor();
              await page.locator('input[type="file"][accept*="heic"]').first()
                .setInputFiles(path.join(process.cwd(), `public/sample/${photo}.jpg`));
              await page.waitForURL(/\/items\//, { timeout: 90_000 });
            }
            itemUrls[input]![photo] = page.url();
            await ready(page);
            const role = await page.locator("[data-pin]").first().getAttribute("data-pin");
            if (!role) throw new Error("Photo has no role with a pin");
            for (let n = 1; n <= 4; n++) await runDrop(page, cdp, photo, input, role, n);
          } catch (error) {
            setupFailures.push(`${photo} ${input}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
          }
        }
      } catch (error) {
        setupFailures.push(`${input} setup: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      } finally {
        await context.close();
        await writeResults();
      }
    }
  } finally {
    await browser.close();
  }
  const failed = rows.filter(r => !r.pass).length;
  console.log(`${rows.length - failed}/${rows.length} drops passed; ${setupFailures.length} setup failures. Reports: ${OUT}/r8_pin-drop.{json,md}`);
  if (failed || setupFailures.length || rows.length !== 24) process.exitCode = 1;
}

main().catch(async error => {
  console.error(error instanceof Error ? error.message.split("\n")[0] : String(error));
  process.exitCode = 1;
});
