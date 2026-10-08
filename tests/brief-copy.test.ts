import { describe, expect, it } from "vitest";
import { chipCopy, chipNoun, EMPTY_ROLE_COPY, labelMatchesSample, parseNamedColors, sanitizeChipLabel } from "@/lib/brief-copy";
import { hexWithoutHash } from "@/lib/colors";

describe("chip labels", () => {
  it("names the detail, not the hex", () => {
    expect(chipCopy("yellow door")).toBe("Baku spotted a yellow door. Add it?");
    expect(chipNoun("yellow siding", "#e8c36a")).toBe("yellow siding");
    expect(labelMatchesSample("yellow door", "#0a0c0b")).toBe(false);
    expect(chipNoun("yellow door", "#0a0c0b")).toBe("black");
    expect(chipCopy("an old awning")).toBe("Baku spotted an old awning. Add it?");
    expect(chipCopy(null)).toBe("Baku spotted another color. Add it?");
  });

  it("drops addresses, street names, plates, and digits", () => {
    expect(sanitizeChipLabel("12 Oak Street")).toBeNull();
    expect(sanitizeChipLabel("license plate")).toBeNull();
    expect(sanitizeChipLabel("door 4")).toBeNull();
    expect(sanitizeChipLabel("yellow door and extra word")).toBeNull();
    expect(sanitizeChipLabel("neon sign")).toBe("neon sign");
  });

  it("parses namedColors with a hex-only fallback", () => {
    expect(parseNamedColors([{ hex: "#e8c36a", label: "yellow door" }])).toEqual([
      { hex: "#e8c36a", label: "yellow door" },
    ]);
    expect(parseNamedColors(undefined, ["#abc123"])).toEqual([{ hex: "#abc123", label: null }]);
  });
});

describe("empty role copy", () => {
  it("uses the add-a-color sentence", () => {
    expect(EMPTY_ROLE_COPY("text")).toBe("No text in this one. Add a color.");
  });
});

describe("hexWithoutHash", () => {
  it("strips the leading hash for compact swatches", () => {
    expect(hexWithoutHash("#6b6656")).toBe("6b6656");
    expect(hexWithoutHash("6b6656")).toBe("6b6656");
  });
});
