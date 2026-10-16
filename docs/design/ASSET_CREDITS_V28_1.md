# v28.1 typography sources and assets

No runtime media, fonts, audio, packages or paid assets were added. Existing
`ASSET_CREDITS_V28.md`, `ASSET_CREDITS_V27_5_1.md` and public notices still apply.
The atlas uses the existing IBM Plex Mono, under `public/licenses/IBM-Plex-OFL.txt`.
Native font rasterization and original GLSL implement the typography.

The two user screenshots and historical Edo / @edo_lunardi Ringwriter frame were
opened from `handoff-v28-1/references/`. The screenshots define defects, not new
production assets. The historical frame informs circular word framing; this
request explicitly rejects its dots and pointer stippling. No private creator
renderer, copied artwork, generated visual media or invented project evidence
is used. The supplied depth diagram is a functional plan.

Technical sources inspected and reconciled with installed Three 0.180:
- https://threejs.org/docs/pages/Texture.html — mip filters, colour space and resource lifetime.
- https://protectwise.github.io/troika/troika-three-text/ — distance fields as a comparison; no migration/package added.
- Installed `WebGLProgram.js` — WebGL2 `texture2DLodEXT` alias used by the existing shader path.

The selected implementation uses one 1024² alpha atlas with measured metrics,
transparent padding and safe mip bounds. Discrete glyph indices are rounded
before atlas-row addressing. Persistent size-driven formation uses actual phrase
letters and is independent of release shuffle. The .25-octave lattice remains:
initial desktop/portrait captures showed readable spacing after removal of dots
and microtext; an alternative lattice was unnecessary.

Review captures are real browser output. Controlled spatial sweeps are labelled
separately from genuine-input recordings. Neither is retimed or interpolated.
Physical-device/display, Brave/Safari and human continuous-motion approval remain
unverified unless later evidence explicitly establishes them.
