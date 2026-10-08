import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fallbackKitName, generatedKitTitle, isCameraFilename, kitAltText, kitDisplayName, UNTITLED_KIT } from "@/lib/kit-name";
import { briefSubjectWord, sanitizeBriefSubject } from "@/lib/brief-subject";
import { LIVE_KIT_NAMES } from "./fixtures/kit-names";

describe("generatedKitTitle", () => {
  it.each(LIVE_KIT_NAMES)("names $id from its dominant noun and saved primary", (fixture) => {
    expect(generatedKitTitle(fixture)).toBe(fixture.expected);
    expect(generatedKitTitle(fixture)!.split(/\s+/)).toHaveLength(2);
  });

  it.each([
    ["victorian house", "Victorian"],
    ["storefront mural", "Storefront"],
    ["ceramic tiles", "Ceramic"],
    ["clapboard facade", "Clapboard"],
    ["houses", "House"],
  ])("reduces %s to the distinctive subject word %s", (subject, expected) => {
    expect(briefSubjectWord(subject)).toBe(expected.toLowerCase());
    expect(generatedKitTitle({ subject, primaryHex: "#d2d0a8" })).toBe(`Cream ${expected}`);
  });

  it("preserves the full sanitized subject in the brief", () => {
    expect(sanitizeBriefSubject(" Victorian   houses ")).toBe("victorian house");
  });

  it.each(["mural", "graffiti", "zigzag"])("uses the saved red primary with %s", (subject) => {
    expect(generatedKitTitle({ ...LIVE_KIT_NAMES[0], subject })).toBe(`Red ${subject[0].toUpperCase()}${subject.slice(1)}`);
  });

  it("uses the sanitized model subject ahead of the brief noun", () => {
    expect(generatedKitTitle({
      ...LIVE_KIT_NAMES[0], subject: " Victorian   houses ",
    })).toBe("Red Victorian");
    expect(generatedKitTitle({
      ...LIVE_KIT_NAMES[0], subject: "storefront",
    })).toBe("Red Storefront");
  });

  it.each([
    "pale", "painted", "dropped", "soft", "playful", "nostalgic", "red", "navy",
    "red mural", "quiet mural", "dropped mural", "running mural", "mural 54",
    "Main Street", "street sign", "license plate", "mural!", "large urban mural",
  ])("rejects invalid model subject %s", (subject) => {
    expect(generatedKitTitle({ ...LIVE_KIT_NAMES[0], subject })).toBe("Red Zigzag");
  });

  it.each([
    ["Doors with white trim", "Door"],
    ["Windows in a wall", "Wall"],
    ["Stairs and railings", "Stair"],
    ["Panes across the storefront", "Storefront"],
    ["Green spray tags", "Graffiti"],
    ["Concrete beside green spray tags", "Graffiti"],
    ["Soft painted concrete", "Concrete"],
  ])("singularizes nouns and prefers whole objects in %s", (briefText, subject) => {
    expect(generatedKitTitle({ briefText, primaryHex: "#ff0000" })).toBe("Red " + subject);
  });

  it.each([
    ["butter", "yellow", "#ffff00"],
    ["lemon", "yellow", "#ffff00"],
    ["sky", "blue", "#0000ff"],
    ["mint", "green", "#00ff00"],
    ["brick", "red", "#ff0000"],
    ["slate", "gray", "#808080"],
  ])("keeps a matching %s %s colour pair", (modifier, family, primaryHex) => {
    const expected = modifier[0].toUpperCase() + modifier.slice(1) + " " + family[0].toUpperCase() + family.slice(1);
    expect(generatedKitTitle({ briefText: "A " + modifier + "-" + family + " detail.", primaryHex })).toBe(expected);
    expect(generatedKitTitle({ namedColors: [{ hex: primaryHex, label: modifier + " " + family }], primaryHex })).toBe(expected);
  });

  it("keeps Butter Yellow alone and uses only the family alongside a subject", () => {
    const namedColors = [{ hex: "#ffff00", label: "butter yellow" }];
    expect(generatedKitTitle({ namedColors, primaryHex: "#ffff00" })).toBe("Butter Yellow");
    expect(generatedKitTitle({ briefText: "Pale butter-yellow facade.", namedColors, primaryHex: "#ffff00" })).toBe("Yellow Facade");
    expect(generatedKitTitle({ subject: "house", namedColors, primaryHex: "#0000ff" })).toBe("Blue House");
    expect(generatedKitTitle({ briefText: "A sky navy detail.", primaryHex: "#0000ff" })).toBe("Sky Blue");
    expect(generatedKitTitle({ briefText: "A brick crimson detail.", primaryHex: "#ff0000" })).toBe("Brick Red");
  });

  it.each([
    ["#ff0000", "Red"], ["#ff4500", "Orange"], ["#ffff00", "Yellow"],
    ["#ffd700", "Yellow"], ["#00ff00", "Green"], ["#008080", "Teal"],
    ["#0000ff", "Blue"], ["#800080", "Purple"], ["#ffc0cb", "Pink"],
    ["#5c4033", "Brown"], ["#e8dcc8", "Cream"], ["#808080", "Gray"],
    ["#000000", "Black"], ["#ffffff", "White"],
    ["#a0adbb", "Gray"], ["#3f5e92", "Blue"],
    ["#90a0ae", "Gray"], ["#90a0af", "Blue"],
  ])("maps primary %s to %s", (primaryHex, color) => {
    expect(generatedKitTitle({
      primaryHex, namedColors: [{ hex: "#00ff00", label: "green spray tag" }],
    })).toBe(color);
    expect(fallbackKitName(primaryHex)).toBe(color);
  });

  it("caps new names at two words even with a compound subject and colour", () => {
    for (const subject of [undefined, "victorian house", "storefront mural", "ceramic tile", "house"]) {
      const input = { subject, primaryHex: "#ffff00", namedColors: [{ hex: "#ffff00", label: "butter yellow" }] };
      expect(generatedKitTitle(input)!.split(/\s+/).length).toBeLessThanOrEqual(2);
      expect(fallbackKitName(input.primaryHex).split(/\s+/).length).toBeLessThanOrEqual(2);
    }
    expect(fallbackKitName(null)).toBe("Gray");
    expect(fallbackKitName("invalid")).toBe("Gray");
    expect(generatedKitTitle({ subject: "victorian house" })).toBeNull();
  });

  it("never uses a chip as the primary or a mood/verb as a subject", () => {
    expect(generatedKitTitle({ briefText: "Dropped playful soft pale painted.", primaryHex: "#ff0000" })).toBe("Red");
    expect(generatedKitTitle({ briefText: "Playful yellow.", primaryHex: "#ffff00" })).toBe("Yellow");
    expect(generatedKitTitle({ namedColors: [{ hex: "#ff0000", label: "red mural" }] })).toBeNull();
    expect(generatedKitTitle({ primaryHex: "invalid", namedColors: [{ hex: "#ff0000", label: "red" }] })).toBeNull();
    expect(generatedKitTitle({})).toBeNull();
    expect(generatedKitTitle({ title: UNTITLED_KIT })).toBeNull();
  });

  it("never mixes colour families or copies addresses into generated names", () => {
    const families = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown", "cream", "gray", "black", "white"];
    for (const fixture of LIVE_KIT_NAMES) {
      const name = generatedKitTitle(fixture)!;
      expect(families.filter((family) => name.toLowerCase().split(" ").includes(family))).toHaveLength(1);
      expect(name).not.toMatch(/\d|\bstreet\b|\bavenue\b|\broad\b|untitled/i);
    }
    expect(generatedKitTitle({
      primaryHex: "#ffff00", subject: "54 Main Street",
      briefText: "Painted mural at 54 Main Street, soft blue-yellow.",
      namedColors: [{ hex: "#ffff00", label: "navy yellow" }],
    })).toBe("Yellow Mural");
    expect(generatedKitTitle({ primaryHex: "#0000ff", briefText: "A slate blue mural." })).toBe("Blue Mural");
    expect(generatedKitTitle({ primaryHex: "#ff0000", briefText: "A brick red-orange mural." })).toBe("Red Mural");
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

  it.each(["Red Crimson", "Yellow Soft", "Yellow Butter", "Yellow Victorian", "Studio 54", "Main Street", "Victorian House Cream", "Mural Red", "My favourite blue house palette"])(
    "keeps the existing title %s unchanged", (title) => {
      const input = { title, briefText: "Playful yellow.", namedColors: [{ hex: "#ffff00", label: "yellow" }] };
      expect(kitDisplayName(input)).toBe(title);
      expect(kitAltText(input)).toBe(title);
      expect(generatedKitTitle(input)).toBe(title);
    },
  );

  it("generates a display name while the persisted title is missing or a camera filename", () => {
    expect(isCameraFilename("IMG_5859.jpg")).toBe(true);
    const input = { title: "IMG_6505", primaryHex: "#ffff00", briefText: "Soft yellow.", namedColors: [{ hex: "#ffff00", label: "yellow" }] };
    expect(kitDisplayName(input)).toBe("Soft Yellow");
    expect(kitAltText(input)).toBe("Soft Yellow");
    expect(kitDisplayName({ ...input, pending: true })).toBe("Soft Yellow");
    expect(generatedKitTitle(input)).toBe("Soft Yellow");
    expect(kitDisplayName({ ...input, title: null })).toBe("Soft Yellow");
    expect(kitDisplayName({ ...input, title: UNTITLED_KIT })).toBe("Soft Yellow");
    expect(kitDisplayName({})).toBe("Gray");
  });

  it("wires the saved header, Wall and collection cards, and photo to the persisted title", () => {
    const src = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
    expect(src("app/items/[id]/page.tsx")).toContain("initialBrief={await readBriefJob(item.id)}");
    expect(src("app/components/WallGrid.tsx").match(/title=\{item.title\}/g)).toHaveLength(2);
    expect(src("app/components/WallGrid.tsx").match(/createdAt=\{item.createdAt\}/g)).toHaveLength(2);
    expect(src("app/components/KitCard.tsx")).toContain("alt={title}");
    const result = src("app/components/KitResult.tsx");
    expect(result).toContain("const displayTitle = useKitDisplayName({ title: brief.title ?? title, primaryHex, brief });");
    expect(result).toContain("<SavedKitHeader title={brief.title ?? title}");
    expect(result).toContain("alt={displayTitle}");
    expect(result.match(/if \(job.title && job.title !== title\) router.refresh\(\);/g)).toHaveLength(2);
  });
});

describe("subject names use only the primary colour family", () => {
  it("never adds a colour modifier when there is a subject", () => {
    expect(generatedKitTitle({ briefText: "The pale yellow facade with dark green shutters.", primaryHex: "#e8d14a" })).toBe("Yellow Facade");
    expect(generatedKitTitle({ briefText: "Soft pale yellow tones.", primaryHex: "#e8d14a" })).toBe("Pale Yellow");
  });
});
