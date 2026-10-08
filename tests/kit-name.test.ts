import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generatedKitTitle, isCameraFilename, kitAltText, kitDisplayName, UNTITLED_KIT } from "@/lib/kit-name";

describe("generatedKitTitle", () => {
  it.each([
    ["Soft", "yellow", "#ffff00", "Soft Yellow"],
    ["Butter", "yellow", "#ffff00", "Butter Yellow"],
    ["Crimson", "red", "#ff0000", "Crimson"],
    ["Playful", "yellow", "#ffff00", "Playful Yellow"],
    ["Deep", "blue", "#0000ff", "Deep Blue"],
    ["Navy", "blue", "#0000ff", "Navy"],
    ["Sage", "green", "#00ff00", "Sage"],
    ["Lavender", "purple", "#800080", "Lavender"],
    ["Blush", "pink", "#ff80c0", "Blush"],
    ["Slate", "grey", "#808080", "Slate"],
    ["Ivory", "beige", "#e8dcc8", "Ivory"],
    ["Gold", "yellow", "#ffff00", "Gold"],
  ])("composes %s with %s", (modifier, color, hex, expected) => {
    for (const briefText of [`${modifier} ${color}.`, `${color} ${modifier}.`]) {
      expect(generatedKitTitle({
        briefText,
        namedColors: [{ hex, label: color }],
      })).toBe(expected);
    }
  });

  it.each([
    ["red", "#ff0000", ["crimson", "scarlet", "ruby"]],
    ["yellow", "#ffff00", ["mustard", "canary", "gold"]],
    ["blue", "#0000ff", ["navy", "cobalt", "azure", "indigo"]],
    ["green", "#00ff00", ["sage", "olive", "emerald"]],
  ])("collapses every specified %s shade", (family, hex, shades) => {
    for (const shade of shades) {
      expect(generatedKitTitle({
        briefText: `${shade} ${family}.`,
        namedColors: [{ hex, label: family }],
      })).toBe(shade[0].toUpperCase() + shade.slice(1));
    }
  });

  it("keeps the colour word after a descriptive (non-colour) modifier", () => {
    for (const [modifier, family, hex] of [["butter", "yellow", "#ffff00"], ["lemon", "yellow", "#ffff00"], ["sky", "blue", "#0000ff"], ["mint", "green", "#00ff00"], ["brick", "red", "#ff0000"]]) {
      const expected = `${modifier[0].toUpperCase()}${modifier.slice(1)} ${family[0].toUpperCase()}${family.slice(1)}`;
      expect(generatedKitTitle({ briefText: `${family} ${modifier}.`, namedColors: [{ hex, label: family }] })).toBe(expected);
    }
  });

  it("deduplicates chip colour words and repeated modifiers", () => {
    expect(generatedKitTitle({ namedColors: [{ hex: "#ff0000", label: "red red red" }] })).toBe("Red");
    expect(generatedKitTitle({ namedColors: [{ hex: "#ffff00", label: "soft soft yellow" }] })).toBe("Soft Yellow");
    expect(generatedKitTitle({ namedColors: [{ hex: "#ffff00", label: "butter yellow" }] })).toBe("Butter Yellow");
    expect(generatedKitTitle({ namedColors: [{ hex: "#0000ff", label: null }] })).toBe("Blue");
    expect(generatedKitTitle({})).toBeNull();
  });
});

describe("persisted kit names", () => {
  it("does not regenerate display names or alt text from a conflicting brief", () => {
    const input = {
      title: "Crimson",
      briefText: "Playful yellow.",
      namedColors: [{ hex: "#ffff00", label: "yellow" }],
    };
    expect(kitDisplayName(input)).toBe("Crimson");
    expect(kitAltText(input)).toBe("Crimson");
    expect(kitDisplayName({ ...input, pending: true })).toBe("Crimson");
    expect(kitAltText({ ...input, pending: true })).toBe("Crimson");
  });

  it.each(["Red Crimson", "Yellow Soft", "Yellow Butter", "Yellow Victorian", "Studio 54", "Main Street"])(
    "keeps the existing title %s unchanged", (title) => {
      const input = { title, briefText: "Playful yellow.", namedColors: [{ hex: "#ffff00", label: "yellow" }] };
      expect(kitDisplayName(input)).toBe(title);
      expect(kitAltText(input)).toBe(title);
      expect(generatedKitTitle(input)).toBe(title);
    },
  );

  it("hides camera filenames without inventing a display title", () => {
    expect(isCameraFilename("IMG_5859.jpg")).toBe(true);
    const input = { title: "IMG_6505", briefText: "Soft yellow.", namedColors: [{ hex: "#ffff00", label: "yellow" }] };
    expect(kitDisplayName(input)).toBe(UNTITLED_KIT);
    expect(kitAltText(input)).toBe(UNTITLED_KIT);
    expect(kitDisplayName({ ...input, pending: true })).toBe(UNTITLED_KIT);
    expect(generatedKitTitle(input)).toBe("Soft Yellow");
  });

  it("wires the saved header, Wall and collection cards, and photo to the persisted title", () => {
    const src = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
    expect(src("app/items/[id]/page.tsx")).toContain("<SavedKitHeader title={kitTitle}");
    expect(src("app/items/[id]/page.tsx")).toContain("kitDisplayName({ title: item.title");
    expect(src("app/components/WallGrid.tsx").match(/title=\{kitDisplayName\(\{ title: item.title/g)).toHaveLength(2);
    expect(src("app/components/KitCard.tsx")).toContain("alt={title}");
    const result = src("app/components/KitResult.tsx");
    expect(result).toContain("const displayTitle = kitDisplayName({ title });");
    expect(result).toContain("alt={displayTitle}");
    expect(result.match(/if \(job.title && job.title !== title\) router.refresh\(\);/g)).toHaveLength(2);
  });
});
