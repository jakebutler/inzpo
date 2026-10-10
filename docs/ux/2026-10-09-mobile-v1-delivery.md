# Inzpo v1 pilot integration

## Product contract
Expo Go on iPhone first, supporting web. Capture or pick any photo for creative inspiration, extract six editable roles plus description, save into a collection, reuse by copying hexes/description or exporting CSS/JSON. Invite-only. Akaya Kanadaka headlines. Broader brand identity generation is deferred.

## Recovered work
Integrated `cursor/inzpo-expo-scaffold` at `4825602` and `cursor/inzpo-pivot-mvp-a89b` at `0dce5f0`. The deployed Grok v7 Expo group is `f4485bc4-e47a-4f53-b555-068038a02ba4`; v6 screenshot referenced group `960c624f-c158-4483-b1eb-ed52dc16e9b8`.

The approved Baku study came from local branch `codex/baku-palette-performance` at `bb16e1e`. Mobile uses its registered artwork, material map, expression masks, and continuous deformation choreography through Skia and Reanimated. Asset prompts and original reference provenance are in `apps/mobile/assets/baku-performance/provenance.json`. Runtime files are copies of that study's WebP assets, not newly generated art. The mesh is 48x32 for phone rendering; the study used 72x48. Real roles map one-to-one to six panels; empty roles remain gray.

## Integration choices
- Keep v7 mobile subject extraction: suppress sky/sidewalk padding; pin an actual interior region sample instead of a centroid in a hole. Retain web region provenance and real-only exports.
- Name a kit once from its measured primary (or first real role) plus recognized subject, with a compare-and-set write that preserves concurrent user edits. Temperature zero reduces naming variation; it does not promise identical inference across model changes.
- Preserve web manual title display. Reject filenames as default titles for new captures.
- Description generation is independent of palette readiness. Users can edit/save/copy a loaded palette while text is pending.
- Missing sample coordinates produce no pin or source crop. No reference-photo fallback points.
- Failed uploads retain the selected photo for retry. Collections are reachable from home, and saved kit cards reopen their result.
- CSS includes only actual filled roles; portable JSON includes name, colors, and available description. Neither contains signed photo URLs or account IDs.
- Mobile requires an explicit backend URL so an unset environment cannot target an unrelated preview.

## Verification boundary
Automated checks run locally. Skia renderer captures under `/tmp/inzpo-native-renderer` verify real shader compilation, registered artwork, and deformation. They are renderer-only evidence, not iPhone layout screenshots.

This Mac has no iOS Simulator. Phone acceptance remains required for camera permissions, Clerk email code, upload, animation timing/mesh performance, actual 375/390-point screen fit, role edits, Save/Keep keyboard layout, collection reopen, clipboard, and the iOS share sheet. Reduced Motion and background/resume should be checked on the device as well.

## Renderer review and validation

The Impeccable renderer review cleared the corrected color transport: repeated
accelerating tapered ribbons reach the moving nostril; a tight nostril-axis jet
clears the trunk before chips fan into their actual editable control slots.
The incoming origins use measured photo samples. Empty roles arrive as blank
stock rather than colored emissions.

The scored review is limited to the real Skia mesh, materials, expressions,
transport code, and labelled composition geometry plates. Those plates use
illustrative origins and unlabelled stock rectangles, so they do not establish
native control rendering, source-pin alignment, phone layout, continuous timing,
gestures, or device frame rate. The complete phone surface remains unaccepted.

Validation: root lint/typecheck and 1,097 tests; mobile lint/typecheck and 366 tests
across 37 suites; Expo Doctor 21/21; iOS Hermes export. Shader rendering executes
through the installed Skia CanvasKit engine, rather than a mocked shader.

## Pilot infrastructure

