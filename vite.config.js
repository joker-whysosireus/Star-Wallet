import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: ['buffer', 'stream', 'util', 'crypto', 'assert', 'process', 'path', 'os', 'vm', 'https', 'http'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      }
    })
  ],
  server: {
    host: true,
    allowedHosts: [
      ".cloudpub.ru",
      "localhost"
    ],
    https: false,
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      path: 'path-browserify',
      os: 'os-browserify',
      https: 'https-browserify',
      http: 'stream-http',
      vm: 'vm-browserify',
      util: 'util'
    }
  },
  define: {
    'process.env': {},
    'global': 'window'
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['tiny-secp256k1', '@ethersproject/hash']
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});