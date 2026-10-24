# Intro Waves source record

Tom Hinton, [#WCCChallenge : Waves](https://codepen.io/TomHinton/pen/EajJrBd),
inspected 2026-10-23. The exposed GLSL and actual rendered Pen identify a
monochrome field with sequential cosine warps at 3/11/17 and tiled radial terms
at 10/20. This task adapts that field behind the existing Ringwriter, with
graphite/silver dark and pearl/graphite light palettes. No generated media or
reference footage is a runtime asset.

The supplied normalized shader transcription and integration seed were source
material, not a production patch. On native RTX 4070 WebGL, the adapted field
matched all pixels of the original at ten sampled times on a 256×160 buffer.
Its signed cubic explicitly defines the original reversed/equal-edge
`smoothstep` behavior; fidelity on other drivers remains unverified. A proposed
mathematical-period modulo exposed finite-precision pixel discontinuities and
was removed. Production follows the existing unwrapped active clock at 1×
reference cadence, with no new timer, renderer or input handler.

The existing displayed theme mix owns both palettes and temporary intro text
contours. Solid ink in the original intro crosses its substrate near the theme
midpoint; the local two-tone contours preserve silhouettes during that brief
polarity change. Normal endpoint typography and all transport math are retained.
This is not a claim that every fading/antialiased glyph is WCAG-certified.

Reduced motion keeps the same renderer only for a still intro backdrop behind
the existing static DOM rings. That canvas must not project or write styles to
the DOM-only reduced-motion Worlds. Graphics failure retains the plain backdrop
and accessible entry. Waves compile outside the foreground readiness gate.

Full notice: [Tom Hinton MIT](../../../public/licenses/Tom-Hinton-Waves-MIT.md).
CodePen's [public-Pen licensing policy](https://blog.codepen.io/documentation/licensing/)
supplies the license basis. The original year was not verified or invented.
Credits remain on the existing `/credits` surface.

Source baseline: local `2f0e7d3a7b682ee20f9e468a8b1a4f6ba4c21f28`;
public `10c9368af18584067381449d58119b76db1c27a4`. All runtime source, assets,
package/lock/config inputs matched between those baselines. Private historical
handoffs/media and local source history stay outside testing-branch delivery.

Read/apply `$reference-led-design`. Preserve real assets, current instructions
and rejected-journey decisions. No generated visuals, invented telemetry or
automatic human acceptance. This work follows Mani's explicit direct-execution
override; it does not use Paseo dispatch.

Recheck with `node scripts/intro-waves-checks.mjs`, existing
`intro-section-checks.mjs` / `v28-transport-checks.mjs` (private `OUT`), and
`npm run build`. For the reduced-motion browser regression, serve the candidate
production build on a private loopback port and run
`V27_NATIVE_GL=1 BASE_URL=... OUT=... node scripts/intro-waves-live-checks.mjs`.
Use installed pinned dependencies. Build/model checks do not establish visual
or subjective motion approval; physical devices, Safari and calibrated display
checks require separate evidence.

The testing branch contains a branch-specific `git.deploymentEnabled: false`
rule in `vercel.json`, preserving the no-deployment boundary during GitHub
testing delivery. Other branches keep their prior default behavior. See the
[official Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
