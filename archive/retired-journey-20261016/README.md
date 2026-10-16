# Retired galaxy → Pelagic bridge

On 2026-10-16 Mani rejected the special galaxy/Earth/cloud/ocean bridge and requested a direct GitHub destination like the other project links.

The bridge is disconnected from `App` and `ExperienceCanvas`: no `WorldScene` import, world coordinator, loading launch, travel controls, canonical redirect or return transition remains in the active application. Old `#earth`, `#pelagic` and `#work` bookmarks resolve to the project reel. Original Pelagic media and the external project are unchanged.

Exact recovery baseline: `284aad245ed20ad1fa03549ce16327f80f93a1d8`, retained locally as `checkpoint/pre-pelagic-direct-github-20261016`. Restore individual files from that ref when inspecting history; do not reset over current work. Its original `App.tsx`, `ExperienceCanvas.tsx` and `hubState.ts` provide the complete prior integration.

Procedural sources remain in `src/experience/WorldScene.tsx`, `src/experience/*`, `src/core/journey.ts`, `src/hooks/useWorldCoordinator.ts` and `src/core/pelagicHandoff.ts`; these legacy modules are source-only and are not imported by the active renderer. NASA images and historical credits/evidence are retained for provenance and recovery. A few shared math/diagnostic modules remain used by the active menu; do not delete them indiscriminately.

The approved v2 preview and completed review archives are unchanged. The user explicitly authorized publication of the current portfolio on 2026-10-16. This release includes the removal; the recovery checkpoint remains local.
