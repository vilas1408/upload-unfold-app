import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/nse-api': {
        target: 'https://www.nseindia.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/nse-api/, ''),
      },
    },
  },
});
