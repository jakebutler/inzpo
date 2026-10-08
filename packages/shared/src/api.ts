import type {
  ApiError, BriefJob, CollectionSummary, CreateKitRequest, CreateKitResponse,
  MobileKit, PresignUploadRequest, PresignUploadResponse, SaveKitRequest, SaveKitResponse, UpdateKitColorsRequest,
} from "./types";

export class InzpoApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "InzpoApiError";
  }
}

export interface InzpoClientOptions {
  /** Server origin, e.g. https://inzpo.example.com (without /api/mobile). */
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

export function createInzpoClient(options: InzpoClientOptions) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  async function checkResponse(response: Response): Promise<void> {
    if (response.ok) return;
    const body = await response.json().catch(() => null) as ApiError | null;
    throw new InzpoApiError(
      response.status,
      typeof body?.error === "string" ? body.error : `Request failed (${response.status})`,
    );
  }

  async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
    const token = await options.getToken();
    if (signal?.aborted) throw abortError();
    if (!token) throw new InzpoApiError(401, "unauthorized");
    const response = await fetcher(`${baseUrl}/api/mobile${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
    await checkResponse(response);
    return await response.json() as T;
  }

  const kitPath = (id: string) => `/kits/${encodeURIComponent(id)}`;
  return {
    presignUpload: (input: PresignUploadRequest) => request<PresignUploadResponse>("/uploads/presign", "POST", input),
    async uploadToPresignedUrl(presign: PresignUploadResponse, body: Blob | ArrayBuffer | Uint8Array): Promise<void> {
      const response = await fetcher(presign.url, {
        method: "PUT",
        headers: { "Content-Type": presign.contentType },
        body: body instanceof Uint8Array ? body.slice().buffer : body,
      });
      await checkResponse(response);
    },
    createKit: (input: CreateKitRequest) => request<CreateKitResponse>("/kits", "POST", input),
    updateKitColors: (id: string, input: UpdateKitColorsRequest) => request<MobileKit>(`${kitPath(id)}/colors`, "PATCH", input),
    getKit: (id: string) => request<MobileKit>(kitPath(id)),
    getBrief: (id: string, options?: { signal?: AbortSignal }) =>
      request<BriefJob>(`${kitPath(id)}/brief`, "GET", undefined, options?.signal),
    runBrief: (id: string) => request<BriefJob>(`${kitPath(id)}/brief`, "POST"),
    listCollections: () => request<CollectionSummary[]>("/collections"),
    saveKit: (id: string, input: SaveKitRequest) => request<SaveKitResponse>(`${kitPath(id)}/save`, "POST", input),
  };
}

export type InzpoClient = ReturnType<typeof createInzpoClient>;

export interface PollBriefOptions {
  intervalMs: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

function abortError(): Error {
  const error = new Error("Brief polling aborted");
  error.name = "AbortError";
  return error;
}

/** Poll immediately, then at the requested interval, with an overall deadline. */
export async function pollBrief(
  client: Pick<InzpoClient, "getBrief">,
  id: string,
  { intervalMs, timeoutMs, signal }: PollBriefOptions,
): Promise<BriefJob> {
  if (!Number.isFinite(intervalMs) || intervalMs < 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Invalid brief polling interval or timeout");
  }
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let delay: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      controller.abort();
      reject(abortError());
    };
    signal?.addEventListener("abort", cancel, { once: true });
    deadline = setTimeout(() => {
      controller.abort();
      reject(new Error("Timed out waiting for brief"));
    }, timeoutMs);
  });
  const poll = async () => {
    while (!controller.signal.aborted) {
      const job = await client.getBrief(id, { signal: controller.signal });
      if (job.status !== "pending") return job;
      if (controller.signal.aborted) break;
      await new Promise<void>((resolve) => { delay = setTimeout(resolve, intervalMs); });
    }
    throw abortError();
  };
  try {
    return await Promise.race([poll(), interrupted]);
  } finally {
    clearTimeout(deadline);
    clearTimeout(delay);
    if (cancel) signal?.removeEventListener("abort", cancel);
    controller.abort();
  }
}
