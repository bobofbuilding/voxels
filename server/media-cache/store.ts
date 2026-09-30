import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export type MediaEntry = { key: string; hash: string; tier: 'pi' | 'mycloud'; bytes: number; type: string; status: number; range?: string; metadata?: Record<string, string>; storedAt: number }
export type CacheOptions = { hot: string; cold?: string; hotLimit: number; coldLimit: number; headroom?: number; coldAvailable?: () => Promise<boolean> }
const META_RESERVE = 4096
const HASH = /^[a-f0-9]{64}$/
export const mediaKey = (url: string, range = '') =>
  createHash('sha256')
    .update(url + '\n' + range)
    .digest('hex')

/** Single world process owns these dedicated directories. Reservations include in-flight writes. */
export class MediaStore {
  hotBytes = 0
  coldBytes = 0
  reservedHot = 0
  reservedCold = 0
  private entries = new Map<string, MediaEntry>()
  private blobs = new Map<string, 'pi' | 'mycloud'>()
  private index: string
  private commits: Promise<unknown> = Promise.resolve()
  private coldReady = false
  constructor(readonly options: CacheOptions) {
    this.index = path.join(options.hot, 'index')
  }
  async initialize() {
    await fs.mkdir(this.options.hot, { recursive: true, mode: 0o700 })
    await fs.mkdir(this.index, { recursive: true, mode: 0o700 })
    for (const name of await fs.readdir(this.options.hot)) {
      const file = path.join(this.options.hot, name),
        stat = await fs.lstat(file)
      if (stat.isSymbolicLink()) throw Error('Cache directory must not contain symlinks')
      if (name.endsWith('.part')) {
        await fs.unlink(file)
        continue
      }
      if (stat.isFile()) {
        this.hotBytes += stat.size
        if (HASH.test(name)) this.blobs.set(name, 'pi')
      }
    }
    // Metadata is local and counted inside the Pi cap, including NAS entries.
    for (const name of await fs.readdir(this.index)) {
      const file = path.join(this.index, name),
        stat = await fs.lstat(file)
      if (stat.isSymbolicLink()) throw Error('Cache index must not contain symlinks')
      if (name.endsWith('.part')) {
        await fs.unlink(file)
        continue
      }
      this.hotBytes += stat.size
      if (!/^[a-f0-9]{64}-\d+-[a-f0-9-]+\.json$/.test(name)) continue
      try {
        const entry: MediaEntry = JSON.parse(await fs.readFile(file, 'utf8'))
        if (!HASH.test(entry.key) || !HASH.test(entry.hash) || !['pi', 'mycloud'].includes(entry.tier) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) continue
        const old = this.entries.get(entry.key)
        if (!old || old.storedAt < entry.storedAt) this.entries.set(entry.key, entry)
        if (entry.tier === 'mycloud' && !this.blobs.has(entry.hash)) {
          this.blobs.set(entry.hash, 'mycloud')
          this.coldBytes += entry.bytes
        }
      } catch {
        /* Invalid metadata is retained and counted, never served. */
      }
    }
    // Count NAS orphans too after a crash. Never delete completed media automatically.
    if (await this.coldOnline()) {
      this.coldBytes = 0
      for (const name of await fs.readdir(this.options.cold!)) {
        const file = path.join(this.options.cold!, name)
        if (name.endsWith('.part')) {
          await fs.unlink(file)
          continue
        }
        if (!HASH.test(name)) continue
        const stat = await fs.lstat(file)
        if (stat.isFile()) {
          this.coldBytes += stat.size
          if (!this.blobs.has(name)) this.blobs.set(name, 'mycloud')
        }
      }
      this.coldReady = true
    }
  }
  async coldOnline() {
    if (!this.options.cold) return false
    if (this.options.coldAvailable) return this.options.coldAvailable()
    try {
      const [hot, cold] = await Promise.all([fs.stat(this.options.hot), fs.stat(this.options.cold)])
      // A disappeared NAS mount must never redirect overflow onto the Pi filesystem.
      return cold.isDirectory() && cold.dev !== hot.dev
    } catch {
      return false
    }
  }
  filename(entry: Pick<MediaEntry, 'tier' | 'hash'>) {
    return path.join(entry.tier === 'pi' ? this.options.hot : this.options.cold!, entry.hash)
  }
  async find(key: string) {
    const entry = this.entries.get(key)
    if (!entry || Date.now() - entry.storedAt > 86400000 || (entry.tier === 'mycloud' && !(await this.coldOnline()))) return null
    try {
      const stat = await fs.stat(this.filename(entry))
      return stat.size === entry.bytes ? entry : null
    } catch {
      return null
    }
  }
  async begin(key: string, maximum: number, details: Pick<MediaEntry, 'type' | 'status' | 'range' | 'metadata'>) {
    if (!HASH.test(key) || !Number.isSafeInteger(maximum) || maximum <= 0) return null
    const disk = await fs.statfs(this.options.hot)
    const free = Number(disk.bavail) * Number(disk.bsize) - this.reservedHot
    const headroom = this.options.headroom ?? 5_000_000_000
    // Leave bounded index space inside the Pi cap so NAS overflow can keep recording entries.
    const indexHeadroom = Math.min(1_000_000_000, Math.floor(this.options.hotLimit / 10))
    const coldOnline = await this.coldOnline()
    let tier: 'pi' | 'mycloud'
    if (this.hotBytes + this.reservedHot + maximum + META_RESERVE <= this.options.hotLimit - indexHeadroom && free >= maximum + META_RESERVE + headroom) tier = 'pi'
    else if (this.coldReady && coldOnline && this.coldBytes + this.reservedCold + maximum <= this.options.coldLimit && this.hotBytes + this.reservedHot + META_RESERVE <= this.options.hotLimit && free >= META_RESERVE + headroom)
      tier = 'mycloud'
    else return null
    const hotReserve = META_RESERVE + (tier === 'pi' ? maximum : 0)
    this.reservedHot += hotReserve
    if (tier === 'mycloud') this.reservedCold += maximum
    const temp = path.join(tier === 'pi' ? this.options.hot : this.options.cold!, randomUUID() + '.part')
    let released = false,
      closed = false,
      bytes = 0
    const digest = createHash('sha256')
    const release = () => {
      if (released) return
      released = true
      this.reservedHot -= hotReserve
      if (tier === 'mycloud') this.reservedCold -= maximum
    }
    let handle: Awaited<ReturnType<typeof fs.open>>
    try {
      handle = await fs.open(temp, 'wx', 0o600)
    } catch {
      release()
      return null
    }
    const abort = async () => {
      if (closed) return
      closed = true
      await handle.close().catch(() => {})
      try {
        await fs.unlink(temp)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          const remaining = await fs
            .stat(temp)
            .then((s) => s.size)
            .catch(() => maximum)
          if (tier === 'pi') this.hotBytes += remaining
          else this.coldBytes += remaining
        }
      }
      release()
    }
    return {
      tier,
      write: async (buffer: Buffer) => {
        if (closed || bytes + buffer.length > maximum) throw Error('Cache reservation exceeded')
        let offset = 0
        while (offset < buffer.length) {
          const written = await handle.write(buffer, offset, buffer.length - offset)
          if (!written.bytesWritten) throw Error('Cache write stopped')
          offset += written.bytesWritten
        }
        digest.update(buffer)
        bytes += buffer.length
      },
      abort,
      finish: () => {
        const finished = this.commits
          .catch(() => {})
          .then(async () => {
            if (closed) return null
            let indexTemp: string | undefined
            try {
              await handle.close()
              const hash = digest.digest('hex')
              let storedTier = this.blobs.get(hash)
              if (storedTier === 'mycloud' && !(await this.coldOnline())) storedTier = undefined
              if (storedTier) {
                const present = await fs
                  .stat(this.filename({ tier: storedTier, hash }))
                  .then((stat) => stat.size === bytes)
                  .catch(() => false)
                if (!present) storedTier = undefined
              }
              if (storedTier) await fs.unlink(temp)
              else {
                await fs.rename(temp, this.filename({ tier, hash }))
                this.blobs.set(hash, tier)
                if (tier === 'pi') this.hotBytes += bytes
                else this.coldBytes += bytes
                storedTier = tier
              }
              const entry: MediaEntry = { ...details, key, hash, tier: storedTier, bytes, storedAt: Date.now() }
              const data = JSON.stringify(entry)
              if (Buffer.byteLength(data) > META_RESERVE) throw Error('Media metadata too large')
              const indexFile = path.join(this.index, `${key}-${entry.storedAt}-${randomUUID()}.json`)
              indexTemp = indexFile + '.part'
              await fs.writeFile(indexTemp, data, { flag: 'wx', mode: 0o600 })
              await fs.rename(indexTemp, indexFile)
              this.hotBytes += Buffer.byteLength(data)
              this.entries.set(key, entry)
              closed = true
              release()
              return entry
            } catch (error) {
              if (indexTemp) await fs.unlink(indexTemp).catch(() => {})
              await abort()
              throw error
            }
          })
        this.commits = finished
        return finished
      },
    }
  }
  async status() {
    return {
      enabled: true,
      piBytes: this.hotBytes,
      piReservedBytes: this.reservedHot,
      piLimitBytes: this.options.hotLimit,
      mycloudBytes: this.coldBytes,
      mycloudReservedBytes: this.reservedCold,
      mycloudLimitBytes: this.options.coldLimit,
      mycloudOnline: await this.coldOnline(),
      retention: 'preserve',
      cachedRequests: this.entries.size,
    }
  }
}
