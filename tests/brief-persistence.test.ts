import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  generate: vi.fn(),
  persistTitle: vi.fn(),
  revalidatePath: vi.fn(),
  extractPalette: vi.fn(),
  readImage: vi.fn(),
  signedUrl: vi.fn(),
}));

vi.mock("@/lib/r2", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/r2")>(),
  r2: () => ({ send: mocks.send }),
}));
vi.mock("@/lib/db", () => ({
  db: { select: mocks.select, update: mocks.update, delete: mocks.delete, insert: mocks.insert },
}));
vi.mock("@/lib/auth/owner", () => ({
  requireOwnerId: async () => "owner",
  assertItemOwned: async () => {},
}));
vi.mock("@/lib/kit-title", () => ({ persistKitTitleFromBrief: mocks.persistTitle }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/brief-request", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/brief-request")>(),
  requestBriefCompletionWithRetry: mocks.generate,
}));
vi.mock("@/lib/palette-extract", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/palette-extract")>(),
  extractPalette: mocks.extractPalette,
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.signedUrl }));

import { saveItemTokensAction } from "@/app/actions/tokens";
import { GET, POST } from "@/app/api/briefs/[id]/route";
import { readBriefJob, runBriefJob, startBriefJob, writeBriefJob, type BriefJob } from "@/lib/brief";
import { briefKey } from "@/lib/r2";
import { itemColors } from "@/lib/db/schema";
import { BriefTimeoutError } from "@/lib/brief-request";
import { hexToLab } from "@/lib/color-distance";

const ready: BriefJob = {
  status: "ready",
  text: "Warm brick in shade.",
  namedHexes: ["#c9341f"],
  namedColors: [{ hex: "#c9341f", label: "brick" }],
  stub: false,
  updatedAt: 123,
};
let stored: BriefJob | null;
let writes: number;
let image: Buffer;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("DO_INFERENCE_API_KEY", "test-key");
  vi.stubEnv("R2_BUCKET", "test-bucket");
  stored = structuredClone(ready);
  writes = 0;
  image = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#f3eee4" } })
    .jpeg().toBuffer();
  mocks.readImage.mockResolvedValue(image);
  mocks.extractPalette.mockResolvedValue({ regions: [] });
  mocks.signedUrl.mockResolvedValue("https://storage.test/kit/w640.webp");
  mocks.send.mockImplementation(async (command) => {
    if (command instanceof PutObjectCommand && command.input.Key === briefKey("kit")) {
      stored = JSON.parse(String(command.input.Body));
      writes++;
      return {};
    }
    if (command instanceof GetObjectCommand && command.input.Key === briefKey("kit")) {
      if (!stored) throw new Error("Not found");
      return { Body: { transformToString: async () => JSON.stringify(stored) } };
    }
    if (command instanceof GetObjectCommand && command.input.Key === "items/kit/w640.webp") {
      return { Body: { transformToByteArray: mocks.readImage } };
    }
    throw new Error("Unexpected storage access");
  });
  mocks.delete.mockReturnValue({ where: async () => {} });
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: async () => {} });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockResolvedValue(undefined);
  mocks.select.mockReturnValue({ from: () => ({ where: async () => [{ hex: "#112233" }] }) });
  mocks.generate.mockResolvedValue({ text: "Blue glass over shade.", namedColors: [], namedHexes: [] });
  mocks.persistTitle.mockResolvedValue("Warm Brick");
});

afterEach(() => vi.unstubAllEnvs());

function request(retry = false) {
  return new NextRequest(`http://localhost/api/briefs/kit${retry ? "?retry=1" : ""}`, { method: "POST" });
}

const params = () => ({ params: Promise.resolve({ id: "kit" }) });

