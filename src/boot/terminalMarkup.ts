const escape = (text: string) => text.replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

// Authored compilation choreography, explicitly requested as visual fiction.
// Build-time real paths; no runtime log, progress, measurements or ready signal.
export function terminalMarkup(paths: readonly string[], contact: {github: string; email: string}) {
  if (!paths.length) throw new Error('Compilation stream needs real source paths')
  const verbs = ['resolve', 'transform', 'link', 'prepare']
  const rows = Array.from({length:256}, (_, index) =>
    verbs[Math.floor(index / 16) % verbs.length].padEnd(11) + paths[(index * 37) % paths.length])
  // The finite tail covers tall viewports across the seamless loop. One text
  // node and one composited strip, independent of main-thread preparation.
  const strip = [...rows, ...rows.slice(0,160)].join('\n')
  return `<section id="portfolio-boot" data-audio-silent aria-label="Portfolio preparation" data-phase="SHELL">
<div class="terminal-stream-window" aria-hidden="true"><pre class="terminal-stream">${escape(strip)}</pre></div>
<div class="terminal-recovery"><p id="portfolio-boot-status" role="status" aria-live="polite">Preparing the portfolio</p><nav aria-label="Loading recovery"><a href="" data-boot-retry>Reload page</a><a href="${escape(contact.github)}">GitHub</a><a href="mailto:${escape(contact.email)}">Contact</a></nav></div>
<noscript><style>#portfolio-boot .terminal-stream-window{display:none}#portfolio-boot .terminal-recovery{position:static;padding:24px;clip-path:none;width:auto;height:auto}#portfolio-boot .terminal-recovery nav{display:flex}</style><p class="terminal-noscript">JavaScript is unavailable. Explore the projects on GitHub.</p></noscript></section>`
}
