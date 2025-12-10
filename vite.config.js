import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Полифиллы для модулей, используемых крипто-библиотеками
      include: ['buffer', 'stream', 'util', 'crypto', 'assert', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      }
    })
  ],
  // Разрешение конфликтов импортов для сборки
  resolve: {
    alias: {
      // Эти алиасы помогают Vite найти браузерные версии модулей
      'stream': 'stream-browserify',
      'buffer': 'buffer',
      'crypto': 'crypto-browserify'
    }
  },
  // Определение глобальных переменных, которых нет в браузере
  define: {
    'process.env': {},
    'global': 'window'
  },
  // Оптимизация зависимостей для сборки
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  },
  build: {
    // Увеличивает лимит на размер чанков (может понадобиться для крипто-библиотек)
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Создает отдельный чанк для vendor-библиотек
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    }
  }
})