# Inzpo pivot: recovered context and UX direction

Research snapshot: October 9, 2026. This is an evidence and planning document, not a release sign-off or a replacement for PRODUCT.md. Repository application code was not changed during this investigation.

## Current intent

The user's current request defines the product as a mobile-first creative inspiration loop:

**Notice something inspiring → take or pick a photo → Baku draws out its colors → receive a palette and description → keep the inspiration → return for another discovery.**

Later expansion: a broader brand identity, including free-source fonts, photo-derived SVG texture, icon choices, and a brand identity brief. These are future scope in the current request, even where an older branch already experiments with texture or exports.

The quality of the experience is part of the value proposition. The central transformation, transitions between screens, and small responses to touch should feel detailed, playful, and intentionally made.

Confirmed directly by the user on October 9:

- Expo Go on iPhone is the primary delivery surface; web supports it. Continue focusing on mobile.
- The payoff is saving inspiration to use in products, apps, and creative projects.
- Akaya Kanadaka is the selected headline font.
- The latest supplied Grok Engineering screenshot is the v6 report for `4d93df0`, with v7 still described as forthcoming. It supplies no newer EAS identifier. The previously recovered `4825602` remains evidence of v7 source code, not proof of native delivery.

Authority used in this document:

1. The user's current request and direct user feedback in the two Baku chats.
2. Current source code and GitHub branch/PR state as evidence of implementation.
3. Grok screenshots and repository documents as historical product/design evidence.
4. Recommendations below are proposals, not decisions the user has already made.

## Where the work actually lives

