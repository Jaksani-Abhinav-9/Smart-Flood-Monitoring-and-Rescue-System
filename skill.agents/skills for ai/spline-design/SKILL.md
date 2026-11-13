---
name: spline-design
description: "Interactive 3D web model creation, Spline WebGL canvas embeds, 3D icon objects, mouse look-at tracking physics, and bounded container 3D element design. Use for 3D UI assets, floating interactive 3D elements, and 3D product previews."
---

# Spline Design 3D Web Skill

Spline is a web-based 3D design and WebGL rendering engine for embedding interactive 3D assets into modern web apps.

## Key Integration Patterns

1. **Bounded Canvas Isolation**:
   - Always embed Spline/WebGL canvases inside fixed container bounds (`width: 100%`, `height: 300px`, `overflow: hidden`) so 3D objects never obscure titles, text, or main navigation buttons.

2. **Interactive 3D Elements**:
   - **Interactive 3D SOS Beacon**: A glowing 3D beacon model that rotates and responds to hover/click events.
   - **3D Flood Gauge Wheel**: A 3D meter showing water height (0.0m - 5.0m) with dynamic color transitions.
   - **3D Rescue Drone & Boat Asset**: A floating 3D vehicle model for team dispatch status.

3. **Event Listeners & Look-At Tracking**:
   - Use cursor tracking events (`onPointerMove`) to subtly tilt 3D models towards the user's mouse position for an immersive feeling.
