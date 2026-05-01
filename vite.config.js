import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: Change 'shelfspace-app' to your actual GitHub repo name
// e.g., if your repo URL is https://github.com/username/my-repo
// then base should be '/my-repo/'
export default defineConfig({
  plugins: [react()],
  base: '/shelfspace-app/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
