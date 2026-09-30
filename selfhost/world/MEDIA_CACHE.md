# Visitor-assisted public media storage

Visitors automatically cache eligible small public media in their browser. In world Settings, **Help store public world media** is off by default. Enabling it streams public parcel media through the selected world host, which writes the same transfer to shared storage. This avoids a second upload of a visitor's browser data and does not make peer connections to the visitor. The selected host sees the media requests; this is not anonymous browsing.

On the Bittrees node, the dedicated local cache is capped at **75,000,000,000 bytes (75 GB)**, including index metadata and reserved in-flight writes. Up to 1 GB within that limit is kept available for the index, so NAS overflow can still be recorded. Once a response cannot fit, it goes to the mounted archive storage media directory. The NAS cache has a 900 GB application limit inside the existing 1 TB archive quota, leaving room for the build archive and private backups. Files are content-addressed with SHA-256; identical completed payloads are deduplicated. A URL/range lookup is refreshed after 24 hours while previous completed versions are retained.

There is no automatic deletion of completed host media. If capacity is exhausted, the NAS mount disappears, or storage fails, playback continues from the source without growing the node cache beyond its limit. A NAS absent at startup requires a cache-service restart after remounting, so usage can be reconciled before writes resume. The mount must not have an unbounded local write cache. The Bittrees rclone mount uses `--vfs-cache-mode off`.

## Scope

The server validates each URL against the current **public** parcel content before serving even a cache hit. It does not accept arbitrary browser blobs. Source connections omit cookies/authorization, reject private/local DNS addresses, pin the validated address, and validate redirects again. Credential-bearing URLs and sources marked private/no-store or setting application/session cookies are excluded. Known CDN bot-management cookies are discarded and never forwarded. Active formats such as HTML, scripts and SVG are not served by the cache.

Supported responses include common images, audio, video, GLB and binary media with a known length up to 2 GB per response. Completed single byte-range responses are cached separately; interrupted transfers are discarded. Unknown-length live streams, protected media, indirect model dependencies not present in the parcel, and requests beyond the bounded two-transfer concurrency fall back to their original sources. This is demand-driven storage, not a full media crawl. Browser caching is limited to 256 MB of readable public payloads, with a 16 MB per-response limit and one-day freshness. The browser may evict this cache under storage pressure. Credentialed and opaque responses are not copied into it.

The first page may begin loading before its service worker takes control; subsequent loaded media is eligible. Sharing can be turned off in Settings for future requests. Existing host copies remain preserved. This release does not automatically replicate stored media files between hosts; nodes independently cache media they serve.

## Configure a host

The cache is disabled unless `MEDIA_CACHE_HOT` is set. Create dedicated writable directories outside the repository. Mount NAS storage before creating its media directory, and keep each directory exclusive to one world-server process.

```text
MEDIA_CACHE_HOT=/absolute/path/to/pi-media-cache
MEDIA_CACHE_HOT_BYTES=75000000000
MEDIA_CACHE_COLD=/absolute/path/to/mounted-nas/media-cache
MEDIA_CACHE_COLD_BYTES=900000000000
```

The cold directory must be on a different filesystem from the hot directory. This prevents an absent mount from silently writing overflow onto the node. With Docker, bind-mount the two operator-selected directories into the world container and add these variables to its private `app.env`; the installer does not automatically expose host storage. Restart the world service after configuration. Keep the hot index with the cache when backing it up. Never share these writable cache paths between processes.

`GET /media-cache/status` reports stored/reserved bytes, limits and NAS availability without exposing paths or credentials. `GET /media-cache/asset?parcel=ID&url=ENCODED_URL` streams an eligible reference, with optional single `Range` header. The server enforces public-parcel membership independently of the browser's opt-in setting.
