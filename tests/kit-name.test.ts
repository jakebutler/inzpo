import { describe, expect, it } from "vitest";
import { isCameraFilename, kitDisplayName, UNTITLED_KIT } from "@/lib/kit-name";

describe("kitDisplayName", () => {
  it("never uses camera filenames and stays Untitled while pending", () => {
    expect(isCameraFilename("IMG_5859.jpg")).toBe(true);
    expect(kitDisplayName({ title: "IMG_5859", pending: true })).toBe(UNTITLED_KIT);
    expect(kitDisplayName({ title: "IMG_5859" })).toBe(UNTITLED_KIT);
    expect(
      kitDisplayName({
        title: "IMG_6505",
        briefText: "A yellow Victorian with a black door.",
        namedColors: [{ hex: "#e8c36a", label: "yellow siding" }],
      }),
    ).toBe("Yellow Victorian");
    expect(kitDisplayName({ title: "Yellow Victorian", briefText: "Warm stone against shade." })).toBe(
      "Yellow Victorian",
    );
  });
});
