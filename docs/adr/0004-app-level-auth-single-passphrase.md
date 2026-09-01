# ADR-0004: App-level auth — single passphrase, rolled-minimal session, media inside the perimeter

**Status:** Accepted (wayfinder ticket [Auth for a single user](https://github.com/jakebutler/inzpo/issues/9))
**Date:** August 2026

## Context

Inzpo is a personal vault: one **Owner**, no other users, ever (multi-user is
out of scope). The app holds the Owner's private library and serves its images
from R2. The assumed deployment is Vercel Hobby, where — the reframing fact —
Deployment Protection covers only preview/deployment URLs; **production
domains stay public** (Password Protection is Enterprise/Pro-add-on only). No
zero-code platform gate exists at this budget.

## Decision

- **The gate is app-level: a single high-entropy passphrase** in an env var,
  timing-safe-compared at login. No username, no user table, no email
  round-trip. Rotation and recovery are the same act: change the env var,
  redeploy.
- **Roll minimal, no auth toolkit**: Next.js middleware + `jose`-signed
  session cookie + one login route (~100 lines). Toolkits manage many
  users/providers and add concepts with nothing to manage for one human. No
  new services, $0/month.
- **Stateless session**: `httpOnly` `Secure` `SameSite=Lax` cookie, **fixed
  180-day expiry**; logout clears the cookie. No session table, no device
  management. Login UX: single passphrase field (autofill-friendly), generic
  error message, light rate limiting (in-app counter or Vercel Firewall rule).
- **Media sits inside the perimeter**: the R2 bucket stays **private**; every
  image is served through an authenticated Route Handler (the media proxy)
  with private cache headers. This refines, not replaces, the media pipeline:
  storage and derivative layout are unchanged (ADR-0003).
- **Login preserves the destination**: the redirect returns to the original
  path **including query params**, so a share-target capture opened mid-expiry
  lands pre-filled after the login round-trip. The redirect target is
  validated as a **same-origin relative path** — no open redirect.

## Alternatives considered

- **Platform gate (Vercel Password Protection)** — unavailable: Pro add-on /
  Enterprise only; Hobby production domains are public.
- **Auth toolkit (NextAuth/Auth.js, Clerk, …)** — rejected: multi-user
  concepts (users, providers, callbacks, adapters) with nothing to manage at
  n=1; extra service or dependency for $0 benefit.
- **Cloudflare Access in front of the app** — not chosen: adds a second
  platform and DNS/infra coupling to what a ~100-line middleware already
  covers at this scale.
- **Per-image signed URLs from R2** — rejected: short-lived signed URLs break
  Image caching and share nothing with the app session; the authenticated
  proxy is simpler and keeps cache headers under app control.
- **Expiring/rolling sessions + device management** — deferred: additive
  later; v1 fixes a simple 180-day stateless cookie.

## Consequences

- One secret to protect (the env var); losing it means changing it and
  redeploying — the same act as rotation.
- Every media byte transits app compute (proxy), not a public bucket/CDN
  direct path — fine at single-user traffic; revisit only if delivery volume
  ever matters.
- The share-target front door depends on the destination-preserving redirect
  (spec §9.5); any future auth change must keep that property.
