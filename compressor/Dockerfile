# ABOUTME: Texture compressor. ffmpeg plus sharp, not the monorepo.
# ABOUTME: amd64 because texture-compressor ships x86 binaries.

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
RUN node scripts/bundle-node.mjs compressor

FROM --platform=linux/amd64 node:24.22.1-bookworm-slim
# Refresh the OS store; fail the build if the distrust update is unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20250419~deb12u2' \
  && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    webp \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/compressor.js /app/compressor.js
RUN npm install --omit=dev sharp@0.34.5 texture-compressor@1.0.2
EXPOSE 8080
CMD ["node", "compressor.js"]
