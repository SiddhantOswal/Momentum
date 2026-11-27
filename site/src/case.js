// The hero object: Momentum M-01, a protective case built from graphite fibreboard
// with corrugated cut edges (modelled in Blender, see /asset-pipeline). It idles in a three-quarter pose.
// It turns on one axis only, the vertical one: hover and it turns toward your cursor; press and drag
// to spin it a full 360, it keeps a little momentum and settles back to rest when you leave.
// Scrolling does not move it.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, MeshBasicMaterial, ShadowMaterial,
  CanvasTexture, SRGBColorSpace, NeutralToneMapping, PMREMGenerator, DirectionalLight, HemisphereLight,
  MathUtils, Box3, Vector3, Vector2, Raycaster, PCFShadowMap, Matrix4, Quaternion,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadCase } from './model.js';
import { createBurst } from './burst.js';

const smooth = (t) => t * t * (3 - 2 * t);
const range = (p, a, b) => MathUtils.clamp((p - a) / (b - a), 0, 1);
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const REST = { yaw: -0.6, pitch: 0.24 };

export async function createCase(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;

  const camera = new PerspectiveCamera(30, 1, 0.1, 80);

  // product-photography rig: big soft key, two rims to cut the silhouette off the yellow, yellow bounce from below
  const key = new DirectionalLight(0xffffff, 2.3);
  key.position.set(-5, 8, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
  scene.add(key, key.target);
  const rimR = new DirectionalLight(0xffffff, 2.8); rimR.position.set(7, 3, -6); scene.add(rimR);
  const rimL = new DirectionalLight(0xffffff, 1.4); rimL.position.set(-8, 1, -5); scene.add(rimL);
  scene.add(new HemisphereLight(0xdfe3e8, 0xf5c518, 0.45));

  // load the case
  const gltf = await loadCase();
  const model = gltf.scene.clone(true);
  const meshes = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; meshes.push(o);
      const m = o.material;
      for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
  });
  const bb = new Box3().setFromObject(model);
  const centre = bb.getCenter(new Vector3());
  model.position.sub(centre);
  const size = bb.getSize(new Vector3());
  const pivot = new Group(); pivot.add(model);
  const holder = new Group(); holder.add(pivot);
  scene.add(holder);
  const burst = createBurst({ meshes, centre, size, pivot, holder });

  // floor: real soft shadow plus a contact blob for the occlusion right under the feet
  const FLOOR = -size.y / 2 - 0.55;
  const shadowPlane = new Mesh(new PlaneGeometry(30, 30), new ShadowMaterial({ opacity: 0.16 }));
  shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = FLOOR; shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 4, 128, 128, 127);
    g.addColorStop(0, 'rgba(11,13,16,.62)'); g.addColorStop(0.45, 'rgba(11,13,16,.16)'); g.addColorStop(1, 'rgba(11,13,16,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  })();
  const blob = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = FLOOR + 0.01; blob.scale.set(size.x * 1.35, size.z * 2.4, 1);
  scene.add(blob);

  /* ───── framing ───── */
  let baseZ = 16, aspect = 1, quality = 1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * quality);
    renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect;
    const t = 2 * Math.tan(MathUtils.degToRad(15));
    const byH = (size.y * 2.15) / t;              // case ~46% of the viewport height
    const byW = (size.x * 1.55) / (t * aspect);   // and never wider than ~65% of a phone
    baseZ = Math.max(byH, byW);
    camera.updateProjectionMatrix();
  }
  resize();

  /* ───── interaction ───── */
  const ray = new Raycaster();
  const ndc = new Vector2();
  const ptr = { x: 0, y: 0, in: false, moved: false };
  const rot = { yaw: REST.yaw, pitch: REST.pitch, vy: 0, vp: 0 };
  const tgt = { yaw: REST.yaw, pitch: REST.pitch };
  let hover = false, drag = null, hoverAmt = 0, enabled = true, lastHit = -1e9, clock = 0;
  const box = new Box3(), corners = Array.from({ length: 8 }, () => new Vector3());

  function screenRect() { // padded screen-space rectangle of the case, for leave hysteresis
    box.setFromObject(model);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const v = corners[i++].set(x, y, z).project(camera);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    return { x0: x0 - 0.04, x1: x1 + 0.04, y0: y0 - 0.06, y1: y1 + 0.06 };
  }
  function hitTest() {
    ray.setFromCamera(ndc.set(ptr.x, ptr.y), camera);
    return ray.intersectObjects(meshes, false).length > 0;
  }
  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !drag) return;
    toNdc(e); ptr.in = true; ptr.moved = true;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, e.timeStamp - drag.t);
      drag.x = e.clientX; drag.y = e.clientY; drag.t = e.timeStamp;
      tgt.yaw += dx * 0.0085;
      rot.vy = (dx * 0.0085) / (dt / 1000); rot.vp = 0;
    }
  });
  document.documentElement.addEventListener('pointerleave', () => { ptr.in = false; });
  const coarse = matchMedia('(hover: none)').matches;
  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    toNdc(e);
    if (!hitTest()) return;
    drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    tgt.yaw = rot.yaw; tgt.pitch = rot.pitch; rot.vy = rot.vp = 0;
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'mouse') e.preventDefault();
  });
  const release = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    if (e && performance.now() - e.timeStamp < 1e4 && e.timeStamp - drag.t > 80) rot.vy = rot.vp = 0; // held still before letting go
    drag = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { drag = null; rot.vy = rot.vp = 0; });

  /* ───── per frame ───── */

  function update(p, intro, _pointer, t, dt, fl = null) {
    clock = t;
    const fa = fl ? fl.a : 0, fb = fl ? fl.b : 0;
    enabled = p < 0.4 && fa === 0;
    const k = (r) => 1 - Math.exp(-dt * r);

    // hover: raycast on movement, leave only when the pointer clears the padded rectangle
    if (ptr.moved) {
      ptr.moved = false;
      if (ptr.in && enabled && hitTest()) { hover = true; lastHit = t; }
      else if (hover) {
        const r = screenRect();
        if (!ptr.in || !enabled || ptr.x < r.x0 || ptr.x > r.x1 || ptr.y < r.y0 || ptr.y > r.y1) hover = false;
      }
    }
    if (!ptr.in) hover = false;
    canvas.style.cursor = drag ? 'grabbing' : hover ? 'grab' : '';
    const pe = enabled && (hover || drag || coarse) ? 'auto' : 'none';
    if (canvas.style.pointerEvents !== pe) canvas.style.pointerEvents = pe;
    hoverAmt += ((hover || drag ? 1 : 0) - hoverAmt) * k(5);

    if (drag) {
      // follow the hand closely
    } else if (Math.abs(rot.vy) + Math.abs(rot.vp) > 0.05) {
      // flick: coast with friction
      tgt.yaw += rot.vy * dt;
      rot.vy *= Math.exp(-dt * 2.6); rot.vp *= Math.exp(-dt * 2.6);
    } else if (hover) {
      // turn to face the cursor, measured from the case's centre on screen
      const c = new Vector3().setFromMatrixPosition(holder.matrixWorld).project(camera);
      const dx = MathUtils.clamp(ptr.x - c.x, -0.6, 0.6), dy = MathUtils.clamp(ptr.y - c.y, -0.5, 0.5);
      const restYaw = REST.yaw + Math.round((tgt.yaw - REST.yaw) / (Math.PI * 2)) * Math.PI * 2;
      tgt.yaw += (restYaw + dx * 1.5 - tgt.yaw) * k(3);
      void dy; tgt.pitch = REST.pitch;
    } else {
      // home: shortest way back to rest
      const d = wrap(tgt.yaw - REST.yaw);
      tgt.yaw = REST.yaw + d;
      tgt.yaw += (REST.yaw - tgt.yaw) * k(1.9);
      tgt.pitch += (REST.pitch - tgt.pitch) * k(1.9);
    }
    const follow = drag ? 18 : 7;
    rot.yaw += (tgt.yaw - rot.yaw) * k(follow);
    rot.pitch += (tgt.pitch - rot.pitch) * k(follow);

    const idle = 1 - hoverAmt;
    const inv = 1 - intro;
    // flight, part 1: drift toward the conveyor's side of the screen with one full turn
    const ea = eio(fa);
    pivot.matrixAutoUpdate = true;
    pivot.rotation.set(
      MathUtils.lerp(REST.pitch, 0.3, ea),
      rot.yaw + Math.sin(t * 0.45) * 0.09 * idle - inv * 2.4 + ea * Math.PI * 2,
      Math.sin(t * 0.55) * 0.012 * idle,
      'XYZ', // spin about the case's own vertical axis, then the fixed viewing tilt
    );

    const halfW = Math.tan(MathUtils.degToRad(15)) * baseZ * aspect;
    holder.position.set(ea * halfW * (aspect > 1 ? 0.46 : 0), Math.sin(t * 0.85) * 0.07 * idle + inv * 0.8 - ea * size.y * (aspect > 1 ? 0.1 : 1.15), 0);
    holder.scale.setScalar(MathUtils.lerp(0.72, 1, smooth(intro)) * (1 + hoverAmt * 0.035) * MathUtils.lerp(1, 0.58, ea));
    holder.updateMatrixWorld();

    burst.update(fa, t);
    const sh = (1 - range(p, 0.28, 0.5)) * smooth(intro) * (1 - fa);
    shadowPlane.material.opacity = 0.16 * sh;
    const air = holder.position.y;
    blob.material.opacity = sh * MathUtils.clamp(1 - air * 0.5, 0.3, 1);
    blob.scale.set(size.x * (1.35 + air * 0.08), size.z * (2.4 + air * 0.1), 1);

    camera.position.set(0, size.y * 0.35, baseZ);
    camera.lookAt(0, -size.y * 0.05, 0);

    // flight, part 2: glide onto the belt. Blend the case's camera-space pose and the projection from
    // the hero view into the conveyor's view, so at the end it sits exactly where the conveyor draws it.
    flying = fb > 0 && fl && fl.mv;
    key.castShadow = !flying && fa < 1;
    if (flying) {
      const eb = smooth(fb);
      holder.updateMatrixWorld(); camera.updateMatrixWorld();
      mA.multiplyMatrices(camera.matrixWorldInverse, pivot.matrixWorld).decompose(pA, qA, sA);
      fl.mv.decompose(pB, qB, sB);
      pA.lerp(pB, eb); qA.slerp(qB, eb); sA.lerp(sB, eb);
      holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); holder.scale.set(1, 1, 1);
      pivot.matrixAutoUpdate = false;
      pivot.matrix.compose(pA, qA, sA);
      holder.updateMatrixWorld(true);
      const e0 = camera.projectionMatrix.elements, e1 = fl.proj.elements, e = flightCam.projectionMatrix.elements;
      for (let i = 0; i < 16; i++) e[i] = e0[i] + (e1[i] - e0[i]) * eb;
      flightCam.projectionMatrixInverse.copy(flightCam.projectionMatrix).invert();
    }
  }
  let flying = false;
  const mA = new Matrix4(), pA = new Vector3(), qA = new Quaternion(), sA = new Vector3();
  const pB = new Vector3(), qB = new Quaternion(), sB = new Vector3();
  const flightCam = new PerspectiveCamera(); // stays at the origin: everything is posed in camera space

  function render() { renderer.render(scene, flying ? flightCam : camera); }
  async function warm() { update(0, 0, null, 0, 0.016); try { await renderer.compileAsync(scene, camera); } catch { /* ignore */ } render(); }
  function degrade() { if (quality <= 0.5) return false; quality = quality > 0.75 ? 0.75 : 0.5; resize(); return true; }
  return { update, render, resize, warm, renderer, degrade, get busy() { return !!drag || hover; } };
}
