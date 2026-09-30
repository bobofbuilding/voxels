# Working on Voxels

## Scope and style

- Follow the user's requested scope and sequence. Prefer small, focused changes.
- Preserve existing behavior during refactors; explain any intentional changes.
- Use clear names, direct prose, and the existing formatting style.
- Remove obsolete code and duplication when their callers have been checked.
- Avoid speculative abstractions, unrelated formatting, and silent error handling.

## Architecture

- `src/` contains the world client; `web/` contains the website and account UI.
- `client/` contains browser-specific modules shared by those clients.
- `common/` contains portable data contracts and shared logic. It must not import application code from `src/`, `web/`, or `client/`.
- `server/` contains HTTP routes and database access. Use its shared database adapter.
- `multiplayer/`, `compiler/`, `compressor/`, and `renderer/` are background services; `services/` holds shared server-side setup.
- Keep secrets on the server. Validate required configuration before startup and use the configured owner wallet for administrator access.

## Rendering and APIs

- Babylon is available globally. Use scene observables for render-loop work.
- Keep camera, track, timer, and listener cleanup with the code that creates them.
- Update `server/openapi.yaml` when documented routes change, then run `pnpm run docs:api`. Do not hand-edit generated API documentation.
- Use `cachedFetch` for cacheable reads and invalidate affected entries after writes.

## Validation and delivery

- Honor a requested testing sequence; if testing is deferred, run checks once the requested implementation is complete.
- Before committing, run `pnpm run precommit` and `pnpm test`. Add focused regression coverage for changed behavior.
- Database tests must use the isolated runner (`pnpm run test:db`), never an existing application database.
- Keep CI fast and measure the effect of added checks.
- Describe the final behavior, validation results, and remaining limitations in the pull request. Include screenshots when visible UI changes need review.