describe("brief persistence", () => {
  it.each([false, true])("stores only snapped region hexes, including legacy model output (hex fallback: %s)", async (fallback) => {
    stored = null;
    const modelHex = "#e9e388";
    const region = { hex: "#c6c09a", lab: hexToLab("#c6c09a"), patch: 0.1, pinX: 0.2, pinY: 0.3 };
    mocks.extractPalette.mockResolvedValue({ swatches: [], regions: [region] });
    mocks.select.mockReturnValue({ from: () => ({ where: async () => [
      { hex: "#1c1b19", role: "text", origin: "region", pinX: 0.1, pinY: 0.1 },
    ] }) });
    mocks.generate.mockResolvedValue({ text: "Yellow siding over shade.", namedColors: fallback ? undefined : [{ hex: modelHex, label: "yellow siding" }], namedHexes: [modelHex] });

    const job = await runBriefJob("kit");
    expect(job.status).toBe("ready");
    expect(stored).toMatchObject({
      namedColors: [{ hex: region.hex, label: fallback ? null : "yellow siding", pinX: 0.2, pinY: 0.3 }],
      namedHexes: [region.hex],
    });
    expect(JSON.stringify(stored)).not.toContain(modelHex);
    expect(await readBriefJob("kit")).toEqual(job);
    expect(mocks.extractPalette).toHaveBeenCalledExactlyOnceWith(image);
    expect(mocks.readImage).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls.filter(([command]) => command instanceof GetObjectCommand && command.input.Key === "items/kit/w640.webp")).toHaveLength(1);
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: expect.stringMatching(/^data:image\/jpeg;base64,/), keptHexes: ["#1c1b19"] }));
    expect(mocks.signedUrl).not.toHaveBeenCalled();
  });

  it("hides snapped siding near any current filled role in the stored job", async () => {
    stored = null;
    mocks.select.mockReturnValue({ from: () => ({ where: async () => [
      { hex: "#1c1b19", role: "text", origin: "sampled" },
      { hex: "#d1cb9e", role: "primary", origin: "sampled" },
    ] }) });
    mocks.extractPalette.mockResolvedValue({ regions: [{ hex: "#c6c09a", lab: hexToLab("#c6c09a"), patch: 0.1, pinX: 0.2, pinY: 0.3 }] });
    mocks.generate.mockResolvedValue({ text: "Yellow siding over shade.", namedColors: [{ hex: "#e9e388", label: "yellow siding" }], namedHexes: [] });
    await runBriefJob("kit");
    expect(stored).toMatchObject({ status: "ready", namedColors: [], namedHexes: [] });
  });

  it.each(["empty", "extraction error", "missing image"])("drops model colours when sampling is unavailable (%s)", async (failure) => {
    stored = null;
    if (failure === "extraction error") mocks.extractPalette.mockRejectedValue(new Error("Cannot extract"));
    if (failure === "missing image") mocks.readImage.mockRejectedValue(new Error("Not found"));
    mocks.generate.mockResolvedValue({ text: "Yellow siding over shade.", namedColors: [{ hex: "#e9e388", label: "yellow siding" }], namedHexes: ["#e9e388"] });
    const job = await runBriefJob("kit");
    expect(job).toMatchObject({ status: "ready", namedColors: [], namedHexes: [] });
    expect(stored).toEqual(job);
    if (failure === "missing image") {
      expect(mocks.extractPalette).not.toHaveBeenCalled();
      expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: "https://storage.test/kit/w640.webp" }));
    }
  });

  it("stores contrast fix provenance and no fabricated text pin without changing the brief", async () => {
    const form = new FormData();
    form.set("itemId", "kit");
    form.set("roles", JSON.stringify({ background: "#79acd3", text: "#1c1b19" }));
    form.set("pins", JSON.stringify({ background: { pinX: 0.2, pinY: 0.3 } }));
    form.set("origins", JSON.stringify({ background: "region", text: "fix" }));
    await saveItemTokensAction(form);
    expect(mocks.values).toHaveBeenCalledWith([
      expect.objectContaining({ role: "background", origin: "region", pinX: 0.2, pinY: 0.3 }),
      expect.objectContaining({ role: "text", origin: "fix", hex: "#1c1b19", pinX: null, pinY: null }),
    ]);
    expect(await readBriefJob("kit")).toEqual(ready);
    expect(writes).toBe(0);
  });

  it("writes brief jobs only to R2 without any database access", async () => {
    await writeBriefJob("kit", ready);
    expect(await readBriefJob("kit")).toEqual(ready);
    expect(writes).toBe(1);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("reads old jobs without subject and sanitizes subjects on stored jobs", async () => {
    expect((await readBriefJob("kit"))?.subject).toBeUndefined();
    stored = { ...ready, subject: " Victorian   houses " };
    expect((await readBriefJob("kit"))?.subject).toBe("victorian house");
    stored.subject = "54 Main Street";
    expect((await readBriefJob("kit"))?.subject).toBeNull();
  });

  it("stores the model subject and passes it to title persistence", async () => {
    stored = null;
    mocks.generate.mockResolvedValue({ text: "Blue glass over shade.", subject: " Victorian   houses ", namedColors: [], namedHexes: [] });
    const job = await runBriefJob("kit");
    expect(job.status).toBe("ready");
    expect(job.subject).toBe("victorian house");
    expect(stored).toMatchObject({ subject: "victorian house" });
    expect((await readBriefJob("kit"))?.subject).toBe("victorian house");
    expect(mocks.persistTitle).toHaveBeenCalledWith("kit", expect.objectContaining({ subject: "victorian house" }));
  });

  it.each([{ primary: "#112233" }, {}])("keeps the generated brief through a tokens save and revisit (%j)", async (roles) => {
    const form = new FormData();
    form.set("itemId", "kit");
    form.set("roles", JSON.stringify(roles));
    await saveItemTokensAction(form);

    expect(mocks.delete).toHaveBeenCalledWith(itemColors);
    if (roles.primary) {
      expect(mocks.values).toHaveBeenCalledWith([expect.objectContaining({ hex: "#112233", itemId: "kit" })]);
    }
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/items/kit");
    expect(await readBriefJob("kit")).toEqual(ready);
    for (const handler of [GET, POST]) {
      expect(await (await handler(request(), params())).json()).toMatchObject(ready);
    }
    await startBriefJob("owner", "kit");
    expect(await runBriefJob("kit")).toEqual(ready);
    expect(writes).toBe(0);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each(["ready", "failed"] as const)("explicit retry generates and persists a new brief from %s", async (status) => {
    stored = { ...ready, status, text: status === "failed" ? null : ready.text };
    const response = await POST(request(true), params());
    expect(await response.json()).toMatchObject({ status: "ready", text: "Blue glass over shade." });
    expect((await readBriefJob("kit"))?.text).toBe("Blue glass over shade.");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(writes).toBe(2); // Explicit retry publishes its pending state before completion.
    await runBriefJob("kit");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("polling or an unmarked POST never starts a second job for a fresh pending brief", async () => {
    stored = { ...ready, status: "pending", text: null, updatedAt: Date.now() };
    await POST(request(), params());
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(writes).toBe(0);
    await runBriefJob("kit");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(stored?.status).toBe("ready");
  });

  it("an unmarked POST finishes a pending brief whose background run was lost", async () => {
    stored = { ...ready, status: "pending", text: null, updatedAt: Date.now() - 60_000 };
    await POST(request(), params());
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(stored?.status).toBe("ready");
  });

  it("a failed job waits for explicit retry", async () => {
    stored = { ...ready, status: "failed", text: null };
    expect((await runBriefJob("kit")).status).toBe("failed");
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(writes).toBe(0);
  });

  it("persists the fallback and keeps the stub job in R2 when inference is unavailable", async () => {
    stored = null;
    vi.stubEnv("DO_INFERENCE_API_KEY", "");
    const job = await runBriefJob("kit");
    expect(job).toMatchObject({ status: "ready", stub: true });
    expect(mocks.persistTitle).toHaveBeenCalledWith("kit", job);
    expect(await readBriefJob("kit")).toEqual(job);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("persists the fallback and failed status after the 24s timeout", async () => {
    stored = null;
    mocks.generate.mockRejectedValue(new BriefTimeoutError());
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const job = await runBriefJob("kit");
      expect(job.status).toBe("failed");
      expect(mocks.persistTitle).toHaveBeenCalledWith("kit", job);
      expect(await readBriefJob("kit")).toEqual(job);
      expect(mocks.update).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
