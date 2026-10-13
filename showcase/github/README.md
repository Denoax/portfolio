# Repository showcase sources

These visuals describe the actual v24 portfolio. They are documentation assets,
excluded from the production Docker context.

- Banner: original HTML/CSS in [banner.html](banner.html), composed with the existing
  original Pelagic poster and licensed Inter font. It is a documentation composition,
  not a screenshot of an additional application screen.
- Desktop and portrait stills: lossless WebP conversions of the final frozen v24
  browser captures, with no cropping, retouching or changed pixels.
- Pelagic: byte-identical owned project poster; original anatomy and scene preserved.
- GIF: the entire unedited v24 browser recording, resized to 960px and sampled
  at 15fps at its original pace. Its palette conversion is for GitHub preview only.
  Original WebM evidence remains local.

Exact source/output hashes and runtime revision are in [sources-v24.json](sources-v24.json), with retained banner/opening provenance in [sources.json](sources.json).
The reference is [Kona Desktop](https://github.com/Denoax/konata-hyprland-dotfiles)
at `e1e8ad65ccb7e7b20b82485f959d5249a5ff41b6`. Actual GitHub layout was inspected.
Its wide banner, centered intro, screenshot-led sections, paired comparisons and
collapsible gallery informed the format. Kona's artwork was not copied.

Rebuild with `node scripts/github-showcase.mjs` from the complete local checkout,
or set `EVIDENCE_ROOT` to the preserved v23 evidence directory. The compact public
release excludes internal handoff packages and full historical recordings.
Pelagic, font and project-media notices remain under `public/licenses` and
`public/assets/notices`; complete attribution is available on the live `/credits` page.
No model-generated media were used.
