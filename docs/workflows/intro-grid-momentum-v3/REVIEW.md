# Intro: fine square waves and signed wheel momentum

The intro restores the original square-field character at 40/20 CSS px. Wheel
input now builds signed momentum, brakes through zero, reverses and coasts to
rest. Automatic opening drift continues until wheel takeover, seeded from the
actual displayed velocity. A rested manual field stays at rest.

Base is the latest smoke-only public source
`aa14ba51f57f16d1a76273b4657f5d49bf9a089e`. The pack's instruction to preserve
neon predates Mani's explicit smoke-only correction; no tubes are restored.
Grid/theme was checked and checkpointed first at
`9997c5c34822fa7d94b8cca69ee8fa4f5cfa96a3`, then momentum implemented. Tested
runtime: `77554bafc2ec438216d9d67a41023869187e5a11`.

## Shape, palette and provenance

Reuse [Tom Hinton's Waves](https://codepen.io/TomHinton/pen/EajJrBd), its original
`fract` square mechanic and existing MIT notice. Narrow seam treatment uses
1.25 CSS px per side with a drawing-pixel antialias minimum. Keep broad cosine
warp and unwrapped active clock. Light remains `#fafbfd/#e4e9ef`; dark retains
`#050607` and uses local crest `#1c222c`. No global exposure, lettering, camera,
ring geometry, assets, content or output conversion changes.

## Transport and input

One Ringwriter/stepIntroZoom owner remains. DOM wheel intent uses CSS pixels:
pixel/line/page modes are normalized once, measured line height (16px fallback)
and current viewport height. See [MDN units](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode)
and [WheelEvent](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent).
Modifiers, horizontal wheel, nested native controls, menus and Worlds retain
native input scope. Static wheel retains positional zoom; no controls added.

120 normalized px adds .04 momentum units. Reservoir decay is 2s, response .15s,
with smooth target `.65*tanh(m/.65)`. A .9 reservoir bound prevents hidden energy
backlogs; invalid, unknown-mode and over-10000px packets are rejected. These
numerical guards replace the former .1625 speed cap. No extra OS inertia model.
Exact reservoir decay and RK4 response/travel use at most 1/240s substeps with
.1s maximum active catch-up; rest cutoff is 1e-7. Last nonzero direction follows
displayed velocity. Holds fence wheel intent; exactly-once release/shuffle/wait
and explicit keyboard/pinch paths retain their existing ownership.

## Validation

- Production build/typecheck, wave owner/failure contracts, original
  lattice/projection/infinite-zoom checks: PASS.
- Updated production transport suite: 20 contract groups. Only old wheel
  floor/return/cap assertions replaced; unaffected coverage retained. Same suite
  fails baseline on manual-rest buildup. Symmetry tolerance 1e-9, same-time
  split packets 1e-12. Fixed events at 30/60/120/240Hz: tolerance 1e-7,
  observed max velocity error 9.81e-11 and travel error 1.48e-11.
- Matched real wave/ring materials: 14 theme/phase/viewport/DPR cases, both
  wave-only and composite. Production IBM Plex loaded. Glyph-only pixel hashes
  and ring attributes identical. Light/dark/portrait frames opened and inspected.
- Native Chromium/RTX4070 trusted automated wheel: both themes exceed old cap,
  brake through exactly one wheel zero crossing and coast below automatic rate.
  Observed buildup -.230/-.218, reversal +.222/+.210, after 8s coast +.00492/+.00484.
  Hold/release/keyboard, rapid theme retarget and no wave draws in Worlds pass.
  Modifier/nested consumption probes are labeled untrusted fixtures.
- Current OS/setting less-motion/frozen redraw checks and smoke-only/project/
  leave/reentry/portrait entry checks: PASS. Browser errors zero.

Unedited light/dark recordings, actual input/velocity traces, matched before/
after frames, raw receipts, source ZIP, clean-extraction rebuild comparison and
remote SHA are in the source-bound review artifact. Early fixture startup,
reversal-window and fallback-font evidence is retained separately. No new GPU/
CPU benchmark or physical performance claim; waves keep the existing one-plane
resource owner and momentum work is bounded. Frame inspection is not continuous
playback approval. Physical mouse/trackpad, Safari, hardware high refresh, true
browser zoom and subjective motion/tactile quality remain unverified.

Testing branch `testing/intro-grid-momentum-v3-20261024-01a16be6` is explicitly
excluded from automatic deployment. Existing guards and notices retained.
This task grants no main integration or deployment authority; review the
candidate before any separate publication instruction.
