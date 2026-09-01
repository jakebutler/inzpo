# ADR-0003: Copy-at-capture for Source media and article text — never hotlink

**Status:** Accepted (wayfinder tickets [Research: media pipeline & color extraction](https://github.com/jakebutler/inzpo/issues/4), [Rich article & video capture depth](https://github.com/jakebutler/inzpo/issues/12))
**Date:** August 2026

## Context

A design-inspiration vault must outlive its sources: og:image URLs are
frequently signed/expiring or referer-checked; pages get paywalled, moved, or
redesigned; videos go private or deleted. The glossary states the invariant —
an Item "never depends on the source staying reachable or unchanged." The
question was how far copying goes in v1, given each copied byte costs storage
and capture-time CPU.

## Decision

At capture, copy the substance **into the vault**; render only copies:

- **Preview/poster images** — download the metascraper/oEmbed image bytes at
  capture and run them through the standard sharp → derivatives → palette
  pipeline. Never render a hotlinked source URL in the UI. (Provenance URL may
  be retained in the DB.)
- **Article body** — readability-extract a sanitized HTML copy from the HTML
  already fetched for metascraper; store at `items/{ulid}/article.html`.
  Text-level structure only; images/iframes/scripts/styles stripped. Read-only
  capture-time substance.
- **Video is the one live-render exception**: platform videos play in-app via
  a sandboxed oEmbed iframe that streams from the source **while it lasts**;
  the copied poster and link are what survive.
- **Extracted colors** are persisted as hex in the DB at capture; filtering
  queries stored colors, never re-extracts.

## Alternatives considered

- **Hotlinking previews** — rejected: signed/expiring URLs break cards over
  time; hotlink protection and referer checks make it worse. This is the
  single most important design decision in the media slot: copies are
  load-bearing.
- **Hotlinked inline article images** — rejected: exactly the live dependence
  the vault exists to avoid, and pulling every article image through the
  sharp pipeline is scope creep. Sanitized text-level structure was chosen
  over plain text, which loses the structure that makes a design article
  readable.
- **Self-hosting video / frame-grab posters (ffmpeg)** — rejected for v1:
  infeasible on Workers, unnecessary on Lambda; the platform serves the player
  for $0, and the user-replaceable preview is the "different frame" escape
  hatch.
- **Re-fetch on view** — rejected: display never re-fetches the source; a
  failed capture leaves a valid metadata-only Item, and "want the text,
  capture the URL again."

## Consequences

- The vault is **archival**: cards, posters, and article reads keep working
  after sources die. ~$0 — KBs of text and compressed derivatives inside R2's
  free tier.
- Capture does more work (fetch + extract + sanitize + derive); accepted at
  single-user scale, with the "unfetchable but saved" metadata-only fallback
  as the universal degradation path.
- SPA pages without server-rendered OG tags get no preview in v1 (headless
  rendering explicitly deferred).
- Storage layout (`items/{ulid}/…`), the DB as metadata source of truth, and
  deletion-by-prefix all carry this decision; serving rides the authenticated
  media proxy (ADR-0004).
