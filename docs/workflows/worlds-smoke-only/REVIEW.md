# Worlds smoke-only restoration — 2026-10-24

Mani rejected the published tubes/neon layer and requested “just a smoke trail
only”. This supersedes the earlier tube direction. The corrective update applies
to the just-published GitHub/site release, preserving the later Waves refinement.

The tube body, halo passes, circular target/history, event listeners and owned
targets/materials are removed. Unused tube modules and their obsolete feature
checks are removed from active source; earlier commits, review archives and
source/rights notices remain recoverable. Active credits retain Waves and no
longer advertise tubes.

`CursorTrail.ts`, `WorldsTrailField.ts` and active credits are byte-identical to
the pre-tubes Waves source `48e7fdaa184ac902a31f10695654653c5bb1fb14`.
`HubScene.tsx` restores that integration while retaining the newer Waves CSS-height
argument. Current `IntroWaves`, Ringwriter, transport/ripples, theme/exposure,
native cursor, all eleven projects/Pelagic/media and dependencies are unchanged
from published `2cdbb234deb13671a0d34e88ff3049f73ff67956`.

Validation:

- Actual `npm run build`/typecheck and `node scripts/intro-waves-checks.mjs`: PASS.
- Same native `scripts/worlds-smoke-only-live-checks.mjs` fails on the published
  tube baseline (five tube/halo shader sources vs expected zero), and passes the
  restored candidate. Smoke receives real movement, paints while stationary
  without synthetic orbit input, changes with theme/project pigment, clears on
  leave and resumes on return. No tube/halo shader compiles in intro or Worlds.
- Desktop light/dark rendered smoke frames inspected; project/intro return and
  portrait reduced-motion visible entry pass. Normal browser errors: zero.
- Exact testing-branch delivery, public-source rebuild, protected staged-file
  verification, main/site release identities and live checks are bound in the
  task's final delivery receipts. Staging uses the existing project/routes and
  authenticated file inspection, without preview sharing or protection changes.

Testing branch: `testing/worlds-smoke-only-20261024-01a16be6`, with automatic
deployment disabled for that exact branch. User's live correction request
authorizes publication of this smoke-only restoration. Human acceptance of the
retired tube design is not inferred from earlier passing checks. Physical-device,
Safari and subjective continuous-playback checks remain unverified. Revert this
specific restoration commit if needed; do not reset other user work or revert
the entire site, which would also discard the retained Waves work.
