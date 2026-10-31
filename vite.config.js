import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import spotifyImportHandler from './api/spotify-import.js'

function spotifyImportPlugin() {
  return {
    name: 'spotify-import-plugin',
    configureServer(server) {
      server.middlewares.use('/api/spotify-import', (req, res) => {
        spotifyImportHandler(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/spotify-import', (req, res) => {
        spotifyImportHandler(req, res)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), spotifyImportPlugin()],
  server: {
    proxy: {
      '/api/saavn': {
        target: 'https://www.jiosaavn.com',
        changeOrigin: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/api\/saavn/, '/api.php')
      }
    }
  },
  preview: {
    proxy: {
      '/api/saavn': {
        target: 'https://www.jiosaavn.com',
        changeOrigin: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        rewrite: (path) => path.replace(/^\/api\/saavn/, '/api.php')
      }
    }
  }
})