Backend: Vercel preview `inzpo-ogumgqw4j-butlerjake-gmailcoms-projects.vercel.app`,
commit `23e15b2c661431e9b4a75e2123373fac7c1e2ba6`, deployment
`dpl_FK1PNrjKzjuFepbbo99Ftqs2Fwuc`. Ready; unauthenticated mobile collections
request correctly returns 401. No production promotion or database migration
was performed. PR: https://github.com/jakebutler/inzpo/pull/64.

Expo publication uses the isolated `v1-pilot` branch. The existing shared EAS
preview environment points at the old Grok backend; it is deliberately preserved.
The iOS bundle is exported locally with the matched preview backend, then sent
with EAS `--skip-bundler --input-dir dist-v1-pilot --environment preview`. Verify
the compiled bundle contains the intended backend URL before publishing. Do not
run a normal EAS rebundle with that shared environment until it is deliberately
reconciled.

## First Expo receipt (superseded after device crash)

- Published October 9, 2026 at 23:10 UTC, branch `v1-pilot`, iOS only.
- Native source commit: `f0198c1b30480fbfbdf0d32815601a03d7873c83`.
- Group: `659b91ea-f0ae-458a-9086-19fa964180c6`.
- Update: `01a122ee-83c0-732f-8f3b-8ec14bb8a909`.
- Runtime: `exposdk:57.0.0`.
- EAS update readback matches the published group/branch/commit. The served
  manifest returns 200 and its launch-asset SHA256 matches the locally checked
  iOS export: `74fea36014983a49f1a92c01dee89075d1797dff9b1d9411086ae47c6364deb7`.
- The compiled bundle contains the new matched backend URL and omits the old
  Grok backend URL. A direct CLI fetch from Expo's asset CDN received Cloudflare
  403, so this receipt confirms manifest/hash agreement, not device download.
