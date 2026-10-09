# manimarami.com deployment

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
