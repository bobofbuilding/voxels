// ABOUTME: Tests for YouTube preview texture fallback behavior.
// ABOUTME: Validates that unavailable video thumbnails fall back to placeholder image.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as BABYLON from 'babylonjs'

describe('YouTube Preview Fallback', () => {
  let scene: BABYLON.Scene
  let engine: BABYLON.NullEngine

  beforeEach(() => {
    engine = new BABYLON.NullEngine()
    scene = new BABYLON.Scene(engine)
  })

  afterEach(() => {
    scene.dispose()
    engine.dispose()
    vi.restoreAllMocks()
  })

  describe('loadYoutubeThumbnail', () => {
    it('should return a texture when YouTube thumbnail loads successfully', async () => {
      const { loadYoutubeThumbnail } = await import('../../../src/features/youtube')

      const texture = await loadYoutubeThumbnail(scene as any, 'dQw4w9WgXcQ', new AbortController().signal)

      expect(texture).toBeInstanceOf(BABYLON.Texture)
    })

    it('should return fallback texture when YouTube thumbnail fails to load', async () => {
      const { loadYoutubeThumbnail } = await import('../../../src/features/youtube')

      const texture = await loadYoutubeThumbnail(scene as any, 'INVALID_VIDEO_ID_THAT_DOES_NOT_EXIST_12345', new AbortController().signal)

      expect(texture).toBeInstanceOf(BABYLON.Texture)
    })

    it('should return fallback when videoId is undefined', async () => {
      const { loadYoutubeThumbnail } = await import('../../../src/features/youtube')

      const texture = await loadYoutubeThumbnail(scene as any, undefined, new AbortController().signal)

      expect(texture).toBeInstanceOf(BABYLON.Texture)
    })

    it('should return fallback when videoId is empty string', async () => {
      const { loadYoutubeThumbnail } = await import('../../../src/features/youtube')

      const texture = await loadYoutubeThumbnail(scene as any, '', new AbortController().signal)

      expect(texture).toBeInstanceOf(BABYLON.Texture)
    })
  })

  describe('buildYoutubeThumbnailUrl', () => {
    it('should build correct thumbnail URL for valid video ID', async () => {
      const { buildYoutubeThumbnailUrl } = await import('../../../src/features/youtube')

      expect(buildYoutubeThumbnailUrl('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    })

    it('should return null for undefined video ID', async () => {
      const { buildYoutubeThumbnailUrl } = await import('../../../src/features/youtube')

      expect(buildYoutubeThumbnailUrl(undefined)).toBeNull()
    })

    it('should return null for empty string video ID', async () => {
      const { buildYoutubeThumbnailUrl } = await import('../../../src/features/youtube')

      expect(buildYoutubeThumbnailUrl('')).toBeNull()
    })
  })
})
