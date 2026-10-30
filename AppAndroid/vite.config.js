import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      // Proxy todas las llamadas /api/ al servidor Django local.
      // Esto hace que el browser vea las peticiones como "mismo origen"
      // (localhost:5173), resolviendo el problema de cookies SameSite=Lax
      // de Chrome 80+ en peticiones POST cross-origin.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('[Vite Proxy] Error:', err.message);
          });
        }
      }
    }
  }
})
