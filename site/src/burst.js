// The mid-flight burst: the case's real parts fly apart, hang and turn, then snap back together.
// A yellow and white spark splash, a shockwave ring and an inner glow go with it.
// Driven by one value (the flight's first half), so it plays forwards and backwards with scroll.
import {
  Vector3, Quaternion, Box3, BufferGeometry, BufferAttribute, Points, PointsMaterial, Sprite, SpriteMaterial,
  CanvasTexture, AdditiveBlending, PointLight, Color, MathUtils, SRGBColorSpace,
} from 'three';

const smooth = (t) => t * t * (3 - 2 * t);
const range = (v, a, b) => MathUtils.clamp((v - a) / (b - a), 0, 1);
const outCubic = (t) => 1 - Math.pow(1 - t, 3);

function dotTexture(soft) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) { g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 60, 128, 128, 127);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.72, 'rgba(255,255,255,0)');
  g.addColorStop(0.86, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export function createBurst({ meshes, centre, size, pivot, holder }) {
  // deterministic randomness so the burst looks the same every scroll
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const reach = size.length();

  // one physical part = one glTF node (multi-material nodes arrive as a group of meshes)
  const objs = [...new Set(meshes.map((o) => (o.parent && o.parent.isGroup && o.parent.children.every((c) => c.isMesh) ? o.parent : o)))];
  const parts = objs.map((m) => {
    const bb = new Box3();
    m.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox); } });
    const c = bb.getCenter(new Vector3()).applyMatrix4(m.matrix);
    const dir = c.clone().sub(centre);
    if (dir.length() < reach * 0.05) dir.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
    dir.normalize().add(new Vector3(rnd() - 0.5, rnd() * 0.6 - 0.2, rnd() - 0.5).multiplyScalar(0.7)).normalize();
    return {
      m, c, dir, dist: reach * (0.17 + rnd() * 0.2),
      axis: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), spin: (0.5 + rnd() * 1.1) * (rnd() < 0.5 ? -1 : 1),
      p0: m.position.clone(), q0: m.quaternion.clone(), ph: rnd() * 6.28,
    };
  });

  // sparks: yellow, white and steel grey, in the case's own space
  const N = 720;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const sparks = Array.from({ length: N }, (_, i) => {
    const d = new Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (d.length() < 0.05) d.set(1, 0, 0);
    d.normalize();
    const k = rnd();
    const c = k < 0.62 ? new Color(0xf5c518) : k < 0.85 ? new Color(0xffffff) : new Color(0xa9b0b9);
    col.set([c.r, c.g, c.b], i * 3);
    return { d, r: reach * (0.3 + Math.pow(rnd(), 0.6) * 0.75), sw: (rnd() - 0.5) * 1.6, ph: rnd() * 6.28 };
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const sparkMat = new PointsMaterial({ size: reach * 0.016, map: dotTexture(false), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });
  const glowMat = new PointsMaterial({ size: reach * 0.09, map: dotTexture(true), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });
  const sparkPts = new Points(geo, sparkMat);
  const glowGeo = new BufferGeometry();
  const GN = 70;
  const gpos = new Float32Array(GN * 3), gcol = new Float32Array(GN * 3);
  glowGeo.setAttribute('position', new BufferAttribute(gpos, 3));
  glowGeo.setAttribute('color', new BufferAttribute(gcol, 3));
  for (let i = 0; i < GN; i++) gcol.set([0.96, 0.77, 0.09], i * 3);
  const glowPts = new Points(glowGeo, glowMat);
  sparkPts.frustumCulled = glowPts.frustumCulled = false;
  sparkPts.visible = glowPts.visible = false;
  pivot.add(sparkPts, glowPts);

  const ring = new Sprite(new SpriteMaterial({ map: ringTexture(), color: 0xf5c518, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
  const flash = new Sprite(new SpriteMaterial({ map: dotTexture(true), color: 0xffe27a, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
  ring.visible = flash.visible = false;
  holder.add(ring, flash);
  const core = new PointLight(0xf5c518, 0, reach * 2.2, 1.6);
  pivot.add(core);

  const R = new Quaternion(), tmp = new Vector3(), rc = new Vector3();
  // a: 0..1 progress of the flight's first half
  function update(a, t) {
    const apart = smooth(range(a, 0.45, 0.64)) * (1 - smooth(range(a, 0.84, 0.98)));
    const splash = smooth(range(a, 0.46, 0.67)) * (1 - smooth(range(a, 0.82, 0.96)));

    for (const pt of parts) {
      if (apart <= 0.0001) { pt.m.position.copy(pt.p0); pt.m.quaternion.copy(pt.q0); continue; }
      const ang = (pt.spin + Math.sin(t * 0.7 + pt.ph) * 0.25) * apart;
      R.setFromAxisAngle(pt.axis, ang);
      rc.copy(pt.c).applyQuaternion(R);                       // rotate about the part's own centre
      pt.m.quaternion.copy(pt.q0).premultiply(R);
      pt.m.position.copy(pt.p0).add(tmp.copy(pt.c).sub(rc))
        .addScaledVector(pt.dir, pt.dist * outCubic(apart))
        .add(tmp.set(Math.sin(t * 0.9 + pt.ph), Math.cos(t * 0.7 + pt.ph), 0).multiplyScalar(reach * 0.012 * apart));
    }

    const on = splash > 0.002;
    sparkPts.visible = glowPts.visible = on;
    if (on) {
      const swirl = t * 0.25;
      for (let i = 0; i < N; i++) {
        const s = sparks[i];
        const r = s.r * outCubic(splash);
        const ca = Math.cos(swirl * s.sw + s.ph * 0.1), sa = Math.sin(swirl * s.sw + s.ph * 0.1);
        const x = s.d.x * ca - s.d.z * sa, z = s.d.x * sa + s.d.z * ca;
        pos[i * 3] = x * r; pos[i * 3 + 1] = s.d.y * r + Math.sin(t + s.ph) * reach * 0.01; pos[i * 3 + 2] = z * r;
        if (i < GN) { gpos[i * 3] = pos[i * 3] * 0.6; gpos[i * 3 + 1] = pos[i * 3 + 1] * 0.6; gpos[i * 3 + 2] = pos[i * 3 + 2] * 0.6; }
      }
      geo.attributes.position.needsUpdate = true;
      glowGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = Math.min(1, splash * 1.4);
      glowMat.opacity = splash * 0.5;
    }

    // shockwave as it bursts, a bright snap as it rejoins
    const rt = range(a, 0.45, 0.63);
    ring.visible = rt > 0 && rt < 1;
    if (ring.visible) { ring.scale.setScalar(reach * (0.3 + 1.9 * outCubic(rt))); ring.material.opacity = (1 - rt) * 0.85; }
    const ft = range(a, 0.92, 1.0);
    flash.visible = ft > 0 && ft < 1;
    if (flash.visible) { flash.scale.setScalar(reach * (0.9 + 0.5 * ft)); flash.material.opacity = Math.sin(ft * Math.PI) * 0.75; }
    core.intensity = 22 * apart;
    return apart;
  }
  return { update };
}
