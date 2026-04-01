import sharp from 'sharp'
import { hashify } from './storage'
import { execFileSync } from 'child_process'
import config from './config'
import * as tmp from 'tmp'
import path from 'path'
import { unlinkSync } from 'fs'

export const enum Type {
  'medium' = 'medium',
}

// GIF frame delay constraints (per https://wunkolo.github.io/post/2020/02/buttery-smooth-10fps/)
const MIN_FRAME_DELAY_MS = 20 // Below this, browsers force 10fps
const BROWSER_FORCED_DELAY_MS = 100 // 10fps when delay too fast

// Sprite sheet constraints
const MAX_SPRITE_GRID_SIZE = 6 // 6x6 grid = 36 frames max
const MAX_SPRITE_FRAMES = MAX_SPRITE_GRID_SIZE * MAX_SPRITE_GRID_SIZE

export interface Options {
  size: number
  mode: string // color, transparent
  stretch: boolean // if not set, use crop
  gif: string // 'sheet'
  passthrough?: boolean
  dontFlipY?: boolean
}

interface Headers {
  [key: string]: string
}

interface FrameInfo {
  frames: number // number of frames
  duration: number // duration in ms
}

// returns the smallest n^2 we can get for a image. For example there is no need to create a 1024px texture if the
// source image is only 300px wide and tall, in that case a 512x512 image is sufficient.
export function smallestPoT(maxSize: number, x: number, y: number): number {
  return Math.min(maxSize, Math.max(potCeil(x), potCeil(y)))
}

export class Texture {
  readonly source: string
  readonly id: string
  options: Options
  frameInfo: FrameInfo = { frames: 1, duration: 0 }
  format: string = 'png'
  outputFormat: string = 'png'
  resizedName: string = ''
  type: Type = Type.medium

  constructor(source: string, opts: Options) {
    this.source = source
    this.id = hashify(source, opts)
    this.options = opts
  }

  public hasAlpha(): boolean {
    return this.options.mode === 'transparent' || this.format === 'gif'
  }

  public setMetadata(md: sharp.Metadata, type: Type) {
    if (md.delay) {
      // Calculate total duration, accounting for browser's 10fps floor on fast GIFs
      const duration = md.delay.reduce((total, delay) => {
        const effectiveDelay = delay >= MIN_FRAME_DELAY_MS ? delay : BROWSER_FORCED_DELAY_MS
        return total + effectiveDelay
      })
      const frames = Math.min(md.delay.length, MAX_SPRITE_FRAMES)
      this.frameInfo = { frames, duration }
    }
    this.type = type
    this.format = md.format || 'png'
    this.outputFormat = md.format || 'png'
    return this
  }

  public HTTPHeaders(prefix: string = ''): Headers {
    const res: Headers = {}
    if (this.frameInfo) res[`${prefix}frames`] = JSON.stringify(this.frameInfo)
    if (this.format) res[`${prefix}original-format`] = JSON.stringify(this.format)
    if (this.outputFormat) res[`${prefix}output-format`] = JSON.stringify(this.outputFormat)
    return res
  }

  public JSONHeaders(prefix: string = ''): string {
    return JSON.stringify(this.HTTPHeaders(prefix))
  }

  public createMedium(): Promise<Texture> {
    return prepare(this)
  }
}

export class CreateError extends Error {
  public file: string
  public url: string
  public message: string
  constructor(file: string, url: string, message: string) {
    super(message)
    this.file = file
    this.url = url
    this.message = message
  }
}

const DEFAULT_MAX_SIZE_GIF = 1024
const DEFAULT_MAX_SIZE_IMAGE = 512
const PASSTHROUGH_MAX_SIZE = 4096

