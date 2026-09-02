if (!process.env.DATABASE_URL) {
  const fs = await import("node:fs");
  for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { createEmptyPalette, updatePaletteColors } = await import("../lib/palettes");
const { getItemDetail, deleteItem } = await import("../lib/items");

const id = await createEmptyPalette("e2e editable");
await updatePaletteColors(id, [{ hex: "#ff0000" }, { hex: "#00ff00" }, { hex: "#0000ff" }]);
const d = await getItemDetail(id);
const fams = d!.colors.map((c) => `${c.hex}:${c.family}`).join(" ");
console.log("palette colors:", fams);
if (d!.colors.length !== 3) throw new Error("update count wrong");
if (!fams.includes("red") || !fams.includes("green") || !fams.includes("blue")) throw new Error("family re-derivation wrong");
try {
  await updatePaletteColors(id, []);
  throw new Error("should have rejected empty palette");
} catch (e) {
  console.log("empty palette rejected ✓");
}
await deleteItem(id);
console.log("palette edit e2e passes");
