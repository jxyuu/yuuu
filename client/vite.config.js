import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 开发时把 /api 转发给 Express（3000），避免跨域问题
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 直接构建到后端要托管的目录，npm run build 后 npm start 就能看到界面
    outDir: '../public',
    emptyOutDir: true,
  },
});
