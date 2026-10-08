# Inzpo — Product (v4, pivot, steelmanned in the Inzpo room)

> Status: DRAFT for Jake's sign-off. Supersedes the v1 "design-inspiration
> vault" framing. `docs/spec/v1.md` and `CONTEXT.md` stay normative for
> anything this doc does not change.

## Value prop

**Steal the colors off anything.** (working line; Jake hasn't finalized it.
Earlier candidates: "Snap a house, keep its colors" and "keep its style.")

Take a photo of something you love. Inzpo pulls the colors that are actually
on it, shows you where each one came from, and saves them as named tokens you
can drop into your own work. A texture tile and a short brief that cites what's
in the photo come along as extras.

Promise only what a designer will check by holding the phone up to the thing.
"Brand kit" is reserved for the export, where it means something to a dev agent.

Origin: San Francisco houses with color schemes worth stealing. The promise
now covers murals, neon, socks, flowers — not just houses.

Feature test: does it get the Owner from photo to colors they trust faster?

## Users

- **Now:** Jake plus a handful of invited designer friends.
- **Not now:** public sign-up, teams, sharing between users.

## First screen (390px)

- One large **Snap something** button within thumb reach, a smaller
  **Pick a photo** next to it.
- Below them, one finished kit: a **sample kit** for new friends (untouched
  output from a photo that passes the palette bar, ideally not a house), or
  their **last kit**.
- Must not show: an empty library, collections, a filter bar, tags, or a login
  wall after the invite code is entered.
- The friend sees what they'll get before the camera permission prompt.

## Capture to kit: one result screen, progressive reveal

1. **Photo** on top. Resized on the phone to ~2000px before upload, and colors
   are extracted from that copy immediately.
2. **Palette** directly under it, instantly:
   - Swatches labeled by role and hex.
   - A **source pin** on the photo for every swatch.
   - Swatches from the sky and the edges of the frame are dropped.
   - Default roles: background is the largest wall color, and text is the
     darkest trim.
   - The **text-on-background contrast ratio** is shown on the palette
     (target ≥ 4.5:1).
   - Tap a swatch to open an **area-averaged eyedropper** and edit that token.
     Rename, reorder, and add sit behind that tap.
   - **Fixed role set** (primary, secondary, accent, background, surface,
     text). The editor owns roles.
