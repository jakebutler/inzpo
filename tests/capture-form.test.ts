import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildCaptureFormData } from "@/lib/capture-form-data";

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("capture submit after key", () => {
  it("puts the upload key on FormData immediately, without waiting for a hidden input", () => {
    const fd = buildCaptureFormData({ uploadKey: "tmp/uploads/user/abc.jpg", filename: "IMG_1.jpg" });
    expect(fd.get("uploadKey")).toBe("tmp/uploads/user/abc.jpg");
    expect(fd.get("filename")).toBe("IMG_1.jpg");
  });

  it("does not submit in a microtask before React commits the hidden field", () => {
    const form = src("app/capture/CaptureForm.tsx");
    expect(form).not.toContain("queueMicrotask");
    expect(form).not.toContain("requestSubmit");
    expect(form).toContain("buildCaptureFormData");
    expect(form).toContain("await capture(");
    expect(form).toContain('setUploading(true)');
    expect(form.indexOf("setUploading(true)")).toBeLessThan(form.indexOf("await prepareUploadFile"));
    expect(form).toContain("data-upload-wait");
    expect(form).toContain("disabled={uploading}");
  });
});
