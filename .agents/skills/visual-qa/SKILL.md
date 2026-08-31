---
name: visual-qa
description: Visually verify and refine the portfolio across required desktop and mobile narrative states, including composition, interaction, accessibility, and performance.
---

# Visual QA

Use after the first coherent frame and after each major implementation pass.

1. Capture at minimum desktop hero, career, ICPC, and horizon plus mobile hero, mid-experience, and horizon.
2. Score each frame from 1-10 for composition, typography, depth, light, hierarchy, originality, and polish. Treat any category below 8 as unfinished.
3. Inspect for washed blacks, uniform dots, excessive bloom, weak silhouettes, text/scene collisions, awkward wrapping, tiny type, generic UI, disconnected chapters, and desktop merely scaled to mobile.
4. Exercise scroll progression, chapter navigation, email copy, LinkedIn, resize, direct refresh, fallback rendering, and reduced motion. Check the console and network for runtime errors and missing assets.
5. Perform two deliberate refinement passes after functionality: first fix composition/hierarchy/depth, then fix timing/microdetail/responsive polish.
6. Validate the production build from `dist/` through a static server, not only the development server.

Record concrete observations and change the source before accepting a low-scoring frame.
