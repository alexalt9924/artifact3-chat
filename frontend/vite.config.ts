import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages can't set response headers, so the policy ships as a <meta> tag.
// Production only: the dev server needs inline scripts for hot reload.
// - img-src has no external hosts: model-written markdown images can't phone home with chat content.
// - connect-src allows any https API, since the login screen lets you point at your own server.
const csp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  'connect-src https:',
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ')

const cspPlugin = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`),
})

// base './' keeps asset paths relative so the build works under any GitHub Pages subpath.
export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
})
