import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApiProxyTarget = env.DEV_API_PROXY_TARGET || 'http://localhost:3000'

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
            if (id.includes('xlsx')) return 'xlsx'
            if (id.includes('jspdf')) return 'pdf'
            if (id.includes('qrcode') || id.includes('jsbarcode')) return 'labels'
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: devApiProxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