| Work | Verified location | State at inspection |
| --- | --- | --- |
| Existing inspiration vault | `main`, `c65a325`; `/Volumes/rexy/GitHub/inzpo-app` | Clean before this research document. README and PRODUCT still describe the old single-user vault. |
| Older capture prototype | `/Volumes/rexy/GitHub/inzpo`, `prototype/capture-ux`, `d556a59` | Separate worktree. Untracked `HITL_kickoff_items.md` preserved. |
| Pivot product document | [PR #52](https://github.com/jakebutler/inzpo/pull/52), `product/pivot-photo-to-palette`, `0a20c79` | Open. Describes phone-first photo-to-palette, but still schedules native Expo for later. |
| Web pivot and backend | [PR #61](https://github.com/jakebutler/inzpo/pull/61), `cursor/inzpo-pivot-mvp-a89b`, `0dce5f0` | Open; GitHub reported merge state CLEAN. |
| Visual work merged into pivot | [PR #62](https://github.com/jakebutler/inzpo/pull/62) | Merged into the pivot branch, not main. |
| Expo application and mobile API | [PR #63](https://github.com/jakebutler/inzpo/pull/63), `cursor/inzpo-expo-scaffold`, `4825602` | Open; base is the pivot branch; GitHub reported merge state DIRTY. Much more than an initial scaffold. |
| Older native animation spike | `cursor/inzpo-munch-spike`, `69e64e1` | Stand-in atlas playback. Not the new web Baku performance. |
| New Baku performance | `codex/baku-palette-performance`, `bb16e1e`, in the separate checkout below | Six local commits based on old main. Clean at inspection; not present in the fetched origin branches or open PR list. |

New Baku checkout:

`/Users/jacobbutler/Documents/Codex/2026-10-09/files-pasted-by-the-user-build/work/inzpo`

The web and mobile branches diverge from `2dbf938`: web has 38 unique commits and mobile has 17. Their overlapping source changes include extraction, token handling, item handling, brief generation, naming, middleware, and tests. The conflict is not merely a presentation-layer issue.

The GitHub checks visible on #61 and #63 were Vercel and GitGuardian checks. Their success does not establish current native behavior, physical-device performance, or design acceptance.

## Reconciliation with the Grok screenshots

The screenshot's revisions are recoverable:

| Screenshot reference | Current Git evidence |
| --- | --- |
| v4, `2855647` | Present: `mobile: v3 polish round` |
| v5, `896f480` | Present: `mobile: v4 fix round` |
| v6, `4d93df0` | Present: `mobile: v5 pins and tilt` |
| Planned v7 naming and 375px Keep fixes | Present in later `4825602`: `mobile: v7 kit name + keep 375` |

The final commit changes kit naming, brief prompting/request settings, Keep layout measurements, and related tests. This establishes that the code was pushed; it does not establish that the pictured v7 native build was delivered or visually accepted.

Not found in the fetched mobile tree: `STATUS.md`, `expo-live/`, `MOTION-NATIVE.md`, `VISUAL-V2.md`, or the referenced mock files. Paths under Grok's `/workspace/` are not paths on this Mac. The mobile tree does contain `MOTION-TODO.md`, `docs/ui-v2-pass-1.md`, `docs/ui-v2-pass-2.md`, implementation, tests, and art assets.

The mobile handoff documents predate some current code. For example, pass 2 describes the main Keep field as a new-collection name; the current KeepScreen has a distinct editable kit name and collection selection. Treat the documents as history and verify each relevant claim in current source.

The expanded physical-material craft bar is on the web pivot branch. The mobile branch's `docs/QUALITY-BAR.md` still contains the shorter earlier checklist, despite implementing several of the newer ideas.

## The latest Baku direction

Recovered from the chats **Create Baku palette animation** (`01a121ed-8a85-7a42-bb9b-2da1c9f62ce6`) and **Build Baku’s palette animation** (`01a12212-6b7b-7fb0-90c1-eab88581c38b`).

Direct user direction:

- Begin with grayscale/monotone knit on Baku's back.
- Reach the trunk toward the photo and inhale its color essence; the belly fills.
- Chew with visibly full, moving cheeks.
- Fill the back using the generated palette, following the actual curved knitted sections and darker stitched separations.
- Sneeze with squeezed-shut eyes and an extending trunk that flares slightly at the tip.
- Swatches clearly emerge from the moving nostril in an organized stream, then land in their final positions.

This supersedes the older Grok bite-photo/cow-chew/swallow description for the central performance. The Grok requirement for a true 3D model is not independently reaffirmed by the current user request. The user described the newer 2.5D study as “getting very close,” followed by specific seam-alignment feedback.

The local implementation uses reference-based felt artwork, a deforming WebGL mesh, GSAP timing, expression patches, and a material map for six physical knit panels. It recolors at runtime; it does not generate a fresh character image for every photo. Its sequence lasts approximately 4.2 seconds when data is ready; slower extraction adds bounded chew cycles. It includes skip, cancellation, replacement uploads, error states, and reduced motion.

Important integration limits:

- This is a DOM/WebGL/GSAP implementation, not a React Native component.
- It uses the old `extractColors` pipeline and old app auth, whereas the pivot uses region-based palette extraction, fixed nullable roles, source coordinates, and Clerk.
- The study emits the full extracted list, sometimes seven colors. The pivot presents six named roles that can be empty. The mapping between palette values, six physical fabric sections, and final chips must be explicit; never add a fake output color just to fill a fabric panel.
- The final landing positions must belong to the actual result interface. Replacing the animation with a looping GIF would lose runtime recoloring and continuity into interactive chips.
- The previous chat reports 167 passing tests and a successful build. Those suites were not rerun in this context-gathering pass.
- The prior delivery explicitly did not verify vault persistence or performance on low-end physical phones.

I inspected the current local study at [localhost:4317/baku-study](http://localhost:4317/baku-study) and its rendered Baku during anticipation. I also inspected the saved contact sheet of the knit-aligned performance. This was a visual context check, not a full new motion audit.

Useful retained artifacts:

- [Technique and verification notes](/Users/jacobbutler/Documents/Codex/2026-10-09/files-pasted-by-the-user-build/work/inzpo/docs/baku-animation.md)
- [Latest GIF](/Users/jacobbutler/Documents/Codex/2026-10-09/files-pasted-by-the-user-build/outputs/baku-palette-knit.gif)
- [Contact sheet](/Users/jacobbutler/Documents/Codex/2026-10-09/files-pasted-by-the-user-build/work/baku-knit-final-sheet.png)
- [Source archive](/Users/jacobbutler/Documents/Codex/2026-10-09/files-pasted-by-the-user-build/outputs/inzpo-baku-source.zip)
- [Editable artwork archive](/Users/jacobbutler/Documents/Codex/2026-10-09/files-pasted-by-the-user-build/outputs/baku-editable-assets.zip)

## What is already implemented

### Web pivot and backend

The branch includes Clerk invite-only authentication and owner-scoped data, resized photo uploads directly to R2, region-based color extraction with source positions, fixed color roles, token editing, contrast guidance, asynchronous descriptions, kit naming, collections, and export code. Existing URL/article/video capture and older organization features are hidden or parked rather than removed from the data model.

Descriptions use a configurable DigitalOcean model; source defaults to `glm-5.3-flash`. This is a code/configuration observation, not verification of today's deployed provider configuration or latency.

Historical product rules worth retaining unless changed: deterministic colors, descriptions based on visible photo details, no invented addresses, empty roles remain empty, Save does not wait for the description, and the camera permission prompt follows an intentional capture tap.

### Native app

At `4825602`, package.json specifies Expo 57, React Native 0.86.3, Expo Router, Reanimated 4.5.1, Skia 2.6.2, Clerk Expo, and Gorhom sheets. These are repository versions, not a claim about newest available versions.

The native tree contains:

- Email/code login and system camera/library selection.
- JPEG conversion and resize to a 2048px long edge; presign → upload → create-kit API flow.
- Waiting photo and stand-in Baku atlas playback.
- Film-print result, physical paint chips, source pins, an arrow to Primary, and printed description.
- Chip lift/flip details with hex, source crop, and contrast information.
- Candidate/hex editing and clear-role controls.
- Full-screen Keep with kit name and collection selection.
- Saved fan-deck composition and a read-only collection screen.
- Paper grain, contact/ambient shadows, button press treatments, haptic helpers, reduced-motion paths, and some Dynamic Type adaptations.

Current typography includes Akaya Kanadaka headings, Geist body, Geist Mono codes, and Caveat handwriting. The user has now confirmed Akaya Kanadaka as the headline choice; the earlier screenshot's font alternatives are superseded.

### Delivery evidence

The mobile config identifies EAS project `529d6681-6398-4009-adff-18b6bb5a6108`, owner `jakebutler`, and update URL `https://u.expo.dev/529d6681-6398-4009-adff-18b6bb5a6108`.

The screenshot mentions EAS group `960c624f` for `4d93df0`. No live EAS update inventory or physical-device build was verified in this pass.

The [PR #63 web preview](https://inzpo-git-cursor-inzpo-exp-716674-butlerjake-gmailcoms-projects.vercel.app) rendered its login page during inspection. This is the Next.js app built from the mobile branch, not a rendering of the native Expo UI.

## Gaps that materially affect the proposed experience

| Gap | Source evidence | Consequence |
| --- | --- | --- |
| Palette reveal and Save wait on the description | Mobile `kit/[id].tsx` sets `ready` only when brief is no longer pending or polling has failed; chips/actions are conditional on `ready`. `use-kit.ts` polls with a 60-second timeout. | The main reward is delayed by optional prose; contradicts the non-blocking Save product rule. |
| The invitation still targets houses | Native home says “A house worth keeping,” “Bring its colors home,” and “Snap a house”; permission and image accessibility copy also mention houses. | The opening promise does not match general creative inspiration. |
| First-use proof is missing from native home | Native index has copy, Baku, and capture buttons, without the sample/last kit described in PRODUCT. | A new user must act before seeing the concrete payoff. |
| The central sequence is still fragmented in native | Capture/result use `MunchPlayer`; result chips use `useResultSequence`; corner Baku uses different art. | No continuous inhale → knit color → sneeze → final chip landing exists in the native flow. |
| Source provenance can be invented by presentation | `result-pins.ts` falls back to fixed reference-photo coordinates when a role lacks valid matching pins; ChipDetail still says “From this spot.” | Manual or legacy colors can be presented as if they came from a particular real pixel. |
| Pin editing has not reached native parity | Native pin presses open the editor; current editor offers candidates/hex/Clear. Handoffs also identify native drag/loupe sampling as absent. | Source-level color correction available in web is not yet the same mobile interaction. |
| Upload recovery is weak | Native failure returns to generic error and the camera/library buttons; current `pick` path starts selection again. | The retained photo is not offered as an obvious retry target after failed upload. |
| Mobile backend target is ambiguous | The default mobile API base is the web-pivot preview URL; that branch has no `app/api/mobile` routes. An `EXPO_PUBLIC_API_BASE_URL` override may fix deployed builds. | Verify the actual EAS build-time base URL before judging any native/backend failure. |
| Native collection experience ends early | Collection route is a read-only list; export/share UX is not wired into the native route. | The return/use loop needs an explicit next payoff. |
| Quality documentation has diverged | New craft gates are only on web; referenced native motion/visual specs and captures are absent. | There is no single reliable acceptance contract for the integrated app. |

These are source-grounded findings. Native rendering, gesture feel, haptics, and device memory were not exercised here.

## Proposed interaction contract

Preserve the material world already established: film prints, paint-chip card stock, a riveted fan deck, a separate description card, and felt/knit Baku. One consistent light direction and restrained interface color let the user's photo supply the vivid color.

| Moment | User benefit and proposed response |
| --- | --- |
| First open / return | Show what one photo becomes. Put capture in thumb reach; show a sample or recent kit as an invitation. |
| Camera / library | Immediate press response; contextual permission explanation; cancellation returns to the same place. |
| Photo accepted | Keep the user's actual image visible; carry it into the performance without a blank frame or unrelated loading screen. |
| Inhale | Baku starts neutral, reaches toward the photo, and visibly draws its color essence into the knit. |
| Processing | Cheek movement carries real work; no pretend progress percentage. Description processing is independent of palette readiness. |
| Sneeze and reveal | Actual palette colors leave the flared nostril and become the same chips the user can touch. Avoid duplicate chips or a hard cut to another result layout. |
| Explore / correct | A chip lifts or flips; source information is truthful; changes visibly connect the photo sample to its chip. Baku yields space to the work. |
| Keep | Preserve spatial continuity as the chips gather into a deck. Keep naming and collection decisions light. |
| Saved | A satisfying settled object, concise acknowledgement, and a clear route to reuse or another capture. |
| Errors / offline / background | Preserve the photo and edits; give a specific recovery action. Keep the tone plain when something fails. |
| Reduced motion | Deliver the same information and payoff through quick fades/static states; do not require flight, tilt, haptics, or character movement to understand the outcome. |

The ordinary touch and navigation transitions should stay quick. The signature performance can be longer while remaining skippable once real colors exist. Do not let a fixed animation duration hold Save hostage.

The old blanket “nothing over 500ms” rule and the later multi-second Baku showpiece need an explicit exception, as do inconsistent historical haptic rules. Visual acceptance should cover continuous recordings and interrupted/error states, not only isolated stills or a screenshot count.

## Recommended next implementation milestone

One coherent native vertical slice: **home → pick/capture → Baku → real palette and description → keep → saved → capture again**.

1. Establish a clean integration branch from the recovered work, preserving both branch histories and the separate Baku checkout. Resolve overlapping extraction/naming/API changes deliberately.
2. Confirm the build-time native API target and current EAS update. Reproduce one existing complete save journey before changing its visuals.
3. Separate palette, description, persistence, and animation readiness. Fix source-pin honesty and photo retry while the state model is explicit.
4. Adapt the Baku performance and its materials to the native renderer in a bounded technical spike. Reuse authored artwork, seam maps, timing logic, and snout geometry where feasible. Physical-device evidence decides the rendering technique.
5. Join the performance to the actual result chips and finish the Keep/Saved transitions. Give permission, failure, background/resume, and reduced-motion paths the same attention.
6. Review at 375 and 390 widths, larger text, and on the target iPhone. Broaden to Android according to the release target. Validate genuine saved output and return behavior as well as animation.

Fonts, icons, SVG texture, and a fuller brand brief can follow once the core loop is credible. The existing texture/export work is useful reference, not a requirement to expand the next milestone.

## Remaining product choices

The first interview round is resolved in Current intent above. The remaining choices before finalizing the v1 implementation brief are:

1. The minimum useful handoff from a saved kit into creative work: copying colors/description, CSS/JSON export, and/or a designed palette image.
2. Whether the six fixed app-design roles remain the visible palette model, or whether a flexible unassigned color collection should lead. The existing implementation assumes fixed nullable roles.
3. Whether v1 remains an invite-only pilot for the user and a few friends, or requires open signup.

Recommendations pending the user's answers: Copy kit plus CSS/JSON export; retain six editable roles with honest empty slots; keep the first release invite-only. These are proposals, not confirmed decisions.

Most valuable additional Grok material, if available later: the missing motion/visual handoffs, actual v7 screen captures or recording, and the latest EAS update identifier. There is no need to reconstruct the entire conversation before proceeding.

## Product decisions confirmed after discovery
The user confirmed Copy kit plus CSS/JSON export; the six editable roles with empty roles; and an invite-only pilot. These supersede the pending questions above. Implementation is being integrated on `codex/inzpo-v1-mobile` from the Expo branch plus the web pivot branch. Baku's approved knitted inhale/chew/sneeze study is the animation source.
