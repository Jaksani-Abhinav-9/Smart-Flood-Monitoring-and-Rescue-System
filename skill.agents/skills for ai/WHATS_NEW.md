# What's new in this update

Your original 15 skills (21st-dev, animista, banner-design, brand, css-gradients(+addendum), design, design-system, slides, spline-design, tailwindcss, theatre-js, ui-buttons, ui-styling, ui-ux-pro-max) are untouched.

## Added from github.com/anthropics/skills
- **frontend-design** — Anthropic's official skill for giving strong, non-generic visual direction instead of defaulting to templated layouts.
- **theme-factory** — generates cohesive color/typography theme systems.
- **canvas-design** — canvas-based visual/graphic generation (includes bundled fonts).
- **web-artifacts-builder** — building complex multi-component React/Tailwind artifacts (state, routing, shadcn/ui).
- **algorithmic-art** — generative/algorithmic visual patterns.
- **webapp-testing** — testing web apps end-to-end (useful for making sure a "demo-ready" build actually works before presenting).
- **claude-api** — calling the Anthropic API correctly (tool use, streaming, batching) — directly relevant to your Node/Express + Anthropic API backend work.
- **skill-creator** — a meta-skill for building/improving skills like these ones.

## Added from github.com/pbakaus/impeccable
- **impeccable** — a full design-critique/design-generation skill (20+ commands: critique, audit, polish, bolder, quieter, animate, colorize, typeset, layout, delight, harden, adapt, live browser iteration, etc.). Note: this one is normally driven through the `npx impeccable` CLI, which templates in real script paths at install time — the raw SKILL.md/reference files here are the content, but for the interactive commands to actually run scripts, you'd `npx impeccable init` in your project first. Even without running the CLI, the `reference/*.md` files are directly useful as design-review checklists.

## Added new (built from ui-layouts, tailwindcss, and the awesome list)
- **ui-layouts** — catalog + usage guide for the ui-layouts.com component library (React + Tailwind + Motion): ~70 creative components (globes, sticky scroll, shimmer/sparkle text, phone-mockup-style effects, drawers, etc.), plus notes on porting the same techniques into plain HTML/CSS/JS for projects like your Smart Drainage / Flood Rescue dashboards that don't use React.
- **tailwindcss/v4-addendum.md** — added to your existing tailwindcss skill: covers Tailwind v4's CSS-first `@theme` config (no `tailwind.config.js`), since that's the current version and meaningfully different from the v3-style HSL-variable approach your existing skill documents.
- **ai-ui-tools-directory** — a lookup-table skill built from the maxbogo/awesome-ai-tools-for-ui list: other design skills, AI design apps, MCP servers for UI work, non-AI design tools (SVG loaders/backgrounds, color tools, shader backgrounds), and UX principle references — organized by category so you know where to look next for something not already covered.

## Suggested next step
Unzip this over (or alongside) your existing skills folder and point your AI tool/editor at it the same way you already do. If you use Claude Code, drop it at `.claude/skills/`.
