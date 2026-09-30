import { build } from 'esbuild'
await build({
  entryPoints: ['selfhost/node/bootstrap.mjs'],
  outfile: 'selfhost/node/bootstrap-bundle.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
})
