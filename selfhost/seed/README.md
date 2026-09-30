# Seed the public Voxels archive

A small Node.js service and standard BitTorrent snapshot let a node verify and seed public parcel builds. Node 24 LTS is sufficient for these standalone tools. The full application retains its own runtime requirements.

The initial snapshot contains **8,807 public parcels and 485,181 saved historical versions**, totaling 4,668,741,062 bytes of compressed archive data. External images, video, audio, and models are **not included**. Non-public parcels were excluded at collection time. This is an archive observation, not an Ethereum ownership snapshot for migration claims.

## Download and seed

1. Download `snapshots/public-world-2026-09-30.torrent` from this repository and open it in Transmission or another BitTorrent client. Choose a disk with at least 5 GB free. Leave the torrent running to seed it. Its data directory is named `seed`.
2. Obtain `publisher.pem` and this manifest hash from a trusted copy of this repository:

   ```text
   44773acab66cd46e405cdd3576b8f4139701d9209965f6844b12e86422d45ba0
   ```

3. Verify the downloaded files using Node:

   ```sh
   node seed.mjs verify /path/to/seed \
     44773acab66cd46e405cdd3576b8f4139701d9209965f6844b12e86422d45ba0 publisher.pem
   ```

4. To reconstruct the original archive, add a new output filename to that command. Allow another 4.67 GB of disk space. Existing output files are never overwritten. Extraction requires additional storage.

The torrent info hash is `5d1244369b5e013e4de20216c5a23234c447b867`. Torrent checks protect transfer integrity; the signed SHA-256 manifest authenticates the publisher and original archive. A key supplied by an untrusted peer is not a trust anchor. Pin the repository revision, public key and manifest hash separately.

If a seed offers direct HTTP access, `node seed.mjs mirror SEED_URL MANIFEST_HASH publisher.pem DESTINATION` downloads only missing or corrupt chunks, verifies every chunk and the complete archive, and resumes safely after interruption. The default snapshot budget is 1 TB. The mirror's budget is not a filesystem quota and does not account for other snapshots already on disk.

To offer read-only HTTP access on your own network:

```sh
node seed.mjs serve /path/to/seed 8788 0.0.0.0
```

Use an HTTPS reverse proxy for public HTTP access. Never expose an archive write interface or a torrent client's administration interface. BitTorrent peers can see each other's IP addresses. The node pilot disables automatic router port forwarding; outside connectivity depends on reachable peers and NAT conditions.

## Snapshot format

Data is split into 8 MiB chunks, addressed by SHA-256. An immutable manifest records the archive name, exact size, complete archive hash, ordered chunks, publication time and previous manifest hash. An Ed25519 signature authenticates the manifest's exact bytes. The timestamp is descriptive; it is not independent proof of publication time. Git history can record when a manifest was published.

`latest.json` is a mutable discovery hint, never a trust anchor. Clients pin the immutable manifest hash. `publisher.pem` is public; keep the matching private key off seed hosts and out of Git.

Publish a new snapshot:

```sh
node seed.mjs keygen /private/publisher.pem
node seed.mjs publish public-world-inventory.tar.gz /archive/seed /private/publisher.pem [PREVIOUS_MANIFEST_HASH]
python3 create-torrent.py /archive/seed snapshot.torrent
```

Reuse the publisher key for subsequent snapshots; do not regenerate it. Publish only the small manifests, signatures, public key and torrent descriptor in GitHub. Keep chunks on seed storage. Publishing and mirroring should each have a single writer per target directory.

## Active world on the node

`https://bittrees.world` opens this repository's playable client at `/play`. The node runs the full world HTTP/grid server, multiplayer server, PostgreSQL 18 database, private Redis presence cache, archive service and Cloudflare Tunnel. Current public builds are imported into the live database; historical versions remain in the archive. See [world setup](../world/README.md).

archive storage supplies a mounted archive directory with a decimal **1 TB hard quota** (950 GB soft threshold). The quota caps use; it does not reserve physical disk space. Mount free-space reports may show the whole NAS capacity rather than this account's quota.

The gateway forwards application requests and up to 64 combined grid/player WebSocket connections. `/archive/` provides snapshot metadata; bulk archive chunks are not exposed through the public gateway. BitTorrent sharing is capped at 128 KB/s on this deployment. PostgreSQL uses a private local socket; Redis listens only on loopback. Player activity is separate from the public archive. Automatic deletion/retention is not enabled.

The launch uses `PARCEL_EDIT_POLICY=admin`: visiting and multiplayer are public, while parcel editing is restricted to the configured administrator wallet until the ownership migration is deployed. Imported public profiles do not confer contributor or moderator permissions. Optional email, voice, uploads and Ethereum integrations need their own credentials/configuration; this deployment does not provision those external services. The node's firewall, DHCP and monitoring services remain separate.

Use WebSockets for authoritative player state. [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/) provides the public connection. [TURN](https://developers.cloudflare.com/realtime/turn/) is useful if WebRTC voice or data channels later need a relay; it does not synchronize or store world state. Keep bulk transfers off the ordinary Cloudflare proxy unless using a service whose terms support that workload.

The measured external-media inventory is already about 824 GB, with additional unsized assets and future growth. A full media import needs capacity planning and URL/content deduplication before treating 1 TB as sufficient.

## Checks

```sh
node --test seed.test.mjs
```

The test covers signed download, complete-archive reconstruction, corruption repair, budget rejection, signature rejection and read-only routing. Deployment additionally verifies every NAS chunk against the manifest and checks the multiplayer protocol and private-service boundaries.
