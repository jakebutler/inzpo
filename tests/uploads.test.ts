import { describe, expect, it } from "vitest";
import {
  isOwnedUploadKey,
  isReadableUploadKey,
  MAX_UPLOAD_BYTES,
  uploadExtForType,
  validateUpload,
} from "@/lib/uploads";

describe("presign upload validation", () => {
  it("allows jpeg, png, webp, heic, and heif under the size cap", () => {
    expect(() => validateUpload({ contentType: "image/jpeg", bytes: 12 })).not.toThrow();
    expect(() => validateUpload({ contentType: "image/png", bytes: 12 })).not.toThrow();
    expect(() => validateUpload({ contentType: "image/webp", bytes: 12 })).not.toThrow();
    expect(() => validateUpload({ contentType: "image/heic", bytes: 12 })).not.toThrow();
    expect(() => validateUpload({ contentType: "image/heif", bytes: 12 })).not.toThrow();
  });

  it("rejects other types and oversized bodies", () => {
    expect(() => validateUpload({ contentType: "application/pdf", bytes: 12 })).toThrow(/unsupported/i);
    expect(() => validateUpload({ contentType: "image/jpeg", bytes: 0 })).toThrow(/too large/i);
    expect(() => validateUpload({ contentType: "image/jpeg", bytes: MAX_UPLOAD_BYTES + 1 })).toThrow(/too large/i);
  });

  it("maps types to extensions", () => {
    expect(uploadExtForType("image/heic")).toBe("heic");
    expect(uploadExtForType("image/heif")).toBe("heic");
    expect(uploadExtForType("image/png")).toBe("png");
    expect(uploadExtForType("image/webp")).toBe("webp");
    expect(uploadExtForType("image/jpeg")).toBe("jpg");
  });
});

describe("upload keys", () => {
  it("scopes presigned keys to the owner", () => {
    expect(isOwnedUploadKey("user_1", "tmp/uploads/user_1/abc.jpg")).toBe(true);
    expect(isOwnedUploadKey("user_1", "tmp/uploads/user_2/abc.jpg")).toBe(false);
    expect(isOwnedUploadKey("user_1", "tmp/uploads/user_1/../x.jpg")).toBe(false);
    expect(isOwnedUploadKey("user_1", "items/x/original.jpg")).toBe(false);
  });

  it("allows share-sheet stash keys and owner uploads", () => {
    expect(isReadableUploadKey("user_1", "tmp/01HABC.jpg")).toBe(true);
    expect(isReadableUploadKey("user_1", "tmp/uploads/user_1/abc.heic")).toBe(true);
    expect(isReadableUploadKey("user_1", "tmp/uploads/user_2/abc.heic")).toBe(false);
  });
});
