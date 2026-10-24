# Waves backdrop refinement v2

The intro backdrop now uses smaller, continuous cells and a quieter light/dark
palette. The merged lettering, transport and completed Worlds tubes are preserved.
Technical verification is complete; human visual and integration review is pending.

## Field and palette

Coarse/fine periods are **48/24 CSS pixels**. Frequency is CSS height / 48 while
sampling uses the actual drawing buffer, so DPR does not change composition.
The two `length(fract(...))` resets are replaced with
`sqrt(dot(sin(pi*p),sin(pi*p)) + .0001)`. Squared sine is periodic; the positive
floor keeps corner derivatives finite. The original broad cosine warp remains.

The oriented cubic ramp uses ordered edges, a minimum half-width of 1.25 fragment
footprints and a smooth orientation blend for edge deltas within ±.035. This
softens narrow ribbon edges and avoids a polarity jump when ramp edges coincide.
There is no framebuffer reduction, scene blur, center mask, extra pass or curtain.

| Theme | Base | Shading/crest |
| --- | --- | --- |
| Light | `#fafbfd` | `#e4e9ef` |
| Dark | `#050607` | `#151920` |

Only wave-material colors change. Existing linear color interpolation, output
conversion, displayed theme mix, brightness and global exposure stay authoritative.
The shared active clock remains unwrapped and continues behind menus; reduced
motion, optional-wave failure, entry/return and no wave work in Worlds are retained.

## Source and preservation

- Completed local Tubes baseline: `25eece74ac960ead5fc7737455b793ba0b025d12`.
- Equivalent public parent: `4d63675171216bc6574e8dcd8a1e5747af7accc5`.
- Frozen refinement runtime: `06eb89d094c524b813cb420140ce30c524d2b461`.
- Final local/public delivery identities and exact build/capture hashes accompany
  the review ZIP in `DELIVERY.json` and `FINAL_*` receipts.

Runtime changes are confined to `IntroWaves.ts` and one `HubScene.tsx` call that
supplies CSS height. The existing wave resource check covers CSS sizing at DPR2
and portrait. The exact new testing branch is disabled in `vercel.json`.
Ringwriter, core transport/ripples, Worlds smoke/tubes, all projects, protected
Pelagic, real assets, dependencies and notices are unchanged from this baseline.

The original checkout remains clean and untouched. The older SHAs in the supplied
pack were provenance, not reset targets. Tom Hinton's
[published field](https://codepen.io/TomHinton/pen/EajJrBd), the supplied real
feedback captures and current implementation informed this focused adaptation.
The complete original MIT notice and `/credits` attribution remain included.
No generated visual media or new dependency is used.

## Validation and visual evidence

- Actual build/typecheck, existing wave resource checks, 17 transport contracts,
  seven intro geometry cases and preserved tube resource/orbit checks: PASS.
- Fourteen matched production-resource cases cover four phases, portrait, short
  landscape and DPR2 in both themes. The same actual Ringwriter, camera, font,
  pose, wave time, brightness and renderer are used. Foreground-only PNG hashes
  and geometry hashes are identical before/after in every case. This fixture is
  separate from full-application interaction recordings.
- Wave-only linear background mean luminance rises from 0.628–0.769 to 0.834–0.897
  in light, and falls from 0.019–0.035 to 0.005–0.008 in dark. Every field remains
  non-flat. Foreground luminance is excluded from this comparison.
- Actual production full-field GLSL, full-contrast float GPU diagnostic: 1470
  cell-join pairs over seven phases/axes, epsilon±.001 CSSpx. Baseline 459 pairs
  exceed a 0.005 normalized jump (worst 1); refinement 0 pairs (worst0.003940).
  Output color conversion alone is omitted for this diagnostic.
- Actual GPU cell helper value gap falls from 0.9998 to 6.43e-8. One-sided slope
  finite-difference gap at h=1e-4 cell units falls from 10000 to 0.099; the smooth
  positive-floor metric has matching limiting slopes. Actual near-coincident
  ramp sign-crossing gap falls from 1 to 0.000043. Full-field evidence is separate.
- Both themes: uninterrupted 30s segments within unedited 47s application videos;
  hold/release, reversal/ripple input, wheel, 10 rapid theme retargets, menu clocks,
  entry/return, live landscape/portrait resize and hidden-state fixture: PASS.
  Observed wave draw count and uniforms both stop in Worlds.
- Fourteen actual browser scenarios: portrait touch/pinch/entry, short landscape,
  DPR2, brightness 80/140, persisted/default theme, OS/setting reduced motion,
  optional shader failure, no WebGL, context loss/retry and credits/license: PASS.
  Existing live static-redraw/visible-entry regression also passes for OS/setting.
  Normal scenarios report no application errors; injected diagnostics are retained.

Full desktop/portrait frames, field details and extracted original recording
frames were inspected. No hard orthogonal patch joins were seen in those frames.
Automated clock checks do not replace subjective continuous-playback review.
Raw receipts, unedited videos and local harnesses are in the review artifact.
One helper harness readiness predicate initially failed and was corrected to
`window.fixtureReady`; this required no application change.

## Fresh performance measurements

Native RTX 4070 headless Chromium; production baseline/refinement, 1440×900,
DPR 1/high tier. Three warm 5s samples per build/theme, reversed pair order for
dark, no recording/query instrumentation during RAF measurement. All four rows
have median 16.7ms, p95 ≤16.8ms, maximum 16.8ms and no interval over 50ms. Both builds
retain six intro draws. RAF intervals are callback intervals, not GPU durations.

Separate actual `EXT_disjoint_timer_query_webgl2` wave-only draws, 60 samples after
30 warm draws per row; all 1440×900 and no disjoint samples:

| Build | Theme | Median ms | p95 ms | Maximum ms |
| --- | --- | ---: | ---: | ---: |
| Baseline | Light | 0.028672 | 0.028672 | 0.031744 |
| Refinement | Light | 0.029696 | 0.076800 | 0.076800 |
| Refinement | Dark | 0.106496 | 0.126976 | 0.144384 |
| Baseline | Dark | 0.141312 | 0.146432 | 0.162816 |

These short GPU profiles vary with GPU state; adverse samples are retained.
No speedup, physical-display timing or all-device performance guarantee is claimed.
Earlier intro GPU results are not used as measurements of this refinement.

## Delivery boundary and limits

Standing explicit testing-branch instructions authorize
`testing/waves-refinement-v2-20261024-01a16be6`. Its commit is constructed on public
testing history with only scoped files, excluding private local ancestry. No
force push, main/release integration or deployment. Original and completed Tubes
checkouts remain available to decline this refinement.

The review ZIP includes exact-source archive/inventory, safe-path/CRC/hash checks,
clean-extraction rebuild receipts, raw evidence and source identities. Rebuild
reuses the unchanged installed dependency tree; fresh `npm ci` is not claimed.
Human visual/motion acceptance, physical devices, Safari/WebKit, calibrated
display brightness, actual desktop zoom and assistive-technology checks remain
UNVERIFIED. Portrait/touch/DPR are browser emulation; hidden state uses an explicit
document visibility fixture. Recordings are 25fps artifacts, not runtime FPS.
