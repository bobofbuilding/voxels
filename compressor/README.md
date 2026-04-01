# Texture Compressor

Converts images to GPU-compressed texture formats (DXT, ETC, PVRTC, ASTC) and uploads to S3.

## API

**GET /compressed**

| Param | Description |
|-------|-------------|
| `url` | Source image URL (required) |
| `hint` | Output format: `.dxt.ktx`, `.etc.ktx`, `.pvrtc.ktx`, `.astc.ktx` |
| `mode` | `color` or `transparent` |
| `size` | Max dimension in pixels |
| `stretch` | `true` to stretch non-square images |
| `gif` | `sheet` (sprite sheet) or `first` (first frame only) |

Returns 301 redirect to the compressed texture on S3.

## Development

```bash
# Create .env with S3 credentials
cp .env.example .env

# Run locally
npm run compressor:dev
```

## Docker

```bash
cd compressor
docker compose up --build
```

Runs on port 9473. Requires `linux/amd64` platform for texture-compressor binaries.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 9473) |
| `DO_SPACE_REGION` | S3 region |
| `DO_SPACE_NAME` | Bucket name |
| `DO_SPACE_KEY` | Access key |
| `DO_SPACE_SECRET` | Secret key |
| `DO_SPACE_ENDPOINT` | S3 endpoint URL |
| `DO_CDN_HOST` | CDN URL for redirects |
