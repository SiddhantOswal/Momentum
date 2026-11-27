import gsap from 'gsap';

// Ask the browser to fetch the page people are most likely to open next, once this one has settled.
export function prefetchPage(url) {
  const add = () => {
    const link = document.createElement('link');
    link.rel = 'prefetch'; link.href = url; link.as = 'document';
    document.head.appendChild(link);
  };
  addEventListener('load', () => setTimeout(add, 1200), { once: true });
}

// Stop the animation loop the moment someone follows an internal link, so the browser spends its
// time on the next page instead of on frames nobody will see. A page restored from the back/forward
// cache comes back asleep, so wake it on return.
export function pauseOnLeave() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="/"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    gsap.ticker.sleep();
    document.documentElement.classList.add('is-leaving');
  }, true);
  addEventListener('pageshow', (e) => { if (e.persisted) { gsap.ticker.wake(); document.documentElement.classList.remove('is-leaving'); } });
}
