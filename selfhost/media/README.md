# Public world media archive

Download **current public-parcel media first**, then media referenced only by saved historical versions. The downloader uses a verified public parcel inventory and preserves completed downloads when resuming or upgrading. This is separate from the live world's 75 GB node cache. Files go directly to the chosen archive mount. Nothing is automatically published, executed, or deleted from the completed archive.

## Set up on a node or Linux host

Requires Python 3.9+, a systemd user session, a writable local state directory and a separately mounted archive. No Python packages, wallet keys or API credentials are needed.

1. Clone `https://github.com/bobofbuilding/voxels.git` and open its root directory. Obtain and verify the public inventory using [the signed seed instructions](../seed/README.md); extract its `assets.csv`. Do not substitute a private parcel catalog.
2. Mount your storage with a real filesystem quota. Avoid an unbounded local write cache. On Bittrees, the dedicated NAS account has a **1.5 TB decimal hard quota** and a **1.45 TB soft threshold**. The existing rclone mount uses `--vfs-cache-mode off`; set `MEDIA_ARCHIVE_RESUME=0` for this mode because it cannot append to existing partial files.
3. Start the downloader:

```sh
sh selfhost/media/install.sh /path/to/assets.csv /mnt/archive
```

Gzipped CSV is also accepted. The default application budget is **1.35 TB**, leaving headroom within a 1.5 TB allocation. The default maximum transfer rate is **8 MB/s**, with one payload written at a time. Up to four small-file connection setups overlap to reduce DNS/TLS/redirect delays; set `MEDIA_ARCHIVE_CONNECTIONS=1` to disable overlap. Override before installation with `MEDIA_ARCHIVE_MAX_BYTES` and `MEDIA_ARCHIVE_RATE`. A lingering systemd user session is needed to keep running after logout; configure that with your host administrator.

The installer resumes an existing local catalog, or restores the archive's catalog snapshot when local state is new. It does not configure a NAS, change its quota, or expose ports.

## Full and partial nodes

This is an optional media archive companion to the [world node installer](../node/README.md). Current parcel builds and saved build versions come from the [signed seed archive](../seed/README.md); this tool downloads their external media references.

The media downloader currently processes the entire supplied public inventory. It does **not** automatically filter media by a partial node's selected parcel IDs. Full world coverage also does not require downloading every historical media file. Parcel ownership and delegated building permissions remain enforced by the world node; archiving media grants no editing rights.

## Simple portable layout

```text
archive/
  seed/                       existing signed build/history archive, unchanged
  media/
    files/<mime-type>/<first-two-hash-characters>/<sha256>.<extension>
    catalog.sqlite            portable URL → file map and outcomes
    status.json               progress, type totals and current transfer
    REPORT.md                 human-readable progress/final report
    unavailable.csv           failed/skipped URLs when the run finishes
    .partial/                 temporary interrupted transfers
```

Files are grouped by actual response type. The short hash prefix keeps individual directories manageable. Identical content at different URLs shares one file, even across reported types; use the catalog to resolve the URL. The catalog preserves original URLs, reported/actual types and sizes, final redirect URLs, hashes, attempts, timestamps and failure reasons. Shared/private node configuration and the running database stay outside this portable media directory.

Keep active SQLite state on the node's local disk, normally `~/.local/share/voxels/media-archive/`. A consistent closed snapshot is copied to the archive at startup, every 15 minutes and at stop/completion. Do not put the active database on SFTP/FUSE. Run only one writer against a media directory. Copy `files/` and `catalog.sqlite` to replicate a completed archive; for a moving archive, stop the service first and wait for its snapshot to finish (a large catalog can take a few minutes over SFTP). Verify file hashes against the catalog when copying to another host. A crash can require redownloading files since the last snapshot; matching payloads deduplicate.

## Download order and safeguards

Current public-parcel media is processed first, including unknown-size current assets; historical-only media follows after every current URL has a completed, skipped or failed outcome. Unavailable current sources remain recorded in the report. Shared URLs count as current and download once. The inventory’s `current_references` column defines current membership at inventory capture time. Within each scope, measured type groups are ordered by their summed reported size, ascending, then files by size; unmeasured files follow the measured groups in that scope. Reported MIME types determine queue order; actual response types determine storage folders.

Only inventory rows classified `asset` are queued. Ordinary links, embedded data already in the builds, streaming services, and live playlists are not finite asset downloads. Each redirect must resolve to public IP addresses; connections pin the validated address and retain TLS hostname verification. No cookies, authentication headers or private credentials are sent. Public Dropbox shared-file links use their ordinary download option. Login/private/HTML responses are recorded as unavailable; access restrictions are not bypassed.

Completed payloads are hashed while streaming. When resume is enabled and storage supports append, interrupted files resume only with an ETag or Last-Modified validator and a correct byte-range response; otherwise the download restarts. Transient failures get up to three attempts. Permanent failures are recorded and the run continues. Unknown-length responses are bounded to 50 GB and 24 hours per attempt; larger files are recorded for review, not silently assumed complete. Current measured files are all below that limit. HTTP Content-Length is checked but reported inventory sizes may have changed.

