# Inzpo quality bar (Critiquito, 2026-10-07)

Judged at 390x844, iOS Safari installed to the home screen. Sign-off = zero blockers and zero worth-fixing across the whole flow.

**Blocker:** breaks the key action, loses the user's work, or misses a hard number below (targets, contrast, reduced motion, layout shift).
**Worth fixing:** usable, but it misses the bar.

## Focus
- One primary action per screen. It's the only filled button, it sits in the bottom third, it's pinned above the home indicator, and it stays clear of the keyboard.
- The first view of every screen says what the screen is and what to do next, with no scrolling.
- The photo and the palette are the loudest things on screen. The interface itself stays neutral.

## Touch
- Tap targets are at least 44x44pt with 8px between them, and that includes swatches and chips.
- Every tap gets visible feedback within 100ms (a slight scale or dim). Nothing depends on hover, and the gray tap flash is turned off.
- No double-tap zoom on controls, and no zoom when an input is focused (input text is 16px or larger).
- Safe areas are respected everywhere, top and bottom.

## Motion
- Durations: tap feedback 100–150ms. Small changes like selecting a swatch, showing a chip, or a toggle take 150–250ms. Sheets and screen changes take 250–400ms. Nothing goes past 500ms except real progress.
- Easing: things entering ease out, things leaving ease in and leave faster than they entered, and things moving on screen ease in and out. Springs settle without visible bounce. Nothing is linear except progress indicators.
- Things move from where they came from. The snapped photo becomes the result-screen photo, and the swatch editor opens from the swatch you tapped.
- Only transform and opacity animate, at 60fps on a mid-range iPhone. Nothing jumps when content arrives: space for the palette and the brief is held from the start.
- Animations can be interrupted. A tap during a transition still works, and swiping back always works.
- With reduced motion turned on, movement becomes a short fade (150ms or less) or happens instantly.

## States
- Every screen has a designed empty, loading, partial (brief still running), error, offline, and done state.
- Work that takes under 300ms shows no loader. Longer work shows a skeleton shaped like the result, not a lone spinner.
- The running brief clearly says Save is safe and that it'll finish in the background.
- Errors say what happened and give one next step, and the photo is never lost.
- Edits and saves show right away. Removing something offers Undo instead of a confirmation dialog.

## Just-in-time hints
- No onboarding carousel and no tooltip tour.
- A hint shows once, at the moment it's needed ("Tap a swatch to edit it" on the first palette), and goes away as soon as it's used.
- Every gesture has a visible way to do the same thing.
- The camera permission prompt appears only after a tap on Snap, with one line beforehand saying why, and there's a way back if the friend says no.

## Craft
- At most two type families, about five sizes, body text 16px or larger, and hex codes in tabular figures.
- Spacing on a 4/8 grid. One icon set with one stroke weight.
- Text contrast at least 4.5:1, controls and focus rings at least 3:1.
- Button labels are verbs in sentence case. The word "tokens" shows up only in the export.

## Accessibility
- VoiceOver reads each swatch as its role, hex, and a plain color name. Focus order follows the screen, and the focus ring is visible.
- Text at 200% doesn't break the layout.

## Installed app
- Correct status bar color, no rubber-band scrolling on fixed screens, and no text selection on long-press of buttons or labels.
- Opens to the Snap screen fast on cellular, and reopens where the friend left off.

## What I need per screen
390px stills of every state, a screen recording from an iPhone for each transition, and the actual duration and easing values from the code.

## Phone

### Phone app (Expo) — additions

Every item below is checked on a real iPhone and a real Android phone, not only the simulator. The web checklist above still applies, except where this section overrides it.

#### Safe areas
- No tappable element sits in the status bar, Dynamic Island, notch, or home-indicator area. The bottom actions sit at least 8pt above the home indicator inset.
- The photo can bleed under the status bar, but the back button and pins stay inside the top inset.
- Bottom sheets add the bottom inset to their content padding, so the last row isn't hidden behind the home indicator.
- Landscape is locked to portrait, or the side insets are respected.

#### Gestures and touch
- Every touch target is at least 44×44pt, and adjacent targets have at least 8pt between them.
- Edge swipe back works on every pushed screen (iOS), and the Android system back closes a sheet before leaving the screen.
- A sheet closes on a pan down, a backdrop tap, and the system back. The 36×4 grabber is visible.
- A pin drag never fights the sheet's pan or the edge-back swipe. A drag that starts on a pin moves only the pin.
- Press feedback shows within 1 frame of touch-down. Nothing waits for touch-up to respond.

#### Haptics
- They follow the budget in `MOTION-NATIVE.md`: shutter press-in (Light), the last band landing (Soft, once), save success or failure, and loupe ticks only when the sampled color changes.
- Never on navigation, opening a sheet, or per band. At most one per 300ms, except loupe ticks.
- Nothing depends on haptics alone. Every haptic event also has a visible change.

#### Reduced motion (`useReducedMotion()`)
- It follows `MOTION-NATIVE.md`: every translate, scale, or squash becomes a 150ms opacity fade. Bands and stripes appear together, with no hop, flash, breathing, or pupil jiggle. Sheets use the stiffer spring.
- Haptics stay on, except loupe ticks.
- Check it with the OS setting on, not a dev flag.

