---
name: ui-layouts
description: "Catalog and usage patterns from the ui-layouts.com open-source component library (React + Tailwind CSS + Framer Motion/Motion). Use when the user wants a creative, animated, or 'not-generic-looking' UI piece — hero sections, scroll effects, cards, modals, marquees, globes, 3D blobs, drawers, sparkle/shimmer text, etc. — either to install as a real React component or to adapt the same visual technique into vanilla HTML/CSS/JS. Also covers the UI Layouts MCP server for pulling live component source directly into an editor."
---

# UI Layouts Component Library

**ui-layouts.com** is an open-source, copy-paste (shadcn-style) component library focused on creative, animation-heavy UI pieces built with **React, Tailwind CSS, and Motion (Framer Motion)**. It is a good source of proven patterns for parallax, glassmorphism, scroll-driven motion, and "delight" details — the kind of polish that separates a demo from a generic template.

See [references/component-catalog.md](references/component-catalog.md) for the full list of ~70 components (accordions, animated beams, blur vignettes, carousels, color pickers, directional drawers, file upload, globes, horizontal/smooth scroll, liquid gradients, mac-genie effect, magnified doc viewer, media modal, motion numbers, phone input, r3f blob, randomized text effect, responsive header, scroll text/marquee, shimmer loader, sparkles title, spotlight cards, sticky scroll, terminal UI, tree code viewer, type writer, and more).

## When to reach for this

- The user asks for a specific effect ("a globe like Stripe's", "text that shimmers", "a phone mockup with parallax", "a sticky scroll section") — check the catalog for a matching component name/description first, since a known-good implementation beats improvising from scratch.
- The user is building in **React + Tailwind**: install directly via the CLI or copy the component source.
- The user is building in **plain HTML/CSS/JS** (no React): use the matching catalog entry as the *reference implementation* for the technique (the animation curve, the layering, the timing), then port the logic to vanilla JS / CSS keyframes / IntersectionObserver instead of Framer Motion hooks. Framer Motion patterns translate directly to `element.animate()` (Web Animations API) or CSS `@keyframes` + `transition`.

## Setup (React projects)

Requires Tailwind CSS already configured. Then:

```bash
npm install motion clsx tailwind-merge
```

Add the `cn` utility (used by nearly every component):

```tsx
// utils.tsx
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Many components also use a media-query hook:

```tsx
// use-media-query.tsx
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false)
  useEffect(() => {
    function onChange(event: MediaQueryListEvent) { setValue(event.matches) }
    const result = matchMedia(query)
    result.addEventListener('change', onChange)
    setValue(result.matches)
    return () => result.removeEventListener('change', onChange)
  }, [query])
  return value
}
```

Individual component source + copy-paste code lives at `https://www.ui-layouts.com/components/<component-slug>` (slug = the code in backticks in the catalog).

## MCP option

`ui-layouts.com/mcp` exposes a **UI Layouts MCP server** that lets an AI editor search and pull real component source directly instead of guessing the code. If a UI Layouts connector/MCP tool is available in this environment, prefer it over hand-reconstructing a component from memory — it returns the actual current source.

## Porting a component to vanilla HTML/CSS/JS

1. Open the catalog entry to identify the *technique* (e.g. "sticky-scroll" = `position: sticky` container + `IntersectionObserver` or scroll-linked opacity/transform).
2. Reproduce the Tailwind utility classes as plain CSS (or keep Tailwind via CDN — it works fine in static HTML too, see the `tailwindcss` skill).
3. Replace Motion's `animate`/`whileInView`/`useScroll` with:
   - CSS `@keyframes` + `animation` for looping/decorative motion (shimmer, marquee, sparkle).
   - `element.animate([...keyframes], {duration, easing})` (Web Animations API) for one-shot or interactive motion.
   - `IntersectionObserver` for "animate on scroll into view".
   - `window.addEventListener('scroll', ...)` with `requestAnimationFrame` throttling for scroll-linked parallax (matches the parallax phone-mockup pattern already used in the Smart Flood Rescue landing page).
4. Keep the same easing/duration values from the source — they're usually already tuned (e.g. `ease: [0.16, 1, 0.3, 1]`, ~0.4–0.8s), and mismatched timing is the most common reason a ported effect feels "off".
