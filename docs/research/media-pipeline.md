# Media pipeline research for Inzpo v1

**Ticket:** wayfinder research — best v1 media pipeline for a single-user app (cheap, low-ops)
**Date of research:** 2026-08-31
**Constraints:** TypeScript/Node; cheap managed hosting; deterministic automation only (no AI/ML services); single-user scale (thousands of items, not millions).
**Method:** primary sources only — official docs, library repositories/READMEs, spec pages (oEmbed, Open Graph), npm registry metadata (last-publish dates), AWS/Cloudflare docs. Live HTTP checks were performed against the YouTube and Vimeo oEmbed endpoints on 2026-08-31. Claims I could not pin to a primary source are flagged in [Not verified](#not-verified--open-questions).

---

## TL;DR — recommended v1 pipeline

| Slot | Recommendation | Runner-up / when to revisit |
| --- | --- | --- |
| Derivatives | **`sharp` on upload**: generate a fixed, small set of variants (WebP) at capture time | Cloudflare Image transformations if/when variants become unpredictable; lazy on-demand generation for rarely used sizes |
| Storage layout | **One prefix per item in an S3-compatible bucket** (`items/{ulid}/original.{ext}` + `items/{ulid}/{variant}.webp`), **DB is the metadata source of truth** (no sidecar files) | Keep originals immutable; add new variant names without touching old ones |
| Color extraction | **`node-vibrant` 4.x** on a downscaled buffer for the full palette; **`sharp` `stats().dominant`** as the zero-dependency dominant-color fallback | Custom median-cut only if palettes disappoint |
| URL previews | **`metascraper`** (core rule bundles) on fetched HTML; **always download `og:image` bytes at capture** and push them through the same sharp pipeline | `open-graph-scraper` if you want a single package; headless rendering is explicitly out of scope for v1 |
| Video posters | **Platform embeds via oEmbed** (YouTube, Vimeo): store `thumbnail_url` copy + `html` embed. **No server-side ffmpeg in v1** | If raw video uploads become a v2 need: client-side frame grab at upload, or ffmpeg on Lambda (feasible per quotas), never on Cloudflare Workers |

End-to-end at Inzpo scale this lands at roughly **$0/month inside free tiers** (R2 free tier, no transformation bill), with every dependency actively maintained as of August 2026 except `get-image-colors` and `@ffmpeg-installer/ffmpeg`, both of which this plan avoids.

---

## 1. Thumbnail / derivative generation

### Options considered

| Option | Quality | Cost at Inzpo scale | Complexity / ops | Notes |
| --- | --- | --- | --- | --- |
| **sharp on upload** (recommended) | Lanczos resampling, ICC/alpha handled correctly; mozjpeg/pngquant-grade output optimization built in; JPEG/PNG/WebP/GIF/AVIF output [1] | $0 (CPU at capture time) | One npm dep; prebuilt binaries, "most modern macOS, Windows and Linux systems do not require any additional install or runtime dependencies"; needs Node-API v9 (Node ≥ 20.9, also Deno/Bun) [1] | Actively maintained: v0.35.4 published 2026-08-26 [2][3] |
| Cloudflare Images transformations (CDN transforms) | Vendor pipeline; automatic format negotiation (AVIF/WebP counted as one transformation) [6] | Free ≤ 5,000 **unique** transformations/month, then $0.50 per 1,000/month [6]. At 3,000 items × 3 variants = 9,000 unique → ~$2/mo, forever | Requires assets reachable through a Cloudflare zone (or R2 + zone); adds a vendor and a billing meter to every new UI size [5][6] | Great when you don't know your sizes; we do |
| Cloudinary | Full-featured; derived assets created on the fly and CDN-cached; each new derived asset counts toward plan quotas [8] | Plan-dependent — free-tier numbers **not verified from primary source this session** | Another vendor account, SDK, and quota model | Not needed at this scale |
| On-demand lazy generation (self-hosted) | Same as sharp (same library) | $0 | Route that checks existence → generates → stores; needs invalidation care | Good optional add-on for rarely-viewed variants, not the primary path |

### Recommendation

Generate **on upload** with `sharp`, deterministically:

- Inputs are immutable: the original is stored once and never modified.
- Produce a small fixed variant set sized to actual UI slots, e.g. `w1600` (detail), `w640` (card), `w256` (thumb), all WebP; plus a tiny (~20–32px wide) variant you can inline as a base64 placeholder for instant grid layout.
- Record `width`, `height`, `format`, byte size, and variant keys in the DB at capture time (see §2).
- Rationale for pre-generation over CDN transforms at single-user scale: the variant set is small and known (UI slots are fixed), so per-transformation billing and vendor coupling buy nothing. `sharp` quality is a solved problem (Lanczos, correct ICC/alpha handling) [1], and the cost curve is exactly zero.
- If a future UI needs ad-hoc sizes, add **lazy on-demand generation on first request** (generate with sharp, store, redirect) before ever considering a transform CDN. Cloudflare's own pricing shows the crossover: 2,000 images × 5 sizes = 10,000 unique transformations → $2.50/month [6] — cheap but pointless when two lines of sharp code produce the same bytes for free.

### Failure modes to design around

- **Large/absurd inputs**: cap accepted dimensions and byte size at upload; decode errors from corrupt files should fail the capture with a clear message, not break the pipeline.
- **EXIF orientation**: read via `sharp().metadata()` and normalize orientation when producing variants (sharp exposes orientation and an `autoOrient` view) [4].
- **Animated GIFs/animated WebP**: sharp reads animated input (`pages`/`delay` in metadata) [4]; decide v1 policy — e.g. keep animation only in the original, derive posters from the first frame.
- **Variant schema evolution**: never rename variant keys; add new ones and backfill lazily. Keys double as the DB record of what exists.

---

## 2. Storage layout (originals + derivatives)

### Conventions used in practice, from primary sources

- Object stores are a **flat keyspace**; "folders" are key **prefixes + `/` delimiter** [9].
- Keys are UTF-8, max 1,024 bytes, case-sensitive; AWS publishes a safe-character set (alphanumerics plus `-_.!*'()`) and a list of characters to avoid (`\ { } % ~ |` etc.) because handling is inconsistent across tools [9].
- Keys sort **lexicographically by UTF-8 bytes** [9] — prefixing with a monotonic ID gives you chronological listing for free.
- In practice (S3/R2-era conventions), services keep user-supplied filenames out of keys because of exactly the encoding hazards AWS documents [9].

### Recommendation

```
items/{itemUlrid}/original.{ext}      # byte-exact original, immutable, never re-encoded
items/{itemUlid}/w1600.webp           # derivatives, name = variant key
items/{itemUlid}/w640.webp
items/{itemUlid}/w256.webp
items/{itemUlid}/ph.json              # optional: tiny inline placeholder payload
```

- **`{itemUlid}`** = ULID/UUIDv7 generated by the app. Monotonic IDs sort chronologically under S3's byte-ordering rule [9], and app-generated IDs keep user text (with its `%`, spaces, unicode hazards [9]) out of keys entirely.
- **Derivative names are the contract**: `w640.webp` means "max-width 640 WebP". No derivative is ever addressed except through the DB.
- **No metadata sidecars as the source of truth.** The application DB row per item carries: original key + sha-256 + bytes + format + width/height, the variant list, extracted palette (§3), source URL, captured preview metadata (§4), timestamps. Object stores are addressed only by keys from the DB. Sidecar files (e.g. XMP-style) are a real convention in creative-tool ecosystems — background knowledge, not verified against a primary source this session — but they add a second mutable artifact to keep in sync; a DB is strictly simpler for a web app and is queryable for filtering (which sidecars are not).
- **Bucket choice:** any S3-compatible store. Cloudflare R2 numbers verified: **10 GB-month free, $0.015/GB-month, 1M Class A / 10M Class B ops free, zero egress fees** [7]. Thousands of design-inspiration items with a handful of objects each fit in or near the free tier indefinitely.

### Failure modes to design around

- **Orphans on failed captures**: write the DB row first with a state flag, upload objects, then flip to `ready`; a reaper deletes prefixes for rows that never became ready.
- **Deletion order**: DB row → delete objects → keep tombstone; deletes are free on R2 [7], partial failure is recoverable by retry.
- **Content-type discipline**: store the true media type from `sharp().metadata()` [4], not from the client-supplied filename or upload header.
- **Don't key by hash alone**: content-addressable keys (`sha256/ab/cd/ef…`) are elegant but make "same screenshot re-saved with new crop" dedupe awkward and hide chronology; ULID-per-item keeps the model aligned with the domain's Item concept.

---

## 3. Dominant color / palette extraction

### Candidates checked (maintenance status from npm registry + GitHub API, 2026-08-31)

| Library | Latest / last publish | Fit for server-side use | Notes |
| --- | --- | --- | --- |
| **node-vibrant** (recommended) | 4.0.4, published **2026-01-27** [11]; repo pushed 2026-01-27, not archived [10] | First-class Node entry (`node-vibrant/node`), identical API for Node/browser/worker; TypeScript monorepo [10][12] | Extracts six swatch classes: Vibrant, Dark/Light Vibrant, Muted, Dark/Light Muted [12]. Quantizer is MMCQ (`@vibrant/quantizer-mmcq`) [13]. `@vibrant/color` is the sibling utilities package from the same monorepo (4.0.4, 2026-01-27) [11] — i.e. the "successor" packaging of the old split |
| **sharp `stats().dominant`** | ships with sharp 0.35.4 [3] | Zero extra deps; same process as derivative generation | Returns the single most dominant sRGB color via a **4096-bin 3D histogram** [4]. One color, not a palette |
| **get-image-colors** | 4.0.1, last publish **2022-02-04** [14]; repo last pushed 2022-07-17; no license file detected via GitHub API [15] | Node-only via `get-pixels`; SVG support | Functionally fine but 4+ years stale — avoid for a new foundation |
| Custom median cut on sharp raw pixels | — | sharp exposes raw pixel output [1] | Feasible (downscale → grab RGB buffer → median cut) but you'd be re-implementing MMCQ, which node-vibrant already ships as a maintained package [13] |

### Recommendation

- Run **`node-vibrant`** on a **downscaled buffer** (e.g. sharp resize to ≤ 256px on the long edge, feed the buffer). This is fast, and — since Node reads pixels directly rather than through HTML canvas — deterministic for identical input bytes, which matters for reproducible re-processing. (The library's own consistency caveats concern browser canvas variance: results are consistent within a platform, but downsampling *can* cause cross-platform drift in browser environments [10]. Server-side, same bytes → same palette.)
- Persist the palette as **hex strings in the DB** (six swatch slots, or fewer if null). Color-based filtering (the Inzpo Palette/color-search feature) then becomes a DB query over stored colors — never a re-extraction at query time.
- Store **`sharp.stats().dominant`** [4] alongside as the guaranteed-populated fallback: every image item then always has at least one searchable color even when Vibrant returns null swatches.
- Run extraction **after** generating the smallest variant, on its bytes — one less large decode.

### Failure modes to design around

- **Null swatches**: Vibrant legitimately returns null for some swatch classes on low-chroma images; treat null as a value, not an error.
- **Re-extraction policy**: because the algorithm is deterministic, a batch re-extraction across all items always converges to the same result — safe to change algorithm versions later with a one-shot backfill.

---

## 4. Pulling preview assets from saved URLs

### Library landscape (registry + repo data, 2026-08-31)

| Library | Latest / last publish | Approach | Notes |
| --- | --- | --- | --- |
| **metascraper** (recommended) | 5.56.2, published **2026-08-17** [16]; repo pushed 2026-08-23, MIT, 2.7k stars [17] | Composable rule bundles over OG, JSON-LD, RDFa, Microdata, Twitter Cards, HTML fallbacks; first matching rule wins, ordered most-specific → most-generic [18] | Official bundles include `metascraper-image`, `-title`, `-description`, `-logo`, `-logo-favicon`, plus vendor bundles (YouTube, X, Dribbble, Instagram…) [18]. Its own benchmark puts it at 95.5% correct vs open-graph-scraper 66.5% — **self-reported, treat as directional** [18] |
| **open-graph-scraper** | 6.12.0, published **2026-06-26** [19]; repo pushed 2026-06-26, MIT, 754 stars [20] | Single package; OG + Twitter Card + JSON-LD; built-in TS types; fetch-based with `html` bypass mode [21] | Simpler dep tree; its README explicitly documents that the default `undici` user-agent gets blocked by some sites and suggests a browser-like UA [21] |

### Spec anchors

- **Open Graph** [22]: `og:image` (plus structured `og:image:secure_url`, `:width`, `:height`, `:alt`) lives in `<meta property=…>` tags **in the initial HTML `<head>`**; multiple `og:image` tags are allowed and the first is preferred. Anything not present in served HTML cannot be scraped without executing JS (SPAs that server-render meta tags still work; those that don't, don't).
- **oEmbed** [23][24]: consumer GETs a provider endpoint with `url` (+ optional `maxwidth`/`maxheight`/`format`); response carries `thumbnail_url` + dimensions when available. Defined error semantics: `404` (no representation), `401` (private resource), `501` (unsupported format). Providers should publish `<link rel="alternate" type="application/json+oembed">` **discovery** tags; the spec strongly encourages discovery over its registry (376 providers) [24]. The registry lists Vimeo's endpoint `https://vimeo.com/api/oembed.{format}` with discovery enabled [24].

### Recommendation

At capture time for URL items:

1. **Fetch HTML** with a normal fetch: browser-like `User-Agent` (documented blocker [21]), follow redirects, 10s timeout, hard cap on response bytes.
2. **Parse with metascraper** loading the core bundles you actually need (`image`, `title`, `description`, `logo`, `logo-favicon`, `publisher`, `url`) [18]. Resolve the returned relative URLs against the final (post-redirect) URL — the `url` option exists for exactly this [18].
3. **Download the preview image immediately and store it as the item's original** (then run §1 derivatives + §3 palette on it). Never hotlink the extracted `og:image` URL in the UI.
4. For **YouTube/Vimeo** URLs specifically, short-circuit to **oEmbed** (§5) — it is more reliable than scraping those pages and returns title, author, and thumbnail in one call.

Keep the captured snapshot as the item's preview; optionally retain the original `og:image` URL in the DB as provenance.

### Failure modes to design around (each one is a normal Tuesday at single-user scale)

- **Blocked fetches / bot defenses**: OGS's own README documents default-UA blocking [21]; some sites will still 403 you. Design the UI for an "unfetchable but saved" state — the URL item is still valid without a preview.
- **SPA / client-rendered pages with no server-rendered meta tags**: OG tags are by definition in initial served HTML [22]; if they're absent, a plain fetch sees nothing. v1 accepts this (empty preview); headless-browser fetching is the known cure but is an ops-priced escalation (metascraper's own docs reach for `browserless`/`html-get` for it [18]) — explicitly deferred.
- **Hotlink protection + link rot**: `og:image` URLs are frequently signed/expiring or referer-checked (operator-side behaviors; general practitioner knowledge, not verified from a single primary source this session). Copying bytes at capture neutralizes both, and is the single most important design decision in this slot.
- **Dead/private targets**: verified live on Vimeo — oEmbed returned `404` for two defunct video IDs and `200` for a live one on the same day (2026-08-31); the oEmbed spec defines `404` and `401` semantics precisely [23]. Previews captured earlier keep working precisely because you stored copies.
- **Malicious/misbehaving previews**: constrain preview fetches to `http(s)` with SSRF hygiene (no private/loopback IP ranges, no redirects into private space) — standard practice, stated here as design guidance rather than a spec citation. The oEmbed spec separately warns about XSS from provider-supplied `html` and recommends rendering embeds in an iframe on another domain [23] — follow that for §5 embeds.
- **Huge or non-image `og:image` targets**: verify with `sharp().metadata()` after download [4]; reject anything that doesn't decode as an image, and cap bytes.

---

## 5. Video posters / stills for v1

### Findings

- **ffmpeg in serverless is feasible but unnecessary for v1.** Lambda's quotas comfortably fit static ffmpeg: deployment package up to **250 MB unzipped including layers** (a static ffmpeg binary is ~78 MB per platform; `ffmpeg-static` ships ffmpeg **6.1.1** builds [25], last published 2025-11-14 [26]), **`/tmp` configurable 512 MB–10 GB**, 15-minute max invocation [27]. Alternative installer `@ffmpeg-installer/ffmpeg` is stale (last publish **2021-07-15**) [28] — prefer `ffmpeg-static` if this route is ever taken.
- **ffmpeg on Cloudflare Workers is not viable**: 128 MB memory per isolate *including WebAssembly allocations*, 10 MB compressed Worker bundle, no native-binary execution [29]. A WASM ffmpeg would fight the memory ceiling on real video; don't.
- **Platform embeds cover the actual v1 need.** Inzpo's "video" items in practice are YouTube/Vimeo links. oEmbed returns everything needed for a poster + card:
  - YouTube (verified live 2026-08-31): `GET https://www.youtube.com/oembed?url=<video-url>&format=json` → `type: "video"`, `title`, `author_name`, `thumbnail_url: https://i.ytimg.com/vi/<id>/hqdefault.jpg` with `thumbnail_width/height`, plus iframe `html` [30]. The spec example documents the same shape [23].
  - Vimeo (endpoint from the official providers registry [24], verified live): `GET https://vimeo.com/api/oembed.json?url=<video-url>` → `thumbnail_url` on `i.vimeocdn.com` with dimensions, `title`, iframe `html` [31]. Vimeo's developer docs page is JS-rendered and did not fetch cleanly; the endpoint itself is attested by the oEmbed registry and confirmed by live call, so the registry + live check stand as the verification.
- The well-known direct URL patterns (`i.ytimg.com/vi/<id>/hqdefault.jpg` etc.) are **undocumented** — they appear inside oEmbed responses but aren't spec'd by Google. Use the oEmbed `thumbnail_url` field rather than constructing these URLs by hand.

### Recommendation

- **v1: no raw video upload support.** Video items = YouTube/Vimeo URLs → oEmbed at capture → store `title`, `author_name`, `thumbnail_url` **as a downloaded copy** (through the same sharp → derivatives → palette pipeline), and store the oEmbed `html` for the watch page (render only in a sandboxed cross-origin iframe per oEmbed's security note [23]).
- Handle oEmbed failure (`404`/`401`/timeout [23]) as "saved, no poster" — a neutral placeholder.
- **If raw video uploads are ever added (v2):** capture the poster **client-side at upload** (seek a `<video>` element and draw a frame to canvas — standard web-platform capability, noted as design intent, not verified against a spec here), keeping the server ffmpeg-free. Fallback: an ffmpeg-on-Lambda side job, which the quotas above support [25][27].

---

## Cost snapshot at Inzpo scale (thousands of items)

| Line | Assumption | Cost |
| --- | --- | --- |
| Derivative generation | sharp, runs during capture request | $0 |
| Storage | R2: ~5k objects, a few GB | **$0** inside 10 GB free tier [7] |
| Object operations | 1 write/item + handful of reads | $0 inside free op tiers [7] |
| Egress | R2 | $0 (no egress fees) [7] |
| Transform CDN | not used | $0 (Cloudflare's 5k free unique transformations/month would also cover modest ad-hoc needs before any billing starts [6]) |
| Color extraction | node-vibrant + sharp, in-process | $0 |

---

## Not verified / open questions

Flagged explicitly per the research method:

- **Cloudinary free-tier limits** — docs confirm transformations are plan-metered per derived asset [8] but I did not fetch/verify current plan numbers.
- **XMP-style sidecar conventions** in creative tools — cited as background knowledge only; no primary source consulted this session.
- **Hotlink-protection and signed-URL expiry behavior** — reasoned failure mode (operator-side behavior of arbitrary origins), not attributable to one primary source.
- **SSRF hygiene and browser-like-UA etiquette** — standard practice, not spec-backed.
- **Client-side video frame capture** (`<video>` + canvas) — standard platform capability asserted as design intent; not verified against a spec here.
- **Twitter/X card meta tags** — I did not fetch X's docs; `twitter:image` support is covered indirectly via metascraper's rules/`metascraper-x` bundle [18]. OG tags remain the primary target per the OG spec [22].
- **node-vibrant's exact Node-side pixel pipeline** (which decoder the `node-vibrant/node` entry uses) — the entry point and API are documented [12], but the underlying reader dependency wasn't audited; worth a 5-minute check during implementation.

## Sources

All accessed 2026-08-31 unless noted. Registry "last publish" values are from the npm registry packuments; repo signals from the GitHub REST API.

**Derivatives / processing**

1. sharp documentation (formats, libvips, licensing, prebuilt binaries, Node-API v9) — https://sharp.pixelplumbing.com/
2. sharp changelog index (v0.35.4 — 26th August 2026) — https://sharp.pixelplumbing.com/changelog/
3. npm registry, `sharp` packument (latest 0.35.4, published 2026-08-26T09:42Z) — https://registry.npmjs.org/sharp
4. sharp API: Input metadata (`metadata()`, `stats()`, `dominant` 4096-bin histogram) — https://sharp.pixelplumbing.com/api-input/

**CDN-transform alternatives**

5. Cloudflare Images docs (transformations, BYO storage incl. R2) — https://developers.cloudflare.com/images/
6. Cloudflare Images pricing (5,000 free unique transformations/mo; $0.50/1k after; worked example 10,000 → $2.50) — https://developers.cloudflare.com/images/pricing/
7. Cloudflare R2 pricing (10 GB free, $0.015/GB-mo, free ops tiers, free egress) — https://developers.cloudflare.com/r2/pricing/
8. Cloudinary image transformations (derived assets on the fly, CDN-cached, plan-metered) — https://cloudinary.com/documentation/image_transformations

**Storage**

9. Amazon S3 User Guide: object keys (flat namespace, prefixes, safe characters, lexicographic order) — https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html

**Color extraction**

10. Vibrant-Colors/node-vibrant repository (README, platform entries, consistency notes; GitHub API: pushed 2026-01-27, not archived) — https://github.com/Vibrant-Colors/node-vibrant
11. npm registry, `node-vibrant` and `@vibrant/color` packuments (both 4.0.4, published 2026-01-27) — https://registry.npmjs.org/node-vibrant , https://registry.npmjs.org/@vibrant/color
12. node-vibrant docs: Get Started (six swatch classes; `node-vibrant/node` entry) — https://github.com/Vibrant-Colors/node-vibrant/blob/main/docs/guides/get-started.md
13. node-vibrant docs: `@vibrant/quantizer-mmcq` reference — https://github.com/Vibrant-Colors/node-vibrant/blob/main/docs/reference/vibrant-quantizer-mmcq/index.md
14. npm registry, `get-image-colors` packument (4.0.1, published 2022-02-04) — https://registry.npmjs.org/get-image-colors
15. GitHub API, `colorjs/get-image-colors` (pushed 2022-07-17; no license file detected) — https://api.github.com/repos/colorjs/get-image-colors

**URL previews**

16. npm registry, `metascraper` packument (5.56.2, published 2026-08-17) — https://registry.npmjs.org/metascraper
17. GitHub API, `microlinkhq/metascraper` (pushed 2026-08-23, MIT) — https://api.github.com/repos/microlinkhq/metascraper
18. metascraper README (rule bundles, fallback ordering, `url` resolution option, self-reported benchmark, browserless/html-get escalation) — https://github.com/microlinkhq/metascraper
19. npm registry, `open-graph-scraper` packument (6.12.0, published 2026-06-26) — https://registry.npmjs.org/open-graph-scraper
20. GitHub API, `jshemas/openGraphScraper` (pushed 2026-06-26, MIT) — https://api.github.com/repos/jshemas/openGraphScraper
21. openGraphScraper README (fetch-based, default UA blocking note, timeout, `html` bypass mode) — https://github.com/jshemas/openGraphScraper
22. The Open Graph protocol (og:image and structured properties; meta tags in initial HTML) — https://ogp.me/

**Video / oEmbed**

23. oEmbed spec (request/response params, 404/401/501 semantics, discovery, security considerations) — https://oembed.com/
24. oEmbed providers registry (Vimeo endpoint `https://vimeo.com/api/oembed.{format}`, discovery; 376 providers) — https://oembed.com/providers.json
25. eugeneware/ffmpeg-static (static ffmpeg 6.1.1 binaries, platforms, GPL-3.0) — https://github.com/eugeneware/ffmpeg-static
26. npm registry, `ffmpeg-static` packument (5.3.0, published 2025-11-14) — https://registry.npmjs.org/ffmpeg-static
27. AWS Lambda quotas (250 MB unzipped package incl. layers; `/tmp` 512 MB–10 GB; 15-min timeout) — https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
28. npm registry, `@ffmpeg-installer/ffmpeg` packument (1.1.0, published 2021-07-15) — https://registry.npmjs.org/@ffmpeg-installer/ffmpeg
29. Cloudflare Workers limits (128 MB isolate memory incl. WASM; 10 MB compressed bundle; no native binaries) — https://developers.cloudflare.com/workers/platform/limits/
30. YouTube oEmbed — live JSON response captured 2026-08-31 — https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json
31. Vimeo oEmbed — live JSON response captured 2026-08-31 (docs page https://developer.vimeo.com/api/oembed is JS-rendered; endpoint attested by [24]) — https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F22439234