3. **Brief** fills in when the model returns (GLM-5.3-flash on DigitalOcean
   inference; 20–36 s observed):
   - Leads with cited photo details ("cream clapboard against a dark green
     door"), followed by a few adjectives. Stock words are banned in the prompt.
   - The prompt forbids addresses and house numbers.
   - Describes only. It never sets roles.
   - **Save does not wait on it.** The friend saves once the palette and tile
     look right; the brief finishes into the saved kit afterward.
   - When the brief names a color the palette dropped, show a one-tap
     **"add this swatch"** chip, not a correction in the paragraph.
4. **Texture card**: the app picks a default crop aimed at the **subject**
   (not the most common color), and one tap moves it. When the crop is one
   flat color, hide the texture card.
   - A **seamless pattern tile** (mirror or offset blend), previewed repeated
     at real size, with token recolor. This is the MVP texture.
   - An **inspired SVG**: generated noise tinted with the palette (keep if
     cheap).
   - **Traced SVG is out of the MVP.** Test #53: 6 of 20 photos passed the
     full bar, all flat paint or murals. Offer as a phase-2 opt-in for those.
   - No perspective correction. Move the crop to a flatter spot instead.
5. **Save** pinned to the bottom: pick an existing collection or create one
   inline. Available as soon as palette and tile are ready; does not block on
   the brief.

## Export: the "brand kit" for a dev implementation agent

Lives on the **collection page**, not in the capture flow:
- `tokens.json`: W3C Design Tokens, with fixed roles and hex
- `tokens.css`: CSS custom properties
- `texture.svg` (wraps the tile) plus the tile PNG
- `brief.md`

## Success (first month)

A handful of designer friends using it.
- **Bar (decided):** 5 invited friends each save ≥3 photos within 2 weeks of
  their invite.
- Signal the promise landed: at least 2 friends use a palette in real work and
  tell Jake where.

## Quality bar

Ultra-polished, mobile-first (390px) design that a designer-focused app is
expected to have:
- Crisp micro-interactions and transitions.
- One clear primary action per screen.
- Just-in-time discoverability: hints appear when needed, not upfront tours.
- Respect `prefers-reduced-motion`.

The full checklist is in [docs/QUALITY-BAR.md](docs/QUALITY-BAR.md).

Design Critique (Critiquito) audits every screen from screenshots of every
state at 390px, plus recordings and the code's duration and easing for each
transition. Fix-and-re-audit rounds repeat until it signs off with no blockers
and nothing left worth fixing. Then the device-only checks must pass on Jake's
phone.

## Standing constraints

- **Phone-first** installable web app (PWA). Every flow is designed at 390px
  first.
- Stack unchanged: Next.js + Neon + Cloudflare R2 + Vercel, shadcn/ui, GSAP.
- **AI only for the brief.** Color extraction stays deterministic.
- **Invite-only logins via Clerk** in restricted mode (public sign-up off;
  Jake invites from the dashboard). Sign-in is our own form on Clerk's hooks:
  one field at a time (email, then code), Inzpo-styled, with
  `autocomplete="one-time-code"` so iPhone autofills the code from Mail. It's a
  **typed code, not a magic link**, because the home-screen app keeps separate
  logins from Safari. After the code, land on the Snap button.
  - An uninvited email gets: "Inzpo is invite-only. Check with Jake." It never
    reveals which email was invited.
  - Clerk **dev mode works on Vercel preview links** during the build. A
    domain Jake owns (with DNS records) is required only for production
    sign-in; `.vercel.app` won't work there.
  - Before each invite, Jake texts the friend a heads-up. Check whether Clerk
    lets us restyle the invite email before promising a kit in it.
- **Per-user data everywhere**, including the image server's ownership check.
  A single missed filter would leak a friend's photos.
- **React Native-ready**: logic sits behind API routes with JSON contracts.
  An Expo app (EAS to the App Store) comes later, as a front-end rebuild
  exercise.
- Copy-at-capture still holds. **Changed (decided):** we store the ~2000px copy, not
  the full original.
- **HEIC / color space (#56):** sharp on Vercel can't decode iPhone HEIC.
  Capture converts on the phone; the share sheet needs a server-side HEIC
  decoder. Convert Display P3 to sRGB through the embedded profile.

## Changes to the existing repo

| Area | Change |
|---|---|
| Auth | Clerk for invites and sign-in (replaces the jose single-owner token; share route and image server switch to Clerk's check; share-sheet stash-then-login flow must survive sign-in). Still ours: map the provider user id to an owner on every table (items, collections, boards, smart collections, tags), backfill Jake's rows, user filter on all ~77 DB calls, ownership check on the image server, per-user tag/facet uniqueness. **Largest and riskiest piece; must land before any invite.** Build on Vercel previews with Clerk dev mode; domain only at production. |
| Uploads (#56) | Client resize to ~2000px. Direct-to-R2 for the form **and the iPhone share sheet** (which sends full-size files). Server-side HEIC decode for the share sheet; P3→sRGB via embedded profile. |
| Link sharing | The share sheet and capture form still create link items that would be invisible. Show "Links aren't supported yet" and save nothing (decided). |
| URL / article / video kinds, facet filter bar, smart collections, tag step in capture | Hidden from the UI, kept in the data model |
| Reference boards (#38), find-more-like-this (#11) | Parked |
| Color table | Add name and role columns. Own pixel lookup for source pins (`node-vibrant` doesn't return locations; ~1 day). |
| Texture | MVP: seamless tile with token recolor. Inspired SVG if cheap. Traced SVG moved to phase 2 (opt-in for flat paint and murals). Default crop aims at subject; hide card on single-color crop. |
| Brand brief | New (first AI call). Non-blocking Save; "add this swatch" chip; no addresses in prompt. |
| Collections | Kept. Inline create at Save. Export moves here. |

## Build order (issues filed in this order)

1. **Two tests:** one photo through the brief model (confirm it accepts
   images; fallback is `nemotron-nano-12b-v2-vl`), and a **20-photo test**
   (#53) on Jake's sample set covering palette quality and the SVG trace.
   **#53 done:** traced SVG fails the bar (6/20); seamless tile stays.
   Palette: with fixes, text-on-background passes 4.5:1 on 19/20; sidewalk/sky
   still leak; small accents get dropped. Jake still marks the palette sheets
   against the 16-of-20 bar.
2. Clerk with invites (dev mode on previews; domain only at production),
   custom sign-in form, owner columns, user filters, image ownership check.
3. Palette quality: source pins, edge and sky filtering, area eyedropper,
   default roles, contrast.
4. Client resize plus direct-to-storage uploads (form and share sheet), with
   server HEIC decode and P3→sRGB.
5. Hide the other kinds. Remove the link and tag steps from capture.
6. Token editor (fixed roles).
7. Brief (non-blocking), then seamless tile, then export on the collection page.
8. Inspired SVG if cheap. Traced SVG is phase 2.

## Later (phase 2+)

- Traced SVG as an opt-in for flat paint and murals.
- Search open-source fonts and icon sets, and attach them to a collection.
- Add more images to a collection from web search (free image APIs) or camera.
- Expo app in the App Store.

## Decided (Oct 7, 2026)

- Store the ~2000px copy: yes.
- Link shares: "not supported yet."
- Success bar: 5 friends, 3+ photos each in 2 weeks.
- Auth: Clerk (restricted mode, typed email code). Dev mode on Vercel
  previews; domain only for production sign-in.
- Traced SVG out of MVP (6/20 in #53). MVP texture = seamless tile with token
  recolor. Traced = phase-2 opt-in for flat paint and murals.
- Default texture crop aims at the subject. Hide texture card on a
  single-color crop.
- Save does not wait on the brief (20–36 s). Brief finishes into the saved kit.
- Brief names a dropped color → one-tap "add this swatch" chip.
- Brief prompt forbids addresses and house numbers.
- First-screen button: "Snap something." Sample kit from a photo that passes
  the palette bar, ideally not a house.
- HEIC: capture converts on phone; share sheet needs server decoder. P3→sRGB
  via embedded profile.
- Quality bar ([docs/QUALITY-BAR.md](docs/QUALITY-BAR.md)): Critiquito audits
  every state, plus recordings and duration and easing for each transition.
  Rounds repeat until there are no blockers and nothing left worth fixing, then
  the device-only checks must pass on Jake's phone.

## Still open

- Value prop wording. Working candidate: "Steal the colors off anything."
  Earlier: "Snap a house, keep its colors" / "keep its style." Jake hasn't
  finalized.
- Inzpo's own domain for Clerk production (not needed until launch).
- Jake marks the #53 palette sheets against the 16-of-20 bar.
