import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve('./src'), // ✅ @/를 src 폴더로 매핑
    },
  },
  optimizeDeps: {
    include: ['lucide-react'],
  },
  server: {
    host: true,
    allowedHosts: true,
  },
})
