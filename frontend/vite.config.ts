import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative so the build works under any GitHub Pages subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
})
