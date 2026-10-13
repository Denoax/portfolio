# manimarami.com deployment

## Current public host — 2026-10-13

The public domain now uses the existing Vercel Hobby project
`manimarami-portfolio` (`prj_JuCj3zJeUXPwe7UjZxGZmOHIod9m`) in
`denoaxlp-4452`. Earlier Docker origin instructions below are historical/local
recovery; they no longer publish the public website. DNS, gateway, other services
and preview protection remain outside routine media updates.

Publish a verified static build through the existing authenticated CLI and linked
project, staging production with `deploy --prebuilt --prod --skip-domain` and
promoting the tested build. Preserve the existing Build Output API routes and
security/cache headers. Retain the prior production deployment ID for rollback.
No automatic Git deployment is configured. Do not print or copy token files.

Current scoped preview refresh: [source and decisions](docs/design/PREVIEW_MEDIA_REFRESH_20261013.md).
Recoverable checks, static manifest and current rollout evidence are at
`/home/mani/.local/share/portfolio-checkpoints/worlds-media-20261013`.

[Current preview-media deployment receipt](showcase/releases/preview-media-20261013.json).

## Historical Docker releases


## Current v24 rollout —2026-10-12

Mani authorizes GitHub publication and deployment. Release a42e088dadbf0be4988cac9deb982ec402bc0a2d matches reviewed runtime 36e626398f76954f64999dbdafc83ffc62eb1209:124 source/221 public files. Build/typecheck and6 model contracts pass. All229 Docker outputs,229 origin and229 public HTTPS responses match reviewed hashes. Credits SPA/missing-asset404 and actual1440x900/390x844 public flows pass, with zero page/shader errors/missing assets. Seven refreshed GitHub gallery assets match public hashes.

[Deployment receipt](showcase/releases/v24/deployment.json). Image: `sha256:e1c5a2d4ffb9cb491508c6717086bf50921c6551b278057d5dc29dfc6d95a8a6`.

Release checkout: `/home/mani/.local/share/portfolio-releases/v24-live-20261013T030501Z`. Checkpoint: `/home/mani/.local/share/portfolio-checkpoints/pre-v24-live-20261013T030501Z`. Previous v23 image retained under `portfolio-portfolio:rollback-pre-v24-20261013t030501z`. Only portfolio service recreated; gateway ID/image/start unchanged. Approved v2 4173/development4174/evidence4180 restored and return200. Full history/review ZIP preserved. No new physical/Safari/AT/high-refresh/listening approval.

Service-only rollback:

```sh
docker compose -p portfolio \
  -f /home/mani/.local/share/portfolio-releases/v24-live-20261013T030501Z/docker-compose.yml \
  -f /home/mani/.local/share/portfolio-checkpoints/pre-v24-live-20261013T030501Z/rollback-v23.yaml \
  up -d --no-build --no-deps portfolio
```

## Historical v23 rollout — 2026-10-11 local / 2026-10-12 UTC

Mani authorized publication of all completed changes and the visual GitHub
repository update. Runtime publication `0125ee7dca9dc12c6a8d12d92df643d62ebfb118`
is a normal fast-forward from the existing remote main; its117 source and221 public
files are byte-identical to the reviewed v23 runtime `60d83a3`. The new README
uses original Pelagic imagery, actual v23 captures and a real recording, following
the inspected Kona Desktop repository's banner/gallery/documentation structure.

Live image: `sha256:afceb2e2e11bf8bbc0980b63810307a00013bed9e55335322b316c8c0a823afc`.
Build/typecheck and six model contracts pass. All229 Docker output files, all229
loopback-origin responses and all229 public HTTPS responses match the reviewed
build. `/credits` SPA routing, missing-asset404 and canonical Pelagic HTTP200 pass.
Actual Chromium1440×900 and390×844 flows verify entry, eight rail markers/21 fine
marks, two-way selection, intentional media playback, keyboard brightness/Reset,
Escape focus return, protected launch/return, persisted theme and opening replay,
with no page errors or failed assets. Actual GitHub1440×1000/390×1000 renders load
every visual and expand the portrait gallery. No new physical-device, WebKit,
assistive-technology, high-refresh or listening checks are claimed.

Release checkout: `/home/mani/.local/share/portfolio-releases/v23-live-20261012`.
Checkpoint: `/home/mani/.local/share/portfolio-checkpoints/pre-v23-live-20261012T012036Z`;
branch: `checkpoint/pre-v23-publish-20261012T012036Z`. Prior v20 image retained as
`portfolio-portfolio:rollback-pre-v23-20261012t012036z`, pointing to
`sha256:637107ab7b502e8f9811dc626104634b30b9a51cf5b69a78bbc3b2f6508cc69b`.
The checkpoint stores previous container/Compose configuration and a service-only
rollback override. Restore only the portfolio service if needed:

