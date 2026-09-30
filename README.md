# Retro Voxels

This is the live code to retro.voxels.com. PRs are welcome. Read agents.md for coding
guidelines.

# Getting started

See [install.md](install.md) for Codespaces and local setup. To host a playable shared world, use the [node installer](selfhost/node/README.md) or give your AI assistant the [setup prompt](selfhost/node/AI_SETUP.md).

# Infrastructure

This app deploys to Digital Ocean App Platform from `main` at https://retro.voxels.com.
Deploy pre-job runs `npm run predeploy` (migrate).

# Operations

PRs are reviewed by the repository maintainers.

# License

This project is licensed under the [MIT License](LICENSE).

### Contributor Agreement

By contributing to this repository, you agree that your contributions are licensed under the MIT License.

# Code organization

- `src/`: Babylon world client and scene features.
- `web/`: website routes, account pages, and application state.
- `client/`: browser-specific media, broadcasting, rendering, and UI helpers used by both clients.
- `common/`: portable contracts and algorithms; no imports from the application clients.
- `server/`: HTTP application, authorization, and the single database adapter.
- `multiplayer/`, `compiler/`, `compressor/`, `renderer/`: background services.
- `services/`: shared environment loading and server-side configuration helpers.

Showbox scene behavior, its broadcast panel, viewer connection, and editor live in separate files under `src/features/showbox/`. Shared camera and track helpers live in `client/broadcast/`.

See [install.md](install.md) for local setup and validation commands. `OWNER_ADDRESS` controls both administrator access and the client owner UI; rebuild the client when changing it. Secrets are never included in the browser configuration.
