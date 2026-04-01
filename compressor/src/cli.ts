// ABOUTME: CLI tool for local texture compression.
// ABOUTME: Compresses a single image to all GPU texture formats.

import config from './config'
import { Texture } from './texture'
import * as fs from 'fs'
import { compress, Compressions } from './compress'
import path from 'path'

const args = process.argv.slice(2)
const textureArguments = { size: 4096, mode: 'color', stretch: true, gif: 'sheet', passthrough: true, dontFlipY: true }

const inputTexture = new Texture(args[0], textureArguments)
fs.copyFileSync(args[0], config.cacheDir(inputTexture.id))

const dir = path.dirname(args[0])
const name = path.basename(args[0], path.extname(args[0]))
inputTexture.createMedium().then((processedTexture) => {
  const jobs: Promise<string>[] = []
  Compressions.forEach((settings, compressionType) => {
    jobs.push(compress(compressionType, processedTexture.resizedName, processedTexture.hasAlpha()))
  })
  Promise.all(jobs).then((compressedFiles) => {
    for (const file of compressedFiles) {
      // compressed textures have two extensions, compression type and the .ktx, like .etc.ktx
      const lastExt = path.extname(file)
      const typeExt = path.extname(path.basename(file, lastExt))
      const dest = path.join(dir, name + typeExt + lastExt)
      fs.copyFileSync(config.cacheDir(file), dest)
    }
  })
})