```sh
docker compose -p portfolio \
  -f /home/mani/.local/share/portfolio-releases/v23-live-20261012/docker-compose.yml \
  -f /home/mani/.local/share/portfolio-checkpoints/pre-v23-live-20261012T012036Z/rollback-v20.yaml \
  up -d --no-build --no-deps portfolio
```

The gateway image and start time remain unchanged. Approved v2 on4173 and current
development on4174 still return200. Full local historical source, retired worlds,
review archive and original recordings are retained; remote main's earlier cleanup
is preserved. [Public receipt](showcase/releases/v23/deployment.json) and
[release provenance](RELEASE.md) identify the published authority. Full rollout
hashes, captures and unedited flow recordings remain locally under
`showcase/v23-evidence/deployment`.

The live origin is the `portfolio` Docker Compose project in this repository on
Mani's Linux host. Its `manimarami-portfolio` container serves compiled Vite output
with Caddy on `http://127.0.0.1:18088`. The existing `mani-web-gateway` container
terminates public HTTPS and routes `manimarami.com` to that origin. The gateway's
configuration, certificates and other sites are separate and are preserved.

## Build and publish an authorized source release

```sh
docker compose config --quiet
docker compose build portfolio
docker run --rm --network none --entrypoint caddy portfolio-portfolio validate --config /etc/caddy/Caddyfile
docker compose up -d --no-build --no-deps portfolio
docker compose ps
```

Build/validate before replacing the running service. Rebuild uses locked npm
packages in Node 24; the final image contains only Caddy, compiled application and
public assets. Research, historical captures and instruction packages are excluded
from the Docker context. Node/npm are not required on a host running the image.

Pushing source to GitHub does **not** rebuild this host automatically. There is no
GitHub Actions deployment workflow. Deploy only with applicable user authorization.
The published repository keeps runtime source and operational documentation; full
local review/history and verified review ZIPs are retained separately.

## Verify and recover

Check both `http://127.0.0.1:18088/` and `https://manimarami.com/` against the
reviewed production HTML and fingerprinted asset hashes. Verify `/credits` SPA
routing, actual preview interactions and missing-asset 404 behavior. A healthy
container alone does not establish the intended version or visual approval.

Before replacing the container, retain its image under a unique local rollback tag.
The v17 pre-release checkpoint records that tag, previous image ID and Compose
configuration under `/home/mani/.codex/backups/portfolio-pre-v17-live-20261008T164701Z`.
Rollback targets only the portfolio service using a Compose override for that image;
use `up -d --no-build --no-deps portfolio`. Do not alter the HTTPS gateway, delete
volumes or prune the retained image during a rollout.

## Network and caching

Compose binds host ports18088/18443 to loopback. Only port18088 serves HTTP;18443
is reserved, with no active TLS listener in this origin. The existing public gateway
owns80/443 and certificates. DNS/registrar/router/firewall configuration is unchanged.

Caddy compresses responses, disables HTML caching, serves fingerprinted Vite assets
with immutable caching and handles application routes through index.html. Asset
requests have their own static handler so a missing asset cannot return an HTML
success page. Existing local review4174, approved-v2 preview4173 and evidence4180
are independent of the production origin.

## Approved v20 rollout —2026-10-09

Mani explicitly approved v20 and authorized GitHub publication and deployment. Runtime `f2f12722ea1559fac08a5a56583d51631d8d309d` / evidence `da9ee3d8e0fd34c0bc1e9dfe8eb3a8e355d411fe` are the reviewed authority. Isolated release checkout: `/home/mani/.codex/worktrees/portfolio-v20-live-20261009`, local commit `4d61f656999e709e10e25d56c633e38f366db421`, preserving remote main cleanup. Docker rebuilt all219 outputs byte-identically; public HTTPS/origin HTML/compiled chunks/media/data, credits routing and missing-asset404 were checked.

Checkpoint: `/home/mani/.codex/backups/portfolio-pre-v20-live-20261009T061933Z`. Previous v17 image: `sha256:3cadb086600592914258933a49ea94aac7d857ad30158896ecf9639af5efed2f`. Rollback tag: `portfolio-portfolio:rollback-pre-v20-20261009t061933z`. Candidate/live v20 image: `sha256:637107ab7b502e8f9811dc626104634b30b9a51cf5b69a78bbc3b2f6508cc69b`. Gateway image/container/start time unchanged; only the portfolio service was recreated. Use Compose project `portfolio` explicitly when operating from the isolated checkout. Recovery must target only that service, retaining the gateway and previews.

GitHub publication initially encountered a connected-integration HTTP403 on Git blob creation. Mani completed the GitHub CLI sign-in; normal fast-forward push published runtime release4d61f65 to main. Actual public desktop1440×900/portrait390×844 checks passed entry67,24minor marks, intentional preview playback, resource Pause/Continue/Cancel and persistent theme with no page errors or missing assets. Final push identity and public checks are recorded in `showcase/v20-evidence/deployment/`.
