# Host a shared Voxels world

This installer runs the playable world, multiplayer server, PostgreSQL and Redis with Docker Compose. Each host keeps its own database and accepts wallet-signed public build edits without contacting another host. Connected hosts exchange those edits and player positions; disconnected hosts catch up when a peer becomes reachable.

Anyone can operate a node. Hosting does not grant editing permission. This first version preserves the migration launch policy: the network's configured `OWNER_ADDRESS` is the only editor. Legacy NFT ownership does not grant editing rights. Per-parcel permissions need a separate migration-aware authorization protocol.

## Requirements

Use a 64-bit Linux or macOS host, Node 24 or newer, and Docker with Compose v2. A Raspberry Pi 4/5 with 8 GB RAM and an SSD is a reasonable starting point; player capacity must be measured. Building the application and importing the world require more disk space than the compressed archive. Keep PostgreSQL on local reliable storage. MyCloud/NAS storage is appropriate for verified archives and private backups, not the live database.

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

Hosts must agree on the world identifier, editor wallet and exact initial parcel data. A world ID is a `0x`-prefixed 32-byte identifier, not a contract address. Starter worlds derive it deterministically from the owner address. For archive-based worlds, obtain the world ID and pinned snapshot from the network publisher through a trusted channel.

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

`--network` checks the island-file hash and sets the pinned owner, world ID, expected parcel count and peer. Archive verification remains a separate required step. Trust the network reference only from a reviewed repository revision. The Pi is the first pilot peer; adding more independently reachable hosts improves resilience. This does not change who may edit or complete the NFT migration.

## Publish safely

The gateway binds only to `127.0.0.1:8787`; PostgreSQL and Redis have no host ports. Put an HTTPS reverse proxy or tunnel in front of that gateway, with WebSocket support and the configured public origin. The installer does not change DNS, router settings, firewall rules or existing services. Keep database, Redis, Docker and torrent administration private. See [AI setup instructions](AI_SETUP.md) for an assistant-guided installation.

Only operator-configured HTTP(S) origins are contacted. HTTPS is required for public peers. `--allow-local-http` is exclusively for isolated test networks. Node endpoints are publicly discoverable; node operators do not have IP anonymity.

## Synchronization and privacy

Each accepted edit retains its wallet signature, world, parcel, starting hash, parent revision, causal counter and nonce in PostgreSQL. Nodes independently verify signatures and permissions before applying it. Edits replay in causal-counter then content-hash order, so arrival order does not decide the result. Changes to different voxels or feature properties survive; competing changes to the same field have a deterministic winner. The signed history retains both alternatives. Full voxel-field replacement intentionally replaces earlier voxel changes. There is no automatic history deletion or compaction; a parcel stops accepting edits at 10,000 events until an explicit upgrade provides safe compaction.

Reconnection is eventual, not instant. Logs survive server restarts. A host can save builds while disconnected from peers, but the browser still needs a connection to that host. There is no browser offline outbox. Metadata edits through the legacy parcel API are disabled in shared-world mode. Public build synchronization covers voxels, features, palette, tileset and brightness. Accounts, chat, voice, vehicles, scripted runtime state, private parcels and NFT migration state are not synchronized.

Player poses travel from browser to its selected host and then over HTTPS between hosts, without browser-to-browser connections. Only anonymous positions, orientations, animation and host-scoped random IDs are forwarded. Other hosts see the relay host's address, not the browser's address. The selected host and its tunnel/proxy provider still see the visitor's network address. External media providers may also receive browser requests. Remote avatars are labeled “Remote traveler”; a host signature proves the host, not a person's identity. Public hosts can invent avatars. Presence expires after 15 seconds and is limited to 64 players per host and 16 remote hosts. Movement updates are roughly once per second, suitable for an initial shared presence implementation rather than competitive game physics.

This node protocol is separate from the planned opt-in browser upload cache. It does not enable WebRTC or promise anonymity from the connected host. GitHub distributes code and small snapshot references, not live traffic or bulk archives.

## Verification

`node --test selfhost/node/setup.test.mjs` checks installer isolation and credential retention. The regular test suite checks signed edits, convergence and presence validation. `sync-smoke.ts` is an explicit integration harness for two disposable local nodes and a throwaway editor wallet; it must never receive a real wallet key. It can test a temporary network partition, restart recovery, replay rejection, convergence, cross-host avatars and departure cleanup. Production deployment still requires testing the wallet flow with the intended wallet and checking resource use under expected load.
