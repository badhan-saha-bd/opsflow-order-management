import { defineConfig } from 'vite';

export default defineConfig({
  // Development only. In Kubernetes, teams design their own /api routing.
  server: { proxy: {
    '/api': 'http://localhost:8080',
    '/health': 'http://localhost:8080',
    '/metrics': 'http://localhost:8080',
  } },
});
