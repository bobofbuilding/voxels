# Installing

## Codespaces

[![Open in GitHub Codespaces](https://img.shields.io/badge/Open_in-GitHub_Codespaces-238636?style=for-the-badge&logo=github&logoColor=white)](https://codespaces.new/cryptovoxels/retro)

`pnpm install` and the database seed run when the codespace is created, so it comes up ready.

* `pnpm run dev`
* Open port 9000

## Locally

(Only *nix environments are supported, PC users install [WSL](https://learn.microsoft.com/en-au/windows/wsl/install))

* Clone repo
* Install postgres@18, node@25 and pnpm@9.15.4 (eg `brew install postgresql@18 node@25 && npm install -g pnpm`)
* `createdb voxels && cat db/import.sql.gz | gunzip | psql voxels`
* `pnpm run setup:env` to create `.env` with a random signing secret, then set `DATABASE_URL=postgres://localhost/voxels` (the example points at the codespace `db` host)
* `pnpm install`
* `pnpm run dev`
* Open http://localhost:9000

Migrations run automatically when the server boots. Redis is optional for local dev; without it chat and
realtime features log connection errors but the server still runs.

Production must provide `JWT_SECRET` (at least 32 random characters) and `OWNER_ADDRESS`. The owner wallet is also the administrator; there is no separate built-in administrator wallet. Missing or invalid authentication settings stop the server before it opens database connections.

## Checks

`pnpm run typescript:check` covers the web app, world client, server, and all background services. Each background service also has a `typecheck:<service>` command.

`pnpm test` runs unit tests and database integration tests. The database runner creates a fresh temporary database, loads the relevant tables from `db/schema.sql`, and drops only that database afterwards. It never uses `DATABASE_URL`. Locally it starts a temporary PostgreSQL cluster using `initdb` and `pg_ctl`; alternatively set `TEST_DATABASE_URL` to a dedicated PostgreSQL server on which the runner may create and drop its own databases. CI supplies PostgreSQL 18. `pnpm run test:unit` runs only tests that do not need PostgreSQL.
