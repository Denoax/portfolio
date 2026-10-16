# Current intro banner and historical gallery

The active repository banner is [portfolio-current-intro-v282.gif](portfolio-current-intro-v282.gif), reused from the existing current-intro export. It contains no speech bubble and is linked only to the website. [Source and output identity](current-intro-source.json). The profile-only buddy invitation is unchanged. Worlds keeps the original interactive Portfolio panel.

The following v24 gallery record and old banner files are historical provenance; they are not the active intro banner.

# Repository showcase sources

These visuals describe the actual v24 portfolio. They are documentation assets,
excluded from the production Docker context.

- Banner: an eight-second, 30fps infinite zoom GIF exported from the original
  dark-theme Ringwriter renderer: 240 distinct frames, 990×352 and a 32-color palette.
  Capture begins after the real opening hint has faded. A documentation-only export
  renders the shader's complete six-octave period, with 20% closer framing and its
  rotational phase held fixed so the cycle closes. This is a controlled scene export,
  not an unedited live recording. Application code and deployed behavior are unchanged.
  The cycle endpoint matches its start within 0.021 mean RGB levels out of 255;
  the encoded wrap step stays within the cycle's ordinary adjacent-frame range.
  GIF resizing/palette conversion is lossy. The profile uses the same bytes.
  [sources-banner-intro.json](sources-banner-intro.json) records the source/output
  identity. The previous 10fps GIF, light WebP and Pelagic composition in
  [banner.html](banner.html) are historical.
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
