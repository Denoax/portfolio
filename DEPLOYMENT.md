# manimarami.com deployment

This repository is packaged as a multi-stage Docker image. Node.js exists only
in the build stage, where the locked npm dependencies build the existing Vite
application. The final image contains Caddy, the compiled `dist/` output, and
the Caddy configuration only.

## Requirements

- Docker Desktop or another Docker Engine with Docker Compose
- Free local TCP ports `18088` and `18443`

Node.js, npm, and Vite are not required on the Windows host.

## Start and operate

Build and start:

```powershell
docker compose up -d --build
```

Check status:

```powershell
docker compose ps
```

View logs:

```powershell
docker compose logs -f
```

Restart:

```powershell
docker compose restart
```

Stop:

```powershell
docker compose down
```

Rebuild after future source changes:

```powershell
docker compose up -d --build
```

The deployment has no persistent volumes. Do not add `-v` to routine shutdown
commands; on deployments with volumes, that option deletes them.

## Local origin

Open `http://localhost:18088` to test the production portfolio.

- Host `127.0.0.1:18088` maps to container HTTP port `80`.
- Host `127.0.0.1:18443` is reserved and maps to container port `443`.
- Port `18443` has no active TLS listener and is not needed while the existing
  public reverse proxy terminates HTTPS.
- Existing host ports `80` and `443` are untouched.

Both published ports are bound to loopback to prevent direct LAN or public
access. This is the preferred arrangement when the reverse proxy runs on the
same Windows computer.

## Public architecture

```text
Internet
   |
   v
manimarami.com
   |
   v
YOUR_PUBLIC_IPV4
   |
   v
Existing HTTPS service / reverse proxy
(existing public ports 80 and 443)
   |
   | hostname = manimarami.com
   v
http://127.0.0.1:18088
   |
   v
Docker -> Caddy -> existing compiled React portfolio
```

The existing reverse proxy must later route requests with the hostname
`manimarami.com` to `http://127.0.0.1:18088`. Configure the canonical redirect
for `www.manimarami.com`, if desired, at that public reverse proxy. This
repository intentionally does not inspect or modify the existing proxy,
certificates, router, firewall, or services on ports `80` and `443`.

If the reverse proxy runs on another LAN computer, the loopback-only Compose
bindings are not reachable from it. In that architecture, deliberately change
the port binding to `18088:80`, route the proxy to
`http://WINDOWS_PC_LAN_IP:18088`, and add only a narrowly scoped Windows
Firewall rule for the proxy machine. Do not disable the firewall or expose the
high port publicly.

## Wix DNS

Wix remains the registrar and DNS provider unless changed separately. DNS does
not contain port numbers: an `A` record maps `manimarami.com` to the public IPv4
address of the service receiving HTTPS traffic, represented here as
`YOUR_PUBLIC_IPV4`. It cannot map the domain directly to port `18088`.

Keep the existing public ingress and router forwarding unchanged. Once DNS
points at that ingress, its hostname-aware reverse proxy performs the final
hop to the portfolio origin on port `18088`.

## Deployment boundaries

Docker builds the existing application without changing its source, assets,
metadata, routing, or visual behavior. Caddy provides static serving, gzip and
zstd compression, conservative caching for `index.html`, and immutable caching
only for fingerprinted Vite assets.

