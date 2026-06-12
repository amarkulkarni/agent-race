import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve('src/main/index.ts')
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve('src/preload/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
