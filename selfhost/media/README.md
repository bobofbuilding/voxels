# Public world media archive

Download the media references from a **public parcel inventory**, including its saved historical versions. This is separate from the live world's 75 GB node cache. Files go directly to the chosen archive mount. Nothing is automatically published, executed, or deleted from the completed archive.

## Set up on a node or Linux host

Requires Python 3.9+, a systemd user session, a writable local state directory and a separately mounted archive. No Python packages, wallet keys or API credentials are needed.

1. Clone this repository. Obtain and verify the public inventory using [the signed seed instructions](../seed/README.md); extract its `assets.csv`. Do not substitute a private parcel catalog.
2. Mount your storage with a real filesystem quota. Avoid an unbounded local write cache. On Bittrees, the dedicated NAS account has a **1.5 TB decimal hard quota** and a **1.45 TB soft threshold**. The existing rclone mount uses `--vfs-cache-mode off`.
3. Start the downloader:

```sh
sh selfhost/media/install.sh /path/to/assets.csv /mnt/archive
```

Gzipped CSV is also accepted. The default application budget is **1.35 TB**, leaving headroom within a 1.5 TB allocation. The default maximum transfer rate is **8 MB/s** with one active file, prioritizing the live world. Override before installation with `MEDIA_ARCHIVE_MAX_BYTES` and `MEDIA_ARCHIVE_RATE`. A lingering systemd user session is needed to keep running after logout; configure that with your host administrator.

The installer resumes an existing local catalog, or restores the archive's catalog snapshot when local state is new. It does not configure a NAS, change its quota, or expose ports.

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

Measured type groups are ordered by their summed reported size, ascending. Within each group, the smallest measured files start first. All unmeasured candidates are attempted afterward. Reported MIME types determine queue order; actual response types determine storage folders.

Only inventory rows classified `asset` are queued. Ordinary links, embedded data already in the builds, streaming services, and live playlists are not finite asset downloads. Each redirect must resolve to public IP addresses; connections pin the validated address and retain TLS hostname verification. No cookies, authentication headers or private credentials are sent. Public Dropbox shared-file links use their ordinary download option. Login/private/HTML responses are recorded as unavailable; access restrictions are not bypassed.

Completed payloads are hashed while streaming. Interrupted files resume only with an ETag or Last-Modified validator and a correct byte-range response; otherwise the download restarts. Transient failures get up to three attempts. Permanent failures are recorded and the run continues. Unknown-length responses are bounded to 50 GB and 24 hours per attempt; larger files are recorded for review, not silently assumed complete. Current measured files are all below that limit. HTTP Content-Length is checked but reported inventory sizes may have changed.

The downloader pauses on its byte budget, missing mount, disk/quota errors, or less than 10 GB free on the underlying filesystem. **A mounted SFTP filesystem may report whole-disk capacity rather than the account quota**: also monitor the dedicated NAS quota and stop this downloader at the 1.45 TB soft threshold. The live cache and backups share the same hard quota. Existing completed files are retained.

Archive data, including SVG/scripts and other active formats, must not be served inline under the world's origin. This downloader does not change playback URLs, publish a media torrent, or automatically integrate historical assets into the live cache.

## Operate and monitor

```sh
systemctl --user status voxels-media-archive.service
cat ~/.local/share/voxels/media-archive/status.json
systemctl --user stop voxels-media-archive.service
systemctl --user start voxels-media-archive.service
journalctl --user -u voxels-media-archive.service -n 20 --no-pager
```

Check every 15 minutes: status timestamp, downloaded count/current transfer bytes, mount availability, quota, and live-world health. A complete run means every candidate has a terminal outcome; missing or restricted files remain in `unavailable.csv`. `unique_bytes` measures content-deduplicated payloads; downloaded URL bytes can be larger because multiple URLs contain the same data. Preserve and include failures in the final report.

## Ask an AI tool to install it

“Read selfhost/media/README.md and the repository instructions. Use my verified public inventory and existing archive mount to install the media downloader. Keep state local and payloads on the archive; do not change firewall rules or credentials. Verify the actual quota, preserve existing data, check the first successful downloads and configure the 15-minute monitoring I request. Report unavailable sources honestly.”

Run regression checks with `python3 -m unittest discover -s selfhost/media -p 'test_*.py'`.
