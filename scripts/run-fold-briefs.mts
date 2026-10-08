/**
 * Run glm-5.3-flash against the fold sample photos and write lib/fold-briefs.ts.
 * Uses DO_INFERENCE_API_KEY; does not touch production DB/R2.
 *
 *   npx tsx scripts/run-fold-briefs.mts
 *   npx tsx scripts/run-fold-briefs.mts --from scripts/fixtures/fold-briefs.json
 *
 * --from <file.json> of { fixtureId: { brief, latencyMs, model } }
 * merges namedColors from a sibling .detail.json when present.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { requestBriefCompletion, bytesToDataUrl, DEFAULT_BRIEF_MODEL, briefModelId, BRIEF_REQUEST } from "../lib/brief-request.ts";
import { parseNamedColors, type NamedColor } from "../lib/brief-copy.ts";
import { HANDOFF_KITS } from "../lib/mascot.ts";

const PHOTOS = ["IMG_6505", "IMG_6208", "IMG_5859"] as const;
type Photo = (typeof PHOTOS)[number];

const APPROX_5859 = ["#c2d6e4", "#c47122", "#959aa1", "#bebec1", "#454a51", "#822128"];

function keptFor(photo: Photo): string[] {
  if (photo === "IMG_5859") return APPROX_5859;
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

function isPhoto(id: string): id is Photo {
  return (PHOTOS as readonly string[]).includes(id);
}

type FromRow = {
  brief?: unknown;
  text?: unknown;
  latencyMs?: unknown;
  model?: unknown;
  namedColors?: unknown;
  outputTokens?: unknown;
};

type Capture = {
  text: string;
  namedColors: NamedColor[];
  latencyMs: number | null;
  model: string;
  outputTokens: number | null;
};

function parseFromRow(row: FromRow, fallbackModel: string): Capture {
  const text =
    typeof row.brief === "string" ? row.brief : typeof row.text === "string" ? row.text : "";
  const latencyMs = typeof row.latencyMs === "number" && Number.isFinite(row.latencyMs) ? row.latencyMs : null;
  const model = typeof row.model === "string" && row.model.length > 0 ? row.model : fallbackModel;
  const namedColors = parseNamedColors(row.namedColors, []);
  const outputTokens =
    typeof row.outputTokens === "number" && Number.isFinite(row.outputTokens) ? row.outputTokens : null;
  return { text, namedColors, latencyMs, model, outputTokens };
}

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  const next = process.argv[idx + 1];
  return typeof next === "string" && next.length > 0 && !next.startsWith("--") ? next : null;
}

async function readJson(file: string): Promise<unknown> {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as unknown;
}

async function loadFromFile(file: string): Promise<Record<Photo, Capture>> {
  const model = briefModelId();
  const parsed = await readJson(file);
  if (typeof parsed !== "object" || parsed === null) throw new Error("--from JSON must be an object");
  const detailPath = argValue("--detail") ?? file.replace(/\.json$/i, ".detail.json");
  let detail: Record<string, FromRow> = {};
  try {
    const extra = await readJson(detailPath);
    if (typeof extra === "object" && extra !== null) detail = extra as Record<string, FromRow>;
  } catch {
    detail = {};
  }
  const empty: Capture = { text: "", namedColors: [], latencyMs: null, model, outputTokens: null };
  const rows: Record<Photo, Capture> = {
    IMG_6505: { ...empty },
    IMG_6208: { ...empty },
    IMG_5859: { ...empty },
  };
  for (const [id, value] of Object.entries(parsed as Record<string, FromRow>)) {
    if (!isPhoto(id) || typeof value !== "object" || value === null) continue;
    const merged: FromRow = { ...detail[id], ...value };
    if (detail[id]?.namedColors && merged.namedColors == null) merged.namedColors = detail[id]!.namedColors;
    rows[id] = parseFromRow(merged, model);
  }
  return rows;
}

function foldBriefsSource(rows: Record<Photo, Capture>): string {
  return `import type { NamedColor } from "@/lib/brief-copy";

export type FoldPhotoId = "IMG_6505" | "IMG_6208" | "IMG_5859";

export type FoldBriefCapture = {
  text: string;
  namedColors: NamedColor[];
  latencyMs: number | null;
  model: string;
  outputTokens: number | null;
};

/** Captured from glm-5.3-flash against the sample photos. */
export const FOLD_BRIEFS: Record<FoldPhotoId, FoldBriefCapture> = {
  IMG_6505: {
    text: ${lit(rows.IMG_6505.text)},
    namedColors: ${lit(rows.IMG_6505.namedColors)},
    latencyMs: ${lit(rows.IMG_6505.latencyMs)},
    model: ${lit(rows.IMG_6505.model)},
    outputTokens: ${lit(rows.IMG_6505.outputTokens)},
  },
  IMG_6208: {
    text: ${lit(rows.IMG_6208.text)},
    namedColors: ${lit(rows.IMG_6208.namedColors)},
    latencyMs: ${lit(rows.IMG_6208.latencyMs)},
    model: ${lit(rows.IMG_6208.model)},
    outputTokens: ${lit(rows.IMG_6208.outputTokens)},
  },
  IMG_5859: {
    text: ${lit(rows.IMG_5859.text)},
    namedColors: ${lit(rows.IMG_5859.namedColors)},
    latencyMs: ${lit(rows.IMG_5859.latencyMs)},
    model: ${lit(rows.IMG_5859.model)},
    outputTokens: ${lit(rows.IMG_5859.outputTokens)},
  },
};
`;
}

async function main(): Promise<void> {
  const from = argValue("--from");
  const model = briefModelId();
  let rows: Record<Photo, Capture>;
  if (from) {
    rows = await loadFromFile(path.resolve(from));
    console.log(`loaded briefs from ${from}`);
  } else {
    const key = process.env.DO_INFERENCE_API_KEY ?? "";
    if (!key) {
      console.error("DO_INFERENCE_API_KEY is missing; cannot capture real briefs.");
      process.exit(2);
    }
    rows = {
      IMG_6505: { text: "", namedColors: [], latencyMs: null, model, outputTokens: null },
      IMG_6208: { text: "", namedColors: [], latencyMs: null, model, outputTokens: null },
      IMG_5859: { text: "", namedColors: [], latencyMs: null, model, outputTokens: null },
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
        timeoutMs: BRIEF_REQUEST.timeoutMs,
      });
      const namedColors = parseNamedColors(result.namedColors, result.namedHexes);
      rows[photo] = {
        text: result.text ?? "",
        namedColors,
        latencyMs: result.latencyMs || Date.now() - started,
        model,
        outputTokens: null,
      };
      console.log(`${photo} ${rows[photo]!.latencyMs}ms ${rows[photo]!.text.slice(0, 80)}`);
    }
  }
  await writeFile(path.join(process.cwd(), "lib/fold-briefs.ts"), foldBriefsSource(rows));
  const motionNote = [
    `brief model ${model}`,
    `IMG_6505 latency ${rows.IMG_6505.latencyMs ?? "n/a"}ms`,
    `IMG_6208 latency ${rows.IMG_6208.latencyMs ?? "n/a"}ms`,
    `IMG_5859 latency ${rows.IMG_5859.latencyMs ?? "n/a"}ms`,
    `brief timeout ${BRIEF_REQUEST.timeoutMs}ms max_tokens ${BRIEF_REQUEST.maxTokens ?? "unset"} reasoning_effort ${BRIEF_REQUEST.reasoningEffort ?? "unset"}`,
    `IMG_6505 outputTokens ${rows.IMG_6505.outputTokens ?? "n/a"}`,
    `IMG_6208 outputTokens ${rows.IMG_6208.outputTokens ?? "n/a"}`,
    `IMG_5859 outputTokens ${rows.IMG_5859.outputTokens ?? "n/a"}`,
  ].join("\n");
  console.log(motionNote);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