The downloader pauses on its byte budget, missing mount, disk/quota errors, or less than 10 GB free on the underlying filesystem. **A mounted SFTP filesystem may report whole-disk capacity rather than the account quota**: also monitor the dedicated NAS quota and stop this downloader at the 1.45 TB soft threshold. The live cache and backups share the same hard quota. Existing completed files are retained.

Archive data, including SVG/scripts and other active formats, must not be served inline under the world's origin. This downloader does not change playback URLs, publish a media torrent, or automatically integrate historical assets into the live cache.

## Performance and limits

Small files can be slow even when little bandwidth is used: each URL may need DNS, TLS, redirects and several archive filesystem operations. The downloader overlaps up to four connection setups for fresh files reported at 1 MiB or smaller, and reuses its verified TLS context. Payloads and archive writes remain sequential so storage accounting, deduplication and the transfer cap stay coordinated. Larger or resumed files use the normal sequential path.

| Installer setting | Default | Purpose |
| --- | --- | --- |
| `MEDIA_ARCHIVE_RESUME` | `1` | Use `0` for mounts that cannot append; interrupted files restart, completed files remain |
| `MEDIA_ARCHIVE_CONNECTIONS` | `4` (range 1–4) | Overlapping small-file connection setups |
| `MEDIA_ARCHIVE_RATE` | `8000000` bytes/s | Payload transfer ceiling, not guaranteed throughput |
| `MEDIA_ARCHIVE_MAX_BYTES` | `1350000000000` bytes | Unique payload budget, not a filesystem quota |

Set these variables when running the installer, including on upgrades if you use custom limits. The following example is for a streaming mount without append support; regular filesystems can keep resume enabled. The direct CLI equivalent is `--no-resume`. No additional local payload cache is required. For example:

```sh
MEDIA_ARCHIVE_RESUME=0 MEDIA_ARCHIVE_CONNECTIONS=4 MEDIA_ARCHIVE_RATE=8000000 \
  sh selfhost/media/install.sh /path/to/assets.csv.gz /mnt/archive
```

A four-file request benchmark on the initial host measured 1.36 seconds sequentially versus 0.16 seconds with overlapping requests. This excludes archive writes and is not an end-to-end speed guarantee. Compare completed URL counts and unique bytes over several monitoring intervals; a small-file group may add many files but few bytes.

Catalog checkpoints run at startup, between files when the 15-minute interval is due, and shutdown. Large active transfers defer the checkpoint until their output is closed. Progress continues updating locally during transfers; the archive copy is updated between files. Prefetched connections are closed before checkpointing to avoid idle timeouts. A large catalog can take several minutes to copy to remote storage. A growing `media/catalog.sqlite.pending` indicates checkpoint progress. Raising the transfer cap will not fix per-file latency or a slow archive mount.

## Upgrade an existing queue

Update your checkout to the current `main` revision first, resolving any local changes. Stop the existing service and let its snapshot finish, then rerun the installer with the **same original inventory file**. Its hash must match the catalog: a recompressed copy of the same CSV may not match. Back up the stopped local catalog before upgrading. Reuse the same archive mount and local state directory (the optional third installer argument). Reprioritization changes only queue membership/order; completed files, hashes, attempts and outcomes are preserved. Do not start a second writer.

```sh
systemctl --user stop voxels-media-archive.service
sh selfhost/media/install.sh /path/to/assets.csv.gz /mnt/archive
```

For a manually managed process, stop it first and run `python3 selfhost/media/archive.py prioritize --root /mnt/archive/media --state /local/state --csv /path/to/assets.csv.gz`, then resume `run`. Older catalogs gain the priority column automatically. A catalog must be prioritized before using current-first order; missing current-reference information is rejected.

## Operate and monitor

```sh
systemctl --user status voxels-media-archive.service
cat ~/.local/share/voxels/media-archive/status.json
systemctl --user stop voxels-media-archive.service
systemctl --user start voxels-media-archive.service
journalctl --user -u voxels-media-archive.service -n 20 --no-pager
```

Status includes `priority_counts` (0=current, 1=historical-only) and the active transfer’s `scope`. Storage errors also save a bounded traceback in local `last-error.json` for diagnosis. Check every 15 minutes: status timestamp, downloaded count/current transfer bytes, mount availability, quota, and live-world health. A complete run means every candidate has a terminal outcome; missing or restricted files remain in `unavailable.csv`. `unique_bytes` measures content-deduplicated payloads; downloaded URL bytes can be larger because multiple URLs contain the same data. Preserve and include failures in the final report.

The installer creates the download service, but does not create a separate 15-minute monitoring automation. Configure monitoring with your preferred tool. If the service reports `blocked`, inspect `last-error.json`, mount health and the account quota. Resolve the cause before restarting; do not repeatedly restart unexplained storage errors. Never disable certificate checks or use credentials to bypass unavailable sources.

## Ask an AI tool to install it

“Read selfhost/media/README.md and the repository instructions. Use my verified public inventory and existing archive mount to install or upgrade the media downloader with current public-parcel media first and historical-only media second. Preserve completed files and use the exact original inventory for an existing catalog. Keep state local and payloads on the archive; do not change firewall rules or credentials. Verify the actual quota, preserve existing data, check the first successful downloads and configure the 15-minute monitoring I request. Report unavailable sources honestly.”

Run regression checks with `python3 -m unittest discover -s selfhost/media -p 'test_*.py'`.
