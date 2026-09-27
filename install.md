# Installing

## Codespaces

[![Open in GitHub Codespaces](https://img.shields.io/badge/Open_in-GitHub_Codespaces-238636?style=for-the-badge&logo=github&logoColor=white)](https://codespaces.new/cryptovoxels/retro)

`pnpm install` and the database seed run when the codespace is created, so it comes up ready.

* `pnpm run dev`
* Open port 9000

## Locally

(Only *nix environments are supported, PC users install [WSL](https://learn.microsoft.com/en-au/windows/wsl/install))

* Clone repo
* Install postgres@18, node@24 and pnpm@9.15.4 (eg `brew install postgresql@18 node@24 && npm install -g pnpm`)
* `createdb voxels && cat db/import.sql.gz | gunzip | psql voxels`
* `cp .env.example .env` and set `DATABASE_URL=postgres://localhost/voxels` (the example points at the codespace `db` host)
* `pnpm install`
* `pnpm run dev`
* Open http://localhost:9000

Migrations run automatically when the server boots. Redis is optional for local dev; without it chat and
realtime features log connection errors but the server still runs.
