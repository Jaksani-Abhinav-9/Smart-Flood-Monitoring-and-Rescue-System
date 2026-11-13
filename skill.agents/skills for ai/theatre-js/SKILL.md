---
name: theatre-js
description: "Cinematic timeline animation, 3D camera choreography, Threlte/Three.js scene orchestration, and state-driven 3D camera transitions. Use for smooth view switching, interactive 3D camera pans, and cinematic reveals."
---

# Theatre.js & Threlte 3D Motion Orchestration Skill

Theatre.js and Threlte provide programmatic, timeline-based motion choreography for Three.js, WebGL, and DOM environments.

## Core Capabilities & Architecture

1. **Timeline-Based Camera Choreography**:
   - Animate 3D camera position (`x`, `y`, `z`) and focal point (`lookAt`) seamlessly when users switch between views.
   - Example: Transitioning from **2D Overview Map** to **3D Command Grid** smoothly pans and tilts the camera from `(0, 50, 0)` top-down to `(0, 15, 25)` angled 3D view over 0.8 seconds.

2. **State-Driven Sequences**:
   - Trigger emergency alert camera sequences when a new SOS request arrives in Firestore.
   - Smooth easing curves (`cubic-bezier(0.165, 0.84, 0.44, 1)`).

3. **Performance Optimization**:
   - Pause render loops when the tab is hidden (`document.hidden`).
   - Limit pixel ratio to `Math.min(window.devicePixelRatio, 2)`.
