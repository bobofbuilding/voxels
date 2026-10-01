# Public world media archive

Download **current public-parcel media first**, then media referenced only by saved historical versions. The downloader uses a verified public parcel inventory and preserves completed downloads when resuming or upgrading. This is separate from the live world's 75 GB node cache. Up to four workers download into a bounded local staging directory; one writer commits verified files to the chosen archive mount. Nothing is automatically published, executed, or deleted from the completed archive.

## Set up on a node or Linux host

Requires Python 3.9+, a systemd user session, a writable local state directory and a separately mounted archive. No Python packages, wallet keys or API credentials are needed.

1. Clone `https://github.com/bobofbuilding/voxels.git` and open its root directory. Obtain and verify the public inventory using [the signed seed instructions](../seed/README.md); extract its `assets.csv`. Do not substitute a private parcel catalog.
2. Mount your storage with a real filesystem quota. Avoid an unbounded local write cache. On Bittrees, the dedicated NAS account has a **1.5 TB decimal hard quota** and a **1.45 TB soft threshold**. The existing rclone mount uses `--vfs-cache-mode off`; set `MEDIA_ARCHIVE_RESUME=0` for this mode because it cannot append to existing partial files.
3. Start the downloader:

```sh
sh selfhost/media/install.sh /path/to/assets.csv /mnt/archive
```

Gzipped CSV is also accepted. The default application budget is **1.35 TB**, leaving headroom within a 1.5 TB allocation. The default maximum aggregate transfer rate is **8 MB/s**, with four download workers and one archive writer. Local staging reserves at most **1.024 GB** (four × 256 MB) plus 10 GB of free-space headroom. Set `MEDIA_ARCHIVE_WORKERS=1` to use the original direct-streaming path. Override before installation with `MEDIA_ARCHIVE_MAX_BYTES` and `MEDIA_ARCHIVE_RATE`. A lingering systemd user session is needed to keep running after logout; configure that with your host administrator.

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

Keep active SQLite state on the node's local disk, normally `~/.local/share/voxels/media-archive/`. A consistent closed snapshot is copied to the archive at startup, every hour and at stop/completion. Do not put the active database on SFTP/FUSE. Run only one writer against a media directory. Copy `files/` and `catalog.sqlite` to replicate a completed archive; for a moving archive, stop the service first and wait for its snapshot to finish (a large catalog can take a few minutes over SFTP). Verify file hashes against the catalog when copying to another host. A crash can require redownloading files since the last snapshot; matching payloads deduplicate.

## Download order and safeguards

Current public-parcel media is processed first, including unknown-size current assets; historical-only media follows after every current URL has a completed, skipped or failed outcome. Unavailable current sources remain recorded in the report. Shared URLs count as current and download once. The inventory’s `current_references` column defines current membership at inventory capture time. Within each scope, measured type groups are ordered by their summed reported size, ascending, then files by size; unmeasured files follow the measured groups in that scope. Reported MIME types determine queue order; actual response types determine storage folders.

Only inventory rows classified `asset` are queued. Ordinary links, embedded data already in the builds, streaming services, and live playlists are not finite asset downloads. Each redirect must resolve to public IP addresses; connections pin the validated address and retain TLS hostname verification. No cookies, authentication headers or private credentials are sent. Public Dropbox shared-file links use their ordinary download option. Login/private/HTML responses are recorded as unavailable; access restrictions are not bypassed.

Completed payloads are hashed while streaming. When resume is enabled and storage supports append, interrupted files resume only with an ETag or Last-Modified validator and a correct byte-range response; otherwise the download restarts. Transient failures get up to three attempts. Permanent failures are recorded and the run continues. Unknown-length responses are bounded to 50 GB and 24 hours per attempt; larger files are recorded for review, not silently assumed complete. Current measured files are all below that limit. HTTP Content-Length is checked but reported inventory sizes may have changed.

The downloader pauses on its byte budget, missing mount, disk/quota errors, or less than 10 GB free on the underlying filesystem. **A mounted SFTP filesystem may report whole-disk capacity rather than the account quota**: also monitor the dedicated NAS quota and stop this downloader at the 1.45 TB soft threshold. The live cache and backups share the same hard quota. Existing completed files are retained.

Archive data, including SVG/scripts and other active formats, must not be served inline under the world's origin. This downloader does not change playback URLs, publish a media torrent, or automatically integrate historical assets into the live cache.

## Performance and limits

Source latency and per-file filesystem operations can limit speed even when bandwidth is available. Four workers fetch complete payloads to local temporary files while one writer copies them sequentially to the archive. Workers never write SQLite or the archive mount. Content hashes are verified again while copying, duplicates avoid a second archive write, and a URL becomes completed only after its archive write closes and its catalog record commits. Current/history and type-group boundaries are preserved; completed staging files are committed in queue order.

