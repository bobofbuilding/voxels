// ABOUTME: Vitest workspace configuration for multi-environment testing.
// ABOUTME: Separates client tests (jsdom + Babylon) from compressor tests (Node.js).

import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Client tests - jsdom environment with Babylon.js setup
  {
    extends: './vitest.config.ts',
    test: {
      name: 'client',
      include: ['test/**/*.test.ts'],
      exclude: ['test/compressor/**'],
    },
  },
  // Compressor tests - pure Node.js environment
  {
    test: {
      name: 'compressor',
      include: ['test/compressor/**/*.test.ts'],
      environment: 'node',
      globals: true,
    },
  },
  // Server tape tests. same runner as the rest, tape API not vitest expect()
  {
    test: {
      name: 'server',
      include: ['server/test/**/*-test.ts'],
      exclude: ['server/test/database/**'],
      environment: 'node',
      globals: false,
      setupFiles: ['./test/vitest-tape.ts'],
      isolate: true,
    },
  },
])
