# Inzpo v1 — Web Stack Recommendation (Research)

**Ticket:** wayfinder — concrete TypeScript web stack for the single-user Inzpo web app
**Date:** August 2026 · **Method:** primary sources only (official docs + official pricing pages, fetched Aug 2026). Claims are cited `[n]` to the Sources list. Claims that could **not** be verified from a primary source are marked **[unverified]**.
**Budget target:** $0–20/month total, managed services only, no self-hosting, TypeScript throughout, mobile-friendly web output, server-side color extraction (sharp or similar).

---

## Recommendation at a glance

| Slot | Pick | Runner-up | Est. cost at small scale |
| --- | --- | --- | --- |
| Framework | **Next.js (App Router)** | React Router v7 (Framework Mode) | $0 |
| Postgres host | **Neon** (Free, then Launch) | Supabase (database only) | $0 |
| Object storage | **Cloudflare R2** (+ sharp at capture; Cloudflare Images optional) | UploadThing | $0 |
| Deployment | **Vercel (Hobby)** | Railway (Hobby $5/mo) | $0 |
| **Total** | | | **$0/month** (headroom to ~$20) |

---

## 1. Framework

### Comparison matrix

| Criterion | Next.js (App Router) | React Router v7 Framework Mode | Vite + React SPA |
| --- | --- | --- | --- |
| Server-side metadata fetching (server-rendered data) | Yes — Server Components fetch data on the server [1] | Yes — `loader` functions run server-side in Framework Mode (SPA/SSR strategies) [2] | No built-in server; requires a separate backend or SSR plugin setup [3] |
| Server actions / mutations | Yes — Server Actions and Server Functions are first-class [4] | Yes — `action` + `useFetcher` data APIs [2] | No — roll your own API layer [3] |
| Built-in image handling | Yes — `next/image` with on-demand resizing of remote images, modern formats, layout-shift protection [5] | No framework-level image component; use third-party or platform image services [2] | No; static asset handling only [3] |
| `sharp` integration path | Explicit: Next.js image optimization requires the `sharp` package on a standard Node server [6] | Works wherever the Node app runs (Docker templates for Fly/Railway) [7] — but you wire up image processing yourself | sharp runs in whatever Node backend you add yourself [3] |
| Ecosystem maturity / docs depth | Largest; extensive App Router docs incl. metadata, caching, PWA guides [1] | Mature, actively developed; multi-mode docs [2] | Mature build tool powering many frameworks; but it is a build tool, not an app framework [3] |
| Fit for media-heavy single-user app | Strong — server actions for capture flows, image optimization pipeline, metadata API [4][5] | Good — but image pipeline and metadata handling are DIY | Weak fit — everything server-side is DIY |

### Pick: Next.js (App Router)

**Rationale.** Inzpo's core jobs map directly onto Next.js App Router primitives:

- **Capture flows** (URL, screenshot, photo, palette, article, video) are form-driven mutations → Server Actions [4].
- **Color extraction** needs a server-side process running sharp; Next.js itself standardizes on sharp for image optimization on a Node server [6], and Route Handlers give the HTTP entry points for upload → process → store pipelines (Route Handlers documented in the Next.js docs index) [1].
- **Image-heavy grid UI** (mobile-friendly masonry of Items) benefits from `next/image`: automatic resizing of remote images (e.g. from an S3/R2 bucket), modern formats, lazy loading, and layout-shift prevention [5].
- **Metadata/OG support** for shared Item links via the Metadata and OG images API (documented under App Router getting started) [1].

**Why not the alternatives.** React Router v7 Framework Mode is a credible, lighter-weight alternative — loaders/actions cover data fetching and mutations, and official Docker templates target Fly.io/Railway directly [2][7]. It loses mainly on the built-in image pipeline: you'd assemble sharp + a resizing route + cache headers yourself. A Vite + React SPA forces you to stand up and secure a separate Node backend for every server-side concern (color extraction, URL metadata fetching, upload signing), which is the most work of the three for this app [3].

