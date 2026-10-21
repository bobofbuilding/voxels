# ABOUTME: Parcel compiler worker - rehosts parcel assets to UGC on a loop.
# ABOUTME: App Platform: DATABASE_URL + UGC_ACCESS + UGC_SECRET + texture bucket creds optional.

FROM node:24.22.1-bookworm-slim
# Refresh the OS store; fail the build if the distrust update is unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20250419~deb12u2' \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# node 25 images ship without corepack
RUN npm i -g pnpm@9.15.4 \
  && pnpm config set engine-strict false \
  && pnpm install --frozen-lockfile

COPY common/ ./common/
COPY server/ ./server/
COPY services/ ./services/
COPY compiler/ ./compiler/
COPY tsconfig.json tsconfig.prod.json ./

ENV PORT=8081
ENV ASSET_PATH=https://www.voxels.com
ENV IMG_HOST=https://cdn.cryptovoxels.com
ENV TEXTURE_BUCKET=https://textures.sfo2.cdn.digitaloceanspaces.com

EXPOSE 8081

CMD ["npx", "tsx", "compiler/src/index.ts"]
