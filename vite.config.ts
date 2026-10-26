import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {readFileSync} from 'node:fs'
import {loadingMarkup} from './src/boot/loadingMarkup'
import {contact} from './src/content/portfolio'

export default defineConfig({
  plugins: [react(), {name:'portfolio-boot-shell',transformIndexHtml:{order:'pre',handler(html) {
    return html.replace('/* PORTFOLIO_BOOT_CSS */',readFileSync(new URL('./src/boot/loading.css',import.meta.url),'utf8'))
      .replace('<!-- PORTFOLIO_BOOT_SHELL -->',loadingMarkup(contact))
  }}}],
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
