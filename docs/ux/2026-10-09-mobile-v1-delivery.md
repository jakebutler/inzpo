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
