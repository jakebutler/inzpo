# Sharing to Inzpo from iOS

iOS does not support the Web Share Target API at the platform level
(Safari cannot register an installed home-screen PWA as a share-sheet
target), so on iPhone/iPad the first-class path is **copy-paste** — and
an optional, documentation-only Apple Shortcut gives you a real share
sheet entry with zero new backend.

## First-class path: copy-paste

1. In any app, copy the link (or the image).
2. Open Inzpo → **+ Capture**.
3. Paste into the link field (or tap the drop zone and pick the image).
4. Tag if you like → **Save**.

## Optional: Apple Shortcut recipe (doc-only)

Build this Shortcut once, then share straight from the share sheet:

1. Open the **Shortcuts** app → **+** (new shortcut).
2. Add **Receive** input: enable *Share Sheet* (Shortcut settings →
   "Show in Share Sheet"), accept *URLs* and *Safari web pages*.
3. Add action **"Get URLs from Input"** (falls back gracefully if the
   input is already a URL).
4. Add action **"URL" → "Open URLs"**, but replace it with:
   **"Open URL"** set to
   `https://<your-inzpo-domain>/capture?url=[URL]`
   using the *URL* variable from step 3.
5. Name it **"Save to Inzpo"**.

Result: Share sheet → *Save to Inzpo* → Inzpo opens the capture surface
with the link pre-filled; tag and Save.

- Importable Shortcut files and anything richer (share-extension app,
  image hand-off) are **post-v1** by decision.
- The share target itself works on **Android (Chrome) and desktop
  Chromium** — install the PWA there and use the OS share sheet
  directly.
