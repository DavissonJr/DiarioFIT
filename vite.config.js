import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // permite abrir pelo celular na mesma rede: http://SEU-IP:5173
    proxy: { '/api': 'http://localhost:3001' },
  },
});
