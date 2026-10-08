import { sanitizeChipLabel } from "@/lib/brief-copy";

// Prefer whole objects over their parts/materials; ties follow the brief's order.
const SUBJECT_GROUPS = [
  "mural graffiti zigzag facade clapboard house victorian storefront shopfront building shop door sign wall fence awning garage",
  "window tile stair railing trim pane shutter brick concrete",
  "tree flower plant leaf mountain beach sky cloud streetlight bench chair table bowl vase sculpture portrait person dog cat car bicycle boat",
].map((group) => new Set(group.split(" ")));

const SINGULAR: Record<string, string> = { houses: "house", leaves: "leaf", people: "person" };
const SUBJECT_MODIFIERS = new Set("ceramic wooden metal glass stone concrete brick clapboard victorian gothic georgian urban coastal garden floral".split(" "));

function noun(word: string): string {
  return SINGULAR[word] ?? (word.endsWith("s") ? word.slice(0, -1) : word);
}

const COLOR_WORDS = new Set((
  "red orange yellow gold green teal blue purple pink brown cream beige gray grey black white " +
  "crimson scarlet ruby tangerine apricot amber rust mustard canary navy cobalt azure indigo sage olive emerald " +
  "turquoise aqua cyan violet lavender lilac plum mauve amethyst rose blush coral fuchsia magenta " +
  "chocolate chestnut sepia ivory ecru silver slate charcoal ash graphite ebony onyx jet alabaster"
).split(" "));
const FORBIDDEN = new Set([...COLOR_WORDS, ...(
  "pale painted dropped soft deep light dark bright warm cool muted dusty " +
  "playful sleepy wistful stately serene nostalgic quiet sunny charm mood calm peaceful happy sad vibrant " +
  "feel feels felt evoke evokes conveys convey remaining spray " +
  "the a an and or of with its this that from into onto for on in at to"
).split(" ")]);

/** Accept a common noun with an optional modifier, never location data or descriptive prose. */
export function sanitizeBriefSubject(raw: unknown): string | null {
  const clean = sanitizeChipLabel(raw);
  if (!clean || !/^[a-z]+(?: [a-z]+)?$/i.test(clean)) return null;
  const words = clean.toLowerCase().split(" ");
  if (words.some((word) => FORBIDDEN.has(word))) return null;
  const head = noun(words[words.length - 1]);
  if (!SUBJECT_GROUPS.some((group) => group.has(head))) return null;
  if (words.length === 2 && !SUBJECT_MODIFIERS.has(words[0]) && !SUBJECT_GROUPS.some((group) => group.has(noun(words[0])))) return null;
  words[words.length - 1] = head;
  return words.join(" ");
}

export function subjectFromBrief(text: string | null | undefined): string | null {
  const words = (text?.toLowerCase().replace(/\bspray tags?\b/g, "graffiti").match(/[a-z]+/g) ?? []).map(noun);
  for (const group of SUBJECT_GROUPS) {
    const subject = words.find((word, index) =>
      group.has(word) &&
      // A material used as a colour modifier is not the photo's subject.
      !(["brick", "sky", "leaf"].includes(word) && COLOR_WORDS.has(words[index + 1])),
    );
    if (subject) return subject;
  }
  return null;
}
