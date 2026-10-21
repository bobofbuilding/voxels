# ABOUTME: Thumb renderer. Playwright base stays. Final stage is the bundle, not the monorepo.
# ABOUTME: index.js sits in renderer/src so __dirname still finds page/ and dist/vendor.

FROM node:24.22.1-bookworm-slim AS build
# Refresh the OS store; fail the build if the distrust update is unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20250419~deb12u2' \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm i -g pnpm@9.15.4
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN node renderer/build-page.mjs && node scripts/bundle-node.mjs renderer

FROM mcr.microsoft.com/playwright:v1.62.1-noble
# Replace the base image's Node independently of its browser dependencies.
COPY --from=build /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20260816ubuntu0.24.04.1' \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/dist/renderer.js /app/renderer/src/index.js
COPY --from=build /app/renderer/page /app/renderer/page
COPY --from=build /app/dist/vendor /app/dist/vendor
RUN npm install --omit=dev playwright@1.62.1
EXPOSE 8080
CMD ["node", "renderer/src/index.js"]
