# Worlds tubes — review candidate

The Worlds cursor now has nine rounded, lit, tapered tube strands over the
existing project smoke. Moving input produces a supple bundle; stationary input
eases into a small slow circle about the real pointer. Leaving the viewport
retains that last observed anchor. Smoke, native cursor, hover hit testing,
perimeters and current UI remain independent. The completed Waves intro is
preserved and never draws tubes.

Corrected runtime checkpoint: `a23d13c7cedf302e57cef8ad902dd68caa4a85ce`.
Local baseline: `48e7fdaa184ac902a31f10695654653c5bb1fb14` (completed Waves).
Public equivalent baseline: `8269e24adde885b0d8d3c682a36517b700a8ef16`.
Final local/public identities, build hashes and archive receipt are in the
external delivery packet. Private development ancestry and creator research
bundle are excluded from GitHub delivery.

- [Candidate preview](http://127.0.0.1:42595/)
- [Unchanged Waves baseline](http://127.0.0.1:45733/)
- [Testing branch](https://github.com/Denoax/portfolio/tree/testing/worlds-tubes-20261023-01a16be6)
- [Design/source/parameter record](SOURCE_RECORD.md)

## Implementation and preservation

One disposable owner uses the existing renderer/frame loop. It owns one dynamic
geometry, one locally lit material and no render targets or new dependencies.
Real three-dimensional ring sections have smoothly tapering ends, transported
normals, self occlusion and per-point color history. Active tube pigment copies
the smoke's exact displayed linear pigment after its existing response step,
including fractional reel positions. Theme alters local shading without a
separate palette or phase restart.

Only read-only pigment getters were added to the smoke classes. Their admission,
history, idle, stale-input and clear policies are unchanged. Synthetic orbit
coordinates enter only the new tube head. Geometry follows a bounded fixed-step
simulation; large pointer jumps, resize and hidden-page resume reseed it.
Keyboard/touch/coarse input suppresses decorative pointer ownership. The site's
existing less-motion/static and graphics-retry policies remain authoritative.
Controls/glass/DOM text stay above the decorative pass. Quiet controls ease local
opacity to 0.18 rather than stopping all motion.

## Validation

`npm run build` passed with the pinned installed dependencies. No package or
lockfile change. Existing bundle-size warning remains; no quality was lowered.

`node scripts/worlds-tubes-checks.mjs` passed actual production contracts for
circle/dwell/drag/leave math, pointer lifecycle, tapered rounded geometry, finite
unit normals, buffer reuse, exact pigment input/history, hidden pause/resume,
section ownership, optional failure and idempotent cleanup. Simulated 30/60/120
Hz geometry RMS versus 120 Hz was 0.473/0/0 CSS px; actual different-refresh
displays were not tested.

The native GPU live check passed all eleven project pigment comparisons, a real
fractional smooth-scroll transition, twenty seconds stationary without new smoke
samples, visible viewport leave/re-entry, rapid theme retargets, a labelled hidden
document fixture, keyboard input, portrait/coarse emulation, short landscape and
DPR2. Ten actual intro/Worlds UI cycles held 10 geometries, 15 textures and one
canvas throughout. No normal application runtime/console errors. Deliberately
invalid tube GLSL kept the smoke/interface usable; its expected diagnostics are
retained separately.

Additional actual UI checks passed settings brightness/reset, quiet-control
fading, dynamic less motion, help tabs/close, direct Pelagic external navigation
and browser Back, and `WEBGL_lose_context`/Retry graphics recovery. The external
response was a clearly labelled static routing fixture. Inherited Waves resource
checks, seven intro geometry cases, seventeen transport contracts, and both
OS/setting reduced-motion browser paths passed.

Earlier harness failures are retained: native snap prevented a fabricated
half-section resting position; a theme assertion preceded actual convergence;
a slider key check preceded pane/focus completion; Back recreated diagnostics
after the DOM returned. Harnesses now observe actual readiness/native behavior.
The same slider check passed on baseline and candidate, with native input/change
events and no prevented key default. No unrelated control behavior was changed.

Frame review caught a real geometry defect in the first candidate: triangle
winding opposed outward normals and hid the lit outer surface. Correcting index
orientation exposes the intended highlights. The same geometric regression
fails on old `f5256d8` and passes on corrected `a23d13c`; final native checks and
new recordings use the corrected build. Earlier captures/performance remain
explicitly identified as pre-correction evidence.

## Measured cost

Final corrected runtime `a23d13c7cedf302e57cef8ad902dd68caa4a85ce`, native
RTX 4070/ANGLE headless Chromium, 1440 × 900 / DPR 1, observed high quality on both
builds. Three warm five-second repetitions per build/theme/workload; dark pair
order reversed. No recording, synchronous geometry reads or GPU queries in the
paired CPU/RAF run. Moving workload uses matched DOM pointer events; actual
browser pointer interaction comes from separate checks.

Across eight aggregates: 7224 RAF intervals, median 16.7 ms, p95
16.7–16.8 ms, maximum 16.8 ms, 0 intervals over 50 ms.
This measures a 60 Hz callback workload, not GPU time or device-wide approval.

| CDP JavaScript ms per callback, average | Baseline | Candidate |
| --- | ---: | ---: |
| Light idle | 1.769 | 4.189 |
| Light moving | 1.735 | 4.031 |
| Dark idle | 2.120 | 4.301 |
| Dark moving | 2.115 | 4.451 |

The feature adds roughly 2.2–2.4 ms of renderer
JavaScript in these workloads. CDP script/task deltas include shared test-fixture
overhead and do not represent whole-device CPU time. Native cadence held, but
this additional CPU work can matter on slower devices. Raw repetitions and all
adverse samples are retained.

Separate genuine `EXT_disjoint_timer_query_webgl2` measurements summed individual
draw durations over 60 warm moving frames per build/theme; no disjoint results.

| Smoke + tubes GPU draws, ms | Baseline median / p95 | Candidate median / p95 |
| --- | ---: | ---: |
| Light | 1.351 / 1.878 | 1.412 / 3.312 |
| Dark | 1.232 / 1.738 | 1.201 / 3.791 |

Tube-only median light/dark: 0.0092/0.0082ms;
p95: 0.0276/0.0307ms;
maximum: 0.0307/0.0461ms.
Mixed medians and adverse tails are retained; no speedup is inferred. Summed
draws exclude clears/uploads, queue latency and physical display. Startup to
first diagnostic was 0.512–0.750s including application startup
and existing driver caches, not isolated genuinely cold shader compilation.
The earlier inward-surface run remains separate under pre-correction evidence.

## Reference, rights and human review

The exact pinned Kevin Levron component rendered locally on native GPU. Local
reference, baseline and candidate unedited recordings and their source/asset
hashes are in the delivery packet. Full frames and details were inspected;
automated trajectories/input checks cover temporal behavior. Subjective normal
speed playback/fidelity judgment remains for Mani. No 1:1 or visual acceptance
claim is made. The small requested idle circle intentionally produces a compact
bundle, unlike the reference's large figure eight.

The implementation is independently authored; the creator's standalone engine,
follower/shader code, rainbow lights and bloom are not shipped. Credits retain
the original Pen's CC BY-NC-SA notice and differing ISC package metadata without
asserting unrestricted commercial/public reuse. No purchase or creator contact.
See the full public source/rights notice. The testing branch publishes only the
authored implementation and existing portfolio source, with an exact-branch
Vercel deployment guard. No main/release integration or deployment is authorized.

Physical devices/displays, Safari/WebKit, assistive technology, true desktop
browser zoom, hardware 30/120 Hz and genuinely cold driver compilation remain
UNVERIFIED. DPR/portrait/coarse checks are browser emulation. Human visual and
integration approval remain pending. Keep the unchanged original/Waves branches
to decline the candidate; any later rollback should revert this task's exact
accepted commit on a separate branch, preserving user history.
