---
name: ai-ui-tools-directory
description: "Curated directory of external AI tools, skills, MCP servers, design tools, and learning resources for building better UI/UX, sourced from the maxbogo/awesome-ai-tools-for-ui list. Use when none of the other skills in this pack cover what's needed and an external tool, plugin, or reference site would help — e.g. the user wants a specific design system feel (Swiss, Material 3, Nothing-OS), a color/palette tool, animated SVG loaders/backgrounds, or wants to know what MCP servers exist for UI work. Not a skill to execute directly — it's a lookup table pointing to where to go next."
---

# AI Tools for UI — Directory

This is a reference index, not an executable skill: it points to external tools/skills/sites worth knowing about when building or improving a UI, organized by category. When a request doesn't map cleanly onto the skills already in this pack (frontend-design, theme-factory, ui-styling, ui-ux-pro-max, ui-layouts, impeccable, canvas-design, etc.), scan this list for a better-fit resource before improvising.

## Other agent skills worth knowing exist
(install/reference only if the current pack doesn't already cover the need)

- **Impeccable** — 20 design commands teaching typography, spacing, visual hierarchy (already vendored in this pack as `impeccable/`).
- **UserInterface.wiki Skill** — 152 UI design rules as a skill file.
- **UI UX Pro Max Skill** — generates design systems (colors, typography, layout) per project type/framework (already vendored as `ui-ux-pro-max/`).
- **Anthropic Frontend Design Skill** — strong visual direction over generic defaults (already vendored as `frontend-design/`).
- **shadcn/ui Skills** — gives an assistant context about an existing shadcn/ui setup.
- **Web Design Guidelines Skill (Vercel Labs)** — checks UI code against best-practice rules.
- **Material Design 3 Skill** — tokens, theming, 30+ components, MD3 audits — useful if a project wants a Material look specifically.
- **Swiss Design System skill** — grotesque typography, disciplined grids, restrained color.
- **Three.js Skills collection** — scenes, geometry, lighting, shaders, loaders, animation — relevant for 3D effects (e.g. the phone-mockup parallax / 3D work already in progress).

## Apps (AI-powered UI generation)

- **21st.dev** — UI component library/templates for AI-built products.
- **Superdesign**, **Variant**, **Stitch (Google)** — generate/iterate on UI designs from prompts in-browser.
- **Khroma** — learns color preference, generates/searches palettes.
- **prompt-kit** — accessible primitives specifically for chat/AI-style interfaces (prompt inputs, message bubbles, reasoning views) — directly relevant if a project's chatbot UI needs polishing.

## MCP servers & plugins

- **Magic MCP** (21st-dev) — generate UI components from text prompts in-editor.
- **UI Layouts MCP** — search/pull real component source from ui-layouts.com instead of guessing code (see the `ui-layouts` skill).
- **Design and Refine** — Claude Code plugin to generate/compare/refine multiple UI variants in a codebase.
- **Interface Design** — remembers interface decisions across sessions for consistency.

## Design tools (not AI, but high-value)

- **SVG Loaders** — 100+ open-source animated loading spinners (MIT).
- **SVG Backgrounds** — free customizable SVG background patterns.
- **Realtime Colors** — preview a palette + typography on a live mockup before committing.
- **Transitions.dev** — copy-paste transition patterns for common interactions.
- **daisyUI** — Tailwind component library with semantic class names + themes + its own MCP server.
- **Paper Shaders** — zero-dependency canvas shaders for animated backgrounds/textures (good fit for a landing page's hero background).
- **Ditther** — dither/halftone/ASCII/pixel effects tool for stylized imagery.

## Resources (principles, not tools)

- **Laws of UX** — psychology-backed design principles.
- **UserInterface.wiki** — UI/animation/motion/typography fundamentals.
- **Zajno Motion** — motion-heavy site gallery for animation/interaction inspiration.
- **The Shape of AI** — UX patterns specific to AI-feature interfaces (relevant for chatbot/assistant UI work).

## How to use this directory

1. Identify the gap: is it a missing *technique* (motion, color, layout), a missing *aesthetic* (Material, Swiss, minimal), or a missing *component* (loader, chart, 3D effect)?
2. Match it to the category above.
3. Prefer resources already vendored in this pack (noted above) before reaching for an external link — they're already available offline.
4. For anything not vendored, treat the entry above as a pointer to fetch/research on request, not as content to reproduce verbatim (respect each project's own license).

Source: curated from `github.com/maxbogo/awesome-ai-tools-for-ui` (54 tools at time of writing). Check that repo directly for newer additions, since this kind of list changes frequently.
