// One controller owns API requests, confirmations, persistence and approval.
import "./welcome.js";
import "./workflow.js";

const lotScreens = new Set(["screen-order-input", "screen-production-analysis", "dashboard-job-review"]);
const stages = document.querySelector('.dashboard-stages');
function syncGuidedNavigation() {
  const panel = document.querySelector('[data-screen-panel].is-active');
  if (!panel) return;
  const preparingLot = lotScreens.has(panel.id);
  stages.hidden = !preparingLot;
  for (const link of stages.querySelectorAll('a')) {
    if (link.hash === '#' + panel.id) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  const lotTab = document.querySelector('.primary-nav a[href="#screen-order-input"]');
  if (preparingLot) lotTab.setAttribute('aria-current', 'page');
  document.title = (panel.id === 'dashboard-job-review' ? 'Job card' :
    panel.querySelector('h1')?.textContent ?? 'Production preparation') + ' · Momentum';
}
// Colour theme: follows the device until the header toggle stores a choice for this browser.
const THEME_KEY = 'momentum-theme';
const root = document.documentElement;
const deviceLight = matchMedia('(prefers-color-scheme: light)');
function storedTheme() {
  try { const value = localStorage.getItem(THEME_KEY); return value === 'light' || value === 'dark' ? value : null; } catch { return null; }
}
const effectiveTheme = () => root.dataset.theme ?? (deviceLight.matches ? 'light' : 'dark');
function syncTheme() {
  const theme = effectiveTheme();
  const toggle = document.getElementById('theme-toggle');
  toggle.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
  toggle.title = toggle.getAttribute('aria-label');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f2ec' : '#101719');
  document.dispatchEvent(new CustomEvent('ustaad:theme', { detail: theme }));
}
const savedTheme = storedTheme();
if (savedTheme) root.dataset.theme = savedTheme;
document.getElementById('theme-toggle').addEventListener('click', () => {
  root.dataset.theme = effectiveTheme() === 'light' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, root.dataset.theme); } catch { /* the choice lasts for this page only */ }
  syncTheme();
});
deviceLight.addEventListener('change', () => { if (!storedTheme()) syncTheme(); });
syncTheme();

// Developer output (Technical response panels, local PDF utility) stays available with ?debug=1.
if (new URLSearchParams(location.search).has('debug')) document.body.classList.add('show-technical');
document.addEventListener('ustaad:navigation', syncGuidedNavigation);
syncGuidedNavigation();
