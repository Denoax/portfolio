# Portfolio Constitution

## Project identity

This repository will become the personal portfolio of **Mani Marami Milani**, a Computer Science and Mathematics student whose professional experience spans software, scientific-data infrastructure, automation, CI/CD, ETL-style pipelines, systems work, competitive programming, and technical problem solving.

The site must be both a memorable portfolio and an interactive demonstration of technical ambition. The visual experience is part of the work; this must not become a conventional resume site.

## Governing concept

The creative direction is a cinematic **galaxy / gravitational-field experience** governed by the metaphor **information under gravity**. Resume information, work history, technologies, algorithms, and personal material should inhabit one coherent spatial universe of attraction, orbital motion, particle systems, stellar fields, constellations, signals, coordinates, data streams, darkness, light, depth, scale, and distortion.

Aim for an interactive title sequence, digital art installation, creative-development experiment, or cinematic WebGL piece. Every major decision must pass this test: does it feel like high-end creative development, or like a developer portfolio template?

## References and originality

- `https://interactive.galaxy.com/` is the primary art-direction reference. Study its black space, contrast, restrained typography, editorial composition, minimal chrome, technical line work, scale changes, scroll choreography, spatial depth, controlled motion, and visual confidence. Do not copy its branding, writing, assets, layouts, navigation, graphics, or identity.
- A local copy based on `Scenes3D/attractors` exists as technical reference material. Inspect the repository to locate it; never assume its path. Do not modify it unless the user explicitly asks. Do not treat its architecture or debug UI as production design.
- Learn from its Three.js, WebGPU, TSL/node-material, GPU-compute, storage-buffer, attractor, force, damping, speed-limiting, additive-rendering, and velocity-color techniques. Reinterpret the mathematics for galaxy arms, orbital fields, particle transitions, constellations, data flow, cursor influence, and event-horizon effects. Do not import the whole app or blindly copy code. Treat code as study material until its reuse license is verified.
- Extract principles from references; never plagiarize proprietary assets, exact compositions, or written language. The final identity must be Mani's own.

## Art direction

Visual quality is a functional requirement and the primary product goal. Prioritize approximately: art direction, composition, camera choreography, motion, lighting, particles/shaders/materials, typography, interaction detail, narrative cohesion, performance that preserves the experience, then conventional portfolio structure. A correct but generic implementation is unsuccessful.

The character is cinematic, dark, editorial, cosmic, precise, minimal, mysterious, technical, elegant, monumental, spatial, restrained, high-contrast, deep, and polished. Preserve moments of stillness. Use contrast between motion and silence, massive forms and microscopic type, blackness and concentrated light, simulation and minimal interface, organic particles and precise typography, and near-camera depth and distant scale.

Important frames must work as deliberate still images. Ask: if this exact frame were posted as a screenshot, would it look intentionally art-directed? If not, it is unfinished.

## Color and light

The foundation palette is directional, not a mandate to use every color:

- Void Black `#020205`
- Deep Space `#05060A`
- Carbon `#0B0D12`
- Graphite `#171A21`
- Starlight / primary text `#F2F0E9`
- Muted text `#8C9099`
- Ion Blue `#7AA7FF`
- Solar Amber `#E8A15B`
- Distant Violet `#7567D8`

Near-black must dominate. Prefer off-white text. Use ion blue selectively, amber as concentrated stellar energy, and violet rarely. Favor localized light, warm stellar cores, cool distant structures, muted background particles, and color tied to velocity, depth, energy, or narrative state. Prefer one meaningful accent family per major moment.

Never make a generic blue-purple gradient universe. Avoid constant neon, cyan-magenta gradients, rainbow shaders, random star colors, excessive saturation, overexposed bloom, or making every object and UI element glow. Preserve true darkness; bloom must not turn black backgrounds grey.

## Typography, layout, and UI

Typography must be editorial and intentional: very large display type, tiny technical metadata, and restrained readable body copy. Suitable directions include Geist, Instrument Sans, Inter, Helvetica-like grotesks, IBM Plex Mono, and Geist Mono. Verify font licenses before downloading or redistributing them.

Use scale, masking, clipping, negative space, viewport cropping, parallax, scene-state reveals, and coordinated camera motion. Avoid constant letter-by-letter animation, typewriter effects, and fake-terminal aesthetics.

Favor asymmetry, strong negative space, clear hierarchy, one dominant focal point, precise spacing, and compositions built around the active 3D frame. Do not automatically center everything.

Keep the interface sparse: chapter numbers, coordinates, progress, small navigation labels, location, year, role, system metadata, resume, email, LinkedIn, and an optional sound state. It should resemble editorial annotation or scientific notation, not a spaceship dashboard. DOM typography over WebGL is welcome, but DOM and 3D must behave as one composition, never an HTML site floating over a Three.js background.

## Galaxy, gravity, camera, and motion

The galaxy must have recognizable, uneven structure: spiral arms, stellar core, dust bands, density variation, orbital streams, attractors, high-energy knots, sparse remote stars, depth-separated populations, haze, trails, clusters, and large voids. Never settle for a uniform random `Points` cloud.

Gravity is the recurring interaction language. Cursor influence should be weak and subtle; information can assemble around attractors, milestones can distort streams, skills can form clusters, algorithms can alter graph fields, and scroll can change global gravitational state. Users should feel influence rather than direct control. Never make particles violently chase the pointer.

Use authored cinematography with designed key compositions: slow dollies, large-scale pushes, foreground flybys, off-axis framing, restrained roll, parallax, focal-scale changes, stillness, near-camera crossings, depth reveals, and slingshot transitions. Do not expose unrestricted OrbitControls or create a rotatable galaxy demo. Avoid constant rotation, excessive shake, and motion that causes discomfort.

