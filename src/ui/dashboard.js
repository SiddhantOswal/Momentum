// One controller owns API requests, confirmations, persistence and approval.
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
document.addEventListener('ustaad:navigation', syncGuidedNavigation);
syncGuidedNavigation();