---

## 2. Postgres hosting (database only)

### Comparison matrix

| Criterion | Neon | Supabase (DB only) | AWS RDS for PostgreSQL |
| --- | --- | --- | --- |
| Free tier (permanent?) | Yes — permanent Free plan, no credit card [8] | Yes — but projects **pause after 1 week of inactivity**; max 2 active projects [9] | No permanent free tier — 12-month free tier for pre-Jul-2025 signups, or one-time credits for newer accounts [10] |
| Serverless friendliness | Scale-to-zero after 5 min idle; suspended compute = $0; autoscaling to 2 CU on Free [8] | Always-on instance; smallest shared-CPU instance, 500 MB DB on Free [9] | Instance-based; billed per second while running; **stopped instances still incur storage + backup charges** [11] |
| Price at small scale | Free: 100 CU-hrs + 0.5 GB + 5 GB egress per project/mo; beyond that Launch is usage-based ($0.106/CU-hr, $0.35/GB-mo), no monthly minimum [8] | Free $0; first paid tier **Pro from $25/mo** (includes $10 compute credit) [9] | Pay per instance-hour + storage; cheapest configurations cost more than $0 from month 13 onward **[unverified: exact t4g.micro rate not captured from a primary page this session]** [10][11] |
| Backup / restore | History window (6 h on Free; up to 7–30 days on paid) enables point-in-time restore; 1 manual snapshot on Free; scheduled snapshots on paid [8] | **No automatic backups on Free**; Pro includes 7-day daily backups; PITR is a $100/mo add-on [9] | Automated backups + snapshots; backup storage billed beyond free allowance; strong, traditional restore tooling [11] |
| Gotcha for this app | Free compute suspends entirely once monthly CU-hour/storage/egress limits are hit [8] | Week-long inactivity pause would take a rarely-used personal app offline until manually resumed [9] | Overkill operationally; least "serverless" option [10][11] |

### Pick: Neon

**Rationale.**

- The **permanent free tier** fits a single-user library: 100 CU-hours/project/month, 0.5 GB storage, scale-to-zero so idle weeks cost nothing [8]. Inzpo is exactly a "prototype / side project" workload per Neon's own plan description [8].
- **Serverless driver friendliness**: scale-to-zero with $0 while suspended, plus autoscaling, is designed for spiky personal-app traffic [8].
- **Backups**: point-in-time restore via the history window plus manual snapshots on Free — adequate for a personal library, upgradeable (7-day history, scheduled snapshots) on the usage-based Launch plan at ~a few dollars [8].
- **Why not Supabase**: using it *database-only* wastes its bundle; the Free tier's 1-week inactivity pause is a real UX risk for a rediscovery app you may not open daily, and the first paid tier jumps to $25/mo — the top of the budget on its own [9].
- **Why not RDS**: the 12-month free tier/credits expire, per-second instance billing runs 24/7 for an always-on DB, stopped instances still bill storage, and PITR/ops burden is heaviest — the opposite of "cheap managed, zero-ops" [10][11].

---

## 3. Object storage for screenshots/photos

### Comparison matrix

