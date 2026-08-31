---
name: gpu-particle-systems
description: Engineer and optimize procedural galaxy, attractor, and particle-field systems for this portfolio across WebGL fallback and WebGPU-capable browsers.
---

# GPU Particle Systems

Use when changing galaxy geometry, shaders, simulation, quality tiers, or renderer behavior.

1. Define distinct deterministic populations: core, logarithmic arms, dust, halo, foreground, and narrative particles. Give them unequal density, scale, opacity, depth, and intentional voids.
2. Keep particle state and per-frame motion outside React state. Reuse typed arrays, vectors, uniforms, geometry, and materials; allocate nothing routinely in the render loop.
3. Map color and brightness to physical or narrative state such as radius, energy, velocity, depth, or chapter. Avoid rainbow mappings.
4. Model pointer influence as a weak, distance-limited, damped attractor. It must bend nearby motion subtly and relax after input stops.
5. Feature-detect renderer capabilities. Preserve a deliberately composed WebGL path; enhance with WebGPU/TSL compute only when it is stable and visibly worthwhile.
6. Select a quality tier at startup from viewport, DPR, device class, concurrency, and capability. Scale particle count, DPR, haze, and post-processing together; do not thrash tiers frame by frame.
7. Precompile or prewarm essential material states before reveal. Dispose resources and remove listeners on teardown.

The local Scenes3D attractor project is study material only. Never modify or import it wholesale, expose its debug UI, or reuse code unless licensing is confirmed.
