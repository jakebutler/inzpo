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
