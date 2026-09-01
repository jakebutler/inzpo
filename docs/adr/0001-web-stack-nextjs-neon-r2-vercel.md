# ADR-0001: Web stack — Next.js App Router · Neon · Cloudflare R2 · Vercel Hobby

**Status:** Accepted (wayfinder ticket [Research: web stack & managed services](https://github.com/jakebutler/inzpo/issues/3))
**Date:** August 2026

## Context

Inzpo is a single-user TypeScript web app: capture flows (URL fetch, image
upload), server-side color extraction (sharp), a media-heavy browse wall, and
advanced filtering over Postgres. Budget target $0–20/month, managed services
only, no self-hosting, mobile-friendly web output.

## Decision

| Slot | Pick |
|---|---|
| Framework | Next.js (App Router) |
| Postgres host | Neon (Free, then Launch) |
| Object storage | Cloudflare R2 (+ sharp at capture) |
| Deployment | Vercel (Hobby) |

Estimated **$0/month** at single-user scale; full comparison matrices with
primary-source citations in `docs/research/web-stack.md` (branch
`research/web-stack`).

**Rationale.** Next.js App Router primitives map 1:1 onto Inzpo's jobs:
Server Actions for capture mutations, Route Handlers for upload → process →
store pipelines and the authenticated media proxy, `next/image` for the Wall,
and a standardized sharp dependency. Neon has the only permanent free tier
with scale-to-zero and PITR-style history among the candidates (Supabase Free
pauses after one week idle; RDS has no permanent free tier). R2 offers 10 GB
free with zero egress fees — the cost category a photo-heavy vault grows
into. Vercel Hobby runs Next.js zero-config at $0.

## Alternatives considered

- **React Router v7 Framework Mode** — credible lighter-weight alternative;
  loses on the built-in image pipeline (sharp + resizing route + cache
  headers become DIY).
- **Vite + React SPA** — forces a separate secured Node backend for every
  server-side concern; most work of the three.
- **Supabase (DB only)** — 1-week inactivity pause on Free is a real UX risk
  for a rediscovery app; first paid tier jumps to $25/mo.
- **AWS RDS / S3** — RDS: no permanent free tier, 24/7 instance billing, most
  ops. S3: internet egress charges beyond 100 GB/mo; storage pricing could
  not be primary-source-verified.
- **UploadThing** — best upload DX but 2 GB free cap, no transform pipeline.
- **Cloudinary** — strong transforms, but consumption-shaped free tier and an
  $89–99/mo first paid plan.
- **Fly.io / Railway** — functionally fine fallbacks (~$2–6/mo); chosen if
  Vercel pricing/terms ever break. The app stays portable: `next start` on
  any Node host runs every feature.

## Consequences

- **Vercel Hobby is personal/non-commercial and usage-capped** (no overage
  purchase). Commercialization forces Pro ($20/mo) or a host move.
- **Neon Free suspends compute** when monthly limits hit (hard stop, not
  overbill); cold starts after ~5 min idle.
- **R2 does not transform images** — the design depends on capture-time sharp
  processing (ADR-0003's pipeline); Cloudflare Images (5,000 free unique
  transforms/mo) is the escape hatch for ad-hoc sizes.
- Pricing figures were fetched Aug 2026 — **re-verify before committing
  spend**.
