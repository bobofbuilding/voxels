# Run the active world

The archive is the durable public dataset. The active world runs this repository's client, HTTP/grid server and multiplayer server against a local writable database. Serve the application at `/play`; `../seed/gateway.mjs` redirects the hostname root there.

For a Docker-based installation with independently writable, wallet-verified nodes, see the [node installer](../node/README.md). Its synchronization scope and limits are documented there.

## Initial import

Use an empty PostgreSQL 18 database with `db/schema.sql` applied (including cube and citext extensions). Extract the signed public archive to a staging directory. Place a reviewed public `/api/islands.json` response alongside its `builds/` directory as `islands.json`.

```sh
DATABASE_URL=postgresql:///voxels_world EXPECTED_PARCELS=8807 \
  node selfhost/world/import-world.mjs /path/to/extracted-inventory
```

Install repository dependencies first. The importer refuses a database that already contains parcels and commits the entire import atomically. It imports only visible builds, their public owner/name profiles, bounds, suburbs and island geometry. It does not import account credentials or contributor/moderator permissions. Keep saved historical versions on archive storage. This archive is not the Ethereum snapshot used for migration claims.

## Build and runtime

Build with `API=/api ASSET_PATH='' PUBLIC_URL=your.hostname NODE_ENV=production pnpm build`. Deploy `dist/`, `public/`, `server/bundle_server.js`, `server/migrations.sql`, `server/queries/`, `server/openapi.yaml` and root documentation files. Run from the deployment root with `node server/bundle_server.js`.

Configure `OWNER_ADDRESS`, a randomly generated `JWT_SECRET`, `DATABASE_URL`, `CONTRACT_ADDRESS`, `PUBLIC_URL`, `BIND_HOST=127.0.0.1`, `PORT=19000`, `DATABASE_STATEMENT_TIMEOUT_MS=5000` for the Pi, and `REDIS_URL` for a private Redis instance. The multiplayer process must use the same database and signing secret, and listen on loopback port 13780. The public gateway forwards `/mp/socket` to multiplayer and `/grid/socket` to the world server. Put HTTPS in front of its loopback port 8787.

For the migration launch, set `PARCEL_EDIT_POLICY=admin` and `RUN_BACKGROUND_JOBS=false`. This preserves administrator editing while preventing old snapshot ownership from granting editing authority. It also keeps legacy scheduled jobs, including metrics truncation and external chain synchronization, disabled. The existing legacy contract address does not imply a new migration contract has been deployed. Enable external integrations only after configuring and verifying their credentials and contracts.

Keep the writable world database on the Pi's SSD. Store dated private database backups outside the public `seed/` directory on the NAS. Never put session secrets, accounts, chat or telemetry in public snapshots. Public snapshots should export only reviewed public parcel builds/history. Archive publication is explicit; no recurring snapshot or destructive retention schedule is installed by these tools.

The current deployment uses Node 24 LTS for the bundled services. The repository's development engine remains Node 25. The Pi is a small-host deployment, not a demonstrated high-concurrency service: measure player capacity before increasing gateway limits.

## World engine and collisions

Retro switched player movement from Babylon's ellipsoid collision coordinator to Rapier in [d3f6e94 (18 August 2026)](https://github.com/cryptovoxels/retro/commit/d3f6e94c8f5097ebe00c85c955d0d50f320f3ac8), then removed cube and voxel-model collision hooks in [7d4e174 (26 August 2026)](https://github.com/cryptovoxels/retro/commit/7d4e1745b429075617bf56b6dabb8639c4b7051f). The full Babylon renderer was still the default; its experimental Lite selection was separate.

This deployment restores Babylon collision-based player movement, uses the full Babylon renderer for every world entry, and enables solid cubes, loaded voxel models, opaque/glass parcel blocks, island ground and ocean floor. Saved `collidable: false` values do not disable these solid objects in this deployment. Archive records are unchanged. Cube placement is available in the normal and minimal feature budgets. Loading drafts and failed model placeholders do not create invisible obstacles.

The existing Babylon 9 rendering version, current world APIs, ownership policy and multiplayer protocol are retained. Rapier remains for ancillary object simulation and the inactive experimental Lite source; it no longer controls normal player movement. Collision vertices remain available on mobile. Automated tests exercise Babylon's real collision coordinator, mesh transforms, instances, jumping, sliding, ceiling contact and geometry disposal.


## Neon environment

The public world uses an original blue-black cloud panorama, black ground with blue emissive-looking grid lines, and a matching cube favicon. The sky is a bundled static texture; no image-generation service is called at runtime. Former ocean and lake surfaces are now opaque, collidable grid ground at street height. Coastline clipping retains all polygon holes so underground parcel access remains open. Player swimming and underwater fog are disabled for this dry world. Parcel build contents and archive records are unchanged.

`dist/textures/neon-clouds-v1.png` was generated with the built-in image-generation tool using a prompt requesting: “A seamless 2:1 equirectangular sky-only texture for a digital voxel world, TRON: Legacy-inspired deep blue-black storm clouds, restrained electric-blue light in the cloud edges, thin cyan horizon glow, dark zenith and nadir, no buildings, ground, logos, text or watermark.” The two accompanying concept images are references, not screenshots of the running world. The favicon is an original SVG cube in `dist/favicon-neon.svg`; its PNG fallback is rasterized from that source.

## Community sharing direction (not enabled yet)

Automatic public-build caching and opt-in uploading are the agreed browser behavior. IP privacy requires relays: direct WebRTC and ordinary BitTorrent peers can see each other's addresses. Use relay-only WebRTC with independently operated, open-source [coturn](https://github.com/coturn/coturn) servers, short-lived credentials and upload limits. Never silently fall back to direct peers. Relay operators still see connecting addresses; relay-only is not anonymity from the operator.

This avoids a mandatory paid TURN provider, but hardware, power and bandwidth are contributed by operators. With only the Pi/MyCloud host, the service is not yet decentralized. Multiple independent archive seeds and relays are needed. The existing public website also depends on Cloudflare's tunnel; independently reachable node endpoints would reduce that dependency. GitHub distributes software and signed manifests, not the live player traffic or bulk archive.

Browser shares must contain only hash-verified public parcel objects, with a bounded evictable cache. Account details, chat, telemetry and private parcels are excluded. Timestamped signed snapshots establish freshness; content hashes establish integrity. The existing archive torrent is for node operators and is not a private browser-sharing transport. No paid TURN service or public relay listener is provisioned by this visual update.