- [Expo Go QR](https://qr.expo.dev/eas-update?projectId=529d6681-6398-4009-adff-18b6bb5a6108&groupId=659b91ea-f0ae-458a-9086-19fa964180c6)
- [EAS update](https://expo.dev/accounts/jakebutler/projects/inzpo/updates/659b91ea-f0ae-458a-9086-19fa964180c6)

On iPhone, scan the QR with Camera and open in Expo Go. Complete one real loop:
sign in, take a photo, see the palette reveal, change a role, save, reopen from
the collection, Copy kit, share CSS, and share JSON. Then check Reduced Motion,
background/resume, a denied camera permission, and a failed-upload retry.

## Device report and reveal crash correction

Jake confirmed on October 9 that Expo Go launch, camera permission, capture,
and photo upload work. Expo Go then closed to the iPhone home screen during
processing/reveal. This supersedes the earlier wholly untested-device status;
the complete capture-to-save loop has not yet passed.

The compiled Worklets payload reproduces `ReferenceError: TIMING is not defined`
in `poseAt`, `anticipationAt`, `durationFor`, and `coatFillAt`. Their default
parameter `timing = TIMING` evaluates before the generated body reads TIMING
from `this.__closure`. The ordinary JS function invoked by Jest's Reanimated
mock retains its module scope, so the original tests could not see this fault.

Those helpers now resolve the optional timing override inside the worklet body.
The choreography, materials, and reveal remain intact. A new test compiles the
actual sources with Expo's Babel preset and runs their serialized worklet code
in an isolated JS realm. It reproduced two failures before the fix and passes
all three checks afterward, including early/late readiness and timing overrides.
This test is part of the normal mobile `npm test` command. It verifies compiled
scope behavior, not iOS GPU execution; the replacement update still needs a
phone retry before the reported crash can be considered device-verified fixed.

## Replacement Expo receipt

- Published October 9, 2026 at 23:22:12 UTC (4:22 PM PDT), branch `v1-pilot`, iOS only.
- Native source commit: `036ecaa2c123eca1c5ab2e170935ec9553a0da1f`.
- Group: `1b3cf7ce-aee6-4d93-9b55-582bbc668d1a`.
- Update: `01a122f9-6663-7c12-8d4a-3fb8ce2b6a01`.
- Runtime: `exposdk:57.0.0`.
- Published manifest returns 200; its launch-asset hash matches the tested local
  iOS Hermes bundle, SHA256
  `2b5e0cebaddf7c8fc01abff792206b6aa8c9524e9cacc4f6132d09c084f2133a`.
- The bundle still targets the matched backend above, with no old Grok URL.
- Validation: 3 compiled-worklet regression tests, 366 Jest tests across 37
  suites, native lint/typecheck, and iOS export pass.
- [Replacement Expo Go QR](https://qr.expo.dev/eas-update?projectId=529d6681-6398-4009-adff-18b6bb5a6108&groupId=1b3cf7ce-aee6-4d93-9b55-582bbc668d1a)
- [Replacement EAS update](https://expo.dev/accounts/jakebutler/projects/inzpo/updates/1b3cf7ce-aee6-4d93-9b55-582bbc668d1a)

Use the replacement QR for the phone retry. The first QR is pinned to the old,
crashing update. Jake subsequently confirmed that this correction fixed the
crash; the next device report and correction follow below.

## Device follow-up: visible Baku and an earlier start

Jake confirmed the replacement update fixed the crash, but Baku was invisible
during the reveal and the upload-to-processing handoff paused before animation.

The mesh's JSX `blendMode="dst"` also set the canvas paint to destination-only,
leaving a transparent canvas unchanged. The previous imperative renderer test
did not exercise that paint property. A new regression renders the actual
`KnitMesh` JSX through Skia's reconciler and paint visitor: it produced zero
opaque pixels with the old property and visible Baku frames after removing it.
This is real CanvasKit scene-graph evidence, not an iOS device capture.

The selected photo now mounts Baku during upload and extraction. His elapsed
clock passes into the result route, which retains the same local photo through
palette readiness. A slow response keeps him chewing without invented colors;
the returned samples trigger their own inhale before the sneeze. The explicit
skip, background/focus pause, failed-upload photo retry, and Reduced Motion
path remain. The new visibility and timing still require a phone retry.

Validation for this correction: native typecheck and lint; three compiled
worklet tests; iOS Hermes export. The full Jest run passed 373 of 374 tests;
the sole failure was an existing result test racing a real animation timer
against its one-second polling timeout. That test now advances the declared
animation duration with fake timers. The corrected screen and transport suites
then passed all 69 tests; all other 36 suites passed in the full run. Actual
scene-graph captures under `/tmp/inzpo-baku-visibility` show the gray waiting
host and colored panels after readiness. Phone layout and frame rate remain
outside this evidence.

## Visible Baku publication receipt

- Published October 9, 2026 at 6:27 PM PDT (October 10 at 01:27:36 UTC).
- Branch `v1-pilot`, iOS, runtime `exposdk:57.0.0`.
- Source commit: `39de3adb39bc3df52deb980bcd72b1023c044b82`.
- Group: `58caf440-c1c4-4ca3-8aa2-18e5ff4afede`.
- Update: `01a1236c-34b9-765c-8491-0f8f71d952d8`.
- Served manifest ID/runtime match; launch-asset hash matches the checked local
  Hermes bundle, SHA256
  `47a094b0ef29b6f5ecdefe40cb71e47cdb20e0fbc361a1ab42852cd80e2b3663`.
- Bundle contains the matched backend URL. No new assets were uploaded.
- [Current Expo Go QR](https://qr.expo.dev/eas-update?projectId=529d6681-6398-4009-adff-18b6bb5a6108&groupId=58caf440-c1c4-4ca3-8aa2-18e5ff4afede)
- [Current EAS update](https://expo.dev/accounts/jakebutler/projects/inzpo/updates/58caf440-c1c4-4ca3-8aa2-18e5ff4afede)

Earlier QR links remain pinned to their historical versions. This update is
published for the next phone pass; Baku visibility and the upload/reveal
continuity are not yet device-confirmed.