function prepare(texture: Texture): Promise<Texture> {
  const sourcePath = config.cacheDir(texture.id)
  let maxSizeGif = texture.options?.size ? potCeil(texture.options?.size) : DEFAULT_MAX_SIZE_GIF
  let maxSizeImage = texture.options?.size ? potCeil(texture.options?.size) : DEFAULT_MAX_SIZE_IMAGE

  if (texture.options.passthrough) {
    maxSizeImage = PASSTHROUGH_MAX_SIZE
    maxSizeGif = PASSTHROUGH_MAX_SIZE
  }

  const tempDir = tmp.dirSync()

  return sharp(sourcePath)
    .metadata()
    .then((md) => {
      texture.setMetadata(md, Type.medium)
      if (!md.width || !md.height) {
        throw new Error('image has no width or height')
      }

      let processedPath = sourcePath
      let pixelSize = smallestPoT(maxSizeImage, md.width, md.height)

      // Convert animated GIF/WebP to sprite sheet (max 6x6 grid)
      const isAnimated = ['gif', 'webp'].includes(texture.format) && texture.frameInfo?.frames > 1
      if (isAnimated) {
        const frames = texture.frameInfo.frames
        const cols = Math.min(frames, MAX_SPRITE_GRID_SIZE)
        const rows = Math.min(Math.ceil(frames / cols), MAX_SPRITE_GRID_SIZE)

        // Recalculate size for sprite sheet dimensions
        pixelSize = smallestPoT(maxSizeGif, md.width * cols, md.height * rows)

        const tileWidth = Math.ceil(pixelSize / cols)
        const tileHeight = Math.ceil(pixelSize / rows)
        const fps = frames / (texture.frameInfo.duration / 1000)
        const videoDir = tempDir.name

        if (texture.format === 'webp') {
          // Extract WebP frames using anim_dump tool
          run('anim_dump', ['-folder', videoDir, processedPath])

          // Sample frames evenly when original has more than we can fit
          const origFrameCount = md.pages || 1
          const divisor = origFrameCount / frames
          const framesToKeep = new Array(frames).fill(0).map((_, i) => Math.round(i * divisor))
          for (let i = 0; i < origFrameCount; i++) {
            const fileName = path.join(videoDir, `dump_${String(i).padStart(4, '0')}.png`)
            if (framesToKeep.includes(i)) {
              run('mogrify', ['-resize', `${tileWidth}x${tileHeight}`, fileName])
            } else {
              unlinkSync(fileName)
            }
          }
        } else {
          // Extract GIF frames using ffmpeg
          run('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-i', sourcePath, '-y', '-frames:v', `${frames}`, '-vf', `scale=${tileWidth}:${tileHeight}:flags=lanczos,fps=${fps}:round=near`, `${videoDir}/%02d.png`])
        }

        // Assemble sprite sheet with ImageMagick montage
        processedPath = tmp.fileSync({ discardDescriptor: true, postfix: '.png' }).name
        run('montage', [`${videoDir}/*`, '-geometry', '+0+0', '-tile', `${cols}x${rows}`, '-strip', '-background', 'none', processedPath])
      }

      // Convert non-compressible formats to PNG
      if (['gif', 'svg', 'tiff', 'webp'].includes(texture.format)) {
        texture.outputFormat = 'png'
      }

      // Validate output format
      if (!['jpeg', 'jpg', 'png', 'bmp', 'gif'].includes(texture.outputFormat as string)) {
        throw new Error(`output format '${texture.outputFormat}' cannot be compressed | ${texture.source}`)
      }

      texture.resizedName = `${texture.id}_${Type.medium}.${texture.outputFormat}`

      const resizeOpts: sharp.ResizeOptions = { width: pixelSize, height: pixelSize, fit: 'fill', kernel: 'lanczos3' }
      const extractOpts: sharp.Region = { top: 0, left: 0, width: pixelSize, height: pixelSize }

      // Apply center-crop for non-square static images (unless stretch mode enabled)
      if (!texture.options?.stretch && !isAnimated && !texture.options.passthrough) {
        resizeOpts.fit = 'outside'
        const aspectRatio = md.width / md.height
        extractOpts.left = aspectRatio < 1 ? 0 : Math.round((pixelSize * aspectRatio - pixelSize) / 2)
        extractOpts.top = aspectRatio > 1 ? 0 : Math.round((pixelSize / aspectRatio - pixelSize) / 2)
      }

      const sharpInstance = sharp(processedPath, { failOn: 'error' })
      return resize(sharpInstance, resizeOpts, extractOpts)
        .then((s) => flatten(s, texture))
        .then((s) => (texture.options.dontFlipY ? s : s.flip()))
        .then((s) => s.toFile(config.cacheDir(texture.resizedName as string)))
        .then(() => texture)
    })
    .catch((error) => {
      throw new CreateError(sourcePath, texture.source, error.message)
    })
}

export function resize(source: sharp.Sharp, resizeOpts: sharp.ResizeOptions, extractOpts: sharp.Region): Promise<sharp.Sharp> {
  const res = source.resize(resizeOpts).extract(extractOpts).sharpen().withMetadata()
  return Promise.resolve(res)
}

// Removes transparency by flattening to white background (except for transparent mode or GIFs)
function flatten(sharpInstance: sharp.Sharp, texture: Texture): sharp.Sharp {
  if (texture.options.mode === 'transparent' || texture.format === 'gif') {
    return sharpInstance
  }
  return sharpInstance.flatten({ background: { r: 255, g: 255, b: 255 } })
}

function run(cmd: string, args: ReadonlyArray<string>): string {
  return execFileSync(cmd, args, { encoding: 'utf-8' })
}

// Rounds up to next power of 2 using bit manipulation (e.g., 300 → 512, 600 → 1024)
export function potCeil(v: number): number {
  v--
  v |= v >> 1
  v |= v >> 2
  v |= v >> 4
  v |= v >> 8
  v |= v >> 16
  v++
  return v
}
