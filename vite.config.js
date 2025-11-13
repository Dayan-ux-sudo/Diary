import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.', // optional: the folder where index.html lives (if you're running vite in Frontend)
  plugins: [react()],
  build: {
    rollupOptions: {
      input: '/index.html' //specify the entry point
    }
  }
});