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
