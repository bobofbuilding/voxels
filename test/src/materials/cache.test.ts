import { describe, it, expect, beforeEach } from 'vitest'
import { generateCacheKey, getCachedMaterial, cacheMaterial, clearCache } from '../../../src/materials/cache'

describe('Material Cache', () => {
  beforeEach(() => {
    clearCache()
  })

  describe('generateCacheKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const key1 = generateCacheKey('video', { alpha: 0.5, zOffset: -3 })
      const key2 = generateCacheKey('video', { alpha: 0.5, zOffset: -3 })
      expect(key1).toBe(key2)
    })

    it('should sort properties alphabetically for consistent keys', () => {
      const key1 = generateCacheKey('video', { zOffset: -3, alpha: 0.5 })
      const key2 = generateCacheKey('video', { alpha: 0.5, zOffset: -3 })
      expect(key1).toBe(key2)
    })

    it('should include material type in key', () => {
      const videoKey = generateCacheKey('video', { alpha: 0.5 })
      const glassKey = generateCacheKey('glass', { alpha: 0.5 })
      expect(videoKey).not.toBe(glassKey)
    })

    it('should filter out undefined values', () => {
      const key1 = generateCacheKey('video', { alpha: 0.5, texture: undefined })
      const key2 = generateCacheKey('video', { alpha: 0.5 })
      expect(key1).toBe(key2)
    })

    it('should handle Color3 objects', () => {
      const color = new BABYLON.Color3(0.5, 0.6, 0.7)
      const key = generateCacheKey('glass', { tint: color })
      expect(key).toContain('tint:0.5,0.6,0.7')
    })

    it('should handle Texture objects using url', () => {
      const scene = new BABYLON.Scene(new BABYLON.NullEngine())
      const textureUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      const texture = new BABYLON.Texture(textureUrl, scene)
      texture.uniqueId = 123
      const key = generateCacheKey('video', { diffuse: texture })
      expect(key).toContain(`diffuse:${textureUrl}`)
      scene.dispose()
    })

    it('should handle null values', () => {
      const key = generateCacheKey('video', { texture: null })
      expect(key).toContain('texture:null')
    })

    it('should handle boolean values', () => {
      const key = generateCacheKey('image', { emissive: true })
      expect(key).toContain('emissive:true')
    })

    it('should handle number values', () => {
      const key = generateCacheKey('video', { alpha: 0.999 })
      expect(key).toContain('alpha:0.999')
    })

    it('should handle string values', () => {
      const key = generateCacheKey('video', { blendMode: 'Multiply' })
      expect(key).toContain('blendMode:Multiply')
    })
  })

  describe('cache operations', () => {
    it('should cache and retrieve materials', () => {
      const scene = new BABYLON.Scene(new BABYLON.NullEngine())
      const material = new BABYLON.StandardMaterial('test', scene)
      const key = 'test_key'

      expect(getCachedMaterial(key)).toBeUndefined()

      cacheMaterial(key, material)
      expect(getCachedMaterial(key)).toBe(material)

      scene.dispose()
    })

    it('should return undefined for non-existent keys', () => {
      expect(getCachedMaterial('non_existent')).toBeUndefined()
    })

    it('should remove material from cache when disposed', () => {
      const scene = new BABYLON.Scene(new BABYLON.NullEngine())
      const material = new BABYLON.StandardMaterial('test', scene)
      const key = 'test_key'

      cacheMaterial(key, material)
      expect(getCachedMaterial(key)).toBe(material)

      material.dispose()
      expect(getCachedMaterial(key)).toBeUndefined()

      scene.dispose()
    })

    it('should clear all cached materials', () => {
      const scene = new BABYLON.Scene(new BABYLON.NullEngine())
      const material1 = new BABYLON.StandardMaterial('test1', scene)
      const material2 = new BABYLON.StandardMaterial('test2', scene)

      cacheMaterial('key1', material1)
      cacheMaterial('key2', material2)

      expect(getCachedMaterial('key1')).toBe(material1)
      expect(getCachedMaterial('key2')).toBe(material2)

      clearCache()

      expect(getCachedMaterial('key1')).toBeUndefined()
      expect(getCachedMaterial('key2')).toBeUndefined()

      scene.dispose()
    })
  })
})
