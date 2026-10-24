# Worlds tubes — source and design record

This task follows the completed Waves intro, using actual local commit
`48e7fdaa184ac902a31f10695654653c5bb1fb14` as its baseline. The equivalent
public testing source is `8269e24adde885b0d8d3c682a36517b700a8ef16`.
The older pack's public `10c9368…` snapshot is not restored. Mani explicitly
authorized direct implementation; obsolete Paseo dispatch instructions do not
apply. Human visual/integration approval remains separate.

## Reference and implementation route

Requested [FreeFrontend entry](https://freefrontend.com/webgl/#2026-02-05-neon-3d-tubes-cursor-trail-l)
→ [Kevin Levron / soju22 — Tubes Cursor (WebGL, WebGPU)](https://codepen.io/soju22/pen/qEbdVjK)
→ pinned `threejs-components@0.0.19/build/cursors/tubes1.min.js`.
Downloaded public reference: 774,791 bytes, SHA256
`676abd6ccd18742a36dcb4ffce66a2052a4f203f240cd8cf97c6ea33a181f81b`.
The native RTX 4070/ANGLE reference fixture renders actual strands. Its source
bundle, captures and unedited recording remain local research evidence.

Observed principles used: rounded tapered volume, overlapping supple followers,
shallow depth and narrow moving specular highlights. Explicit adaptations:
restrained intensity, one displayed project pigment, a compact last-pointer
circle, theme-readable shading and the existing renderer/input lifecycle.
Reference typography, rainbow lights, click palettes, full-page suppression,
renderer, postprocessing and source implementation are not shipped.

`WorldsTubes.ts` and `tubeOrbit.ts` are independently authored. They use standard
circle/tube mathematics, parallel-transport frames and bounded following against
the existing Three.js version. They are not presented as the creator's private
component source or an exact reproduction. The Pen's explicit CC BY-NC-SA 4.0
notice conflicts with the package's ISC metadata; see the retained
[source/rights notice](../../../public/licenses/Worlds-Tubes-Sources.md).
No unrestricted commercial rights, creator permission or endorsement is claimed.

## Final implementation parameters

| Property | Value |
| --- | --- |
| Strands / rings / radial sections | 9 / 72 / 8 |
| Vertices / triangles | 5,832 / 10,224 |
| Middle body diameters | 1.8, 2.7, 3.6, 4.5 CSS px, repeating |
| Taper | `sin(pi * lengthFraction)` at both ends |
| Follower | 60 Hz fixed simulation, 0.05 s delta cap, render interpolation |
| Per-link response at 60 Hz | 0.36–0.72 by strand |
| Idle dwell / radius / period | 0.9 s / 22 CSS px / 12 s |
| Idle rise / fall constants | 0.75 s / 0.18 s |
| Discontinuity reseed | >240 CSS px; also resize and resume |
| Maximum strand head wandering | 16.8 px moving, 3.36 px fully idle |
| Depth wandering | ±12 px moving, ±6 px fully idle |
| Quiet-control opacity | 0.18, eased over 0.14 s |
| Additional draw / geometry / targets | 1 / 1 / 0 while active |

Active smoke's read-only displayed pigment is copied after its response step,
including fractional project blends. There is no second active hue damper.
Retained-anchor idle uses the same pigment response policy when smoke's accepted
leave policy clears its input. Per-point color history travels down each chain.
Local lighting changes shading with the existing displayed theme mix; input
pigment and phase do not change with theme. No global exposure changes or bloom.

The synthetic orbit is exclusive to the new tube head. Native cursor, hover,
smoke sampling and all existing pointer-clear policies are unchanged. Hidden
pages stop draw/update and resume by dropping elapsed time and reseeding.
Keyboard/touch/coarse input clears decorative pointer ownership. Less motion
retains the site's existing static/unmount policy; remount creates fresh owned
resources, requiring another supported pointer observation. Visible pointer
leave/blur retains the last observed anchor. No outside-browser tracking occurs.

## Verification and review boundary

Run `npm run build`, `node scripts/worlds-tubes-checks.mjs`, and the actual
loopback candidate with `V27_NATIVE_GL=1 BASE_URL=… OUT=… node
scripts/worlds-tubes-live-checks.mjs`. Use the configured Playwright browser cache.
The latter reads actual production GPU buffers in a test-only observer; those
synchronous reads are excluded from performance measurement.

Source tests cover actual orbit, geometry, pigment history and lifetime contracts
and simulated 30/60/120 Hz input. The outward-face regression fails on the
first candidate and passes after the bounded index-winding correction. Native checks cover all eleven project pigments,
real smooth-scroll blending, stationary/leave/re-entry behavior, theme retargets,
visibility, keyboard/coarse input, responsive/DPR states, ten section cycles and
an explicit optional-shader failure. Build/tests do not confer visual acceptance.
Performance, recordings, exact identities and remaining limits belong in the
source-bound review packet. Safari, physical devices/displays and subjective
normal-speed fidelity require separate evidence/human review.

The standing explicit GitHub testing-branch instruction authorizes testing
delivery despite the attached pack's generic no-push wording. Publish only the
authored task files onto the public Waves testing history. Never push the private
development ancestry or local creator fixture. `vercel.json` disables automatic
deployment for the exact testing branch; main/release remain unchanged.
