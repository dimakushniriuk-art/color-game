import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Nel sito unico l'admin sta in /admin/ (App su /, Studio su /studio/).
export default defineConfig({ base: '/admin/', plugins: [react()], build: { outDir: 'dist', target: 'es2020' } });
