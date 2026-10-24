# Worlds tubes neon refinement v2

The cursor bundle is shorter, has bright project-tinted cores and a soft colored
halo beyond its silhouettes, and travels through a more visible circular idle.
The existing smoke and native cursor remain. Technical validation is complete;
Mani's visual/motion and integration approval remains pending.

## Parameters and preservation

- Nine rounded strands, 32 resampled cross sections each, 8 sides, outward winding
  and transported frames preserved. Preallocated 80-tick fixed 60Hz head/color
  history replaces the 72-link follower. A spatial cap 200 CSSpx (or 45% of narrow
  viewport width) and moving age 0.32s bound the actual supported arc. Both actual
  ends taper to zero. Idle memory rises to 1.17s without resurrecting discarded tail.
- Idle radius 42 CSSpx, revolution 5.5s, dwell 0.5s, rise 0.45s, return 0.18s. Small
  subordinate weave/depth keeps the traveling arc dimensional. One existing
  orbit/active-time owner; no independent target, synthetic smoke input or RAF.
- Tube-only linear emission into two RGBA8 targets, separable 9-tap Gaussian blur
  with 10 CSSpx support, then colored premultiplied composite and sharp shaded
  body. Half drawing-buffer resolution, each dimension capped at 1024. Target
  pixel storage is 2.59MB at 1440×900/DPR1 and at most 8MiB overall; no depth target.
  One tube draw becomes five (emission, two blur, composite, body).
- Displayed smoke pigment and its history feed body/halo together. Emission/blur
  store unencoded linear RGB/coverage; only the final halo/body use the installed
  output conversion, with halo premultiplication after conversion. Light uses a
  tinted alpha composite; dark uses a brighter colored composite. No global
  exposure/bloom, scene texture, new setting, renderer, dependency or creator bundle.
- Real controls stay quiet; leaving/blur clears stale event state. Keyboard,
  coarse/touch, hidden/reduced motion and scene gating retain their policy.
  Targets/materials/listeners are owned/disposed, and pending preparation stops
  at disposal before accessing the released program or starting another compile.

Latest Waves baseline local `87c81e5424ec0968e0265809cae261462c8d3e35`, public
`c9de2e5ee7e879e46b5f71f3490c36158e2007ce`. Final runtime
`d7323d65d9c20f177447b298d87eae6cb080017b` (build04). Exact final local/public
delivery identities, output/capture hashes and archive receipts accompany the
review ZIP. Waves/HubScene, typography/transport, smoke, UI, all 11 projects,
protected Pelagic, real media, dependencies and source notices are unchanged.
Original and previous candidates/history remain recoverable.

## Reference and evidence

Kevin Levron's [original Tubes Cursor](https://codepen.io/soju22/pen/qEbdVjK)
and the supplied original recording inform the compact luminous strand character.
The project-color adaptation and requested circle are intentional. Original
code remains independently authored; existing Pen CC BY-NC-SA4.0/package ISC
discrepancy stays recorded in `public/licenses/Worlds-Tubes-Sources.md`. No creator
bundle/reference video ships in the application or testing branch.

