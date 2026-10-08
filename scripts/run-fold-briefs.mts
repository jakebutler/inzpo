/**
 * Run glm-5.3-flash against the fold sample photos and write lib/fold-briefs.ts.
 * Uses DO_INFERENCE_API_KEY; does not touch production DB/R2.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { requestBriefCompletion, bytesToDataUrl, DEFAULT_BRIEF_MODEL, briefModelId } from "../lib/brief-request.ts";
import { parseNamedColors } from "../lib/brief-copy.ts";
import { HANDOFF_KITS } from "../lib/mascot.ts";

const PHOTOS = ["IMG_6505", "IMG_6208"] as const;

function keptFor(photo: (typeof PHOTOS)[number]): string[] {
  const kit = HANDOFF_KITS[photo];
  return Object.values(kit).filter((hex): hex is string => typeof hex === "string");
}

async function w640DataUrl(file: string): Promise<string> {
  const input = await readFile(file);
  const out = await sharp(input).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  return bytesToDataUrl(new Uint8Array(out), "image/webp");
}

function lit(value: unknown): string {
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  const key = process.env.DO_INFERENCE_API_KEY ?? "";
  if (!key) {
    console.error("DO_INFERENCE_API_KEY is missing; cannot capture real briefs.");
    process.exit(2);
  }
  const model = briefModelId();
  const rows: Record<string, { text: string; namedColors: unknown; latencyMs: number | null; model: string }> = {
    IMG_5859: { text: "", namedColors: [], latencyMs: null, model },
  };
  for (const photo of PHOTOS) {
    const file = path.join(process.cwd(), "public/sample", `${photo}.jpg`);
    const imageUrl = await w640DataUrl(file);
    const started = Date.now();
    const result = await requestBriefCompletion({
      imageUrl,
      keptHexes: keptFor(photo),
      apiKey: key,
      model,
    });
    const namedColors = parseNamedColors(result.namedColors, result.namedHexes);
    rows[photo] = {
      text: result.text ?? "",
      namedColors,
      latencyMs: result.latencyMs || Date.now() - started,
      model,
    };
    console.log(`${photo} ${rows[photo]!.latencyMs}ms ${rows[photo]!.text.slice(0, 80)}`);
  }
  const src = `import type { NamedColor } from "@/lib/brief-copy";
import { DEFAULT_BRIEF_MODEL } from "@/lib/brief-request";

export type FoldPhotoId = "IMG_6505" | "IMG_6208" | "IMG_5859";

export type FoldBriefCapture = {
  text: string;
  namedColors: NamedColor[];
  latencyMs: number | null;
  model: string;
};

/** Captured from ${DEFAULT_BRIEF_MODEL} against the sample photos. */
export const FOLD_BRIEFS: Record<FoldPhotoId, FoldBriefCapture> = {
  IMG_6505: {
    text: ${lit(rows.IMG_6505!.text)},
    namedColors: ${lit(rows.IMG_6505!.namedColors)},
    latencyMs: ${lit(rows.IMG_6505!.latencyMs)},
    model: ${lit(rows.IMG_6505!.model)},
  },
  IMG_6208: {
    text: ${lit(rows.IMG_6208!.text)},
    namedColors: ${lit(rows.IMG_6208!.namedColors)},
    latencyMs: ${lit(rows.IMG_6208!.latencyMs)},
    model: ${lit(rows.IMG_6208!.model)},
  },
  IMG_5859: {
    text: ${lit(rows.IMG_5859!.text)},
    namedColors: ${lit(rows.IMG_5859!.namedColors)},
    latencyMs: ${lit(rows.IMG_5859!.latencyMs)},
    model: ${lit(rows.IMG_5859!.model)},
  },
};
`;
  await writeFile(path.join(process.cwd(), "lib/fold-briefs.ts"), src);
  const motionNote = [
    `brief model ${model}`,
    `IMG_6505 latency ${rows.IMG_6505!.latencyMs}ms`,
    `IMG_6208 latency ${rows.IMG_6208!.latencyMs}ms`,
  ].join("\n");
  console.log(motionNote);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
