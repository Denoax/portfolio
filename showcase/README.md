# Repository showcase

Real captures of the portfolio's production build, recorded on 2026-09-05 from
application revision `b590bca`. This presentation pass changes documentation and
capture tooling only; the website's application and hosting configuration are unchanged.

## Media

| Asset | Source / treatment |
| --- | --- |
| `assets/banner.png` | Live WebGL opening with a repository-only HTML/CSS title treatment, 1800×800 |
| `assets/desktop-*.png` | Unaltered application screenshots, 1440×900 |
| `assets/portrait-*.png` | Unaltered application screenshots, 390×844 viewport emulation |
| `assets/gravity-motion.gif` | Signal → Identity → Signal; real browser frames |
| `assets/field-motion.gif` | Infrastructure → Algorithm → Infrastructure; real browser frames |
| `assets/*.mp4` | Higher-quality 1120×700 recordings at a nominal 12 fps |

GIFs are reduced to 800×500 at 8 fps with a 96-color palette for GitHub. Their
frame rate and color banding are encoding limitations, not website performance
measurements. Each loop travels back to the starting chapter instead of cutting
directly between unrelated frames. The nominal playback cadence is fixed;
capture overhead can affect the apparent speed of ambient animation.

The cover is deliberately labeled a designed banner, not a screenshot. Its galaxy
is the running application's geometry; `banner.html` and `banner.css` supply the
repository typography. No AI-generated or third-party galaxy image was used.

## Recreate the media

Requirements: Node.js 24, the project's installed dependencies, FFmpeg, and a
Chromium-compatible browser. Use a dedicated browser profile; the script creates
and removes its own temporary profile and frame directory.

Build and serve the portfolio first:

```sh
npm ci
npm run build
npm run preview -- --port 4194 --strictPort
```

In another terminal, point `CHROME_BIN` at your browser executable or wrapper:

```sh
export CHROME_BIN=/path/to/brave-or-chromium
node showcase/capture.mjs screens http://127.0.0.1:4194/
node showcase/capture.mjs banner http://127.0.0.1:4194/
node showcase/capture.mjs motion http://127.0.0.1:4194/
```

For Flatpak Brave, the wrapper can invoke `flatpak run com.brave.Browser "$@"`.
The capture uses an isolated headless session and the OpenGL ANGLE backend.
If a debugging port is already occupied, set `CDP_PORT` to an unused local port.
The script aborts when the app does not become ready or reports a browser error.
It overwrites only its named showcase outputs when rerun.

To re-encode GIFs from existing MP4s without recapturing:

```sh
node showcase/encode.mjs
```

No raw temporary frame sequence is committed. Font assets come from the existing
application build and retain the project's font-package licensing.

## Verification

- TypeScript check and Vite production build passed on 2026-09-05. A temporary
  output directory was used during this documentation pass to avoid rewriting
  the repository's existing checked-in `dist/` files.
- All eight desktop states and three portrait states reached ready, with zero
  horizontal document overflow and no captured browser console exceptions.
- The tested renderer path was WebGL. A reduced-motion visit also reached ready;
  this is not evidence that every browser or GPU has been tested.
- Banner, selected desktop/portrait frames, and samples throughout both encoded
  GIFs were inspected. The presentation preserves the site's black field, broad
  typography, and limited amber accent rather than applying a different theme.
- This is a repository presentation pass, not a full accessibility or performance
  certification. Existing `scripts/visual-qa.mjs` is a broader Playwright workflow
  and was not used for these Brave captures.

### Existing application limitations, not hidden by the showcase

The 390px infrastructure capture shows the large `COMPLEXITY` heading clipped at
the right edge despite zero document overflow. Some portrait horizon text also
crosses the bright particle band. Those are pre-existing layout issues and were
not retouched in the captures or changed during this repository-only request.
The main gallery emphasizes the desktop experience; portrait captures remain
available as-is. The public domain could not be verified from the research
browser during this pass, so the media comes from the local production build.

The original repo's reference-study directory has no project-wide reuse license
established here. This pass does not relicense the application or its references.