#### Dynamic Type and font scaling
- At the largest standard size (iOS AX1 or Android 200%), no label is clipped, overlaps, or is truncated without a way to read it in full. Kit names wrap to 2 lines.
- The hex values and band rows can cap their scaling at 1.3× (`maxFontSizeMultiplier`) to protect the layout. Body copy, buttons, and errors are never capped.
- Buttons grow taller instead of truncating their labels.
- VoiceOver and TalkBack read each band as its role name, color name, and hex, and read Baku as decorative.

#### States on the phone
- Offline or a failed upload shows one line of copy and a retry, with no spinner left running.
- If camera or photo permission is denied, the screen explains why it's needed and links to Settings. It is never a blank screen.
- After the app is backgrounded mid-upload and reopened, the result still arrives or a retry shows.

## Craft gates (craft bar v2)

From /workspace/critiques/inzpo/craft-bar.md (v2, Oct 8 2026). This layer sits on top of the correctness checks above (including the earlier Craft section and the phone section), which still apply. Every screen must pass all of these gates.

### 1. Objects, not rectangles
The key content on each screen is a physical object:
- The photo is an instant-film print.
- The colors are paint chips on card stock.
- The kit is a fan deck.
- The brief is its own printed card.

It fails if a crafted object is expected and the screen shows a flat fill, a 1px gray border, or a default shadow instead.
- **Materials:** paper grain is visible at 100% zoom, and every label printed on it still reads at 4.5:1 or better.
- **Shadows:** two layers, a tight contact shadow plus a soft ambient one. One light direction (top-left) is used across the whole app, on web and phone.
- **Buttons:**
  - A 1px stroke about 2 shades lighter than the fill, and a shadow about 2 shades darker.
  - On press, the button sinks: scale 0.97, and the shadow shrinks within one frame.
  - Never a flat slab.
- **Edges:** no cutout has a hard alpha fringe or a halo. Baku gets a soft, fibrous edge that matches felt; a "green screen" outline is a fail.

### 2. Light and tilt
- Objects tilt with the phone by 3° or less. A light sweep moves across the gloss on the photo, with a softer sheen on card stock.
- The result screen, where pins get dragged, stays upright and still.
- With reduced motion on, tilt is off and the light stays fixed.

### 3. Baku as host
- **Where he appears:** at login and first open, during the munch, at the reveal, after saving, and on empty and error states. Nowhere else.
- **Login:** with the keyboard hidden, Baku is the hero, at least 40% of the viewport width. With the keyboard up, he shrinks to fit, as he does today.
- **Reveal and after saving:** he presents the colors or reacts, then retreats to a lower corner at 64pt or less within about 600ms. Once the objects are showing, he never takes their space again.
- **Empty and error states:** he softens the moment with a pose and a line. He is never a decoration stuck onto a page.

### 4. The munch is the showpiece
- **The model:** a true 3D Baku that keeps the v7 look: felt fiber texture, fuzz on the silhouette, and the knit stripe. It should read as the same character as the sprite, not a glossy 3D toy.
- **The chew:** an exaggerated cow or camel chew. The jaw drops, grinds side to side, and closes, while the snout bobs behind it. The photo visibly gets pulled in and bitten, and the colors come out of the chew and become the chips.
- **Timing:**
  - The chew loops seamlessly for as long as the upload takes. When the result is ready, it ends on a satisfying swallow, which hands off into the reveal.
  - It never restarts, flashes, or reloads.
- **Performance:** 60fps on a mid-range phone, with no first-frame hitch.
- **Reduced motion:** a single still pose with a 150ms fade, per MOTION-NATIVE.md.
- **Haptics:** a soft tick on each bite (at most one every 300ms), plus one on the swallow.
- **Interim:** Designer's 2D jaw-layer plan can ship only as a stopgap. The bar isn't met until the 3D munch lands.

### 5. Type with a voice
- The headline font has real character (Jake picks from the top three). It is used for kit names, screen titles and the brief card label. Geist is used for everything else.
- At least three purposeful treatments sit on top of Geist:
  - names and emphasis (the email on the code step in medium or italic)
  - hex values in mono
  - chip labels set like printed paint-store labels
- No screen reads as a default hierarchy of the same font in different sizes.

### 6. Words
- Copy is warm, short, and a little witty, and it changes with state. For example, after a code is sent, the helper says so.
- Errors say what happened and what to do next, with no jokes.
- Baku's lines are kept to his moments: greeting, munch, reveal, save, and empty or error states.

### 7. The flow always moves forward
- Every tap shows a visible response within 100ms.
- Save advances to the next step.
- No button is dead, and no screen reloads in a loop.
- Each of these is a blocker.

### 8. One signature detail per screen
Every screen gets one detail you'd notice the second time, never more than one. Examples:
- a printed registration mark on a chip label
- the rivet on the fan deck
- a handwritten date on the film border
- Baku's crumbs after the munch

### 9. The screenshot test
Would Jake send a screenshot of this screen to a friend without being asked? If not, the screen is worth fixing, and on a key screen it is a blocker.
