# Inzpo code review — security and correctness (2026-09-14)

Scope: `main` at the time of review. Every finding below was traced end-to-end through the code path; the two sanitizer bypasses were reproduced by executing `sanitizeArticleHtml` against the payloads shown. Time-boxed (25 min), so priority-5 logic and priority-6 test gaps got a lighter pass than auth/SSRF/upload.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High     | 4 |
| Medium   | 7 |
| Low      | 9 |

## Top 5 to fix first

1. **C1** Stored XSS on the app origin via the archived-article sanitizer (comment/CDATA parser differential). `lib/article.ts`
2. **H1** "Select all" in a collection-scoped Wall resolves against the whole library; bulk delete can wipe everything. `app/actions/bulk.ts:13`
3. **H2** SQL injection in `mergeFacetValues` via `sql.raw` on form-supplied ids. `lib/vocab.ts:40`
4. **H3** Cold-start share-image capture always ends on "Capture failed" because `redirect()` is swallowed by `catch`. `app/capture/actions.ts:19-29`
5. **H4** Unauthenticated, unlimited, never-expiring writes to R2 through `/share` file stash. `app/share/route.ts:36-58`

---

## Critical

### C1. Archived article HTML: sanitizer can be bypassed with comment-closer differentials → stored XSS on the authenticated origin
- **Where:** `lib/article.ts:14-54` (`sanitizeArticleHtml`), rendered at `app/items/[id]/page.tsx:117` via `dangerouslySetInnerHTML`.
- **Defect:** The walker only visits `node.children` (elements). Comment, CDATA and processing-instruction nodes pass through untouched, and linkedom/htmlparser2 serializes them differently from how browsers re-parse them.
- **Reproduced:**
  - Input `<![CDATA[--><img src=x onerror=alert(1)>]]>` → output `<!--[CDATA[--><img src=x onerror=alert(1)>]]-->`. A browser closes the comment at the first `-->`, so the `<img onerror>` executes.
  - Input `<!-- a --!><img src=x onerror=alert(1)> -->` → output unchanged. Browsers treat `--!>` as a comment closer; htmlparser2 does not.
- **Scenario:** Attacker publishes a page with enough body text to be classified `article` (>= 800 chars, `lib/kind-guess.ts:40`) containing one of the payloads. Owner captures the URL (the app's primary use case is saving strangers' pages). Detail page renders attacker JS on the app origin with the session cookie in play: it can call every server action (bulk delete, tag rewrite), read the whole library through `/media/*`, and exfiltrate. Readability does not strip comments, so the payload survives extraction.
- **Fix (small):** strip every non-element, non-text node before/while walking, and do it on `childNodes`, not `children`:
  ```ts
  function walk(node: Element) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== 1) {            // 1 = element
        if (child.nodeType !== 3) child.remove(); // drop comments (8), CDATA (4), PIs (7)
        continue;
      }
      // ...existing element handling on `child as Element`
    }
  }
  ```
  Also add the two payloads above (plus `<!--<!-->…-->`, `<?xml -->…`) to `tests/article.test.ts`. Longer-term, consider a spec-compliant parser (parse5) or DOMPurify-on-jsdom; htmlparser2 is not an HTML5 tokenizer and will keep producing differentials.

## High

### H1. Bulk "select all" ignores the collection scope the user is looking at
- **Where:** `app/actions/bulk.ts:13-22` (`resolveIds`), `app/components/WallGrid.tsx:96-101, 236-242`, `app/page.tsx:26-31`.
- **Defect:** The page counts and renders with `buildWallQuery(state, collectionId)`, but `hiddenTarget` sends only `all=1` and `f`; the server re-resolves with `buildWallQuery(state)` and no collection.
- **Scenario:** Owner opens a 5-item collection with no filters, long-presses, taps "Select all", confirms "Delete all 5 items?". `bulkDeleteAction` deletes every `ready` item in the library. Same leak applies to bulk tag assign/remove and add/remove-from-collection.
- **Fix:** carry `c` (collection id) in the hidden form fields and pass it to `buildWallQuery(state, collectionId)` in `resolveIds`; validate with `collectionExists` as `app/page.tsx` does.

