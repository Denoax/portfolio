---
name: cinematic-choreography
description: Design scroll-driven camera shots, chapter transitions, easing, and synchronized DOM/WebGL motion for the continuous portfolio narrative.
---

# Cinematic Choreography

Use when implementing or revising progression, camera motion, chapter visibility, or interaction timing.

1. Map scroll to a continuous normalized progress value and derive chapter-local progress from it. Avoid hard slides, heavy snapping, and scroll traps.
2. For every state, specify camera position, look target, FOV, dominant screen region, typography anchor, and entry/exit behavior. Interpolate orientation with quaternions when needed.
3. Reuse visual matter across transitions: galaxy to orbit anchors, streams, graph, dual fields, human signals, then convergence. Avoid unrelated scene cuts.
4. Vary the shot language: establishing scale, close pass, profile, core approach, void, graph traversal, and static poster. Provide pauses; do not continuously rotate.
5. Synchronize DOM and WebGL from the same progress signal. Let metadata clear before large moves and let type settle just after the camera.
6. Use scroll velocity only for subtle inertia, streak length, or environmental energy. Never sacrifice legibility during fast scrolling.
7. Provide independent portrait camera poses and a reduced-motion path with shorter travel, calmer particles, and equally deliberate static frames.
