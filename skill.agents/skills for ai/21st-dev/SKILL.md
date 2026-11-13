---
name: 21st-dev
description: "Integration, architecture, and component generation using 21st.dev (21.dev) - the community registry for React, Tailwind CSS, Radix UI, and Framer Motion components following the shadcn/ui copy-paste architecture. Use when searching, building, remixing, or adding modern UI components, animated cards, hero sections, navigation bars, micro-interactions, or AI prompt-driven UI blocks."
---

# 21st.dev (21.dev) Component Registry & Architecture

**21st.dev** is a component registry and marketplace for React UI components built with **Tailwind CSS**, **Radix UI**, **Framer Motion**, and **Lucide React icons**. It follows the **shadcn/ui** philosophy: source code is copied directly into the project repository so you own and customize every line.

---

## Key Principles & Architecture

1. **Code Ownership (Shadcn Architecture)**:
   - Components are not `node_modules` black-box dependencies.
   - Code is placed directly into `@/components/ui/` or `@/components/blocks/`.
   - Utility functions use `cn(...)` from `@/lib/utils` (combining `clsx` and `tailwind-merge`).

2. **Core Tech Stack**:
   - **Styling**: Tailwind CSS (v3 or v4) with CSS variables for dynamic themes (`bg-background`, `text-foreground`, `border-border`).
   - **Primitives**: Radix UI headless components (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, etc.) for WCAG AA accessibility & keyboard navigation.
   - **Animation**: Framer Motion (`framer-motion`) or GSAP for smooth micro-interactions, layout transitions, and entrance effects.
   - **Icons**: Lucide React (`lucide-react`) vector icons.

3. **Installation & Component Retrieval**:
   - **Shadcn Registry CLI**: `npx shadcn@latest add "https://21st.dev/r/<username>/<component-name>"`
   - **21st CLI**: `@21st-dev/cli` (`npx @21st-dev/cli add <component>`)
   - **Direct Source Copy**: Paste component file directly into `components/ui/<component-name>.tsx`.

---

## Integration Workflow

### Step 1: Detect Project Stack & Dependencies
Before installing or building 21st.dev components, verify project configuration:
- Ensure `@/lib/utils` contains the canonical `cn` helper:
  ```ts
  import { ClassValue, clsx } from "clsx";
  import { twMerge } from "tailwind-merge";

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```
- Verify `framer-motion`, `lucide-react`, `clsx`, and `tailwind-merge` are present in dependencies.

### Step 2: Component Structure Standard
When building or adapting 21st.dev components, structure them cleanly:

```tsx
"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  badge?: string;
}

export const ComponentName = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, title, badge, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm hover:shadow-md transition-shadow",
          className
        )}
        {...props}
      >
        {badge && (
          <span className="mb-2 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {badge}
          </span>
        )}
        {title && <h3 className="text-lg font-bold tracking-tight">{title}</h3>}
        {children}
      </motion.div>
    );
  }
);

ComponentName.displayName = "ComponentName";
```

---

## Best Practices for 21st.dev UI Elements

1. **Accessibility First**:
   - Ensure all interactive elements have visible focus rings (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`).
   - Use semantic HTML tags (`<nav>`, `<header>`, `<main>`, `<article>`, `<button>`).
   - Provide `aria-label` or `sr-only` text for icon-only triggers.

2. **Smooth & Purposeful Motion**:
   - Keep transition durations between `150ms` and `300ms`.
   - Always honor `prefers-reduced-motion` settings.

3. **Theme & CSS Variables**:
   - Use Tailwind CSS variables (`hsl(var(--primary))`, `bg-background`, `text-muted-foreground`) so components automatically adapt to light & dark mode.