| Installer setting | Default | Purpose |
| --- | --- | --- |
| `MEDIA_ARCHIVE_WORKERS` | `4` (range 1–4) | Parallel local downloads; `1` restores direct streaming |
| `MEDIA_ARCHIVE_STAGE_FILE_BYTES` | `256000000` | Maximum local bytes reserved per worker |
| `MEDIA_ARCHIVE_CHECKPOINT_SECONDS` | `3600` | Archive catalog backup interval; local progress still updates every 30 seconds |
| `MEDIA_ARCHIVE_RESUME` | `1` | Use `0` for archive mounts that cannot append |
| `MEDIA_ARCHIVE_CONNECTIONS` | `4` (range 1–4) | Small-file connection overlap in direct-streaming mode only |
| `MEDIA_ARCHIVE_RATE` | `8000000` bytes/s | Aggregate payload ceiling across workers, with bounded chunk buffering |
| `MEDIA_ARCHIVE_MAX_BYTES` | `1350000000000` bytes | Unique payload budget, not a filesystem quota |

The installer allows up to one CPU core (`CPUQuota=100%`) at low scheduling priority and retains its 384 MB memory limit. Each local staging slot reserves the full configured per-file limit before network work begins, including unknown-size files. Larger files stream directly to the archive. If a response grows past its staging limit, its connection closes and it restarts through the bounded direct-streaming path. Archive writes never overlap with each other or catalog snapshots.

Staging is separate from the live-world cache. Its directory is temporary under the local state directory; normal shutdown cleans it after workers exit. An abrupt power loss can leave a `staging-*` directory: inspect and remove only those temporary directories while the downloader is stopped. Completed archive files and the active catalog must be preserved. Staged transfers restart after interruption; `MEDIA_ARCHIVE_RESUME` applies to the direct-streaming fallback. Keep `MEDIA_ARCHIVE_RESUME=0` on mounts without append support.

```sh
MEDIA_ARCHIVE_RESUME=0 MEDIA_ARCHIVE_WORKERS=4 MEDIA_ARCHIVE_CHECKPOINT_SECONDS=3600 \
  sh selfhost/media/install.sh /path/to/assets.csv.gz /mnt/archive
```

Set these variables on upgrades as well. The direct CLI defaults to one worker for compatibility; use `--workers 4 --stage-file-bytes 256000000 --checkpoint-seconds 3600` to enable staging. Smaller hosts can choose two workers or smaller staging slots. Completed local staging files waiting for the archive writer apply backpressure: no new batch begins until the previous batch is consumed.

Catalog checkpoints run at startup, between archive writes when the interval is due, and shutdown. Staging downloads can continue within their reservation during a checkpoint. A growing `media/catalog.sqlite.pending` indicates checkpoint progress. Hourly archive backups reduce pauses but increase how much work might need reconciling if local state is lost; the local catalog still records every completed URL. Compare completed URLs and unique bytes over several intervals. Throughput depends on source hosts, duplication, file sizes and storage; four workers do not guarantee a fourfold gain.

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

Status includes `staging` for in-flight local downloads, `current.phase=archive-write` when copying a staged payload, `priority_counts` (0=current, 1=historical-only) and the active transfer’s `scope`. Storage errors also save a bounded traceback in local `last-error.json` for diagnosis. Check every 15 minutes: status timestamp, downloaded count/current transfer bytes, mount availability, quota, and live-world health. A complete run means every candidate has a terminal outcome; missing or restricted files remain in `unavailable.csv`. `unique_bytes` measures content-deduplicated payloads; downloaded URL bytes can be larger because multiple URLs contain the same data. Preserve and include failures in the final report.

The installer creates the download service, but does not create a separate 15-minute monitoring automation. Configure monitoring with your preferred tool. If the service reports `blocked`, inspect `last-error.json`, mount health and the account quota. Resolve the cause before restarting; do not repeatedly restart unexplained storage errors. Never disable certificate checks or use credentials to bypass unavailable sources.

## Ask an AI tool to install it

“Read selfhost/media/README.md and the repository instructions. Use my verified public inventory and existing archive mount to install or upgrade the media downloader with current public-parcel media first and historical-only media second. Preserve completed files and use the exact original inventory for an existing catalog. Keep state and bounded temporary staging local, completed payloads on the archive; do not change firewall rules or credentials. Verify the actual quota, preserve existing data, check the first successful downloads and configure the 15-minute monitoring I request. Report unavailable sources honestly.”

Run regression checks with `python3 -m unittest discover -s selfhost/media -p 'test_*.py'`.
