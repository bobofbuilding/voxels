// ABOUTME: Vitest configuration for testing the feature pump v2 system
// ABOUTME: Configures modern testing environment with TypeScript support

import { defineConfig } from 'vitest/config'
import path from 'path'

// Custom plugin to handle shader files
const shaderPlugin = () => {
  return {
    name: 'shader-loader',
    transform(code: string, id: string) {
      if (id.endsWith('.vsh') || id.endsWith('.fsh') || id.endsWith('.fx')) {
        // Return the shader code as a string export
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: null,
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [shaderPlugin()],

  // JSX configuration for Preact
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'preact'`,
  },

  test: {
    // Note: include/exclude patterns are now managed by vitest.workspace.ts
    // This config serves as the base for the 'client' workspace project

    // Default environment and setup for client tests
    environment: 'jsdom',
    setupFiles: ['./test/babylon-setup.ts'],
    globals: true,

    // Timeout configuration
    testTimeout: 10000,
    hookTimeout: 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/', 'vendor/', 'dist/', '.build/', 'packages/', '**/*.config.ts', '**/*.config.js', '**/babylon-setup.ts'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    },
  },

  // Resolve configuration for TypeScript paths and module resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './test'),
      // Fix Preact JSX import issues
      'preact/src/jsx': 'preact/jsx-runtime',
    },
  },

  // Define globals for BABYLON.js and other dependencies
  define: {
    global: 'globalThis',
    window: 'globalThis',
    Worker: `class MockWorker { 
      constructor() { this.listeners = new Map() }
      
      simulateSorting(featuresWithParcels, cameraPosition, cameraDirection) {
        // Handle empty or invalid inputs
        if (!featuresWithParcels || featuresWithParcels.length === 0) {
          return []
        }
        
        // Provide defaults for camera position and direction
        const camPos = cameraPosition || [0, 0, 0]
        const camDir = cameraDirection || [0, 0, 1]
        
        // Simple sorting simulation with hierarchy support
        const sorted = [...featuresWithParcels].sort((a, b) => {
          const aFeature = a.feature
          const bFeature = b.feature
          
          // Handle hierarchy first - groups (parents) come before non-groups (children)
          const aIsGroup = aFeature.type === 'group'
          const bIsGroup = bFeature.type === 'group'
          
          // If one is a parent group and the other is its child, parent comes first
          if (aIsGroup && bFeature.groupId === aFeature.uuid) return -1 // a is parent of b
          if (bIsGroup && aFeature.groupId === bFeature.uuid) return 1  // b is parent of a
          
          // Generally prioritize groups over non-groups
          if (aIsGroup && !bIsGroup) return -1
          if (bIsGroup && !aIsGroup) return 1
          
          // If both are groups or both are non-groups, sort by distance and direction
          const aPos = aFeature.position || [0, 0, 0]
          const bPos = bFeature.position || [0, 0, 0]
          
          // Calculate distances (camera position is an array [x, y, z])
          const aDist = Math.sqrt(
            Math.pow(aPos[0] - camPos[0], 2) +
            Math.pow(aPos[1] - camPos[1], 2) +
            Math.pow(aPos[2] - camPos[2], 2)
          )
          const bDist = Math.sqrt(
            Math.pow(bPos[0] - camPos[0], 2) +
            Math.pow(bPos[1] - camPos[1], 2) +
            Math.pow(bPos[2] - camPos[2], 2)
          )
          
          // Calculate direction scores (dot product with camera direction)
          const aDir = [
            aPos[0] - camPos[0],
            aPos[1] - camPos[1],
            aPos[2] - camPos[2]
          ]
          const bDir = [
            bPos[0] - camPos[0],
            bPos[1] - camPos[1],
            bPos[2] - camPos[2]
          ]
          
          // Normalize direction vectors
          const aDirLen = Math.sqrt(aDir[0]*aDir[0] + aDir[1]*aDir[1] + aDir[2]*aDir[2])
          const bDirLen = Math.sqrt(bDir[0]*bDir[0] + bDir[1]*bDir[1] + bDir[2]*bDir[2])
          
          if (aDirLen > 0) {
            aDir[0] /= aDirLen
            aDir[1] /= aDirLen
            aDir[2] /= aDirLen
          }
          if (bDirLen > 0) {
            bDir[0] /= bDirLen
            bDir[1] /= bDirLen
            bDir[2] /= bDirLen
          }
          
          // Calculate dot products (1 = in front, -1 = behind)
          const aDot = aDir[0] * camDir[0] + aDir[1] * camDir[1] + aDir[2] * camDir[2]
          const bDot = bDir[0] * camDir[0] + bDir[1] * camDir[1] + bDir[2] * camDir[2]
          
          // Prioritize features in front of camera
          if (aDot > 0.5 && bDot <= 0.5) return -1 // a is in front, b is not
          if (bDot > 0.5 && aDot <= 0.5) return 1  // b is in front, a is not
          
          // Both in front or both behind - sort by distance
          return aDist - bDist
        })
        
        // Return just the feature records
        return sorted.map(item => item.feature)
      }
      
      postMessage(data) { 
        // Simulate async worker response with longer delay to ensure proper setup
        setTimeout(() => {
          const listener = this.listeners.get('message')
          if (listener) {
            // Simulate successful worker response based on message type
            let response
            if (data.type === 'identify-instances') {
              // Simulate instance detection using the same logic as the real worker
              const instanceRelations = []
              const processedBaseKeys = new Set()
              const features = data.features || []
              
              // Helper to get feature key (simplified version of real logic)
              const getFeatureKey = (feature) => {
                if (feature.type === 'vox-model' && feature.url) {
                  return 'vox-model:' + feature.url
                }
                if (feature.type === 'text' && feature.text) {
                  return 'text:' + feature.text
                }
                // Non-instancable features return false
                return false
              }
              
              for (let i = 0; i < features.length; i++) {
                const feature = features[i]
                const featureKey = getFeatureKey(feature)
                if (featureKey === false) continue
                
                // Skip if we've already found a base feature for this key
                if (processedBaseKeys.has(featureKey)) {
                  // Find the base feature for this key
                  const baseFeature = features.find((f) => {
                    const baseKey = getFeatureKey(f)
                    return baseKey === featureKey && !instanceRelations.some(([instUuid]) => instUuid === f.uuid)
                  })
                  
                  if (baseFeature) {
                    // This feature is an instance of the base
                    instanceRelations.push([feature.uuid, baseFeature.uuid])
                  }
                } else {
                  // This is the first (base) feature for this key
                  processedBaseKeys.add(featureKey)
                }
              }
              
              response = {
                type: 'identify-instances-response',
                requestId: data.requestId,
                instanceRelations: instanceRelations
              }
            } else if (data.type === 'sort-features') {
              // Simulate visual sorting based on camera position and direction
              const sorted = this.simulateSorting(data.featuresWithParcels || [], data.cameraPosition, data.cameraDirection)
              response = {
                type: 'sort-features-response',
                requestId: data.requestId,
                loadOrder: sorted
              }
            } else {
              return
            }
            listener({ data: response })
          } else {
          }
        }, 10)
      } 
      terminate() {} 
      addEventListener(type, listener) { 
        this.listeners.set(type, listener) 
      } 
      removeEventListener(type) { this.listeners.delete(type) } 
    }`,
  },

  // SSR configuration to handle CommonJS modules
  ssr: {
    noExternal: ['ndarray', 'ao-mesher'], // Force these CommonJS modules to be processed by Vite
  },
})