### H2. SQL injection in `mergeFacetValues` via `sql.raw`
- **Where:** `lib/vocab.ts:40`
  ```ts
  .where(sql`${facetValues.id} = any(${sql.raw(`array['${all.join("','")}']::text[]`)})`)
  ```
- **Defect:** `survivorId` and `mergeIds` come straight from `FormData` (`app/vocab/actions.ts:36-44`) and are string-interpolated into raw SQL.
- **Scenario:** `survivorId = "x'] ) or true) -- "` (or any `'`-containing value) alters the statement. Requires a session, but any XSS (see C1) or a crafted request from the owner's browser reaches it, and it should never have been raw in the first place.
- **Fix:** `.where(inArray(facetValues.id, all))` from drizzle, or `sql\`${facetValues.id} in (${sql.join(all.map(id => sql\`${id}\`), sql\`, \`)})\``. Also guard `mergeValueIds.length === 0` (after the survivor filter) to avoid `in ()`.

### H3. Cold-start share capture: `redirect()` thrown inside `try` is swallowed by `catch`
- **Where:** `app/capture/actions.ts:18-30`.
- **Defect:** In Next 15 `redirect()` throws `NEXT_REDIRECT`. Line 26's success redirect is inside the `try`; the bare `catch` at line 27 catches it and redirects to `/capture?error=capture-failed`.
- **Scenario:** Share an image while logged out → login → capture form submits with `shareToken` → item is created, tags attached, tmp object deleted → user sees "Capture failed — try again", retries, and gets a genuine failure (tmp object is gone) — or re-shares and creates a duplicate.
- **Fix:** move the `revalidatePath`/`redirect` after the `try/catch`, or `catch (err) { if (isRedirectError(err)) throw err; ... }` (`import { isRedirectError } from "next/dist/client/components/redirect-error"`). Note `tests/e2e-share.mts` exists but does not cover this branch.