The [official bloom example](https://threejs.org/docs/pages/UnrealBloomPass.html)
informed the local blur approach. This implementation does not use a global
composer or adopt that example's tone mapping. The installed renderer/chunks and
[color documentation](https://threejs.org/manual/pages/color-management.html)
were inspected for linear/output responsibilities and DPR viewport ownership.

Actual matched production-resource inputs, same camera/CSS size/pigment:

| Trajectory | Baseline mean arc CSSpx | Revised mean arc CSSpx |
| --- | ---: | ---: |
| Slow150px/s | 225.8 | 45.3 |
| Medium500px/s | 742.8 | 151.4 |
| Fast700px/s | 1039.2 | 200.0 |
| Tight turn | 465.9 | 97.2 |
|350ms after stop | 733.5 | 2.95 |
|20s stationary | 27.6 | 55.6 |

Independent actual-geometry1600px/s checks cap all strands at200px. Extended
moving tails settle below 5px within 350ms; settled idle remains50–61px of curved
arc. Existing30/60/120Hz simulation RMS stays below 1 CSSpx; this is not physical
refresh-rate evidence. Isolated no-smoke halo captures show 1988–2402 colored
pixels beyond a 3 CSSpx guard around the bare body across light/dark and renderer
DPR1/2. Halo/body centroids align within 2.9 CSSpx. Actual full app keeps smoke.

## Validation

Actual build/typecheck and current tube model/winding/normals/pigment/ownership
checks pass. Actual supported-arc, settling, halo state-restoration/interruption
and exact target-disposal tests pass. Same lifecycle check fails on pre-guard
`69cd613` and passes final source. Same real hover/leave check reproduces the old
stale 0.18 opacity and returns to 0.9997 on the revision while active controls stay
below 0.3. Latest Waves resource and OS/setting static-redraw/entry checks pass.

Native production checks pass for all 11 project pigments/fractional transitions,
20s stationary, leave/reentry, theme retargets, keyboard/hidden behavior, ten real
UI entry cycles, bounded resources, framebuffer/viewport restoration, DPR/short/
coarse portrait and optional shader failure. Final actual slider pointer/keyboard,
reset, dynamic less-motion, help, direct Pelagic/Back fixture, real context loss/
retry and fine-pointer portrait resize pass. Normal application errors are zero.
Full native suite used build03; final04 only moves the disposal guard before
released-program access and is covered by the final model/UI/context checks.

Matched frames, current unedited light/dark before/after recordings, several
project hues and source-bound capture manifests are supplied in the review ZIP.
Full frames/details and original extracted video frames were inspected. Actual
geometry/shader evidence and temporal checks do not invent subjective continuous
playback acceptance. Earlier fixture/automation failures and superseded partial
timings are retained separately and are not final measurements.

## Commands used

From the candidate checkout with Node22.23.2 and installed dependencies:

```sh
npm run build -- --outDir /home/mani/Documents/kattis/portfolio-tubes-neon-v2-intake-01a16be6/build-04
node scripts/worlds-tubes-checks.mjs
node scripts/intro-waves-checks.mjs
V27_NATIVE_GL=1 BASE_URL=http://127.0.0.1:34119/ OUT=/home/mani/Documents/kattis/portfolio-tubes-neon-v2-intake-01a16be6/browser-native node scripts/worlds-tubes-live-checks.mjs
V27_NATIVE_GL=1 BASE_URL=http://127.0.0.1:34119/ OUT=/home/mani/Documents/kattis/portfolio-tubes-neon-v2-intake-01a16be6/preserved-static node scripts/intro-waves-live-checks.mjs
```

Playwright uses `/home/mani/.cache/ms-playwright`. Private native comparison, UI,
quiet, performance and recording harnesses/commands are included in the review
artifact with their actual URL/settings/source identities. Build and checks PASS;
the existing bundle-size advisory remains. No dependency update.

## Fresh performance

Native RTX 4070 headless Chromium, production baseline/final04, 1440×900/DPR1/high
tier. Three warm 5s repetitions per idle/moving workload; dark pair order reversed.
Same pointer-event fixture; no recording, synchronous buffer reads or GPU queries
during CPU/RAF sampling. Script values below are median run CDP ScriptDuration
per observed RAF interval, including whole renderer/application/test overhead. They
are not isolated tube CPU times. RAF intervals are not GPU durations.

| Build | Theme | Workload | Script ms/RAF interval | RAF median | p95 | Max | >50ms |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| baseline | light | idle | 1.220 | 16.70 | 16.70 | 16.80 | 0 |
| baseline | light | moving | 1.091 | 16.70 | 16.70 | 16.80 | 0 |
| candidate | light | idle | 0.649 | 16.70 | 16.70 | 16.80 | 0 |
| candidate | light | moving | 0.751 | 16.70 | 16.70 | 16.80 | 0 |
| candidate | dark | idle | 0.883 | 16.70 | 16.70 | 16.80 | 0 |
| candidate | dark | moving | 0.862 | 16.70 | 16.70 | 16.80 | 0 |
| baseline | dark | idle | 1.679 | 16.70 | 16.80 | 16.80 | 0 |
| baseline | dark | moving | 1.745 | 16.70 | 16.70 | 16.80 | 0 |

Separate true `EXT_disjoint_timer_query_webgl2` around draw submissions, summed
over 60 warmed moving callbacks. Candidate sums body+emission+both blur+halo;
baseline sums old body. No disjoint samples. This excludes clear/upload commands,
pipeline latency and physical display; raw per-pass and adverse results retained.

| Build | Theme | Tube pipeline median ms | p95 ms | Maximum ms |
| --- | --- | ---: | ---: | ---: |
| baseline | light | 0.0061 | 0.0502 | 0.0768 |
| candidate | light | 0.3052 | 1.1387 | 1.5258 |
| baseline | dark | 0.0061 | 0.0369 | 0.0461 |
| candidate | dark | 0.2980 | 0.4721 | 1.1489 |

No all-device performance, physical FPS, calibrated brightness or speedup claim.
Historical 2.2–2.4ms figures and the interrupted pre-guard run are not measurements
of this final revision. Current raw results include any unfavorable observations.

## Delivery and limits

Standing explicit testing-branch delivery authorization applies to
`testing/tubes-neon-v2-20261024-01a16be6`; exact auto-deployment is disabled and
prior guards remain. Public-history delivery excludes private local ancestry.
No main/release integration, deployment, rights purchase or external app change.
The source ZIP safe inventory/CRC/hashes and clean extraction/rebuild comparison
are in separate receipts; unchanged installed dependencies reused, no fresh
`npm ci` claim. Keep either prior checkout to decline this candidate.

Human continuous-playback/visual approval, physical devices/displays, Safari,
true desktop zoom, calibrated luminance and assistive technology remain UNVERIFIED.
Portrait/touch/DPR are emulation; hidden state is an explicit fixture and external
Pelagic response is intercepted only for the browser navigation test. Recordings
are 25fps artifacts, not runtime FPS. All source evidence and human gates preserved.
