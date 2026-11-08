import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 发音数据单独缓存，日后修改页面不必重新下载整份词表。
  build: { rollupOptions: { output: { manualChunks: { pronunciations: ['./src/data/pronunciations.ts'] } } } },
  test: {
    environment: 'node',
  },
})
