import { pauseOnLeave, prefetchPage } from './leave.js';
import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createInk } from './ink.js';
import { createCase } from './case.js';
import { createConveyor } from './conveyor.js';
import { initDemo } from './demo.js';
import { applyLinks } from './links.js';
import { Matrix4 } from 'three';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const NOGL = params.has('nogl');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);
const range = (p, a, b) => clamp01((p - a) / (b - a));

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
applyLinks();
pauseOnLeave();
prefetchPage('/login');

/* ───────── smooth scroll: Lenis driven by GSAP's ticker, one clock for everything ───────── */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    autoRaf: false,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    const el = id === '#top' ? 0 : $(id);
    if (el === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else if (el === 0) window.scrollTo(0, 0); else el.scrollIntoView();
  });
});

/* ───────── shared state ───────── */
const state = { p: 0, intro: reduced ? 1 : 0, inkIntro: reduced ? 1 : 0 };
const pointer = { x: 0.5, y: 0.5 };
let lastMove = -1e9;
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight; lastMove = performance.now();
}, { passive: true });

let ink = null, board = null, belt = null, heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0 }).observe($('#heroPin'));

/* ───────── render loop (single clock) ───────── */
let clock = 0, lastDegrade = 0;
const slow = [];
gsap.ticker.add((_, deltaTime) => {
  const dt = Math.min(deltaTime, 50) / 1000;
  clock += dt;
  if (!heroVisible) return;
  const live = performance.now() - lastMove < 2600;
  // the ink runs on real time, so it keeps sweeping at full speed even when a slow machine drops frames
  const inkT = performance.now() / 1000;
  if (ink && state.p < 0.995) { ink.update(dt, inkT, pointer, live, 1, state.inkIntro); ink.render(inkT); }
  if (board && board.degrade && deltaTime < 250) {
    slow.push(deltaTime); if (slow.length > 45) slow.shift();
    if (slow.length === 45 && clock - lastDegrade > 2) {
      const avg = slow.reduce((a, b) => a + b, 0) / 45;
      if (avg > 24 && board.degrade()) { lastDegrade = clock; slow.length = 0; }
    }
  }
  if (board) {
    const ok = fl.b > 0 && belt && belt.slotPose(innerWidth, innerHeight, fl.mv, fl.proj);
    board.update(state.p, state.intro, live ? pointer : { x: 0.5, y: 0.5 }, clock, dt, { a: fl.a, b: ok ? fl.b : 0, mv: ok ? fl.mv : null, proj: fl.proj });
    if (fl.b < 1) board.render();
  }
});

/* ───────── the case's flight: hero → across the dark hand-off → onto the conveyor ─────────
   Part A runs while the dark panel rises (case drifts and turns); part B starts when the belt
   comes into view and lands the case on it. Both are tied straight to scroll position. */
const flight = { aS: 1e9, bS: 1e9, bE: 1e9, on: !reduced && !NOGL };
const fl = { a: 0, b: 0, mv: new Matrix4(), proj: new Matrix4() };
function measureFlight() {
  const pin = ScrollTrigger.getAll().find((t) => t.pin);
  const b = $('#belt');
  if (!pin || !b) return;
  const r = b.getBoundingClientRect(), y = scrollY, vh = innerHeight;
  const top = r.top + y;
  flight.aS = pin.start + 0.5 * (pin.end - pin.start);
  flight.bE = Math.max(flight.aS + vh, top + r.height * 0.5 - vh * 0.5);
  flight.bS = Math.min(Math.max(flight.aS + vh * 0.5, top - vh * 0.92), flight.bE - vh * 0.3);
}
gsap.ticker.add(() => {
  if (!board) return;
  const y = scrollY;
  const c = (v) => Math.min(1, Math.max(0, v));
  fl.a = flight.on ? c((y - flight.aS) / (flight.bS - flight.aS)) : 0;
  fl.b = flight.on ? c((y - flight.bS) / (flight.bE - flight.bS)) : 0;
  const inFlight = fl.a > 0 && fl.b < 1;
  if (belt) belt.setLanded(!flight.on || fl.b >= 1);
  const show = (heroVisible && fl.b < 1) || inFlight;
  const gear = $('#gear');
  if (gear.style.visibility !== (show ? 'visible' : 'hidden')) gear.style.visibility = show ? 'visible' : 'hidden';
  if (!show || heroVisible) return; // in the hero the main loop already rendered it
  const ok = fl.b > 0 && belt && belt.slotPose(innerWidth, innerHeight, fl.mv, fl.proj);
  board.update(1, 1, { x: 0.5, y: 0.5 }, clock, 1 / 60, { a: fl.a, b: ok ? fl.b : 0, mv: ok ? fl.mv : null, proj: fl.proj });
  board.render();
}, false, true); // runs first, so the main loop renders with this frame's flight state

