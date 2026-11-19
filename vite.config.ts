import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works from a GitHub Pages sub-path.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // three.js alone is ~770 kB minified (193 kB gzipped) and cannot be split further.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Libraries in their own long-cached files, fetched in parallel with the app.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 },
            { name: 'r3f', test: /node_modules[\\/](@react-three|postprocessing|three-stdlib|maath|its-fine|zustand|suspend-react)/, priority: 20 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'motion', test: /node_modules[\\/](gsap|@gsap)[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
})