| Criterion | Cloudflare R2 | AWS S3 | UploadThing | Cloudinary |
| --- | --- | --- | --- | --- |
| Price at small scale | **10 GB-month free** + 1M Class A + 10M Class B ops free/mo; then $0.015/GB-mo; **zero egress fees** [12] | Egress to internet free only for first 100 GB/mo; storage tier rates are rendered client-side on the pricing page and could not be captured from a primary source this session **[unverified: exact Standard per-GB rate]** [13] | Free: **2 GB storage shared across all apps**, unlimited up/downloads; $10/mo for 100 GB [14] | Free: 25 credits/mo (1 credit = 1 GB storage **or** 1 GB bandwidth **or** 1,000 transformations); paid starts **$89–99/mo** [15] |
| Transform / thumbnails | R2 itself stores only; **Cloudflare Images adds transforms**: 5,000 unique transformations/month free, works on images stored in R2; then $0.50 per 1,000 [16] | None native; DIY (Lambda/Lambda@Edge or sharp in your app) [13] | No image-transformation feature found in official docs index (frameworks, file routes, uploads, UTApi) — **as of Aug 2026** [17] | Full pipeline: transformations, transcoding, CDN delivery are headline features of every plan [15] |
| DX with Next.js/TS | S3-compatible API; pairs with Next.js Route Handler + sharp pipeline [12] | S3 SDK; standard but most boilerplate (IAM, signing, regions) [13] | First-party Next.js App Router adapter + typed file routes; auth-on-your-server model [17] | Upload widget + API; heavier vendor coupling [15] |
| Fits color-extraction plan | Yes — download object in a Route Handler, run sharp, store dominant colors in Postgres | Yes — same | Yes (fetch file server-side via UTApi), but no transform pipeline | Yes — but extraction would happen inside Cloudinary, not your sharp code |

### Pick: Cloudflare R2 (+ sharp in the app)

**Rationale.**

- **Free tier fits Inzpo's first years**: 10 GB-month storage with a million writes and ten million reads per month at $0, and — uniquely — **zero egress charges** even on the free tier, which de-risks the media-heavy read patterns of a moodboard app [12].
- **Thumbnails without vendor lock-in**: generate thumbnails and dominant-color data **at capture time with sharp** inside a Next.js Route Handler (sharp is the dependency Next.js itself standardizes on for image optimization [6]); serve variants from R2 directly. If on-demand variants are ever needed, **Cloudflare Images** transforms R2-stored images with 5,000 free unique transformations/month and transparent per-1k pricing after [16].
- **Why not S3**: pricing transparency failed the primary-source test this session (the storage table is client-rendered), and S3 charges internet egress beyond 100 GB/mo — the exact cost category a photo-heavy app grows into [13].
- **Why not UploadThing**: the best upload DX (typed Next.js adapter [17]) but the 2 GB free cap is the tightest of the four [14], and its docs list no transformation capability [17].
- **Why not Cloudinary**: excellent transforms, but the free tier (25 credits/mo ≈ 25 GB bandwidth *or* 1 GB storage) is consumption-shaped and the first paid plan jumps to $89–99/mo — far past budget if you outgrow free [15].

---

## 4. Deployment

### Comparison matrix

| Criterion | Vercel (Hobby) | Fly.io | Railway |
| --- | --- | --- | --- |
| Fit with Next.js | Vercel's own docs call it the native Next.js platform: zero-config SSR, ISR, streaming, image optimization [18]; Next.js officially documents that one Node server (`next start`) can run every feature, and Vercel is the zero-configuration path [6] | Docker/Node hosting; Next.js runs as a standard Node app — officially supported path via adapters/Docker [6] | Node/docker hosting; Next.js runs as a standard Node app [6] |
| Node image-processing (sharp) | Image Optimization is zero-config on Vercel (5,000 transformations/mo included on Hobby) [19]; custom sharp code in Functions runs in a managed Node runtime | Full Docker VM — sharp installs and runs natively; cheapest preset shared-cpu-1x/256 MB ≈ **$2.02/mo** (US), 512 MB ≈ $3.32/mo [20] | Full Node service — sharp runs natively; usage-based: ≈ $10/GB RAM-mo, $20/vCPU-mo, Hobby plan includes $5/mo of usage [21] |
| Price at small scale | **$0/mo Hobby**: 100 GB fast data transfer, 1M edge requests, 4 hrs Fluid active CPU, 1M invocations, 5K image transforms/mo included [19] | ~$2–6/mo machine + $0.02/GB egress (N.A./EU); credit card required; no free tier stated on pricing page [20] | **$5/mo Hobby** incl. $5 usage credit; egress $0.05/GB; object storage $0.015/GB-mo with free egress [21] |
| Caveats | Hobby is for **personal, non-commercial** use; free accounts are usage-capped (no overage purchase) [19] | Most ops surface (Dockerfile, fly.toml, certs $0.10/mo after first 10); scale-to-zero via autostop possible but more setup [20] | If usage exceeds $5, you pay the overage on Hobby (charges = total usage) [21] |

