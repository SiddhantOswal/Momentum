// Every outbound link lives here. Leave a value empty and the page degrades cleanly:
// buttons fall back to their on-page target, footer text links render as plain, dimmed text.
// The demo video, blog and team profile URLs stay empty until the founders supply them.
export const LINKS = {
  app: '/login',     // "Open Momentum": the sign-in page, which hands over to the dashboard
  dashboard: '/app/', // where people land after signing in
  demoVideo: '',
  blog: '',
  team: [
    { name: 'Siddhant Oswal', linkedin: '', x: '' },
    { name: 'Om Jain', linkedin: '', x: '' },
  ],
};

export function applyLinks() {
  document.querySelectorAll('[data-link]').forEach((a) => {
    let v = LINKS;
    for (const k of a.dataset.link.split('.')) v = v == null ? v : v[k];
    if (typeof v === 'string' && v) {
      a.href = v;
      if (/^https?:/.test(v)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    } else if (!a.classList.contains('btn')) {
      a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true');
    }
  });
  document.querySelectorAll('[data-team-name]').forEach((h) => {
    const m = LINKS.team[Number(h.dataset.teamName)];
    if (m && m.name) h.textContent = m.name;
  });
}
