import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  // svelte-плагин компилирует .svelte и руны в .svelte.ts для тестов renderer.
  plugins: [svelte(), svelteTesting()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    // node по умолчанию; DOM-тесты помечают себя `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts']
  }
})
