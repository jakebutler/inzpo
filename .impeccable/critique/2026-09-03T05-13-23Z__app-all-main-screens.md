---
target: all main screens (wall, capture, detail, vocab)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Volumes/rexy/GitHub/inzpo-app/app/ (all main screens)"
timestamp: 2026-09-03T05-13-23Z
slug: app-all-main-screens
---
# Inzpo UX Critique — Wall + Capture + Detail + Vocab (as-assessed scores)

Method: dual-agent (A: design-review agent · B: detector/browser agent)

## Design Health Score: 25/40 (Acceptable) — post-fix batch 28/40 (Good)
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | auto-selected chip frozen at opacity 0 (fixed) |
| 2 | Match System/Real World | 3 | naming drift: Saved/Smart collections/saved searches |
| 3 | User Control & Freedom | 3 | no undo for deletes |
| 4 | Consistency & Standards | 1 | theme split: light tokens vs hardcoded dark (fixed) |
| 5 | Error Prevention | 3 | merge has no preview/confirm |
| 6 | Recognition over Recall | 3 | stance cycle + long-press undiscoverable (legend + mobile entry added) |
| 7 | Flexibility & Efficiency | 3 | power-user dense |
| 8 | Aesthetic & Minimalist | 2 | card overlay circles; sticky Save overlapped chips (both fixed) |
| 9 | Error Recovery | 2 | no undo; GSAP failure left invisible state (fixed via fromTo) |
| 10 | Help & Documentation | 1 | stance cycle documented nowhere (legend added) |

## Design specificity verdict
Half-authored: architecture unmistakably Inzpo (per-kind relevant trays, auto detection, duplicate notice, archived reader); surface was category-interchangeable due to the theme split (root cause: shadcn add overwrote layout.tsx, dropping the dark class — the .dark token block was unreachable).

## Priority issues
- [P0 fixed] theme split — dark class restored at root; tokens are the single source of truth
- [P0 fixed] auto chip stuck at opacity 0 — gsap.fromTo with explicit end state + E2E regression check on computed opacity
- [P1 fixed] sticky Save pill overlapped tray chips — opaque bottom bar
- [P1 partial] selection/stance discoverability — mobile Select entry + sheet legend added; screen-reader stance text still glyph-based
- [P2] naming drift (Saved/Smart collections/saved searches; Tags/Vocabulary)
- [P2 fixed] masonry read column-major — round-robin row-major columns; card overlay circles hidden on touch; touch targets >=36px in vocab; contrast tokens applied (neutral-500/600 -> muted-foreground)

## Strengths
- Copy voice ("tag if you feel like it", "saving again is fine")
- Relevance cascade is real product thinking, verifiably per-kind
- prefers-reduced-motion honored in every GSAP moment; live match counts make filtering tangible

## Detector/browser evidence
- detect.mjs: 1 finding (side-tab border) — false positive (article blockquote convention)
- Browser: 1.09:1 toolbar contrast and 1.00:1 active chips under light tokens (root-caused the dark class); www.example.com vs example.com normalization is spec-correct (no www canonicalization)
