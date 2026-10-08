import { afterEach, describe, expect, it, vi } from "vitest";
import { createInzpoClient, InzpoApiError, pollBrief, type BriefJob } from "@inzpo/shared";

function job(status: BriefJob["status"]): BriefJob {
  return { status, text: null, namedHexes: [], namedColors: [], stub: false, updatedAt: 0 };
}

function setup(response: () => Response = () => Response.json({})) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response());
  const getToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("session-token");
  const client = createInzpoClient({ baseUrl: "https://inzpo.test///", getToken, fetch: fetcher });
  return { client, fetcher, getToken };
}

afterEach(() => { vi.useRealTimers(); });

describe("shared mobile client", () => {
  it("sends a Bearer header and the JSON request body", async () => {
    const signed = { url: "https://r2.test/upload", key: "tmp/uploads/user/one.jpg", contentType: "image/jpeg" };
    const { client, fetcher } = setup(() => Response.json(signed));
    const input = { contentType: "image/jpeg", bytes: 123 };
    expect(await client.presignUpload(input)).toEqual(signed);
    expect(fetcher).toHaveBeenCalledWith("https://inzpo.test/api/mobile/uploads/presign", {
      method: "POST", headers: { Authorization: "Bearer session-token", "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("routes every authenticated method and obtains a fresh token for each call", async () => {
    const { client, fetcher, getToken } = setup();
    await client.createKit({ uploadKey: "tmp/uploads/user/one.jpg", filename: "house.jpg" });
    await client.getKit("kit/id");
    await client.getBrief("kit/id");
    await client.runBrief("kit/id");
    await client.listCollections();
    await client.saveKit("kit/id", { newName: "Houses" });
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["https://inzpo.test/api/mobile/kits", "POST"],
      ["https://inzpo.test/api/mobile/kits/kit%2Fid", "GET"],
      ["https://inzpo.test/api/mobile/kits/kit%2Fid/brief", "GET"],
      ["https://inzpo.test/api/mobile/kits/kit%2Fid/brief", "POST"],
      ["https://inzpo.test/api/mobile/collections", "GET"],
      ["https://inzpo.test/api/mobile/kits/kit%2Fid/save", "POST"],
    ]);
    for (const [, init] of fetcher.mock.calls) expect(init?.headers).toHaveProperty("Authorization", "Bearer session-token");
    expect(fetcher.mock.calls[0]![1]?.body).toBe(JSON.stringify({ uploadKey: "tmp/uploads/user/one.jpg", filename: "house.jpg" }));
    expect(fetcher.mock.calls[5]![1]?.body).toBe(JSON.stringify({ newName: "Houses" }));
    expect(getToken).toHaveBeenCalledTimes(6);
  });

  it("throws the exported error with the server's 4xx message", async () => {
    const { client } = setup(() => Response.json({ error: "Invalid upload key" }, { status: 400 }));
    const error = await client.createKit({ uploadKey: "foreign" }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(InzpoApiError);
    expect(error).toMatchObject({ status: 400, message: "Invalid upload key" });
  });

  it("reports non-JSON errors and 5xx responses", async () => {
    const { client } = setup(() => new Response("upstream failure", { status: 503 }));
    await expect(client.listCollections()).rejects.toMatchObject({ status: 503, message: "Request failed (503)" });
  });

  it("rejects a missing token before sending an authenticated request", async () => {
    const { client, getToken, fetcher } = setup();
    getToken.mockResolvedValueOnce(null);
    await expect(client.listCollections()).rejects.toMatchObject({ status: 401, message: "unauthorized" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([new Blob(["photo"]), new Uint8Array([1, 2, 3]).buffer, new Uint8Array([1, 2, 3]).subarray(1)])(
    "uploads binary bodies with Content-Type and no authorization", async (body) => {
      const { client, fetcher, getToken } = setup(() => new Response(null, { status: 200 }));
      await client.uploadToPresignedUrl({ url: "https://r2.test/signed", key: "tmp/key", contentType: "image/png" }, body);
      const [url, init] = fetcher.mock.calls[0]!;
      expect(url).toBe("https://r2.test/signed");
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual({ "Content-Type": "image/png" });
      if (body instanceof Uint8Array) expect(new Uint8Array(init?.body as ArrayBuffer)).toEqual(body);
      else expect(init?.body).toBe(body);
      expect(getToken).not.toHaveBeenCalled();
    },
  );

  it("throws on failed presigned PUTs", async () => {
    const { client } = setup(() => new Response("forbidden", { status: 403 }));
    await expect(client.uploadToPresignedUrl({ url: "https://r2.test/signed", key: "tmp/key", contentType: "image/png" },
      new Uint8Array([1]))).rejects.toMatchObject({ status: 403 });
  });
});

describe("pollBrief", () => {
  it.each(["ready", "failed"] as const)("resolves after pending becomes %s", async (status) => {
    vi.useFakeTimers();
    const getBrief = vi.fn().mockResolvedValueOnce(job("pending")).mockResolvedValueOnce(job(status));
    const promise = pollBrief({ getBrief }, "kit", { intervalMs: 100, timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toEqual(job(status));
    expect(getBrief).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns immediately if the first result is terminal", async () => {
    const getBrief = vi.fn().mockResolvedValue(job("ready"));
    expect(await pollBrief({ getBrief }, "kit", { intervalMs: 100, timeoutMs: 1_000 })).toEqual(job("ready"));
    expect(getBrief).toHaveBeenCalledTimes(1);
  });

  it("times out while still pending and stops polling", async () => {
    vi.useFakeTimers();
    const getBrief = vi.fn().mockResolvedValue(job("pending"));
    const promise = pollBrief({ getBrief }, "kit", { intervalMs: 100, timeoutMs: 250 });
    const assertion = expect(promise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(250);
    await assertion;
    expect(getBrief).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getBrief).toHaveBeenCalledTimes(3);
  });

  it("enforces its deadline even when the HTTP request hangs", async () => {
    vi.useFakeTimers();
    const getBrief = vi.fn(() => new Promise<BriefJob>(() => {}));
    const promise = pollBrief({ getBrief }, "kit", { intervalMs: 100, timeoutMs: 250 });
    const assertion = expect(promise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(250);
    await assertion;
    expect(getBrief.mock.calls[0]).toBeDefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("supports cancellation and clears timers", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const getBrief = vi.fn().mockResolvedValue(job("pending"));
    const promise = pollBrief({ getBrief }, "kit", { intervalMs: 100, timeoutMs: 1_000, signal: controller.signal });
    const assertion = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a poll when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const getBrief = vi.fn();
    await expect(pollBrief({ getBrief }, "kit", { intervalMs: 100, timeoutMs: 1_000, signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(getBrief).not.toHaveBeenCalled();
  });
});
