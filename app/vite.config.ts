import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the same build works on Vercel, as a PWA and inside Capacitor (iOS/Android)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
});