### Pick: Vercel (Hobby)

**Rationale.**

- **Zero-configuration for the chosen framework**: Vercel documents native, zero-config support for exactly the Next.js features Inzpo uses — SSR/streaming (Server Components), ISR/PPR, `next/image` optimization with no extra services to provision [18][19].
- **sharp lives in two sensible places**: (a) Vercel's built-in Image Optimization (5,000 transformations/mo on Hobby) for on-demand delivery sizing [19], and (b) **capture-time color extraction** — heavy sharp work happens once per capture in a Route Handler; on Hobby's 4 hrs/mo Fluid active CPU that is well within a single-user budget [19]. If a capture batch ever outgrew it, the same code runs unchanged on Fly/Railway because it is plain Node [6][20][21].
- **$0 and mobile delivery included**: 100 GB transfer and global CDN at no cost matches the personal-project budget exactly [19].
- **Why not Fly.io**: functionally excellent for Next.js (officially, a single Node server suffices [6]) and cheap (~$2/mo [20]), but it means owning Docker builds, TLS certificates, and basic ops for zero benefit at single-user scale.
- **Why not Railway**: a fine middle ground (Hobby $5/mo with usage included [21]) and the natural fallback if Inzpo ever becomes non-personal (see caveat below), but it adds a fixed $5/mo floor versus Vercel Hobby's $0.

---

## Total estimated monthly cost (small scale)

Assumptions: ~2–5 GB of assets, tens of thousands of reads/month, captures a few times per week, one user.

| Service | Plan | Monthly |
| --- | --- | --- |
| Vercel | Hobby | $0 [19] |
| Neon | Free | $0 [8] |
| Cloudflare R2 | Free tier | $0 [12] |
| Cloudflare Images (optional, only if on-demand variants wanted) | Free | $0 (≤5,000 unique transforms) [16] |
| **Total** | | **$0/month** |

**Growth headroom inside the $20 budget:** R2 storage beyond 10 GB at $0.015/GB-mo [12]; Neon Launch usage-based with no minimum (~$1–3/mo for a busy month) [8]; Vercel Pro or Railway/Fly only if Hobby limits bind [19][20][21]. Even a "everything paid, still tiny" month (Vercel Pro $20 *or* Neon ~$3 + R2 ~$1) stays inside budget.

---

## Risks & caveats

1. **Vercel Hobby license**: explicitly for personal, non-commercial use, and free accounts cannot purchase overage — capped usage only [19]. Fine for Inzpo as a single-user personal app; a future commercialization forces Pro ($20/mo) or a move to Railway/Fly (cheap, Node-portable [20][21]).
2. **Neon Free hard stop**: when monthly limits (100 CU-hours, 0.5 GB storage, 5 GB egress) are hit, compute **suspends until the next billing month** — the app goes down rather than overbilling [8]. Scale-to-zero after 5 minutes also means cold starts on first visit after idle [8].
3. **Supabase-free-fallback risk**: if Neon is ever replaced by Supabase Free, remember its 1-week inactivity pause and absent automatic backups on Free [9].
4. **R2 does not transform images by itself** — the plan depends on capture-time sharp processing (thumbnails + dominant colors persisted in Postgres). Losing that pipeline means on-demand transforms via Cloudflare Images (billed after 5,000 unique/month) [16].
5. **Unverified data point**: the exact S3 Standard storage per-GB rate could not be captured from a primary source this session (the pricing table is client-side rendered); S3's free-100 GB/mo internet egress allowance *is* verified [13]. Do not rely on the unquoted figure without re-checking aws.amazon.com.
6. **Next.js on Vercel coupling**: Next.js runs on any Node host by design (`next start` covers every feature, with sharp for image optimization) [6], so the app remains portable to Fly/Railway if Vercel pricing/terms change.
7. **Pricing volatility**: all figures are from official pages fetched August 2026; Neon and Cloudflare both note beta/new services (e.g. Neon Object Storage billing "when billing begins") — re-verify before committing spend [8][12].

