import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Extract host and port for HMR
  const domain = env.VITE_DOMAIN || env.DOMAIN || 'localhost';
  const host = domain.replace(/^https?:\/\//, '').split(':')[0];

  // Port: use explicit port if present, else 443 for https, else 80
  const portMatch = domain.match(/:(\d+)/);
  const port = portMatch ? parseInt(portMatch[1]) : (domain.startsWith('https') ? 443 : 80);

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 3000,
      allowedHosts: env.VITE_ALLOWED_HOSTS ? env.VITE_ALLOWED_HOSTS.split(',') : [],
      hmr: {
        host: host,
        clientPort: port
      }
    }
  }
})
