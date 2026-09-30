FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@9.15.4
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG BUILD_NUM=node
ARG OWNER_ADDRESS
ARG FEDERATION_WORLD
ENV BUILD_NUM=$BUILD_NUM OWNER_ADDRESS=$OWNER_ADDRESS FEDERATION_WORLD=$FEDERATION_WORLD NODE_ENV=production API=/api ASSET_PATH="" CONTRACT_ADDRESS=0x79986aF15539de2db9A5086382daEdA917A9CF0C IMG_HOST=https://cdn.cryptovoxels.com IMG_URL=https://cdn.cryptovoxels.com/node SOUNDS_URL=https://sounds.crvox.com/fx
RUN pnpm exec lessc web/src/style/app.less dist/app.css && node scripts/bundle-node.mjs web && node scripts/bundle-node.mjs mp
RUN node selfhost/node/build-bootstrap.mjs

FROM node:24.21.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/bundle_server.js /app/server/migrations.sql /app/server/openapi.yaml ./server/
COPY --from=build /app/server/queries ./server/queries
COPY --from=build /app/public ./public
COPY --from=build /app/db/schema.sql ./db/schema.sql
COPY --from=build /app/README.md ./README.md
COPY --from=build /app/selfhost/seed/gateway.mjs ./selfhost/seed/gateway.mjs
COPY --from=build /app/selfhost/node/bootstrap-bundle.mjs ./selfhost/node/bootstrap-bundle.mjs
USER node
CMD ["node", "server/bundle_server.js"]