/* ───────── hero scroll choreography ───────── */
function setupHero() {
  const nav = $('#nav');
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#top', start: 'top top', end: '+=220%', pin: '#heroPin', scrub: true,
      anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (self) => { state.p = self.progress; nav.classList.toggle('is-light', self.progress > 0.94); },
    },
  });
  tl.to('[data-half="a"]', { xPercent: -60, duration: 0.42 }, 0.02)
    .to('[data-half="b"]', { xPercent: 60, duration: 0.42 }, 0.02)
    .to('.wm', { yPercent: -60, duration: 0.5 }, 0.3)
    .to('.hero__meta', { opacity: 0, duration: 0.09 }, 0)
    .fromTo('#heroDark', { yPercent: 100, y: 0 }, { yPercent: 0, y: 0, duration: 0.5, ease: 'power1.inOut' }, 0.5)
    .set({}, {}, 1);

  ScrollTrigger.create({
    trigger: '#how', start: 'top 48px', end: 'bottom 48px',
    onToggle: (self) => nav.classList.toggle('on-paper', self.isActive),
  });
}

/* ───────── section effects ───────── */
function setupSections() {
  // statement: words light up as you read
  const big = $('#whatBig');
  const words = big.textContent.trim().split(/\s+/);
  big.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  if (!reduced) {
    gsap.to($$('.w', big), {
      opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: big, start: 'top 95%', end: 'bottom 55%', scrub: true },
    });
  }

  // how: a fluted line that draws itself down the list
  let railST = null;
  const buildRail = () => {
    const list = $('#steps'), svg = $('#rail');
    const h = Math.round(list.offsetHeight);
    svg.setAttribute('viewBox', `0 0 40 ${h}`);
    svg.style.height = `${h}px`;
    const pts = [];
    for (let y = 0; y <= h; y += 3) pts.push(`${(20 + 9 * Math.sin((y / 44) * Math.PI * 2)).toFixed(2)} ${y}`);
    const d = `M${pts.join(' L')}`;
    $('#railBase').setAttribute('d', d);
    const on = $('#railOn');
    on.setAttribute('d', d);
    const len = on.getTotalLength();
    on.style.strokeDasharray = len;
    if (railST) { railST.scrollTrigger?.kill(); railST.kill(); }
    if (reduced) { on.style.strokeDashoffset = 0; return; }
    on.style.strokeDashoffset = len;
    railST = gsap.to(on, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: list, start: 'top 62%', end: 'bottom 62%', scrub: true },
    });
  };
  buildRail();
  $$('.st').forEach((st) => ScrollTrigger.create({ trigger: st, start: 'top 64%', toggleClass: { targets: st, className: 'is-on' } }));
  if (reduced) $$('.st').forEach((st) => st.classList.add('is-on'));

  // footer: yellow spotlight follows the pointer inside the wordmark
  const foot = $('#footWord');
  let raf = 0, fx = 0, fy = 0;
  $('#links').addEventListener('pointermove', (e) => {
    const r = foot.getBoundingClientRect(); fx = e.clientX - r.left; fy = e.clientY - r.top;
    if (!raf) raf = requestAnimationFrame(() => { foot.style.setProperty('--mx', `${fx}px`); foot.style.setProperty('--my', `${fy}px`); raf = 0; });
  }, { passive: true });

  return buildRail;
}

