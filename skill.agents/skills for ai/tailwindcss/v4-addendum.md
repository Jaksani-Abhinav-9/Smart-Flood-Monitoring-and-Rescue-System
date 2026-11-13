# Tailwind CSS v4 addendum (CSS-first config)

Tailwind v4 (current: 4.3.x) replaced the JS config file with a **CSS-first** setup. If a project uses `@import "tailwindcss";` instead of the classic `@tailwind base/components/utilities;` directives, it's on v4 — use this instead of a `tailwind.config.js`:

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.7 0.15 250);
  --font-display: "Outfit", sans-serif;
  --spacing-18: 4.5rem;
}
```

Anything defined under `@theme` automatically becomes a utility (`bg-primary`, `font-display`, `p-18`, etc.) — no `theme.extend` needed.

Key v4 differences worth knowing:

- **No config file required.** Content detection is automatic; use `@source "../some/path"` in the CSS file only to add extra scan paths (e.g. a folder outside the default detection root).
- **Arbitrary hex values now canonicalize** to the closest named theme color case-insensitively (e.g. `bg-[#fff]` resolves like `bg-white`).
- **`@tailwindcss/vite`** is the recommended plugin for Vite projects (faster than PostCSS). For plain static HTML/CDN use, `@tailwindcss/browser` still works for quick prototypes.
- Colors are commonly defined in `oklch()` now instead of HSL triplets — perceptually uniform, so lightening/darkening a color by the same delta looks visually consistent across hues (useful for generating a shade ramp for a single brand color).
- `@tailwindcss/upgrade` can migrate a v3 project (JS config + old directives) to v4 automatically.

If a project's `style.css`/`index.html` already uses the HSL `:root` variable pattern from the main SKILL.md (Tailwind v3 style), that's still valid — v3 and v4 can coexist across different projects, just don't mix the two configuration styles within one project.
