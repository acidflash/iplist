import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const apiTarget = process.env.API_TARGET || 'http://localhost:8080'

const appVersion = process.env.VITE_APP_VERSION || (() => {
  try {
    return execSync('git describe --tags --always --dirty').toString().trim()
  } catch {
    return 'dev'
  }
})()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