/* ───────── wordmark fits the viewport exactly ───────── */
function fitWordmark() {
  const target = innerWidth * (innerWidth < 720 ? 0.94 : 0.965);
  const h = Math.min(target / (766 / 140), innerHeight * 0.4);
  $('#wm').style.setProperty('--wm-h', `${h}px`);
  const f = $('#footWord');
  f.style.fontSize = '100px';
  const w = f.scrollWidth || f.getBoundingClientRect().width;
  f.style.fontSize = `${(100 * innerWidth * 0.92) / w}px`;
}

/* ───────── loader and entrance ───────── */
const loadNum = $('#loadNum'), loadBar = $('#loadBar');
const counter = { v: 0 };
const paintLoader = () => {
  const n = Math.round(counter.v);
  if (loadNum) loadNum.textContent = String(n).padStart(3, '0');
  if (loadBar) loadBar.style.transform = `scaleX(${counter.v / 100})`;
};

// the conveyor sits beside the statement, from the centre of the screen to the right edge
function placeBelt() {
  const sec = $('#what'), big = $('#whatBig'), belt = $('#belt');
  if (!sec || !big || !belt) return;
  const s = sec.getBoundingClientRect(), b = big.getBoundingClientRect();
  belt.style.setProperty('--belt-top', `${b.top - s.top}px`);
  belt.style.setProperty('--belt-h', `${b.height}px`);
}

async function boot() {
  gsap.set('.ch', { yPercent: reduced ? 0 : 112 });
  gsap.set('.hero__lede, .hero__cue', { opacity: reduced ? 1 : 0, y: reduced ? 0 : 16 });

  const crawl = reduced ? null : gsap.to(counter, { v: 90, duration: 1.5, ease: 'power2.out', onUpdate: paintLoader });

  await document.fonts.ready;
  await Promise.all([document.fonts.load('900 80px Archivo'), document.fonts.load('400 40px Serif'), document.fonts.load('500 16px Inter')]);

  if (!NOGL) {
    try { ink = createInk($('#ink')); } catch (e) { console.warn('ink failed', e); }
    try { board = await createCase($('#gear')); if (board) await board.warm(); } catch (e) { console.warn('case failed', e); }
  }

  fitWordmark();
  placeBelt();
  const rebuildRail = setupSections();
  if (!NOGL) createConveyor($('#belt'), { reduced }).then((c) => { belt = c; measureFlight(); }).catch((e) => console.warn('conveyor failed', e));
  ScrollTrigger.addEventListener('refresh', measureFlight);
  measureFlight();
  const demo = initDemo({ reduced });
  if (!reduced) setupHero();
  else if (board) { board.update(0, 1, { x: 0.5, y: 0.5 }, 0, 0.016); board.render(); }
  ScrollTrigger.refresh();

  let lw = innerWidth, lh = innerHeight, rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (innerWidth === lw && Math.abs(innerHeight - lh) < 120) return;
      lw = innerWidth; lh = innerHeight;
      fitWordmark(); placeBelt(); ink?.resize(); board?.resize(); rebuildRail(); ScrollTrigger.refresh();
    }, 160);
  });

  if (DEBUG) window.__m = { demo, lenis, ScrollTrigger, state, gsap, get ink() { return ink; }, get board() { return board; }, get belt() { return belt; }, fl, flight };

  if (reduced) { root.classList.add('is-ready'); $('#loader')?.remove(); return; }

  crawl.kill();
  await gsap.to(counter, { v: 100, duration: 0.5, ease: 'power1.inOut', onUpdate: paintLoader });

  const tl = gsap.timeline({ onComplete: () => { $('#loader').style.display = 'none'; lenis?.start(); root.classList.add('is-done'); } });
  tl.to('#loader', { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, 0.1)
    .to(state, { intro: 1, duration: 2.6, ease: 'power3.out' }, 0.45)
    .to(state, { inkIntro: 1, duration: 2.2, ease: 'power2.out' }, 0.7)
    .to('.ch', { yPercent: 0, duration: 1.4, stagger: 0.07, ease: 'expo.out' }, 0.75)
    .add(() => root.classList.add('is-ready'), 1.0)
    .to('.hero__lede, .hero__cue', { opacity: 1, y: 0, duration: 1.1, stagger: 0.14, ease: 'power3.out' }, 1.7);
}

boot();
