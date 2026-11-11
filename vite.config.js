import { defineConfig } from 'vite';

export default defineConfig({
  // OneDrive drops file-change events, so poll instead
  server: { watch: { usePolling: true, interval: 300 } },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
