# Waves intro candidate review

Status: implemented and technically verified locally; human visual/motion review pending. Mani explicitly authorized direct execution without Paseo. Original source checkout is preserved.

One live Tom Hinton cosine-warped field now sits behind the existing infinite rings. The existing renderer, active clock, theme owner, typography/transport/inputs and intro exit remain authoritative. Dark uses graphite/silver and light uses pearl/graphite; light stays default. The still reduced-motion intro uses the same context behind existing DOM rings, with no projected-panel writes. Its complete Worlds paint layer stays hidden until entry, including children with explicit inline visibility. Waves stop drawing/updating in Worlds. Optional shader failure retains plain accessible entry.

The source adaptation matched every original-field pixel at ten sampled phases on native RTX 4070 WebGL (256×160). A proposed modulo wrap produced a few adverse pixels at narrow ramps and was removed. Intro-only transition contours address the measured inherited polarity crossover; normal endpoint text and all other site content are preserved. Full MIT notice and existing `/credits` attribution are included.

## Validation

- Actual `npm run build` / typecheck with unchanged installed dependencies: PASS; existing large-bundle advisory retained.
- New resource readiness, optional compile/link failure, shared phase, resize/DPR, visibility/exit and disposal contracts: PASS.
- Existing complete-lattice geometry: 7 cases PASS; existing production transport: 17 contracts PASS.
- Native Chromium desktop light/dark, 30-second unedited segments, hold/release/ripples, wheel, ten rapid theme retargets, menus, exit/return and labelled hidden-state fixture: PASS.
- Fourteen focused scenarios: portrait/touch/pinch/entry in both themes; OS and persisted reduced motion freeze/theme/resize/entry; DPR2; short landscape; brightness80/140; light default/persisted policy; optional shader failure; no WebGL; actual context loss/retry; credits and complete notice: PASS.
- Normal browser scenarios report no application errors. Failure injection is explicitly labelled. Initial harness failures and the fixed reduced-motion projection defect remain documented in local evidence.

## Matched performance

Native RTX 4070, headless Chromium, production builds, 1440×900 CSS/buffer, DPR1, same observed quality. Three warm five-second samples per build/theme, no recording during measurement; pair order reversed for dark. Values are RAF callback intervals, not GPU timings.

| Build | Theme | Median ms | p95 ms | Max ms | >50 ms | Intro draws |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| baseline | light | 16.70 | 16.70 | 16.80 | 0 | 5 |
| candidate | light | 16.70 | 16.70 | 16.80 | 0 | 6 |
| candidate | dark | 16.70 | 16.80 | 16.80 | 0 | 6 |
| baseline | dark | 16.70 | 16.80 | 16.80 | 0 | 5 |

Both builds use one draw in idle Worlds. The candidate adds exactly one fullscreen intro draw in this workload. No material RAF regression was observed in this bounded sample; this is not an all-device performance guarantee or a speedup claim. Cold readiness was approximately 0.50–0.72 seconds across the four runs and includes overall startup, not isolated shader compile timing. Separate actual GPU timer queries around only the wave draw returned median 0.027648 ms, p95 0.028672 ms and max 0.032768 ms across 60 warm samples, with no disjoint results. This profile is separate from the paired RAF benchmark. Raw and adverse samples are in the local evidence package.

## Source and review boundary

Implementation baseline: local `2f0e7d3a7b682ee20f9e468a8b1a4f6ba4c21f28`. Public baseline: `10c9368af18584067381449d58119b76db1c27a4`. All runtime source/assets/package/config inputs matched. GitHub testing delivery is constructed from public history with only this task's files; private history/media is excluded. The exact candidate/remote SHA, build inventory, source/evidence ZIP hash and extraction-rebuild receipt are supplied with the local delivery receipt rather than self-referenced in this commit. Testing-branch auto-deployment is disabled for this exact branch in `vercel.json`; no main integration or deployment is authorized.

## Limits and rollback

Screenshots were inspected at desktop/portrait and theme midpoint. Unedited native recordings and temporal checks do not supply Mani's subjective continuous-motion acceptance. Physical phones/displays, Safari/WebKit, calibrated brightness, assistive technology and actual desktop browser zoom remain UNVERIFIED. The headless Ctrl+plus shortcut did not change zoom. Hidden state uses an explicit document visibility fixture. System-theme persistence retains the existing validator's migration to light, proven on both baseline and candidate. Fade/antialias/contour pixels are not presented as a blanket WCAG certification.

Rollback before integration is simply to keep using the unchanged original checkout. To remove an integrated candidate later, revert this task's exact commit in an isolated branch and rerun the affected checks; do not reset user work. Preview/evidence files and prior failed receipts remain recoverable.
