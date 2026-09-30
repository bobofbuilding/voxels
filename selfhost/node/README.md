# Host a shared Voxels world

This installer runs the playable world, multiplayer server, PostgreSQL and Redis with Docker Compose. Each host keeps its own database and accepts wallet-signed public build edits without contacting another host. Connected hosts exchange those edits and player positions; disconnected hosts catch up when a peer becomes reachable.

Anyone can operate a node. Hosting does not grant editing permission. The pinned public snapshot preserves each parcel's owner and delegated managers/builders. Every edit carries that wallet's signature and a permission revision; a node operator cannot grant themselves access. The network owner retains its existing administrator override. Historical renter records are retained without being promoted to builder or manager. Malformed wallet entries are preserved separately for explicit review; they are never silently repaired into grants. These rights reflect the archived snapshot; they do not claim that a new NFT migration or live on-chain ownership transfer has occurred.

## Requirements

Use a 64-bit Linux or macOS host, Node 24 or newer, and Docker with Compose v2. A host with 8 GB RAM and an SSD is a reasonable starting point; player capacity must be measured. Building the application and importing the world require more disk space than the compressed archive. Keep PostgreSQL on local reliable storage. Archive storage is appropriate for verified archives and private backups, not the live database.

The software has no mandatory paid synchronization service. Operators supply storage, electricity and bandwidth. HTTPS hosting, domain names and relays may have their own costs.

## Start a small world

From a trusted checkout of this repository:

```sh
node selfhost/node/setup.mjs doctor
node selfhost/node/setup.mjs init \
  --directory "$HOME/voxels-node" \
  --owner 0xYOUR_PUBLIC_EDITOR_ADDRESS \
  --starter
node selfhost/node/setup.mjs up --directory "$HOME/voxels-node"
```

Open `http://localhost:8787/play`. The starter contains one unminted parcel; setup does not mint an NFT or request a wallet private key. Connect the configured editor wallet to build. Each submitted change asks for a wallet message signature, not an Ethereum transaction or gas payment.

`init` refuses an existing directory. It creates private credentials once. `up` rebuilds the application and retains the database and credentials. `status` shows service health. `down` stops the node and retains its data. Run each command with the same `--directory`. Back up the entire private node directory before upgrading; never publish its `app.env`, `database.env` or database folder. A failed/partial initial import requires inspection; the installer deliberately does not erase or automatically adopt a database.

## Join another host

Hosts must agree on the world identifier, network administrator, archived parcel rights and exact initial parcel data. A world ID is a `0x`-prefixed 32-byte identifier, not a contract address. Starter worlds derive it deterministically from the owner address. For archive-based worlds, obtain the world ID and pinned snapshot from the network publisher through a trusted channel.

```sh
node selfhost/node/setup.mjs init \
  --directory "$HOME/voxels-node" \
  --owner 0xSHARED_PUBLIC_EDITOR_ADDRESS \
  --inventory /absolute/path/to/verified-inventory \
  --expected-parcels 8807 \
  --world 0xSHARED_64_HEX_DIGIT_WORLD_ID \
  --peer https://AN_EXISTING_NODE \
  --public-origin https://YOUR_NODE_HOSTNAME
node selfhost/node/setup.mjs up --directory "$HOME/voxels-node"
```

Repeat `--peer` for up to 16 peers. A connection exchanges changes both ways, so one configured direction is sufficient. For an existing node, update the comma-separated `FEDERATION_PEERS` in its private `app.env` and restart with `up`. Adding a peer does not download the initial world. Use the [signed archive verification instructions](../seed/README.md) first, extract into a new staging directory, and include reviewed `islands.json` alongside `builds/*.json.gz`. Saved historical versions stay in archive storage. A node rejects edits whose starting parcel hash differs.

The current public archive is about 4.67 GB compressed and excludes external media. Download availability depends on reachable seeds; the pilot website does not expose bulk chunks through its public gateway. A fresh starter is a separate world and cannot synchronize with an archive-based world.

## Join the Bittrees pilot

The repository includes a [pinned network reference](networks/bittrees.json) and [island geometry](networks/bittrees-islands.json). Verify and extract the public snapshot described above, then copy the pinned island file into that extracted inventory as `islands.json`:

```sh
cp selfhost/node/networks/bittrees-islands.json /path/to/verified-inventory/islands.json
node selfhost/node/setup.mjs init \
  --directory "$HOME/voxels-node" \
  --network selfhost/node/networks/bittrees.json \
  --inventory /path/to/verified-inventory \
  --public-origin https://YOUR_NODE_HOSTNAME
node selfhost/node/setup.mjs up --directory "$HOME/voxels-node"
```

`--network` checks the island-file hash and sets the pinned owner, world ID, expected parcel count and peer. Archive verification remains a separate required step. Trust the network reference only from a reviewed repository revision. The node is the first pilot peer; adding more independently reachable hosts improves resilience. The parcel manager preserves the archived role assignments; joining does not grant the host operator parcel rights or complete the NFT migration.

## Publish safely

The gateway binds only to `127.0.0.1:8787`; PostgreSQL and Redis have no host ports. Put an HTTPS reverse proxy or tunnel in front of that gateway, with WebSocket support and the configured public origin. The installer does not change DNS, router settings, firewall rules or existing services. Keep database, Redis, Docker and torrent administration private. See [AI setup instructions](AI_SETUP.md) for an assistant-guided installation.

