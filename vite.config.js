import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.PORT || '3000';

  return {
    root: 'frontend',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    server: {
      host: '127.0.0.1',
      proxy: {
        '/api': `http://127.0.0.1:${backendPort}`,
      },
    },
  };
});
