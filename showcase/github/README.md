# Repository showcase sources

These visuals describe the actual v24 portfolio. They are documentation assets,
excluded from the production Docker context.

- Banner: a six-second looping GIF of the actual live site's dark-theme opening.
  Chromium captured the uninterrupted idle scene as PNG samples at a 1800×640
  CSS-pixel viewport and 1× device scale. Recorded capture timestamps preserve its
  original pace; the first six seconds become a 990×352, 10fps GIF with a 64-color
  palette. No crop, overlays, retouching, camera or application changes. GIF color
  quantization and resizing are lossy. The GitHub profile uses the same bytes.
  [sources-banner-intro.json](sources-banner-intro.json) records the source/output
  identity. The previous light WebP and Pelagic composition in [banner.html](banner.html)
  and `portfolio-banner.webp` are historical.
- Desktop and portrait stills: lossless WebP conversions of the final frozen v24
  browser captures, with no cropping, retouching or changed pixels.
- Pelagic: byte-identical owned project poster; original anatomy and scene preserved.
- GIF: the entire unedited v24 browser recording, resized to 960px and sampled
  at 15fps at its original pace. Its palette conversion is for GitHub preview only.
  Original WebM evidence remains local.

Gallery source/output hashes and runtime revision are in [sources-v24.json](sources-v24.json), with historical banner/opening provenance in [sources.json](sources.json).
The reference is [Kona Desktop](https://github.com/Denoax/konata-hyprland-dotfiles)
at `e1e8ad65ccb7e7b20b82485f959d5249a5ff41b6`. Actual GitHub layout was inspected.
Its wide banner, centered intro, screenshot-led sections, paired comparisons and
collapsible gallery informed the format. Kona's artwork was not copied.

V24 uses exact owned captures recorded in sources-v24.json. Full originals remain
in the local review archive. scripts/github-showcase.mjs is the historical v23
generator; public release excludes private handoffs and full recordings.
Pelagic, font and project-media notices remain under `public/licenses` and
`public/assets/notices`; complete attribution is available on the live `/credits` page.
No model-generated media were used.
