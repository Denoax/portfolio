import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {readFileSync,readdirSync} from 'node:fs'
import {terminalMarkup} from './src/boot/terminalMarkup'
import {contact} from './src/content/portfolio'

export default defineConfig({
  plugins: [react(), {name:'portfolio-boot-shell',transformIndexHtml:{order:'pre',handler(html) {
    return html.replace('/* PORTFOLIO_BOOT_CSS */',readFileSync(new URL('./src/boot/terminal.css',import.meta.url),'utf8'))
      .replace('<!-- PORTFOLIO_BOOT_SHELL -->',terminalMarkup(
        readdirSync(new URL('./src',import.meta.url),{recursive:true})
          .filter(path=>/\.(tsx?|css|json)$/.test(path)).map(path=>'src/'+path.replaceAll('\\','/')).sort(),contact))
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
