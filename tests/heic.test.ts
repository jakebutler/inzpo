import { describe, expect, it } from "vitest";
import { decodeHeicToPng, isHeicBuffer } from "@/lib/heic";

function ftyp(brand: string): Buffer {
  const buf = Buffer.alloc(16, 0);
  buf.writeUInt32BE(16, 0);
  buf.write("ftyp", 4);
  buf.write(brand.slice(0, 4).padEnd(4, " "), 8);
  return buf;
}

describe("HEIC detection", () => {
  it("recognizes ISO-BMFF HEIC/HEIF brands", () => {
    expect(isHeicBuffer(ftyp("heic"))).toBe(true);
    expect(isHeicBuffer(ftyp("heix"))).toBe(true);
    expect(isHeicBuffer(ftyp("mif1"))).toBe(true);
    expect(isHeicBuffer(ftyp("msf1"))).toBe(true);
    expect(isHeicBuffer(ftyp("hevc"))).toBe(true);
    expect(isHeicBuffer(ftyp("jpeg"))).toBe(false);
    expect(isHeicBuffer(Buffer.from("not a picture"))).toBe(false);
    expect(isHeicBuffer(Buffer.alloc(8))).toBe(false);
  });

  it("rejects a truncated HEIC box instead of pretending sharp can decode HEVC", async () => {
    await expect(decodeHeicToPng(ftyp("heic"))).rejects.toThrow();
  });
});
