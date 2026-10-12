import { chromium } from 'playwright'

// A fixed off-screen surface avoids the desktop tiler's clipping of headed
// screencasts. Select the same real OpenGL GPU backend as the measured browser;
// callers retain its reported identity instead of assuming hardware support.
export const launchCaptureBrowser = () =>
  chromium.launch({
    headless: true,
    args: ['--use-angle=gl', '--enable-gpu'],
  })
