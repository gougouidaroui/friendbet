import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) {
            return 'vendor';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/components/') || id.includes('/services/')) {
            return 'app';
          }
        },
      },
    },
  },
});
