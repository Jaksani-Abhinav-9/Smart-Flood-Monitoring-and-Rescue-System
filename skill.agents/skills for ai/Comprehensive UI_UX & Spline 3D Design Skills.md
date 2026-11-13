# Comprehensive UI/UX & Spline 3D Design Skills

This single document compiles essential UI/UX design principles, color theory, typography rules, layout patterns, motion guidelines, and a complete guide to Spline 3D integration. It is designed to be fed to AI coding assistants (like Claude, Cursor, or Codex) to generate distinctive, high-quality, and interactive interfaces.

---

## Part 1: Core Design Philosophy & Principles

### 1.1 Distinctive Intentionality
To avoid generic, "templated" AI designs, approach UI creation as a design lead who must deliver a unique visual identity. Make deliberate, opinionated choices about palette, typography, and layout that are specific to the project brief.

**The "Anti-Slop" Rules (What to Avoid):**
- **The Template Triad:** Avoid the warm cream background (#F4F1EA) with terracotta accents, the near-black background with acid-green accents, and the broadsheet-style layout with hairline rules.
- **Overused Typography:** Do not use Arial, Inter, or default system fonts for everything. Avoid gray text on colored backgrounds.
- **Visual Clutter:** Never wrap everything in cards or nest cards inside cards. Do not use pure black or pure gray (always tint).
- **Dated Motion:** Avoid bounce or elastic easing, which feels dated and artificial.

### 1.2 Fundamental UI Design Principles
1. **Hierarchy:** Use font size, weight, contrast, and spacing to guide the user's eye to the most important information first.
2. **Progressive Disclosure:** Present features and information sequentially to avoid overwhelming the user.
3. **Consistency:** Establish familiar patterns. Buttons and interactive elements should look and behave consistently.
4. **Contrast:** Use contrast strategically to draw attention to critical actions or information.
5. **Accessibility:** Ensure high contrast between foreground and background elements. Provide alternative text, ensure keyboard navigability, and adhere to WCAG guidelines.
6. **Proximity:** Group related elements closely together. Users naturally perceive items near each other as related.
7. **Alignment:** Use a strong grid system to establish order, balance, and predictability.

### 1.3 Psychology-Backed UX Laws
- **Hick’s Law:** The time it takes to make a decision increases with the number of choices. Keep interfaces simple.
- **Fitts’s Law:** Make interactive elements appropriately sized and reachable.
- **Miller’s Law:** The average person can only keep 7 (plus or minus 2) items in their working memory. Chunk information logically.
- **Aesthetic-Usability Effect:** Users perceive aesthetically pleasing designs as more usable.

---

## Part 2: Color Theory & Typography

### 2.1 Color Harmony Rules
- **The 60-30-10 Rule:** 60% Primary (neutral background), 30% Secondary (supporting elements), 10% Accent (Call-to-Actions).
- **Color Schemes:** Use Complementary (high contrast), Analogous (calm, unified), or Triadic (vibrant, balanced) schemes.
- **Accessibility (WCAG):** Ensure a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text. Never rely on color alone to convey information.

### 2.2 Typographic Scale
Use a mathematical ratio (like 1.25 or 1.333) to define font sizes:

| Role | Typical Size (Desktop) | Weight | Line Height |
| :--- | :--- | :--- | :--- |
| **Display** | 64px - 80px | Bold / Black | 1.1 - 1.2 |
| **H1** | 48px - 56px | Bold | 1.2 - 1.25 |
| **H2** | 36px - 40px | Semi-Bold | 1.25 - 1.3 |
| **H3** | 28px - 32px | Semi-Bold | 1.3 - 1.35 |
| **Body Large** | 18px - 20px | Regular | 1.5 |
| **Body Default** | 16px | Regular | 1.5 - 1.6 |
| **Caption/Small** | 12px - 14px | Medium / Regular | 1.4 - 1.5 |

**Best Practices:** Pair a characterful Display font with a highly readable, neutral Body font. Keep body text line length between 50 and 75 characters. Use left-aligned text for readability.

---

## Part 3: Layout & Spacing (The 8-Point Grid)

Spacing is the foundation of visual rhythm. Use an 8-point grid system to define all spacing values.

### 3.1 Standard Spacing Tokens
- **4px:** Tight grouping (e.g., icon to text)
- **8px:** Small padding inside buttons, tight element spacing
- **16px:** Standard padding inside cards, default spacing between form fields
- **24px:** Spacing between related components
- **32px:** Spacing between distinct sections
- **48px - 64px:** Large section padding (e.g., hero sections)
- **96px+:** Major layout breathing room (desktop only)

### 3.2 Layout Patterns
- **The Thesis Hero:** Open with the most characteristic thing in the subject's world. Avoid generic "text on left, image on right" layouts.
- **Card Layouts:** Ensure clear contrast, balanced internal padding (24px or 32px), and clear typography hierarchy. Never nest cards inside cards.
- **Responsive Design:** Design mobile-first. Reduce padding/margins on smaller screens and use responsive typography (e.g., `text-lg md:text-xl`).

---

## Part 4: Motion & Interaction Design

Motion should serve a functional purpose (state changes, spatial relationships, feedback).

### 4.1 Easing Curves and Timing
| Animation Type | Duration | Easing Curve | Use Case |
| :--- | :--- | :--- | :--- |
| **Micro-interaction** | 100ms - 200ms | `ease-out` | Button hover, checkbox toggle |
| **Element entrance** | 200ms - 350ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Cards appearing, text fading in |
| **Modal/Dialog** | 250ms - 400ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Modal opening |
| **Page transition** | 300ms - 500ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Route changes |

**Avoid:** Bounce/elastic easing (feels dated) and linear easing (feels robotic).

### 4.2 Staggered Animations
When multiple elements enter the screen together, stagger their entrance (e.g., 50ms - 100ms delay between elements). Stagger no more than 5-7 elements to avoid long total animation times.

### 4.3 Interactive Elements
- **Hover States:** Slight background color change, subtle scale (1.02), or shadow increase.
- **Focus States:** Always provide a visible focus ring (2px - 3px) for keyboard navigation.
- **Reduced Motion:** Always respect the user's `prefers-reduced-motion` setting.

---

## Part 5: Component Patterns & UI Ideas

### 5.1 Hero Section Patterns
- **Thesis Statement:** Bold headline, single supporting line, one CTA. (Best for SaaS, portfolios)
- **Split Screen:** Content on one side, visual/animation on the other. (Best for product showcases)
- **Immersive Full-Screen:** Full viewport with background video, WebGL effect, or large imagery. (Best for creative agencies)
- **Mega-Type:** Oversized typography dominating the viewport. (Best for editorial, design studios)

### 5.2 Navigation Patterns
- **Floating Navbar:** Sits with padding from edges, rounded, glass-morphism effect.
- **Sticky Minimal:** Thin, top-anchored bar that becomes sticky on scroll with a subtle shadow.
- **Command Palette:** Keyboard-triggered search/command input (Cmd+K).

### 5.3 Creative Elements
- **Glass Card:** Backdrop-blur with semi-transparent background.
- **Bento Grid:** Cards of varying sizes in an asymmetric grid layout.
- **R3F Blob Effect:** Animated 3D blob using React Three Fiber for ambient motion.
- **Clip Path Image:** Images with creative CSS clip-path shapes (hexagons, waves).
- **Timeline Animation:** Vertical or horizontal timeline with animated nodes.

### 5.4 Error and Empty States
Never leave users facing a blank or broken screen without guidance.
- **Empty States:** Include an illustration/icon, a clear headline, and a CTA that invites action.
- **Error States:** Explain what went wrong in plain language and suggest a fix. Do not apologize or use vague language.

---

## Part 6: Spline 3D Design & Integration

Spline is a browser-based 3D design tool that allows for creating interactive, production-ready 3D experiences without complex coding.

### 6.1 Spline Best Practices & Optimization
- **Performance Panel:** Use Spline's built-in Performance Panel to monitor Export Size, Loading Time, Polygon Count, and Object Count.
- **Polygon Reduction:** Smoother objects have higher polygon counts. Reduce the number of "Sides" on parametric objects (spheres, cylinders) to increase performance.
- **Lighting:** Limit scene lighting to fewer than 3 light sources. Each additional light reduces performance.
- **Compression:** Enable "Geometry Compression" and set it to "Performance" during export.
- **Embeds:** Avoid multiple embeds per web page. Stick to one or two complex 3D scenes per page maximum. Avoid full-screen embeds if possible, as larger canvases require more pixels to render.

### 6.2 React Integration (`@splinetool/react-spline`)
To embed Spline scenes in React:
```bash
npm install @splinetool/react-spline @splinetool/runtime
```

**Basic Usage:**
```jsx
import Spline from '@splinetool/react-spline';

export default function App() {
  return (
    <div>
      <Spline scene="https://prod.spline.design/YOUR_SCENE_URL/scene.splinecode" />
    </div>
  );
}
```

### 6.3 Interacting with Spline Objects (React)
You can query objects by name or ID and manipulate them (move, hide, trigger events) via React refs.

```jsx
import { useRef } from 'react';
import Spline from '@splinetool/react-spline';

export default function App() {
  const cube = useRef();

  function onLoad(spline) {
    // Find the object named 'Cube' in the Spline scene
    cube.current = spline.findObjectByName('Cube');
  }

  function moveObj() {
    if (cube.current) {
      // Move the object in 3D space
      cube.current.position.x += 10;
    }
  }

  return (
    <div>
      <Spline 
        scene="https://prod.spline.design/YOUR_SCENE_URL/scene.splinecode" 
        onLoad={onLoad} 
      />
      <button onClick={moveObj}>Move Cube</button>
    </div>
  );
}
```

### 6.4 Triggering Spline Events
Spline allows you to define events (like `mouseHover`, `mouseDown`, `keyDown`) in the editor and trigger them via code.

```jsx
import { useRef } from 'react';
import Spline from '@splinetool/react-spline';

export default function App() {
  const splineApp = useRef();

  function onLoad(splineAppInstance) {
    splineApp.current = splineAppInstance;
  }

  function triggerHover() {
    // Trigger the 'mouseHover' event on the object named 'Cube'
    splineApp.current.emitEvent('mouseHover', 'Cube');
  }

  return (
    <div>
      <Spline 
        scene="https://prod.spline.design/YOUR_SCENE_URL/scene.splinecode" 
        onLoad={onLoad} 
      />
      <button onClick={triggerHover}>Trigger Hover</button>
    </div>
  );
}
```

### 6.5 Using Spline Variables
Spline Variables allow you to create reusable values (like numbers, booleans, or strings) in the editor and update them dynamically from code.

```jsx
import { useEffect } from 'react';
import Spline from '@splinetool/react-spline';

export default function App() {
  const splineApp = useRef();

  function onLoad(splineAppInstance) {
    splineApp.current = splineAppInstance;
    
    // Update variables after the scene loads
    splineApp.current.setVariables({ 
      myTheme: 'dark', 
      score: 100 
    });
  }

  return (
    <div>
      <Spline 
        scene="https://prod.spline.design/YOUR_SCENE_URL/scene.splinecode" 
        onLoad={onLoad} 
      />
    </div>
  );
}
```

---

## Part 7: Master Prompt Template

Use the following template when interacting with AI coding assistants. Paste this along with the contents of this document.

```
You are a senior UI/UX designer and frontend developer with deep expertise in 
creating distinctive, intentional visual designs and interactive 3D experiences.

## Project Brief

- **Product Type:** [e.g., SaaS dashboard / e-commerce site / portfolio / landing page]
- **Target Audience:** [e.g., developers aged 25-40 / small business owners / designers]
- **Core Purpose:** [e.g., "Help users track their fitness goals" / "Showcase my photography"]
- **Brand Vibe:** [e.g., minimal and professional / playful and colorful / dark and technical]
- **3D Requirements:** [e.g., "Interactive 3D blob in the hero section" / "Rotating product model" / "None"]
- **Framework:** [e.g., React + Tailwind CSS / Next.js / Vue]

## Design Requirements

1. **Distinctiveness:** Do NOT use generic AI design defaults. Make deliberate, opinionated choices specific to this brief.
2. **Typography:** Choose a distinctive display font paired with a readable body font.
3. **Color System:** Define 4-6 named colors using the 60-30-10 rule. Ensure WCAG contrast compliance.
4. **Spacing:** Use an 8-point grid.
5. **Layout:** Vary section layouts. Avoid repetitive patterns (e.g., cards in cards).
6. **Motion:** Add purposeful animations only. Use ease-out or spring curves. Never use bounce easing.
7. **3D Integration (If applicable):** Use `@splinetool/react-spline` for React projects. Optimize polygon counts and limit lights to <3. Use React refs to interact with 3D objects and trigger events based on user scroll or clicks.

## Deliverables

Generate:
1. A design plan (token system: colors, type, layout, signature element)
2. Fully functional, responsive code
3. Mobile-first with breakpoints at 640px, 768px, 1024px, 1280px
4. Accessible (keyboard nav, ARIA labels, sufficient contrast)
5. A brief explanation of design decisions made
```
