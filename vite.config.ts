import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    entries: ['index.html', 'src/main.tsx'],
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: {
      ignored: [
        '**/server/**',
        '**/dist/**',
        '**/tests/**',
        '**/migration-reports/**',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-lucide';
          }
          if (id.includes('leaflet')) {
            return 'vendor-leaflet';
          }
          return 'vendor-misc';
        },
      },
    },
  },
});