Only operator-configured HTTP(S) origins are contacted. HTTPS is required for public peers. `--allow-local-http` is exclusively for isolated test networks. Node endpoints are publicly discoverable; node operators do not have IP anonymity.

## Synchronization and privacy

Each accepted edit retains its wallet signature, world, parcel, starting hash, parent revision, causal counter and nonce in PostgreSQL. Nodes independently verify signatures and permissions before applying it. Edits replay in causal-counter then content-hash order, so arrival order does not decide the result. Changes to different voxels or feature properties survive; competing changes to the same field have a deterministic winner. The signed history retains both alternatives. Permission changes explicitly retain acknowledged builds. Unsynced changes under an older permission revision remain pending for the parcel owner to review; revocation never silently grants a revoked wallet fresh authority. Concurrent manager permission branches pause building for that parcel until its owner settles them. New owner epochs supersede old manager branches. Rights propagate eventually; an online host is not proof of instantaneous agreement across a partition. Full voxel-field replacement intentionally replaces earlier voxel changes. There is no automatic history deletion or compaction; a parcel stops accepting edits at 10,000 events until an explicit upgrade provides safe compaction.

Reconnection is eventual, not instant. Logs survive server restarts. A host can save builds while disconnected from peers, but the browser still needs a connection to that host. There is no browser offline outbox. Entry checks a live host before booting the world, and every save rechecks permissions at that host. A cached page is not authorization to edit. Unsigned metadata edits through the legacy parcel API are disabled in shared-world mode. The existing parcel manager signs changes to names/descriptions and delegated roles, and supports signed build import/revert. Public build synchronization covers voxels, features, palette, tileset, brightness and full build replacements. Accounts, chat, voice, vehicles, scripted runtime state, private parcels and NFT migration state are not synchronized.

Player poses travel from browser to its selected host and then over HTTPS between hosts, without browser-to-browser connections. Only anonymous positions, orientations, animation and host-scoped random IDs are forwarded. Other hosts see the relay host's address, not the browser's address. The selected host and its tunnel/proxy provider still see the visitor's network address. External media providers may also receive browser requests. Remote avatars are labeled “Remote traveler”; a host signature proves the host, not a person's identity. Public hosts can invent avatars. Presence expires after 15 seconds and is limited to 64 players per host and 16 remote hosts. Movement updates are roughly once per second, suitable for an initial shared presence implementation rather than competitive game physics.

Public media storage has its own opt-in sharing setting; see [Media cache](../world/MEDIA_CACHE.md). It does not enable WebRTC or promise anonymity from the connected host. GitHub distributes code and small snapshot references, not live traffic or bulk archives.

## Verification

`node --test selfhost/node/setup.test.mjs` checks installer isolation and credential retention. The regular test suite checks signed edits, convergence and presence validation. `sync-smoke.ts` is an explicit integration harness for two disposable local nodes and a throwaway editor wallet; it must never receive a real wallet key. It can test a temporary network partition, restart recovery, replay rejection, convergence, cross-host avatars and departure cleanup. Production deployment still requires testing the wallet flow with the intended wallet and checking resource use under expected load.

## Upgrade from the owner-only pilot

All participating hosts must upgrade to protocol version 2 before exchanging delegated edits. Back up first. Nodes whose original import excluded roles can run `selfhost/world/restore-parcel-rights.mjs VERIFIED_INVENTORY` with their private database configuration **before** starting this version with `PARCEL_EDIT_POLICY=parcel`. The one-time restore refuses existing roles, changed ownership or initialized permission genesis. It imports only parcel-specific roles, never global moderators, credentials or sessions. New installer imports already preserve these records. Do not overwrite a running permission history with a fresh archive.

## Public media storage

Optional visitor-assisted media caching and the 75 GB node/archive overflow configuration are documented in [Media cache](../world/MEDIA_CACHE.md). Browser sharing is opt-in; the world host independently validates public references.

## Full and partial nodes

A **full node** hosts all public parcels from the verified initial snapshot and synchronizes their signed build and permission history. This describes parcel coverage, not a promise that every linked media file has already been downloaded. A **partial node** imports and synchronizes only the parcel IDs its operator selects. Storage hardware does not determine either role.

The default is full coverage. For a partial node, add these options to the existing `init --network ... --inventory ...` command:

```sh
--node-mode partial --parcels 1,42,109
```

The installer validates the entire public source snapshot, then imports only the selected parcels and their original ownership, managers, builders and unresolved rights records. It retains shared island geometry. The host advertises `coverage` in `/federation/info`; peers exchange only their shared parcels. Older full peers are supported by locally discarding unrelated feed events while advancing their cursor.

Selection does not grant editing authority. Every accepted edit and permission change still verifies the wallet signature, world, parcel snapshot, causal parents and current permission history. A partial node refuses reads of federation state and edits for parcels it does not host. Visitors see the hosted portion of the world; there is no automatic cross-node parcel routing. Anonymous world-wide presence packets remain shared; private accounts, messages and access credentials are not replicated.

Coverage is fixed per installation. To change selection, create a new node directory from the same verified snapshot and synchronize its history before switching traffic. Do not edit `NODE_MODE`/`NODE_PARCELS` on an existing database: startup rejects a changed or inconsistent selection. Existing nodes with no coverage setting retain full coverage. A partial node needs a reachable peer with overlapping parcels to receive later changes. The archive downloader is a separate explicit task; choosing partial coverage does not prune or change an already running full-media archive job.
