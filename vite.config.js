const dotenv = require('dotenv');
dotenv.config();

const { defineConfig } = require('vite');
const reactRefresh = require('@vitejs/plugin-react-refresh');

const { PORT = 3001 } = process.env;

module.exports = defineConfig({
  plugins: [reactRefresh()],
  server: {
    proxy: {
      '/api': {
        target: `https://guessing-game-o6ly.onrender.com`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/app',
  },
});
