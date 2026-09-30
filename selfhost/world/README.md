# Run the active world

The archive is the durable public dataset. The active world runs this repository's client, HTTP/grid server and multiplayer server against a local writable database. Serve the application at `/play`; `../seed/gateway.mjs` redirects the hostname root there.

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
