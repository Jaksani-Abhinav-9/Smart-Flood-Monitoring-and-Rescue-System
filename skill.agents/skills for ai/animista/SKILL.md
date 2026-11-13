---
name: animista
description: "CSS keyframe animations, micro-interactions, entrance/exit reveals, button hover effects, and 60fps lightweight motion design rules based on Animista. Use for UI flair, state pulses, loading indicators, and micro-motion."
---

# Animista CSS Micro-Animation Skill

Animista is a curated library of CSS keyframe animations designed for fast, lightweight 60fps micro-interactions without heavy JavaScript libraries.

## Core Categories & Use Cases

1. **Pulse & Heartbeat (`anim-heartbeat`)**:
   - Ideal for emergency buttons (SOS Help), critical alerts, and active GPS pinging.
   ```css
   @keyframes anim-heartbeat {
     from { transform: scale(1); }
     14% { transform: scale(1.05); }
     28% { transform: scale(0.98); }
     42% { transform: scale(1.06); }
     70% { transform: scale(1); }
   }
   ```

2. **Shadow Drop & Lift (`anim-shadow-drop`)**:
   - Ideal for 21st.dev floating cards, action tiles, and interactive buttons.
   ```css
   .anim-shadow-drop {
     transition: transform 0.3s ease, box-shadow 0.3s ease;
   }
   .anim-shadow-drop:hover {
     transform: translateY(-4px);
     box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(0, 242, 254, 0.35);
   }
   ```

3. **Glow Border Pulse (`anim-glow-border`)**:
   - Ideal for high-risk flood zone cards, active telemetry badges, and emergency command panels.

4. **Text Pop-Up (`anim-text-pop`)**:
   - Ideal for headline hovers and metric counter updates.
