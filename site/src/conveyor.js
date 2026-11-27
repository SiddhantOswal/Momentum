// The statement section's conveyor: a graphite belt that starts at the centre of the screen and runs
// right, carrying two M-01 cases through an inspection gate. The canvas is masked so everything
// fades out toward the right edge. Renders only while on screen.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, BoxGeometry, CylinderGeometry, PlaneGeometry,
  MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace, NeutralToneMapping,
  PMREMGenerator, DirectionalLight, MathUtils, Box3, Vector3, AdditiveBlending,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { loadCase } from './model.js';

const BELT_LEN = 10, BELT_W = 1.9, START = 0, SPEED = 0.55, GATE_X = 2.4;
const smooth = (t) => t * t * (3 - 2 * t);

function slatTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#16191d'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 8; i++) {
    const y = i * 32;
    x.fillStyle = '#0b0d10'; x.fillRect(0, y, 64, 3);
    x.fillStyle = '#20252b'; x.fillRect(0, y + 3, 64, 2);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 8;
  return t;
}

export async function createConveyor(holder, { reduced = false } = {}) {
  const canvas = holder.querySelector('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const key = new DirectionalLight(0xffffff, 2.4); key.position.set(-3, 7, 6); scene.add(key);
  const rim = new DirectionalLight(0xffffff, 2.6); rim.position.set(4, 3, -6); scene.add(rim);
  const fill = new DirectionalLight(0xf5c518, 0.5); fill.position.set(0, -2, 6); scene.add(fill);

  // belt
  const steel = new MeshStandardMaterial({ color: 0x2a3038, metalness: 0.85, roughness: 0.38 });
  const dark = new MeshStandardMaterial({ color: 0x121519, metalness: 0.4, roughness: 0.6 });
  const yellow = new MeshBasicMaterial({ color: 0xf5c518 });
  const slats = slatTexture(); slats.repeat.set(1, BELT_LEN / 1.6);
  const beltTop = new MeshStandardMaterial({ map: slats, roughness: 0.75, metalness: 0.1 });
  const belt = new Group(); scene.add(belt);

  const surface = new Mesh(new PlaneGeometry(BELT_W, BELT_LEN), beltTop);
  surface.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); surface.position.set(START + BELT_LEN / 2, 0, 0);
  belt.add(surface);
  const bed = new Mesh(new BoxGeometry(BELT_LEN, 0.22, BELT_W - 0.04), dark);
  bed.position.set(START + BELT_LEN / 2, -0.115, 0); belt.add(bed);
  // head drum where the belt begins
  const drum = new Mesh(new CylinderGeometry(0.12, 0.12, BELT_W + 0.06, 32), steel);
  drum.rotation.x = Math.PI / 2; drum.position.set(START, -0.11, 0); belt.add(drum);
  // side rails with a yellow edge line on the near side
  for (const z of [-1, 1]) {
    const rail = new Mesh(new BoxGeometry(BELT_LEN + 0.1, 0.16, 0.07), steel);
    rail.position.set(START + BELT_LEN / 2 - 0.05, 0.02, z * (BELT_W / 2 + 0.04)); belt.add(rail);
  }
  const line = new Mesh(new BoxGeometry(BELT_LEN, 0.018, 0.075), yellow);
  line.position.set(START + BELT_LEN / 2, 0.105, BELT_W / 2 + 0.04); belt.add(line);
  // rollers peeking out under the near rail
  const rollers = [];
  const rollerGeo = new CylinderGeometry(0.075, 0.075, 0.12, 20); rollerGeo.rotateX(Math.PI / 2);
  for (let x = START + 0.55; x < START + BELT_LEN; x += 0.55) {
    const r = new Mesh(rollerGeo, steel); r.position.set(x, -0.27, BELT_W / 2 - 0.02); belt.add(r); rollers.push(r);
  }

  // inspection gate: a slim arch with a yellow scan line
  const gate = new Group(); gate.position.x = GATE_X; belt.add(gate);
  const postGeo = new BoxGeometry(0.1, 1.35, 0.1);
  for (const z of [-1, 1]) { const p = new Mesh(postGeo, steel); p.position.set(0, 0.6, z * (BELT_W / 2 + 0.12)); gate.add(p); }
  const beam = new Mesh(new BoxGeometry(0.16, 0.12, BELT_W + 0.36), steel); beam.position.y = 1.3; gate.add(beam);
  const scanMat = new MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.0, blending: AdditiveBlending, depthWrite: false });
  const scan = new Mesh(new PlaneGeometry(0.03, 1.2), scanMat); scan.rotation.y = Math.PI / 2; scan.scale.set(1, 1, 1);
  const curtain = new Mesh(new PlaneGeometry(BELT_W + 0.14, 1.2), scanMat); curtain.rotation.y = Math.PI / 2; curtain.position.y = 0.62; gate.add(curtain);
  const lamp = new Mesh(new BoxGeometry(0.17, 0.03, BELT_W + 0.2), yellow); lamp.position.y = 1.235; gate.add(lamp);
  void scan;

  // soft yellow wash on the floor under the belt
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(245,197,24,0)'); g.addColorStop(0.5, 'rgba(245,197,24,.55)'); g.addColorStop(1, 'rgba(245,197,24,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 64);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  })();
  const glow = new Mesh(new PlaneGeometry(BELT_LEN, BELT_W * 2.4), new MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(START + BELT_LEN / 2, -0.62, 0); belt.add(glow);
  const shTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 2, 64, 64, 63);
    g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  })();

  // the two cases
  const gltf = await loadCase();
  const proto = gltf.scene;
  const bb = new Box3().setFromObject(proto);
  const size = bb.getSize(new Vector3()), centre = bb.getCenter(new Vector3());
  const S = 1.25 / size.y;
  const items = [0, 1].map((i) => {
    const m = proto.clone(true);
    m.position.sub(centre);
    const pivot = new Group(); pivot.add(m);
    const g = new Group(); g.add(pivot);
    pivot.scale.setScalar(S);
    pivot.rotation.y = i === 0 ? -0.18 : Math.PI / 2 - 0.12; // one side-on, one end-on
    g.position.y = (size.y * S) / 2;
    scene.add(g);
    const fx = (i === 0 ? size.x : size.z) * S, fz = (i === 0 ? size.z : size.x) * S;
    const sh = new Mesh(new PlaneGeometry(fx * 1.5, fz * 1.9), new MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.006; scene.add(sh);
    return { g, pivot, sh, phase: i * 0.5, footprint: fx };
  });

  let aspect = 1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect;
    // frame so the belt's head sits at the canvas's left edge
    camera.fov = 30;
    const dist = aspect > 1 ? 8.2 : 9.5;
    const halfW = Math.tan(MathUtils.degToRad(15)) * dist * aspect;
    const cx = START - 0.25 + halfW * 0.94;
    camera.position.set(cx - 1.1, 2.7, dist);
    camera.lookAt(cx, 0.32, 0);
    camera.updateProjectionMatrix();
  }
  resize();

  // The first case arrives from the hero. Until it lands, the belt waits with an empty slot at its head;
  // once it lands the belt starts and carries it away. Scrolling back resets the belt.
  let landed = false, tb = 0;
  const SLOT_X = START + 0.75;
  const restY = () => (size.y * S) / 2 + 0.005;
  const vcam = camera.clone();
  function setLanded(v) {
    if (v === landed) return;
    landed = v;
    if (!v) tb = 0;
    if (!running) frame(true);
  }
  function slotPose(W, H, outMV, outP) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const it = items[0];
    it.g.position.set(SLOT_X, restY(), 0); it.g.scale.setScalar(1); it.pivot.rotation.z = 0;
    it.g.updateMatrixWorld(true); camera.updateMatrixWorld();
    outMV.multiplyMatrices(camera.matrixWorldInverse, it.pivot.matrixWorld);
    vcam.copy(camera);
    vcam.setViewOffset(r.width, r.height, -r.left, -r.top, W, H);
    vcam.updateProjectionMatrix();
    outP.copy(vcam.projectionMatrix);
    return true;
  }

  let t = 0, last = performance.now(), running = false;
  function frame(force) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduced || force) t += reduced ? 0 : dt;
    if (landed && !reduced) tb += dt;
    slats.offset.y = -(tb * SPEED) / 1.6;
    rollers.forEach((r) => { r.rotation.z = -tb * SPEED / 0.075; });
    let near = 0;
    const travel = BELT_LEN - 1.4;
    items.forEach((it, i) => {
      const cyc = (tb * SPEED) / travel + it.phase + (reduced ? 0.12 : 0);
      const u = cyc % 1;
      const x = SLOT_X + u * travel;
      // the first pass of the landed case needs no drop-in; later passes drop in at the head
      const enter = i === 0 && cyc < 1 ? 1 : smooth(MathUtils.clamp(u / 0.06, 0, 1));
      it.g.position.x = x;
      it.g.position.y = restY() + (1 - enter) * 0.5;
      it.g.scale.setScalar(0.6 + 0.4 * enter);
      it.g.visible = enter > 0.01 && (i > 0 || landed);
      it.sh.position.x = x; it.sh.material.opacity = enter * 0.85; it.sh.visible = it.g.visible || i === 0;
      it.pivot.rotation.z = Math.sin(t * 2.1 + i) * 0.004;
      near = Math.max(near, 1 - MathUtils.clamp(Math.abs(x - GATE_X) / (it.footprint * 0.6 + 0.25), 0, 1));
    });
    scanMat.opacity = 0.05 + 0.32 * smooth(near);
    renderer.render(scene, camera);
  }
  const tick = () => frame(false);
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running && !reduced) { running = true; last = performance.now(); gsap.ticker.add(tick); }
    else if (!e.isIntersecting && running) { running = false; gsap.ticker.remove(tick); }
  }, { rootMargin: '100px' });
  io.observe(holder);
  new ResizeObserver(() => { resize(); frame(true); }).observe(holder);
  try { await renderer.compileAsync(scene, camera); } catch { /* ignore */ }
  frame(true);
  return { renderer, setLanded, slotPose };
}