### H4. Unauthenticated, unlimited, never-expiring R2 writes through `/share`
- **Where:** `app/share/route.ts:36-58` (`saveStashedImage`), excluded from middleware by `middleware.ts:16`.
- **Defect:** Any anonymous POST with `multipart/form-data` and an `image` part ≤ 25 MB is written to `tmp/<ulid>.<ext>`. No rate limit, no per-IP cap, no TTL, and nothing ever deletes the object unless the owner completes the capture (`app/capture/actions.ts:24`).
- **Scenario:** `for i in $(seq 1 10000); do curl -F image=@25mb.bin https://vault/share; done` → 250 GB in R2, storage + Class A op charges, plus function-time cost. No session required.
- **Fix:** (a) only stash when the request carries a signed-but-expired session cookie (proves it is the owner's device): verify signature with `jwtVerify(..., { currentDate: new Date(0) })`-style tolerance or decode+HMAC check; (b) add an R2 lifecycle rule expiring `tmp/` after 24 h; (c) drop the cap to ~10 MB and apply the login rate limiter keyed by IP. (a)+(b) together close it.

## Medium

### M1. SSRF: DNS-rebinding TOCTOU between `assertPublicHost` and `fetch`
- **Where:** `lib/ssrf.ts:33`, `lib/fetch-url.ts:19-24`.
- **Defect:** The host is resolved once for the check, then `fetch` (undici) resolves it again. A hostname with a 0-TTL record can answer public on the first lookup and `10.x`/`169.254.169.254` on the second.
- **Scenario:** Owner captures `http://rebind.attacker.tld/` → first lookup 1.2.3.4 (passes), fetch connects to 169.254.169.254 (or any internal service reachable from the function) and the response body is scraped/stored (title, og:image).
- **Fix:** resolve once and connect to the pinned address: use an undici `Agent({ connect: { lookup: checkedLookup } })` where `checkedLookup` calls `dns.lookup` and rejects private results, and pass it as `dispatcher` to `fetch`. Also cover every redirect hop (already looped).

### M2. Fetch timeout only covers headers; body read is unbounded in time
- **Where:** `lib/fetch-url.ts:20-31, 44-62`.
- **Defect:** `clearTimeout(timer)` fires as soon as `fetch` resolves (headers). `readCapped` then reads with no deadline; a server drip-feeding 1 byte/s under 5 MB holds the function for its max duration.
- **Fix:** keep the controller alive through `readCapped` (start the timer before fetch, clear it after the body is consumed), or `AbortSignal.timeout(TIMEOUT_MS)` passed through both.

### M3. sharp decompression-bomb exposure; image decoded four times
- **Where:** `lib/media.ts:21-41`.
- **Defect:** No `limitInputPixels` (sharp default is ~268 MP) and `sharp(input)` is re-instantiated per variant plus placeholder, so a 16 000 × 16 000 PNG (~100 KB on disk, ~1 GB RGBA) is decoded four times sequentially.
- **Scenario:** Owner drops such a PNG (or captures a URL whose og:image is one) → OOM on the Vercel function, item left in `preparing` if the crash lands between inserts.
- **Fix:** `sharp(input, { failOn: "error", limitInputPixels: 40_000_000 })` everywhere, and build one base pipeline then `.clone()` per variant.

### M4. Login rate limiter is per-instance memory; ineffective on Vercel and grows unbounded
- **Where:** `lib/auth/ratelimit.ts`, `app/login/actions.ts:16`.
- **Defect:** `failures` is a module-level `Map` in a serverless function: multiple concurrent instances each have their own counter, cold starts reset it, and keys are never pruned.
- **Scenario:** Brute-force spread across instances sees far more than 10 attempts / 5 min; ADR-0004 describes the limit as a real control.
- **Fix:** persist attempts in Postgres (`login_failures(ip, at)`, count window on read) or use a Vercel Firewall rate-limit rule on `POST /login`. Prune old entries when recording.

### M5. Passphrase rotation does not invalidate existing sessions
- **Where:** `lib/auth/session.ts:6-8`, ADR-0004 ("rotation and recovery are the same act").
- **Defect:** Sessions are bound only to `AUTH_SESSION_SECRET`; changing `AUTH_PASSPHRASE` leaves any previously minted 180-day cookie valid.
- **Fix:** derive the signing key from both: `sha256(AUTH_SESSION_SECRET + "\0" + AUTH_PASSPHRASE)`, or embed `sha256(passphrase).slice(0,8)` as a claim and check it in `verifySessionToken`.

### M6. Multi-step mutations are not transactional
- **Where:** `lib/vocab.ts:38-86` (merge: update → delete → delete → rewrite saved), `lib/vocab.ts:128-171` (promote), `lib/capture-url.ts:103-118` (items then item_sources), `app/actions/bulk.ts` (loops), `app/items/[id]/edit/actions.ts:40-42` (delete tags then re-attach).
- **Scenario:** Merge fails after the repoint but before deleting the merged values → duplicates remain and saved searches are not rewritten; edit fails between the deletes and `attachTags` → item loses all tags.
- **Fix:** wrap each in `db.transaction(async (tx) => …)` (Neon HTTP driver needs the WebSocket/`neon-serverless` driver or `drizzle-orm/neon-http` batch; confirm `lib/db` driver supports it).

### M7. Media proxy sends `Content-Length: ""` when R2 omits the length
- **Where:** `app/media/[...key]/route.ts:48`.
- **Defect:** `String(result.ContentLength ?? "")` emits an empty header value, which some runtimes reject or mis-frame; images show up truncated or fail to stream.
- **Fix:** only set the header when `ContentLength` is a number.

## Low

- **L1** `lib/filter.ts:63` double-decodes: `parseFilterParam` calls `decodeURIComponent` on a value Next has already decoded. A search like `50% off` throws `URIError` and silently resets the whole filter; `100%25` becomes `100%`. Decode only in the client path, or `try` the decode and fall back to the raw string.
- **L2** `lib/ssrf.ts:4-23` blocklist gaps: no 224.0.0.0/4, 240.0.0.0/4, 198.18.0.0/15, 192.0.0.0/24, IPv6 `fec0::/10`, `2002::/16`, `64:ff9b::/96`, `2001::/32`. IPv6 literals in URLs are currently rejected only by accident (`hostname` keeps brackets so `isIP` returns 0 and the DNS lookup fails). Use a maintained matcher (e.g. `ipaddr.js` `range()`), and strip brackets before `isIP`.
- **L3** `lib/items.ts:130-133` `deleteItem` removes R2 objects before the DB row; if the delete fails after R2 succeeds you get a `ready` item with 404 media. Delete the row first, then best-effort `deletePrefix`.
- **L4** `lib/vocab.ts:88-93, 121-126` removing a facet value / free tag leaves saved searches referencing it (the rewrite is a no-op); they silently match nothing. Filter the stale selection out in the rewrite.
- **L5** `lib/vocab.ts:21-36` rename does not check for a case-insensitive collision with another value in the same facet; the DB unique index is case-sensitive, so `Blue`/`blue` can coexist while every lookup uses `lower()`. Detect and route to merge.
- **L6** `app/api/duplicate-check/route.ts`, `app/api/filter-count/route.ts` have no in-handler auth; they are protected only by `middleware.ts`'s matcher. Fine today, but `/api/preview` and `/media` do check explicitly. Add the same two-line check for defense in depth.
- **L7** `lib/auth/session.ts:7`, `lib/r2.ts:9-13`: no startup validation of `AUTH_SESSION_SECRET` / `AUTH_PASSPHRASE` / R2 vars. A missing session secret makes `TextEncoder.encode(undefined)` an empty key (login 500s). Assert length ≥ 32 at module load.
- **L8** `app/items/[id]/page.tsx:38,101-105` the oEmbed iframe `src` is regex-extracted from provider HTML and not checked to be `https:`; the sandbox grants `allow-scripts allow-same-origin` (normal for cross-origin, but pointless if src were ever same-origin). Assert `new URL(src).protocol === "https:"` and a provider host allowlist.
- **L9** `lib/fetch-url.ts:75` `fetchImageBytes` accepts `application/json` bodies as "image" bytes; harmless (sharp rejects) but confusing. Drop the `json` branch.

## Test gaps (priority 6)

No tests exist for: `lib/ssrf.ts` (private-range matcher, IPv6, DNS results), `lib/fetch-url.ts` (redirect-to-private, byte cap, non-http scheme), `lib/wall-query.ts` (any-of within / AND across / exclude semantics), `lib/vocab.ts` (rename/merge/promote propagation into saved searches), `app/actions/bulk.ts` `resolveIds` (select-all scope), `app/share/route.ts` (unauth stash, param preservation), `app/capture/actions.ts` (shareToken branch, which would have caught H3), `app/media/[...key]/route.ts` (key allowlist, unknown key → 404), `middleware.ts` matcher (which paths are gated), and `lib/filter.ts` parse/serialize round-trip (which would catch L1). `tests/article.test.ts` should gain the comment/CDATA differentials from C1.

## What is notably well done

The auth core is small and correct: HS256 via `jose` with a `sub` check, `httpOnly`/`Secure`/`SameSite=Lax` cookie, SHA-256-then-`timingSafeEqual` passphrase compare (fixed-length, so no length leak), and `validateRelativePath` correctly blocks `//`, backslash, `://` and control characters. The middleware matcher gates `/api/*` and `/media/*` by default rather than opting in. The media proxy verifies the key against `media_assets`/`item_sources` before touching R2 (no traversal or enumeration), serves with `nosniff` and a `default-src 'none'` CSP, and uses the sharp-detected mime rather than the upload's. SSRF handling follows redirects manually and re-validates every hop, blocks non-http schemes, caps bytes at 5 MB, and the ontology/wall-query SQL is parameterized throughout (`sql.join` of bound values) apart from H2. The article sanitizer's element-level logic (drop dangerous tags, strip all attributes, allow only `https?://` hrefs, unwrap unknowns after sanitizing children) is sound; only the non-element node handling needs fixing. Item deletion cascades are correct: `origins.originItemId` cascades the pointer row, not the derived item, matching spec §2.4.
