import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* =========================================================
   Vite — configuración del front de Candylandia Store
   ========================================================= */
export default defineConfig({
  plugins: [react()],

  build: {
    outDir: 'dist',
    /* Los bundles van a dist/estaticos/, NO al dist/assets/ de siempre.
       `public/assets/` (el logo y la mascota, que el sitio clásico ya servía
       desde ahí) se copia tal cual a dist/assets/, y dejar que Vite escriba
       sus JS y CSS en esa misma carpeta es pedir que un día un archivo pise
       al otro. Con dos carpetas distintas el problema no existe. */
    assetsDir: 'estaticos',
    sourcemap: false,
    chunkSizeWarningLimit: 900
  },

  server: {
    port: 5173,
    /* En desarrollo el API corre aparte (uvicorn en :8000). El proxy hace que
       el front lo vea en su MISMO origen, igual que en producción: así el
       código no necesita saber en cuál de los dos mundos está. */
    proxy: {
      '/api':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media':  { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/healthz':{ target: 'http://127.0.0.1:8000', changeOrigin: true }
    }
  },

  preview: { port: 4173 }
});
