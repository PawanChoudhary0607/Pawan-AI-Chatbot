import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Splits stable, independently-versioned vendor code into its own
        // cacheable chunks. Doesn't shrink what's downloaded on a cold
        // first visit, but means a future app-code-only release doesn't
        // invalidate the (much larger, much less frequently changing)
        // markdown/highlighting or React vendor chunks for returning users.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
          if (
            id.includes('react-markdown') ||
            id.includes('remark') ||
            id.includes('rehype') ||
            id.includes('mdast') ||
            id.includes('hast') ||
            id.includes('unist') ||
            id.includes('unified') ||
            id.includes('micromark') ||
            id.includes('lowlight') ||
            id.includes('highlight.js') ||
            id.includes('vfile')
          ) {
            return 'vendor-markdown'
          }
          if (id.includes('dexie') || id.includes('zustand')) return 'vendor-data'
          return undefined
        },
      },
    },
  },
})
