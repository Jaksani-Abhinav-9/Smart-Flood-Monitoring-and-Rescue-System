---
name: ui-buttons
description: "Pure CSS/HTML button interaction styles - hover/click animations, 3D press effects, neumorphism, glow, gooey, progress-fill, and shape-morphing buttons, based on the youneslaaroussi/ui-buttons catalog (100 styles, no JS required). Use when a user wants a distinctive animated button, CTA, or interactive UI element beyond default browser or Tailwind defaults."
---

# UI Buttons - Animated CSS Button Catalog

A catalog of pure CSS/HTML button interaction styles (no JS dependency). Source: https://github.com/youneslaaroussi/ui-buttons (100 Modern CSS Buttons, MIT licensed, live previews at https://ui-buttons.web.app).

## When to Use
- User wants a "cool" / "animated" / "interactive" button beyond a flat default
- CTAs, SOS/emergency buttons, hero section buttons, form submit buttons
- Looking for hover/click micro-interactions without adding JS animation libraries

## How to Use
1. Ask (or infer from context) what feeling the button should convey: playful, tactile/physical, futuristic/neon, soft/organic, urgent/alert.
2. Pick 1-2 candidate styles from `references/catalog.md` (grouped by feel).
3. Adapt the color values to the project's existing palette (see `css-gradients` skill) rather than using the example colors verbatim.
4. For a style not in `references/examples.css`, describe the mechanism (e.g. "borders fill up from the center") and reference the corresponding page at ui-buttons.web.app/<slug> if the user wants to see the original.

## Starter Examples (ready to use)
Three additional styles beyond the original 100, in `references/examples.css`:
- **Tactile Retro Push Down** - thick hard drop-shadow "presses in" on click. Good for: physical/retro feel, SOS/emergency triggers.
- **Claymorphism (Soft Capsule)** - inset shadows for a soft, inflated look. Good for: friendly, approachable CTAs.
- **Isometric Glow Lift** - `perspective` + `rotateX` tilt that lifts higher on hover. Good for: futuristic/dashboard UI.

## Categories (from the 100-button catalog)
See `references/catalog.md` for the full list with one-line mechanism descriptions per style, grouped as:
- **Slide/fill fills** (background slides in from a direction on hover/click)
- **3D & tilt** (perspective, rotateX/Y, press-down depth)
- **Neumorphism / soft shadow** (inset shadows, fluffy shadow shifts)
- **Text/character effects** (letter dance, text slide, rotate reveal)
- **Border & outline** (snake borders, focus-in, neon)
- **Attention-grabbing** (pulse, heartbeat, tada, wobble, shake - borrowed from animate.css)
- **Novelty/shape-morph** (gooey, shapeshifter, fold, glitch)

## Notes
- All effects are pure CSS - copy the class + keyframes, no JS needed.
- Don't reproduce the entire upstream repo verbatim in one file; pull individual button styles as needed per request.
- Pair with the `animista` skill for keyframe-only micro-interactions that aren't button-specific.
