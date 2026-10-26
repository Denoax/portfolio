const escape = (text: string) => text.replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

// Original DOM/CSS adaptation of Lusion's plain black numerical preloader.
// The thin progress line is Mani's requested addition. No creator assets copied.
export function loadingMarkup(contact: {github: string; email: string}) {
  return `<section id="portfolio-boot" data-audio-silent aria-label="Portfolio preparation" data-phase="SHELL">
<div class="boot-progress" data-boot-progress role="progressbar" aria-label="Loading portfolio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
<span class="boot-number" data-boot-number aria-hidden="true">000</span>
<div class="boot-track" aria-hidden="true"><div class="boot-fill" data-boot-fill></div></div></div>
<div class="boot-recovery"><p id="portfolio-boot-status" role="status" aria-live="polite">Loading portfolio</p><nav aria-label="Loading recovery"><a href="" data-boot-retry>Reload page</a><a href="${escape(contact.github)}">GitHub</a><a href="mailto:${escape(contact.email)}">Contact</a></nav></div>
<noscript><style>#portfolio-boot .boot-progress{display:none}#portfolio-boot .boot-recovery{position:static;padding:24px;clip-path:none;width:auto;height:auto}#portfolio-boot .boot-recovery nav{display:flex}</style><p class="boot-noscript">JavaScript is unavailable. Explore the projects on GitHub.</p></noscript></section>`
}
