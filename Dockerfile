FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM caddy:2-alpine AS runtime

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

