import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  generate: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/r2", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/r2")>(),
  r2: () => ({ send: mocks.send }),
}));
vi.mock("@/lib/db", () => ({
  db: { select: mocks.select, delete: mocks.delete, insert: mocks.insert },
}));
vi.mock("@/lib/auth/owner", () => ({
  requireOwnerId: async () => "owner",
  assertItemOwned: async () => {},
}));
vi.mock("@/lib/kit-title", () => ({ persistKitTitleFromBrief: async () => "Warm Brick" }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/brief-request", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/brief-request")>(),
  requestBriefCompletionWithRetry: mocks.generate,
}));

import { saveItemTokensAction } from "@/app/actions/tokens";
import { GET, POST } from "@/app/api/briefs/[id]/route";
import { readBriefJob, runBriefJob, startBriefJob, type BriefJob } from "@/lib/brief";
import { briefKey } from "@/lib/r2";
import { itemColors } from "@/lib/db/schema";

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

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("DO_INFERENCE_API_KEY", "test-key");
  vi.stubEnv("R2_BUCKET", "test-bucket");
  stored = structuredClone(ready);
  writes = 0;
  const image = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#f3eee4" } })
    .jpeg().toBuffer();
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
      return { Body: { transformToByteArray: async () => image } };
    }
    throw new Error("Unexpected storage access");
  });
  mocks.delete.mockReturnValue({ where: async () => {} });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockResolvedValue(undefined);
  mocks.select.mockReturnValue({ from: () => ({ where: async () => [{ hex: "#112233" }] }) });
  mocks.generate.mockResolvedValue({ text: "Blue glass over shade.", namedColors: [], namedHexes: [] });
});

afterEach(() => vi.unstubAllEnvs());

function request(retry = false) {
  return new NextRequest(`http://localhost/api/briefs/kit${retry ? "?retry=1" : ""}`, { method: "POST" });
}

const params = () => ({ params: Promise.resolve({ id: "kit" }) });

describe("brief persistence", () => {
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
    expect(writes).toBe(1);
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
});