Motion must feel physical and costly: astronomical structures move slowly, small particles may move quickly, and UI interactions are fast and precise. Tune easing carefully. Avoid bouncy or elastic UI, cartoon motion, random motion, purposeless animation, repetitive fade-ups, frustrating scroll hijacking, and effects without narrative function.

## Narrative and content

Design narrative states inside one continuous universe, not a stack of Hero/About/Skills/Experience/Contact templates. Reuse visual material across transitions: galaxy particles can become career orbits, then data streams, skill constellations, algorithm graphs, and finally collapse into a gravitational field.

Never invent employers, titles, metrics, projects, technologies, awards, rankings, dates, education, accounts, or social links. A current resume or factual repository source is authoritative. Cinematic condensation must preserve factual meaning. Keep detailed resume content accessible without crowding the primary layer. Do not prominently expose private-looking addresses or phone numbers unless explicitly requested.

Never use portfolio clichés such as “Hi, I'm Mani,” “Welcome to my portfolio,” “I am a passionate developer,” “Turning ideas into reality,” “Crafting digital experiences,” “Code. Create. Innovate.,” “Hello World,” or generic “Let's create something amazing” calls to action unless the user explicitly requests that style. Confidence should come from the work and its presentation.

## Forbidden design patterns

Do not use generic portfolio templates, Tailwind-template aesthetics, shadcn/Bootstrap/Material visual language, glassmorphism cards, ubiquitous bento grids, floating skill pills, skill percentages, progress bars, rainbow or purple-gradient backgrounds, glowing rounded rectangles, huge radii, logo clouds, floating cubes, stock astronauts or rockets, rotating Earths, random planets or asteroids, default starfields, Matrix rain, fake terminals or operating systems, cyberpunk HUD overload, constant glitch/chromatic aberration/VHS effects, giant cursor blobs, universal glow, universal centering, disconnected section templates, or obviously AI-generated copy.

## Technical direction

Unless later repository constraints strongly indicate otherwise, prefer React, TypeScript, Vite, Three.js, React Three Fiber, Drei where genuinely useful, GSAP for authored cinematic timelines, and custom GLSL or TSL when it materially improves the image.

Treat WebGPU as a meaningful capability for advanced particle simulation, not a buzzword. Where sensible, provide graceful degradation or a compatible alternative. React orchestrates state and UI; high-frequency visual state belongs in GPU simulation, Three.js objects, refs, typed arrays, storage buffers, and shader logic. Never drive hundreds of thousands of per-frame particle updates or routine animation-frame renders through React state.

Inspect before rewriting. Understand the current architecture, make deliberate changes, avoid unnecessary dependencies, keep render-loop allocations low, reuse geometry and materials, clean up Three.js resources, and separate simulation, rendering, choreography, and content where useful. Avoid giant monolithic scene files, but do not over-engineer abstractions before proving the visual direction.

Debug tools such as lil-gui, stats, OrbitControls, TransformControls, shader controls, and camera helpers are allowed during development but must never survive as accidental production UI.

## Performance and responsive art direction

Performance protects visual quality. Plan adaptive DPR, GPU simulation, instancing, storage buffers, geometry/material reuse, compressed assets, intentional texture sizes, lazy loading, quality tiers, mobile particle budgets, post-processing budgets, and allocation-free render loops. Do not optimize away the central image prematurely, but treat dropped frames as a visual defect.

Mobile is a distinct portrait composition, not shrunken desktop. Adjust camera pose, particle density, focal scale, typography wrapping, post-processing, interaction, DPR, and camera travel as needed. Do not replace the immersive mobile experience with ordinary cards simply because 3D is harder.

## Accessibility and audio

Honor `prefers-reduced-motion`, keep essential links keyboard accessible, preserve semantic content and readable contrast, avoid scroll traps and rapid flashes, and make the art direction survive as strong static compositions. Audio must never be required or intrusively autoplayed. If added, expose a clear mute state and favor restrained drones, resonance, granular texture, and quiet spatial tones over lasers, spaceship effects, trailer impacts, and constant beeps.

## Visual development and QA

For major visual work, prove one exceptional composition before expanding the full site. Run it, inspect it, and refine composition, lighting, typography, and motion before extending the language. One exceptional scene with a coherent foundation is better than a mediocre hero plus eight mediocre sections.

Compilation is not visual verification. Inspect representative desktop, laptop, mobile-portrait, and high-DPI states. Check for weak composition, washed blacks, excessive bloom, generic particles, unresolved type hierarchy, awkward wrapping, scene/text collisions, shallow depth, poor mobile framing, over-animation, UI clutter, and template-like design. Fix visual defects before declaring completion.

A visual feature is complete only when it belongs to the art direction, has been visually inspected, has intentional motion and typography, has deliberate responsive behavior, performs acceptably, avoids generic portfolio patterns, and advances the continuous galaxy narrative. Rendering, compiling, animating, loading, or functioning alone is insufficient.

## Decision filter

When choosing between implementations, ask which creates the stronger image, greater depth, clearer intention, least template-like result, best expression of the galaxy/gravity metaphor, sufficient performance for fluid motion, and most memorable portfolio. Choose neither complexity for its own sake nor simplicity for convenience; choose what serves the experience.

## Repository skills

This file contains rules that apply broadly. Specialized, reusable workflows belong in `.agents/skills/<skill-name>/SKILL.md`, with valid name/description metadata and clear trigger conditions. Before complex implementation work, inspect available skills and use those whose descriptions match. Do not inflate this constitution with detailed specialist procedures.

## Final principle

The finished portfolio must feel **complex underneath, controlled on the surface**. Visitors should notice scale, beauty, depth, motion, precision, atmosphere, and craft before they notice the technology. The technology exists to create the image; the image exists to make Mani memorable.
