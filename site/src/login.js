import './styles.css';
import './login.css';
import gsap from 'gsap';
import { createInk } from './ink.js';
import { LINKS } from './links.js';
import { pauseOnLeave, prefetchPage } from './leave.js';
import { signInWithEmail, signInWithGoogle, googleEnabled, describe } from './auth.js';

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const form = $('#form'), email = $('#email'), pw = $('#password'), msg = $('#msg'), submit = $('#submit'), google = $('#google');

function say(text, tone = 'info') { msg.textContent = text; msg.dataset.tone = tone; }
function busy(on, label) {
  [submit, google].forEach((b) => { b.disabled = on; });
  submit.querySelector('span').textContent = on && label ? label : 'Sign in';
  form.setAttribute('aria-busy', on ? 'true' : 'false');
}
function goDashboard() { location.assign(LINKS.dashboard); }

$('#show').addEventListener('click', (e) => {
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  e.currentTarget.textContent = show ? 'Hide' : 'Show';
  e.currentTarget.setAttribute('aria-pressed', String(show));
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!email.value.trim() || !email.checkValidity()) { say('Enter your work email, like name@company.com.', 'error'); email.focus(); return; }
  if (!pw.value) { say('Enter your password.', 'error'); pw.focus(); return; }
  busy(true, 'Signing in…'); say('');
  try { await signInWithEmail(email.value.trim(), pw.value); goDashboard(); }
  catch (err) { say(describe(err), 'error'); busy(false); }
});

google.addEventListener('click', async () => {
  busy(true); say('');
  try { await signInWithGoogle(); goDashboard(); }
  catch (err) { say(describe(err), 'error'); busy(false); }
});

/* the same liquid ink as the landing page hero */
const pointer = { x: 0.5, y: 0.5 };
let lastMove = -1e9;
addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight; lastMove = performance.now(); }, { passive: true });
let ink = null;
try { ink = createInk($('#ink')); } catch { ink = null; }
const state = { intro: reduced ? 1 : 0 };
if (ink) {
  let clock = 0;
  if (reduced) { ink.update(0.016, 4, pointer, false, 1, 1); ink.render(4); }
  else {
    gsap.to(state, { intro: 1, duration: 2.2, ease: 'power2.out', delay: 0.15 });
    gsap.ticker.add((time, delta) => {
      const dt = Math.min(delta, 100) / 1000; clock += dt;
      ink.update(dt, clock, pointer, performance.now() - lastMove < 2600, 1, state.intro);
      ink.render(clock);
    });
    gsap.ticker.lagSmoothing(0);
  }
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => ink.resize(), 120); });
}

// Show only the sign-in method this server runs: Google when Google sessions are on, email otherwise.
googleEnabled().then((on) => {
  const hide = (...nodes) => nodes.forEach((n) => { if (n) n.style.display = 'none'; });
  if (on === true) hide(form, $('.auth__or'));
  if (on === false) hide(google, $('.auth__or'));
});

pauseOnLeave();
prefetchPage('/');
root.classList.add('is-ready');
if (!reduced) {
  gsap.from('.auth__intro > *', { opacity: 0, y: 18, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.1 });
  gsap.from('.auth__card', { opacity: 0, y: 26, duration: 1.1, ease: 'power3.out', delay: 0.25 });
}