---

## Sources

1. Next.js Docs — App Router sitemap (Fetching Data, Metadata and OG Images, Route Handlers): https://nextjs.org/docs/sitemap.md
2. React Router Docs — Picking a Mode (Framework Mode loaders/actions): https://reactrouter.com/start/modes
3. Vite Docs — Why Vite (build tool, framework foundation; SSR is opt-in guidance): https://vite.dev/guide/why
4. Next.js Docs — Mutating Data (Server Functions/Server Actions): https://nextjs.org/docs/app/getting-started/mutating-data
5. Next.js Docs — Image Optimization (`next/image`, remote images, on-demand resizing): https://nextjs.org/docs/app/getting-started/images
6. Next.js Docs — Deploying Next.js to different platforms (single Node server runs all features; `sharp` required for Image Optimization): https://nextjs.org/docs/app/guides/deploying-to-platforms
7. React Router Docs — Deploying (official Docker templates: Fly.io, Railway, etc.): https://reactrouter.com/start/framework/deploying
8. Neon Pricing (Free plan, CU-hours, scale-to-zero, storage, history window/snapshots): https://neon.com/pricing
9. Supabase Pricing (Free pausing after 1 week, no automatic backups on Free, Pro from $25/mo, compute add-ons): https://supabase.com/pricing
10. Amazon RDS Pricing (free tier structure/12 months or post-Jul-2025 credits): https://aws.amazon.com/rds/pricing/
11. Amazon RDS Pricing FAQ (per-second billing while running; stopped instances still billed for storage/backups): https://aws.amazon.com/rds/pricing/
12. Cloudflare R2 Docs — Pricing (10 GB free tier, $0.015/GB-mo, Class A/B rates, zero egress): https://developers.cloudflare.com/r2/pricing/
13. Amazon S3 Pricing (data transfer: first 100 GB/month to internet free; storage table rendered client-side — exact Standard rate **[unverified]**): https://aws.amazon.com/s3/pricing/
14. UploadThing Pricing (Free 2 GB shared; $10/mo 100 GB): https://uploadthing.com/pricing
15. Cloudinary Pricing (Free 25 credits/mo; credit = 1 GB storage or 1 GB bandwidth or 1,000 transformations; Plus $89–99/mo): https://cloudinary.com/pricing
16. Cloudflare Images Docs — Pricing (5,000 free unique transformations/mo; transforms of R2-stored images; $0.50/1,000 after): https://developers.cloudflare.com/images/platform/pricing/
17. UploadThing Docs (Next.js App Router adapter, file routes, UTApi; no transformation feature listed in docs index): https://docs.uploadthing.com/
18. Vercel Docs — Next.js on Vercel (native platform, zero-config SSR/ISR/Image Optimization): https://vercel.com/docs/frameworks/nextjs
19. Vercel Pricing (Hobby $0: 100 GB transfer, 1M edge requests, 4 hrs Fluid CPU, 5K image transforms, personal non-commercial use): https://vercel.com/pricing
20. Fly.io Resource Pricing (shared-cpu-1x 256 MB ≈ $2.02/mo, egress $0.02/GB NA/EU, certs, volumes): https://fly.io/docs/about/pricing/
21. Railway Pricing (Hobby $5/mo incl. $5 usage; $20/vCPU-mo, $10/GB-mo memory, $0.05/GB egress): https://railway.com/pricing
