# Inzpo — Product Context

## Product

Inzpo is a **single-user, web-based design-inspiration vault**. The Owner
saves design inspiration (six item kinds: URL, screenshot, photo, palette,
article, video) and — the core value — **finds "that thing I saved" again**
by style × usage × medium × palette. Filtering is the anchor; the browsing
Wall is the stage it plays on.

Derived from the approved build-ready spec (`docs/spec/v1.md`) and the domain
glossary (`CONTEXT.md`); both are normative.

## Users

Exactly one: the **Owner** — a designer collecting reference material for
their own work. Auth exists only to keep everyone else out. Single-user scale
(thousands of items, not millions), used a few times a week, roughly 50/50
phone/desktop, capture-heavy on phone.

## Jobs

1. **Capture** something inspiring in seconds — paste a link, drop an image,
   or share from the OS — with zero required input.
2. **Rediscover** it months later by facet, color, kind, or free-text search.
3. **Curate** — vocabularies, collections, saved searches — without the
   system demanding structure up front.

## Mechanism

Deterministic automation does the work at capture: kind detection, metadata
copy-at-capture, color extraction, duplicate awareness. The Owner never has
to fill anything in; structure (facets, tags) is offered, never demanded.

## Standing constraints

- Mobile-friendly from day one (not mobile-first); every flow verified at
  390px.
- Deterministic automation only in v1 — no AI tagging (post-MVP tooling
  already decided).
- ~$0/month managed stack: Next.js + Neon + Cloudflare R2 + Vercel.
- Items never depend on their source staying reachable (copy-at-capture; one
  live-render exception: platform video embeds).
- Component library: **shadcn/ui**; animation: **GSAP** (Owner direction).

## Surface modes (impeccable)

- Wall, Capture, Item detail, Vocabulary manager: **Operate** — task surfaces;
  scanability and feedback outrank expression; the brand lives in precise
  details.
- The capture detection cascade (preview → relevant facets → auto-tags) is
  the product's one authored motion moment.

## Open decisions

- Final visual-world pass (typography voice, accent identity) — Owner will
  judge on the redesigned capture flow first.
