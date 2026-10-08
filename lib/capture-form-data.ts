/**
 * Build the capture action payload from values we already have in memory.
 * Do not read a hidden input that React may not have committed yet.
 */
export function buildCaptureFormData(input: {
  uploadKey: string;
  filename?: string | null;
  shareToken?: string | null;
}): FormData {
  const uploadKey = typeof input.uploadKey === "string" ? input.uploadKey.trim() : "";
  if (!uploadKey) {
    throw new Error("uploadKey required");
  }
  const fd = new FormData();
  fd.set("uploadKey", uploadKey);
  const filename = input.filename?.trim();
  if (filename) fd.set("filename", filename);
  const shareToken = input.shareToken?.trim();
  if (shareToken) fd.set("shareToken", shareToken);
  return fd;
}
