import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import inject from '@rollup/plugin-inject'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-optional-chaining-assign', { 
            version: '2023-07' 
          }]
        ]
      }
    }),
    nodePolyfills({
      include: ['buffer', 'process', 'crypto', 'stream', 'util', 'assert'],
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
      protocolImports: true,
    }),
    inject({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    })
  ],
  define: {
    'process.env': '{}',
    'process.version': '"v18.0.0"',
    'process.browser': true,
    global: 'globalThis',
    __dirname: JSON.stringify(''),
    __filename: JSON.stringify(''),
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      util: 'util',
      process: 'process/browser',
      vm: 'vm-browserify',
      http: 'stream-http',
      https: 'https-browserify',
      os: 'os-browserify',
      path: 'path-browserify',
      assert: 'assert',
      fs: false,
      tls: false,
      net: false,
      zlib: false,
      dns: false,
      child_process: false,
    }
  },
  server: {
    host: true,
    allowedHosts: [
      ".cloudpub.ru",
      "localhost"
    ],
    https: false,
  },
  optimizeDeps: {
    include: [
      'buffer',
      'process',
      'crypto-browserify',
      'stream-browserify',
      'util',
      'assert',
    ],
    exclude: [
      '@ethersproject/hash',
      '@ethersproject/providers',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      exclude: [],
      include: [
        /node_modules/,
      ],
    },
    rollupOptions: {
      plugins: [
        inject({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      ],
    },
  },
})