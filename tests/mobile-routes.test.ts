import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BriefJob } from "@inzpo/shared";
import type { ItemDetail } from "@/lib/items";

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(), devOwnerId: vi.fn(), isClerkConfigured: vi.fn(),
  send: vi.fn(), getSignedUrl: vi.fn(), presignUpload: vi.fn(), createImageItem: vi.fn(), getItemDetail: vi.fn(), getWallItems: vi.fn(),
  readBriefJob: vi.fn(), runBriefJob: vi.fn(), persistKitTitleFromBrief: vi.fn(), saveKitTitle: vi.fn(), getItemCollections: vi.fn(),
  assertItemOwned: vi.fn(), listCollections: vi.fn(), createCollection: vi.fn(), addToCollection: vi.fn(),
  revalidatePath: vi.fn(), after: vi.fn(), replaceItemTokens: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ verifyToken: mocks.verifyToken }));
vi.mock("@/lib/auth/dev-bypass", () => ({ devOwnerId: mocks.devOwnerId }));
vi.mock("@/lib/auth/clerk-configured", () => ({ isClerkConfigured: mocks.isClerkConfigured }));
vi.mock("@/lib/auth/owner", () => ({ assertItemOwned: mocks.assertItemOwned }));
vi.mock("@/lib/items", () => ({ createImageItem: mocks.createImageItem, getItemDetail: mocks.getItemDetail, getWallItems: mocks.getWallItems }));
vi.mock("@/lib/brief", () => ({ readBriefJob: mocks.readBriefJob, runBriefJob: mocks.runBriefJob }));
vi.mock("@/lib/kit-title", () => ({ persistKitTitleFromBrief: mocks.persistKitTitleFromBrief, saveKitTitle: mocks.saveKitTitle }));
vi.mock("@/lib/item-collections", () => ({ getItemCollections: mocks.getItemCollections }));
vi.mock("@/lib/collections", () => ({
  listCollections: mocks.listCollections, createCollection: mocks.createCollection, addToCollection: mocks.addToCollection,
}));
vi.mock("@/lib/r2", async () => {
  const { GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  return { r2: () => ({ send: mocks.send }), GetObjectCommand, DeleteObjectCommand };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.getSignedUrl }));
vi.mock("@/lib/uploads", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/uploads")>(), presignUpload: mocks.presignUpload,
}));
vi.mock("@/lib/item-tokens", () => ({ replaceItemTokens: mocks.replaceItemTokens }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(), after: mocks.after,
}));

import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { POST as presign } from "@/app/api/mobile/uploads/presign/route";
import { POST as createKit } from "@/app/api/mobile/kits/route";
import { GET as getKit } from "@/app/api/mobile/kits/[id]/route";
import { GET as getBrief, POST as runBrief } from "@/app/api/mobile/kits/[id]/brief/route";
import { GET as collections } from "@/app/api/mobile/collections/route";
import { GET as collectionDetail } from "@/app/api/mobile/collections/[id]/route";
import { POST as saveKit } from "@/app/api/mobile/kits/[id]/save/route";

import { PATCH as updateColors } from "@/app/api/mobile/kits/[id]/colors/route";

const context = () => ({ params: Promise.resolve({ id: "kit_1" }) });
const pending: BriefJob = { status: "pending", text: null, namedHexes: [], namedColors: [], stub: false, updatedAt: 0 };
const ready: BriefJob = { ...pending, status: "ready", text: "A house with warm walls." };
const item: ItemDetail = {
  id: "kit_1", kind: "photo", title: "Warm House", note: null, createdAt: new Date(0),
  source: null, oembedHtml: null, hasArticle: false, origin: null,
  media: { originalKey: "items/kit_1/original.jpg", displayKey: "items/kit_1/w1600.webp", placeholder: null,
    mime: "image/jpeg", width: 1000, height: 800, tileKey: null },
  colors: [{ hex: "#ABCDEF", role: "primary", name: "Wall", origin: "extracted", family: "blue",
    position: 0, pinX: null, pinY: null }],
};

