// Scripted product walkthrough. Nothing here needs a person: a fake cursor drags a PO in,
// fields autofill, checkboxes tick, risk bars fill, settings apply, a supervisor approves.
// One GSAP timeline, built from measured element positions, every tween reversible so
// jumping between steps always lands on a consistent frame.
import gsap from 'gsap';

export function initDemo({ reduced = false } = {}) {
  const app = document.getElementById('app');
  const stage = document.getElementById('stage');
  if (!app || !stage) return null;

  const cur = document.getElementById('cur');
  const ring = cur.querySelector('.cur__ring');
  const scrs = [...stage.querySelectorAll('.scr')];
  const stepper = [...app.querySelectorAll('.stepper li')];
  const stepBtns = [...document.querySelectorAll('#demoSteps .step')];
  const stepBars = stepBtns.map((b) => b.querySelector('.step__bar'));
  const toggle = document.getElementById('demoToggle');
  const toggleLbl = toggle.querySelector('.demo__lbl');

  let tl = null;
  let flags = []; // class toggles driven by playhead time, so seeking and looping stay exact
  let labels = [0, 0, 0, 0];
  let total = 1;
  let idx = -1;
  let userPaused = false;
  let inView = false;

  const q = (sel) => stage.querySelector(sel);
  const qa = (sel) => [...stage.querySelectorAll(sel)];
  const rel = (el, fx = 0.5, fy = 0.5) => {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - s.left + r.width * fx, y: r.top - s.top + r.height * fy };
  };

  function resetDom() {
    gsap.set(stage.querySelectorAll('*'), { clearProps: 'transform,opacity,width,visibility,backgroundColor,color' });
    stage.querySelectorAll('.is-on,.is-over,.is-typing').forEach((e) => e.classList.remove('is-on', 'is-over', 'is-typing'));
  }

  function naturalWidth(el) {
    el.style.width = 'auto';
    const w = Math.ceil(el.getBoundingClientRect().width) + 2;
    el.style.width = '';
    return w;
  }

  function sync() {
    if (!tl) return;
    const time = tl.time();
    for (const f of flags) { const on = time >= f.from && time < f.to; if (f.on !== on) { f.on = on; f.el.classList.toggle(f.cls, on); } }
    const i = time >= labels[3] ? 3 : time >= labels[2] ? 2 : time >= labels[1] ? 1 : 0;
    const end = i < 3 ? labels[i + 1] : total;
    const frac = Math.max(0, Math.min(1, (time - labels[i]) / (end - labels[i])));
    if (i !== idx) {
      idx = i;
      stepBtns.forEach((b, n) => b.classList.toggle('is-active', n === i));
      stepper.forEach((li, n) => li.classList.toggle('is-on', n === i));
    }
    stepBars.forEach((bar, n) => bar.style.setProperty('--p', n < i ? 1 : n === i ? frac.toFixed(3) : 0));
  }

  function build(keepAt = 0) {
    if (tl) { tl.kill(); tl = null; }
    resetDom();

    const T = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.6, defaults: { ease: 'power2.inOut' }, onUpdate: sync });

    const click = (at) => {
      T.to(cur, { scale: 0.8, duration: 0.08, ease: 'power2.out' }, at)
        .to(cur, { scale: 1, duration: 0.22, ease: 'back.out(3)' }, at + 0.08)
        .fromTo(ring, { scale: 0.3, opacity: 0.8 }, { scale: 1.6, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, at);
    };
    const fadeIn = (el, at) => T.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, at);
    const fadeOut = (el, at) => T.to(el, { opacity: 0, y: -14, duration: 0.45, ease: 'power2.in' }, at);
    flags = [];
    const flag = (el, cls, at, to = Infinity) => { flags.push({ el, cls, from: at, to, on: false }); el.classList.remove(cls); };

    gsap.set(cur, { transformOrigin: '0 0' });
    const start = rel(stage, 0.94, 0.9);

    /* ───────── 0 · read the order ───────── */
    fadeIn(scrs[0], 0);
    T.fromTo(cur, { x: start.x, y: start.y, opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.3);

    const chip = q('#pochip'), drop = q('#drop');
    const grab = rel(chip, 0.3, 0.5);
    const chipC = rel(chip, 0.5, 0.5);
    const dropC = rel(drop, 0.5, 0.42);
    const dx = dropC.x - chipC.x, dy = dropC.y - chipC.y;
    T.to(cur, { x: grab.x, y: grab.y, duration: 1.0, ease: 'power3.inOut' }, 0.5);
    T.to(cur, { scale: 0.82, duration: 0.1, ease: 'power2.out' }, 1.55);
    T.to(cur, { x: grab.x + dx, y: grab.y + dy, duration: 1.1 }, 1.65);
    T.to(chip, { x: dx, y: dy, scale: 0.94, rotation: -2, duration: 1.1 }, 1.65);
    T.to(cur, { scale: 1, duration: 0.22, ease: 'back.out(3)' }, 2.8);
    T.fromTo(ring, { scale: 0.3, opacity: 0.8 }, { scale: 1.6, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, 2.8);
    T.to(chip, { opacity: 0, scale: 0.7, duration: 0.3 }, 2.95);
    T.to(q('.drop__a'), { opacity: 0, duration: 0.25 }, 2.9);
    T.to(q('.drop__b'), { opacity: 1, duration: 0.3 }, 3.1);
    T.to(q('#scan'), { opacity: 1, duration: 0.15 }, 3.1);
    T.fromTo(q('#scan'), { yPercent: -110 }, { yPercent: 330, duration: 1.3, ease: 'power1.inOut' }, 3.1);
    T.to(q('#scan'), { opacity: 0, duration: 0.2 }, 4.3);
    T.to(cur, { x: rel(q('#fields'), 0.78, 0.5).x, y: rel(q('#fields'), 0.78, 0.5).y, duration: 0.9 }, 3.3);

    const fields = qa('.f');
    fields.forEach((f, i) => {
      const t = f.querySelector('.t'), ok = f.querySelector('.ok');
      const w = naturalWidth(t), st = 4.3 + i * 0.36;
      flag(f, 'is-typing', st, st + 0.3);
      T.to(t, { width: w, duration: 0.3, ease: `steps(${Math.max(6, t.textContent.length)})` }, st);
      T.to(ok, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, st + 0.3);
    });
    const endTyping = 4.3 + fields.length * 0.36 + 0.3;
    T.to(q('.drop__b'), { opacity: 0, duration: 0.25 }, endTyping - 1.6);
    T.to(q('.drop__c'), { opacity: 1, duration: 0.3 }, endTyping - 1.45);
    flag(drop, 'is-over', 2.2, endTyping - 1.5);

    /* ───────── 1 · confirm conditions ───────── */
    const L1 = endTyping + 0.9;
    fadeOut(scrs[0], L1 - 0.2);
    fadeIn(scrs[1], L1);
    let tt = L1 + 0.6;
    qa('.ck').forEach((li) => {
      const p = rel(li.querySelector('.cb'));
      T.to(cur, { x: p.x, y: p.y, duration: 0.55, ease: 'power3.inOut' }, tt);
      click(tt + 0.55);
      flag(li, 'is-on', tt + 0.62);
      tt += 0.95;
    });
    const b1 = q('#s1btn'), b1p = rel(b1);
    flag(b1, 'is-on', tt - 0.2);
    T.to(cur, { x: b1p.x, y: b1p.y, duration: 0.6, ease: 'power3.inOut' }, tt);
    click(tt + 0.6);
    tt += 1.1;

    /* ───────── 2 · risk and settings ───────── */
    const L2 = tt + 0.2;
    fadeOut(scrs[1], L2 - 0.15);
    fadeIn(scrs[2], L2 + 0.1);
    qa('.rk').forEach((rk, i) => {
      const bar = rk.querySelector('.rk__bar i');
      const v = parseFloat(bar.style.getPropertyValue('--v')) || 0.2;
      const st = L2 + 0.8 + i * 0.14;
      T.to(bar, { scaleX: v, duration: 0.9, ease: 'power3.out' }, st);
      T.to(rk.querySelector('.lv--a') || rk.querySelector('.lv'), { opacity: 1, duration: 0.3 }, st + 0.6);
    });
    T.fromTo(qa('#recs li'), { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.12, ease: 'power2.out' }, L2 + 2.0);
    const b2 = q('#s2btn'), b2p = rel(b2);
    T.to(cur, { x: b2p.x, y: b2p.y, duration: 0.9, ease: 'power3.inOut' }, L2 + 3.0);
    const apply = L2 + 3.9;
    click(apply);
    T.to(b2, { backgroundColor: '#f5c518', color: '#17130a', duration: 0.25 }, apply + 0.05);
    const warp = q('.rk[data-warp] .rk__bar i');
    T.to(warp, { scaleX: 0.24, duration: 1.0, ease: 'power2.inOut' }, apply + 0.15);
    T.to(q('.rk[data-warp] .lv--a'), { opacity: 0, duration: 0.25 }, apply + 0.55);
    T.to(q('.rk[data-warp] .lv--b'), { opacity: 1, duration: 0.3 }, apply + 0.7);

    /* ───────── 3 · approval ───────── */
    const L3 = apply + 2.3;
    fadeOut(scrs[2], L3 - 0.15);
    fadeIn(scrs[3], L3 + 0.1);
    const b3 = q('#s3btn'), b3p = rel(b3);
    T.to(cur, { x: b3p.x, y: b3p.y, duration: 0.9, ease: 'power3.inOut' }, L3 + 0.8);
    click(L3 + 1.7);
    T.to(q('#s3btn .ab--b'), { opacity: 1, duration: 0.25 }, L3 + 1.78);
    T.fromTo(q('#jc'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, L3 + 2.0);
    T.fromTo(q('#stamp'), { opacity: 0, scale: 1.8, rotation: -14 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.35, ease: 'back.out(2)' }, L3 + 2.9);
    const end = L3 + 5.3;
    T.to(cur, { opacity: 0, duration: 0.3 }, end - 0.4);
    T.to(scrs[3], { opacity: 0, duration: 0.5 }, end);
    T.set({}, {}, end + 0.5);

    labels = [0, L1, L2, L3];
    total = T.duration();
    tl = T;
    idx = -1;
    tl.time(Math.min(keepAt, total - 0.01), false);
    sync();
    updatePlayState();
  }

  function updatePlayState() {
    if (!tl) return;
    const run = inView && !userPaused && !reduced && !document.hidden;
    if (run) tl.play(); else tl.pause();
  }

  /* controls */
  const jump = (i) => {
    if (!tl) return;
    const stillEnd = (i < 3 ? labels[i + 1] : total - 0.6) - 0.5;
    tl.time(reduced ? stillEnd : labels[i] + 0.05, false);
    sync();
  };
  stepBtns.forEach((b, i) => b.addEventListener('click', () => jump(i)));
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    toggle.setAttribute('aria-pressed', String(userPaused));
    toggleLbl.textContent = userPaused ? 'Play demo' : 'Pause demo';
    updatePlayState();
  });

  new IntersectionObserver(([e]) => { inView = e.isIntersecting; updatePlayState(); }, { threshold: 0.35 }).observe(app);
  document.addEventListener('visibilitychange', updatePlayState);

  /* rebuild on size change, keep the playhead */
  let rz, lastW = 0;
  new ResizeObserver(() => {
    const w = Math.round(app.getBoundingClientRect().width);
    if (w === lastW) return;
    lastW = w;
    clearTimeout(rz);
    rz = setTimeout(() => build(tl ? tl.time() : 0), 180);
  }).observe(app);

  if (reduced) { app.classList.add('is-static'); toggle.hidden = true; }
  build(0);
  if (reduced) jump(2);
  return { get timeline() { return tl; }, jump };
}
