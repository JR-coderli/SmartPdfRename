
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // 这里就是指定端口的地方
    strictPort: true, // 如果 5173 被占用，直接报错而不是寻找下一个可用端口
    open: true, // 启动时自动打开浏览器
  },
});