function request(method = "GET", body?: unknown, token: string | null = "valid-token"): Request {
  return new Request("https://inzpo.test/api/mobile/test", {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("R2_BUCKET", "test-bucket");
  vi.stubEnv("CLERK_SECRET_KEY", "test-secret");
  mocks.devOwnerId.mockReturnValue(null);
  mocks.isClerkConfigured.mockReturnValue(true);
  mocks.verifyToken.mockImplementation(async (token: string) => {
    if (token !== "valid-token") throw new Error("Invalid token");
    return { sub: "user_1" };
  });
  mocks.send.mockImplementation(async (command: unknown) => command instanceof GetObjectCommand
    ? { ContentLength: 3, Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }
    : {});
  mocks.getSignedUrl.mockResolvedValue("https://r2.test/photo?signed=1");
  mocks.presignUpload.mockResolvedValue({ url: "https://r2.test/upload", key: "tmp/uploads/user_1/one.jpg", contentType: "image/jpeg" });
  mocks.createImageItem.mockResolvedValue("kit_1");
  mocks.getItemDetail.mockResolvedValue(item);
  mocks.getWallItems.mockResolvedValue([{ id: item.id }]);
  mocks.readBriefJob.mockResolvedValue(null);
  mocks.runBriefJob.mockResolvedValue(ready);
  mocks.persistKitTitleFromBrief.mockResolvedValue("Warm House");
  mocks.getItemCollections.mockResolvedValue([{ id: "collection_1", name: "Houses" }]);
  mocks.assertItemOwned.mockResolvedValue(undefined);
  mocks.listCollections.mockResolvedValue([{ id: "collection_1", name: "Houses", count: 2, description: "Private description" }]);
  mocks.createCollection.mockResolvedValue("collection_new");
  mocks.addToCollection.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("mobile route authentication", () => {
  const routes = [
    { name: "uploads POST", call: (req: Request) => presign(req) },
    { name: "kits POST", call: (req: Request) => createKit(req) },
    { name: "colors PATCH", call: (req: Request) => updateColors(req, context()) },
    { name: "kit GET", call: (req: Request) => getKit(req, context()) },
    { name: "brief GET", call: (req: Request) => getBrief(req, context()) },
    { name: "brief POST", call: (req: Request) => runBrief(req, context()) },
    { name: "collections GET", call: (req: Request) => collections(req) },
    { name: "collection GET", call: (req: Request) => collectionDetail(req, context()) },
    { name: "save POST", call: (req: Request) => saveKit(req, context()) },
  ];
  it.each(routes)("$name returns JSON 401 without a token", async ({ call }) => {
    const response = await call(request("POST", {}, null));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.assertItemOwned).not.toHaveBeenCalled();
    expect(mocks.getItemDetail).not.toHaveBeenCalled();
    expect(mocks.getWallItems).not.toHaveBeenCalled();
    expect(mocks.listCollections).not.toHaveBeenCalled();
    expect(mocks.createCollection).not.toHaveBeenCalled();
    expect(mocks.presignUpload).not.toHaveBeenCalled();
  });

  it("returns JSON 401 for an invalid token", async () => {
    const response = await collections(request("GET", undefined, "garbage"));
    expect(response.status).toBe(401);
    expect(mocks.listCollections).not.toHaveBeenCalled();
  });
});

describe("mobile presign", () => {
  it("uses the bearer owner and returns the shared DTO", async () => {
    const response = await presign(request("POST", { contentType: "image/jpeg", bytes: 3 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://r2.test/upload", key: "tmp/uploads/user_1/one.jpg", contentType: "image/jpeg" });
    expect(mocks.presignUpload).toHaveBeenCalledWith({ ownerId: "user_1", contentType: "image/jpeg", bytes: 3 });
  });

  it.each([null, [], {}, { contentType: 1, bytes: 3 }, { contentType: "application/pdf", bytes: 3 },
    { contentType: "image/jpeg", bytes: MAX_UPLOAD_BYTES + 1 }])("validates the request before presigning", async (body) => {
    const response = await presign(request("POST", body));
    expect(response.status).toBe(400);
    expect(mocks.presignUpload).not.toHaveBeenCalled();
  });
});

describe("mobile kit creation", () => {
  it.each(["tmp/uploads/user_2/one.jpg", "items/kit_1/original.jpg", "tmp/share-sheet.jpg", "tmp/uploads/user_1/../one.jpg"])(
    "rejects a foreign, share-sheet, or invalid key (%s)", async (uploadKey) => {
      const response = await createKit(request("POST", { uploadKey }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid upload key" });
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.createImageItem).not.toHaveBeenCalled();
    },
  );

  it("creates the kit, removes the temp object, and schedules the brief after the response", async () => {
    const response = await createKit(request("POST", { uploadKey: "tmp/uploads/user_1/one.jpg", filename: " house.jpg " }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ itemId: "kit_1" });
    expect(mocks.createImageItem).toHaveBeenCalledWith({ ownerId: "user_1", buffer: Buffer.from([1, 2, 3]), filename: "house.jpg" });
    expect(mocks.send.mock.calls[0]![0]).toBeInstanceOf(GetObjectCommand);
    expect(mocks.send.mock.calls[1]![0]).toBeInstanceOf(DeleteObjectCommand);
    expect(mocks.send.mock.calls[1]![0].input).toMatchObject({ Key: "tmp/uploads/user_1/one.jpg" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.runBriefJob).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0]![0]();
    expect(mocks.runBriefJob).toHaveBeenCalledWith("kit_1");
  });

  it("rejects oversized upload metadata before consuming the body", async () => {
    const read = vi.fn();
    mocks.send.mockResolvedValueOnce({ ContentLength: MAX_UPLOAD_BYTES + 1, Body: { transformToByteArray: read } });
    expect((await createKit(request("POST", { uploadKey: "tmp/uploads/user_1/one.jpg" }))).status).toBe(400);
    expect(read).not.toHaveBeenCalled();
    expect(mocks.createImageItem).not.toHaveBeenCalled();
  });

  it("also enforces the byte limit when metadata is absent", async () => {
    mocks.send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array(MAX_UPLOAD_BYTES + 1) } });
    expect((await createKit(request("POST", { uploadKey: "tmp/uploads/user_1/one.jpg" }))).status).toBe(400);
    expect(mocks.createImageItem).not.toHaveBeenCalled();
  });

  it("returns 400 for unreadable uploads", async () => {
    mocks.send.mockRejectedValueOnce(new Error("Missing object"));
    expect((await createKit(request("POST", { uploadKey: "tmp/uploads/user_1/one.jpg" }))).status).toBe(400);
  });

  it("returns JSON 400 for malformed JSON", async () => {
    const req = new Request("https://inzpo.test/api/mobile/kits", { method: "POST", headers: { Authorization: "Bearer valid-token" }, body: "{" });
    const response = await createKit(req);
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
  });
});

describe("mobile kit detail", () => {
  it("returns signed photos, role gaps, brief state, and owner-scoped memberships", async () => {
    const response = await getKit(request(), context());
    expect(response.status).toBe(200);
    const dto = await response.json();
    expect(dto).toEqual({
      id: "kit_1", title: "Warm House",
      photo: { url: "https://r2.test/photo?signed=1", width: 1000, height: 800, placeholder: null },
      roles: { primary: "#abcdef", secondary: null, accent: null, background: null, surface: null, text: null },
      colors: [{ hex: "#ABCDEF", role: "primary", name: "Wall", origin: "extracted", pinX: null, pinY: null }],
      brief: pending, collectionIds: ["collection_1"],
    });
    expect(mocks.getItemDetail).toHaveBeenCalledWith("user_1", "kit_1");
    expect(mocks.getItemCollections).toHaveBeenCalledWith("user_1", "kit_1");
    expect(mocks.getSignedUrl.mock.calls[0]![1].input).toMatchObject({ Key: "items/kit_1/w1600.webp" });
    expect(mocks.getSignedUrl.mock.calls[0]![2]).toEqual({ expiresIn: 900 });
  });

  it("keeps the Primary name once the brief is ready and falls back to the original photo", async () => {
    mocks.readBriefJob.mockResolvedValue(ready);
    mocks.getItemDetail.mockResolvedValue({ ...item, media: { ...item.media!, displayKey: null } });
    const response = await getKit(request(), context());
    expect((await response.json()).title).toBe("Warm House");
    expect(mocks.getSignedUrl.mock.calls[0]![1].input).toMatchObject({ Key: "items/kit_1/original.jpg" });
  });

  it('reads the persisted name before and after saving, despite palette and brief changes', async () => {
    mocks.getItemCollections.mockResolvedValue([]);
    const titles = [];
    for (const brief of [pending, ready, { ...ready, text: 'A blue house.', namedColors: [{ hex: '#ffffff', label: 'white windows' }] }]) {
      const primary = { ...item.colors[0]!, hex: '#426092', name: 'blue' };
      const secondary = { ...primary, role: 'secondary' as const, hex: '#426092', name: 'window' };
      for (const colors of [[primary, secondary], [secondary, primary]]) {
        mocks.getItemDetail.mockResolvedValue({ ...item, title: 'Yellow Victorian', colors });
        mocks.readBriefJob.mockResolvedValue(brief);
        titles.push((await (await getKit(request(), context())).json()).title);
      }
    }
    expect(titles).toEqual(Array(6).fill('Yellow Victorian'));
    mocks.getItemCollections.mockResolvedValue([{ id: 'collection_1', name: 'Houses' }]);
    expect((await (await getKit(request(), context())).json()).title).toBe('Yellow Victorian');
    const collection = await (await collectionDetail(request(), { params: Promise.resolve({ id: 'collection_1' }) })).json();
    expect(collection.kits[0].title).toBe('Yellow Victorian');
    expect(mocks.persistKitTitleFromBrief).not.toHaveBeenCalled();
  });

  it('preserves an explicit saved name when the brief changes', async () => {
    mocks.getItemDetail.mockResolvedValue({ ...item, title: 'Sunday walks' });
    for (const brief of [pending, ready]) {
      mocks.readBriefJob.mockResolvedValue(brief);
      expect((await (await getKit(request(), context())).json()).title).toBe('Sunday walks');
    }
  });

  it("supports a kit without media", async () => {
    mocks.getItemDetail.mockResolvedValue({ ...item, media: null });
    expect((await (await getKit(request(), context())).json()).photo).toBeNull();
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it.each([[0.2, 0.4], [0, 1]])("returns source sample coordinates, including boundary values (%s, %s)", async (pinX, pinY) => {
    mocks.getItemDetail.mockResolvedValue({ ...item, colors: [{ ...item.colors[0]!, pinX, pinY }] });
    const dto = await (await getKit(request(), context())).json();
    expect(dto.colors[0]).toMatchObject({ pinX, pinY });
  });

  it.each([null, { ...item, kind: "url" }])("returns JSON 404 for foreign, missing, or non-kit items", async (detail) => {
    mocks.getItemDetail.mockResolvedValue(detail);
    const response = await getKit(request(), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(mocks.readBriefJob).not.toHaveBeenCalled();
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });
});

describe("mobile briefs", () => {
  it("returns the same pending default as the web route", async () => {
    const response = await getBrief(request(), context());
    expect(await response.json()).toEqual(pending);
    expect(mocks.assertItemOwned).toHaveBeenCalledWith("user_1", "kit_1");
  });

  it("persists a ready title and revalidates the web paths", async () => {
    mocks.readBriefJob.mockResolvedValue(ready);
    const response = await getBrief(request(), context());
    expect(await response.json()).toEqual(ready);
    expect(mocks.persistKitTitleFromBrief).toHaveBeenCalledWith("kit_1", ready);
    expect(mocks.revalidatePath.mock.calls).toEqual([["/items/kit_1"], ["/"]]);
  });

  it("runs a brief after checking ownership", async () => {
    const response = await runBrief(request("POST"), context());
    expect(await response.json()).toEqual(ready);
    expect(mocks.runBriefJob).toHaveBeenCalledWith("kit_1");
    expect(mocks.revalidatePath.mock.calls).toEqual([["/items/kit_1"], ["/"]]);
  });

  it.each([getBrief, runBrief])("maps ownership errors to JSON 404 without reading or running a job", async (handler) => {
    mocks.assertItemOwned.mockRejectedValueOnce(new Error("Not found"));
    const response = await handler(request(), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(mocks.readBriefJob).not.toHaveBeenCalled();
    expect(mocks.runBriefJob).not.toHaveBeenCalled();
  });
});

describe("mobile collections and saves", () => {
  it("returns only collection summary fields for the bearer owner", async () => {
    const response = await collections(request());
    expect(await response.json()).toEqual([{ id: "collection_1", name: "Houses", count: 2 }]);
    expect(mocks.listCollections).toHaveBeenCalledWith("user_1");
  });

  it.each([{}, { newName: "  " }, { collectionId: "" }, { newName: 5 }, null, []])(
    "returns 400 without a usable collectionId or newName", async (body) => {
      const response = await saveKit(request("POST", body), context());
      expect(response.status).toBe(400);
      expect(mocks.createCollection).not.toHaveBeenCalled();
      expect(mocks.addToCollection).not.toHaveBeenCalled();
    },
  );

  it("saves to an existing collection and preserves precedence over newName", async () => {
    const response = await saveKit(request("POST", { collectionId: "collection_1", newName: "Ignored" }), context());
    expect(await response.json()).toEqual({ collectionId: "collection_1" });
    expect(mocks.createCollection).not.toHaveBeenCalled();
    expect(mocks.addToCollection).toHaveBeenCalledWith("user_1", "collection_1", "kit_1");
    expect(mocks.revalidatePath.mock.calls).toEqual([["/items/kit_1"], ["/"]]);
  });

  it("creates a named collection then adds the kit", async () => {
    const response = await saveKit(request("POST", { newName: " New Houses " }), context());
    expect(await response.json()).toEqual({ collectionId: "collection_new" });
    expect(mocks.createCollection).toHaveBeenCalledWith("user_1", "New Houses");
    expect(mocks.addToCollection).toHaveBeenCalledWith("user_1", "collection_new", "kit_1");
  });

  it("does not create a collection for an item belonging to another owner", async () => {
    mocks.assertItemOwned.mockRejectedValueOnce(new Error("Not found"));
    const response = await saveKit(request("POST", { newName: "Houses" }), context());
    expect(response.status).toBe(404);
    expect(mocks.createCollection).not.toHaveBeenCalled();
    expect(mocks.addToCollection).not.toHaveBeenCalled();
  });

  it("returns 404 for a collection belonging to another owner", async () => {
    mocks.addToCollection.mockRejectedValueOnce(new Error("Not found"));
    const response = await saveKit(request("POST", { collectionId: "foreign" }), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});


describe("mobile color editing", () => {
  it.each<unknown>([null, [], {}, { roles: [] }, { roles: { other: "#123456" } },
    { roles: { accent: "#abc" } }, { roles: { accent: "123456" } },
    { roles: { accent: "#gggggg" } }, { roles: { accent: 123 } }, { roles: null },
    { roles: {}, extra: true }, { roles: { constructor: "#123456" } }])("rejects invalid roles (%j)", async (body) => {
    expect((await updateColors(request("PATCH", body), context())).status).toBe(400);
    expect(mocks.replaceItemTokens).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const req = new Request("https://inzpo.test", { method: "PATCH", headers: { Authorization: "Bearer valid-token" }, body: "{" });
    expect((await updateColors(req, context())).status).toBe(400);
  });

  it.each([null, { ...item, kind: "url" }])("returns 404 for missing or non-kit items", async (detail) => {
    mocks.getItemDetail.mockResolvedValue(detail);
    expect((await updateColors(request("PATCH", { roles: {} }), context())).status).toBe(404);
    expect(mocks.replaceItemTokens).not.toHaveBeenCalled();
  });

  it("preserves unchanged sampled pins and omitted roles, returns the fresh GET shape, and revalidates", async () => {
    const original = { ...item, colors: [{ ...item.colors[0]!, pinX: 0.2, pinY: 0.4, origin: "sampled" }] };
    const fresh = { ...original, colors: [...original.colors, { ...item.colors[0]!, role: "accent" as const, hex: "#123456", pinX: null, pinY: null }] };
    mocks.getItemDetail.mockResolvedValueOnce(original).mockResolvedValue(fresh);
    const response = await updateColors(request("PATCH", { roles: { primary: "#abcdef", accent: "#123456" } }), context());
    expect(response.status).toBe(200);
    expect(mocks.replaceItemTokens).toHaveBeenCalledWith("user_1", "kit_1",
      { primary: "#abcdef", secondary: null, accent: "#123456", background: null, surface: null, text: null },
      { primary: { pinX: 0.2, pinY: 0.4 } }, { primary: "sampled", accent: "sampled" });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/items/kit_1"], ["/"]]);
    const dto = await response.json();
    expect(dto).toEqual(await (await getKit(request(), context())).json());
    expect(dto.roles.accent).toBe("#123456");
    expect(dto.colors).toHaveLength(2);
  });

  it("drops changed pins, marks user colors sampled, clears a role, and preserves an omitted role", async () => {
    mocks.getItemDetail.mockResolvedValue({ ...item, colors: [
      { ...item.colors[0]!, pinX: 0.3, pinY: 0.4, origin: "sampled" },
      { ...item.colors[0]!, role: "secondary", hex: "#111111", pinX: 0.5, pinY: 0.6, origin: "sampled" },
      { ...item.colors[0]!, role: "accent", hex: "#222222" },
    ] });
    expect((await updateColors(request("PATCH", { roles: { primary: "#654321", accent: null } }), context())).status).toBe(200);
    expect(mocks.replaceItemTokens).toHaveBeenCalledWith("user_1", "kit_1",
      { primary: "#654321", secondary: "#111111", accent: null, background: null, surface: null, text: null },
      { secondary: { pinX: 0.5, pinY: 0.6 } }, { secondary: "sampled", primary: "sampled" });
  });

  it.each(["#ABC", " ABC ", "#AABBCC", " AABBCC "])("preserves sampled pins for normalized omitted and unchanged roles (%s)", async (hex) => {
    mocks.getItemDetail.mockResolvedValue({ ...item, colors: [
      { ...item.colors[0]!, hex, pinX: 0, pinY: 1, origin: "sampled" },
      { ...item.colors[0]!, role: "secondary", hex, pinX: 0.2, pinY: 0.4, origin: "sampled" },
    ] });
    expect((await updateColors(request("PATCH", { roles: { primary: "#AABBCC" } }), context())).status).toBe(200);
    expect(mocks.replaceItemTokens).toHaveBeenCalledWith("user_1", "kit_1",
      { primary: "#aabbcc", secondary: "#aabbcc", accent: null, background: null, surface: null, text: null },
      { primary: { pinX: 0, pinY: 1 }, secondary: { pinX: 0.2, pinY: 0.4 } },
      { primary: "sampled", secondary: "sampled" });
  });
});

describe("mobile collection detail", () => {
  const collectionContext = () => ({ params: Promise.resolve({ id: "collection_1" }) });
  it("returns only collection kits, display names, roles and signed photo URLs for the bearer owner", async () => {
    const response = await collectionDetail(request(), collectionContext());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "collection_1", name: "Houses", kits: [{
      id: "kit_1", title: "Warm House",
      roles: { primary: "#abcdef", secondary: null, accent: null, background: null, surface: null, text: null },
      photo: { url: "https://r2.test/photo?signed=1" },
    }] });
    expect(mocks.listCollections).toHaveBeenCalledWith("user_1");
    expect(mocks.getWallItems).toHaveBeenCalledWith("user_1", expect.objectContaining({
      kinds: { photo: "include", screenshot: "include" },
    }), "collection_1");
    expect(mocks.getItemDetail).toHaveBeenCalledWith("user_1", "kit_1");
    expect(mocks.getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      input: { Bucket: "test-bucket", Key: "items/kit_1/w1600.webp" },
    }), { expiresIn: 900 });
  });
  it("returns 404 for missing or foreign collections before reading kits", async () => {
    mocks.listCollections.mockResolvedValue([]);
    const response = await collectionDetail(request(), collectionContext());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(mocks.getWallItems).not.toHaveBeenCalled();
    expect(mocks.getItemDetail).not.toHaveBeenCalled();
  });
  it("returns an empty list for an empty collection", async () => {
    mocks.getWallItems.mockResolvedValue([]);
    expect(await (await collectionDetail(request(), collectionContext())).json())
      .toEqual({ id: "collection_1", name: "Houses", kits: [] });
  });
  it("bounds detail query concurrency for large collections without dropping kits", async () => {
    mocks.getWallItems.mockResolvedValue(Array.from({ length: 24 }, (_, index) => ({ id: `kit_${index}` })));
    let inFlight = 0;
    let peak = 0;
    mocks.getItemDetail.mockImplementation(async (_owner: string, id: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return { ...item, id };
    });
    const response = await collectionDetail(request(), collectionContext());
    expect(response.status).toBe(200);
    const dto = await response.json();
    expect(dto.kits.map((kit: { id: string }) => kit.id)).toEqual(
      Array.from({ length: 24 }, (_, index) => `kit_${index}`));
    expect(peak).toBe(8);
  });
  it("omits deleted, foreign and non-kit items and supports missing photos", async () => {
    mocks.getWallItems.mockResolvedValue([{ id: "gone" }, { id: "url" }, { id: "kit_1" }]);
    mocks.getItemDetail.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...item, kind: "url" })
      .mockResolvedValueOnce({ ...item, media: null });
    const dto = await (await collectionDetail(request(), collectionContext())).json();
    expect(dto.kits).toHaveLength(1);
    expect(dto.kits[0].photo).toBeNull();
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });
  it("returns JSON 500 for query failures", async () => {
    mocks.getWallItems.mockRejectedValue(new Error("offline"));
    const response = await collectionDetail(request(), collectionContext());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not complete request" });
  });
});


it('saves the kit title separately from an existing collection', async () => {
  const response = await saveKit(request('POST', { collectionId: 'collection_1', title: ' Yellow Victorian ' }), context());
  expect(response.status).toBe(200);
  expect(mocks.saveKitTitle).toHaveBeenCalledWith('user_1', 'kit_1', 'Yellow Victorian');
  expect(mocks.addToCollection).toHaveBeenCalledWith('user_1', 'collection_1', 'kit_1');
  expect(mocks.createCollection).not.toHaveBeenCalled();
});
it.each([123, '', ' '.repeat(3), 'a'.repeat(101)])('rejects an invalid kit title: %s', async (title) => {
  expect((await saveKit(request('POST', { newName: 'Walks', title }), context())).status).toBe(400);
  expect(mocks.createCollection).not.toHaveBeenCalled();
  expect(mocks.saveKitTitle).not.toHaveBeenCalled();
});
