const fs = require('fs')
const fetch = require('node-fetch')
const path = require('path')
const zlib = require('zlib')
const { bundles } = require('./urls')

function sizeOf(st) {
  const length = st.length || st.byteLength

  return `${(length / 1024 / 1024).toFixed(2)}mb`
}

function compress(st) {
  const c = zlib.brotliCompressSync(st, { 
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
  })

  console.log(` * Compressed ${sizeOf(st)} to ${sizeOf(c)} with brotli`)
  const d = zlib.brotliDecompressSync(c).toString()

  // console.log(d)

  if (d !== st) {
    throw new Error('Decompression introduced errors')
  }

  return c
}

const filesAlreadyBuilt = new Set()

// A bundle can contain sourceUrls to download, and sourceFilenames to read from disk.
async function buildBundle(outputPath, bundleName, bundleInfo) {
  const { targetFilename, sourceUrls = {}, sourceFilenames = []} = bundleInfo

  // Regenerating them would be harmless, but this is more explicit
  if (filesAlreadyBuilt.has(targetFilename)) {
    console.log(`Ignoring ${targetFilename}: already built`)
    return
  }

  let output = `

    // ${bundleName} bundle for voxels - ${new Date().toString()}

    `

  for (const m of Object.values(sourceUrls)) {
    const f = await fetch(m)
    const t = await f.text()

    console.log(` * ${m}: ${sizeOf(t)}`)
    output += `\n\n/*********** URL ${m} ***********/\n\n` + t
  }

  for (const f of sourceFilenames) {
    const t = fs.readFileSync(path.join(__dirname, f))

    console.log(` * ${f}: ${sizeOf(t)}`)
    output += `\n\n/*********** File ${f} ***********/\n\n` + t
  }

  fs.writeFileSync(path.join(outputPath, targetFilename), output)
  fs.writeFileSync(path.join(outputPath, `${targetFilename}.br`), compress(output))
  filesAlreadyBuilt.add(targetFilename)
  console.log(`Wrote bundle files ${targetFilename}{,.br}.`)
}

async function buildAllBundles(outputPath) {
  for (let minify = 0; minify <= 1; ++minify) {
    const allBundles = bundles(!!minify)
    for (const b in allBundles) {
      await buildBundle(outputPath, b, allBundles[b])
    }
  }
}

buildAllBundles(path.join(__dirname, '../../dist/vendor'))
