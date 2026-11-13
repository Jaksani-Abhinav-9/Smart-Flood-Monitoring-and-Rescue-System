---
name: tailwindcss
description: "Tailwind CSS utility-first styling guidelines, color systems, glassmorphism utilities, dark mode configuration, responsive design breakpoints, flexbox/grid layout patterns, and modern Tailwind v3/v4 design architecture. Use when styling HTML components, configuring themes, writing utility classes, or creating custom Tailwind components."
---

# Tailwind CSS Design System & Utility Skill

**Tailwind CSS** is a utility-first CSS framework for rapidly building custom user interfaces with responsive layout primitives, HSL color systems, and modern visual design patterns.

---

## 1. Core Layout & Spacing Primitives

- **Flexbox Layout**:
  - Center: `flex items-center justify-center`
  - Between: `flex items-center justify-between`
  - Stack: `flex flex-col gap-4`
- **Grid Layout**:
  - Responsive Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
  - Auto-fit Grid: `grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6`
- **Container & Spacing**:
  - Max Width Container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

---

## 2. Color System & HSL Theme Variables

Use semantic CSS variables for dark & light mode theme compatibility:

```css
@layer base {
  :root {
    --background: 222 47% 6%;
    --foreground: 210 40% 98%;
    --card: 222 40% 10%;
    --card-foreground: 210 40% 98%;
    --primary: 199 89% 48%;
    --primary-foreground: 210 40% 98%;
    --secondary: 160 84% 39%;
    --danger: 354 84% 57%;
    --border: 217.2 32.6% 17.5%;
  }
}
```

---

## 3. Glassmorphism & 3D Card Utility Patterns

- **21st.dev Style Glass Card**:
  `bg-slate-900/80 backdrop-blur-xl border border-sky-500/20 rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/50 hover:shadow-sky-500/20`
- **Glowing Neon Badge**:
  `inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-[0_0_15px_rgba(56,189,248,0.3)]`
- **Floating 3D Button**:
  - Primary: `w-full py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_8px_20px_rgba(14,165,233,0.35)] border border-white/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(14,165,233,0.5)] active:translate-y-0`
  - Emergency SOS: `w-full py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_8px_20px_rgba(239,68,68,0.4)] border border-white/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(239,68,68,0.6)] animate-pulse`

---

## 4. Typography & Accessibility Standards

- **Headings**: `font-extrabold tracking-tight text-white font-outfit`
- **Body Text**: `text-slate-300 leading-relaxed font-inter`
- **Focus Rings (A11y)**: `focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`

---

## 5. Responsive Breakpoints

- `sm`: `640px` (Mobile landscape)
- `md`: `768px` (Tablets)
- `lg`: `1024px` (Laptops & Small Desktop)
- `xl`: `1280px` (Desktops)
- `2xl`: `1536px` (Large Displays)
