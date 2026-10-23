import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: { environment: 'node', setupFiles: ['tests/setup.js'] },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split big libraries so the browser can cache them separately
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          mediapipe: ['@mediapipe/tasks-vision'],
          pdf: ['jspdf'],
        },
      },
    },
  },
});
