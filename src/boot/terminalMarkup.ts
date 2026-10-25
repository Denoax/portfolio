interface IndexProject {
  id: string
  title: string
  description: string
  kind: string
}
const escape = (text: string) => text.replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
const cell = (value: string, className = '') => {
  const text = escape(value.toUpperCase())
  return `<span class="terminal-cell ${className}"><span class="terminal-value"><span>${text}</span><span class="terminal-inverse" aria-hidden="true">${text}</span></span></span>`
}
const kind = (value: string) => value === 'documentation' ? 'DOCS' : value

// Build-time projection of the real catalogue; never a second editable list.
export function terminalMarkup(projects: readonly IndexProject[], contact: {github: string; email: string}) {
  const work = projects.map((project, index) => `<div class="terminal-row terminal-project" data-boot-row="${project.id}">
${cell(index === 0 ? 'Portfolio' : '', 'terminal-source')}${cell(String(index + 1).padStart(2, '0'), 'terminal-number')}${cell(project.title, 'terminal-title')}${cell(kind(project.kind), 'terminal-meta')}${cell(`${String(index + 1).padStart(2, '0')}/${projects.length}`, 'terminal-end')}</div>`).join('')
  const notes = projects.map(project => `<div class="terminal-row terminal-note" data-boot-row="note-${project.id}">${cell(project.title, 'terminal-source')}${cell(project.description, 'terminal-description')}${cell(kind(project.kind), 'terminal-end')}</div>`).join('')
  return `<section id="portfolio-boot" data-audio-silent aria-label="Portfolio preparation" data-phase="SHELL">
<header class="terminal-header"><strong>MANI MARAMI MILANI</strong><span>SELECTED WORK —</span><i class="terminal-indicator" aria-hidden="true"></i></header>
<div class="terminal-content" aria-hidden="true"><section><h2>SELECTED WORK —</h2>${work}</section><section><h2>PROJECT NOTES —</h2>${notes}</section></div>
<footer class="terminal-footer"><div><p id="portfolio-boot-status" role="status" aria-live="polite">Preparing the portfolio</p><a class="terminal-retry" href="" data-boot-retry>Reload page</a><noscript><p>JavaScript is unavailable. Explore the projects on GitHub.</p></noscript></div><nav aria-label="Loading recovery"><a href="${escape(contact.github)}">GITHUB ↗</a><a href="mailto:${escape(contact.email)}">CONTACT ↗</a></nav></footer>
<noscript><style>#portfolio-boot-status{display:none}</style></noscript></section>`
}
