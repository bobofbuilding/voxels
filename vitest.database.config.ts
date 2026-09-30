import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'database',
          include: ['server/test/database/*-test.ts'],
          environment: 'node',
          setupFiles: ['./server/test/database/setup.ts'],
          testTimeout: 10000,
          hookTimeout: 10000,
        },
      },
    ],
  },
})
