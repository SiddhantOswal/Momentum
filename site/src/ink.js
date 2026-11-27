// Background ink, independent of the 3D object. Three brush ribbons wander on their own paths and a
// fourth follows the pointer. Each ribbon is a chain of tapered capsules; ribbons and droplets are
// blended with a smooth minimum, so where they meet they pool together like liquid instead of
// overlapping as hard shapes. Ribbons thin away and swell back, and shed droplets from their tails.
// One fullscreen fragment shader on a reduced-resolution buffer; the soft edge hides the upscale.

const NR = 4, NP = 16, ND = 8;

const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FS = (deriv) => `${deriv ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1' : ''}
precision highp float;
uniform vec2 uRes;
uniform float uTime, uAlpha, uSoft, uK;
uniform vec3 uP[${NR * NP}];
uniform vec3 uD[${ND}];
uniform vec3 uInk;
float sdSeg(vec2 p, vec3 a, vec3 b){
  vec2 pa = p - a.xy, ba = b.xy - a.xy;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);
  return length(pa - ba * h) - mix(a.z, b.z, h);
}
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
vec2 warp(vec2 p){
  // slow layered flow so the edges drift like liquid, never vector-perfect
  p += vec2(sin(p.y * 6.0 + uTime * 0.6), cos(p.x * 5.0 - uTime * 0.5)) * 0.0045;
  p += vec2(sin(p.y * 13.0 - uTime * 0.9 + p.x * 3.0), cos(p.x * 11.0 + uTime * 0.7)) * 0.0022;
  return p;
}
float field(vec2 p){
  float d = 1e3;
  for (int r = 0; r < ${NR}; r++) {
    float dr = 1e3;
    for (int i = 0; i < ${NP - 1}; i++) dr = min(dr, sdSeg(p, uP[r * ${NP} + i], uP[r * ${NP} + i + 1]));
    d = smin(d, dr, uK);
  }
  for (int i = 0; i < ${ND}; i++) d = smin(d, length(p - uD[i].xy) - uD[i].z, uK * 0.8);
  return d;
}
void main(){
  vec2 p = warp(gl_FragCoord.xy / uRes.y);
  float d = field(p);
  if (d > uSoft * 2.0) { gl_FragColor = vec4(0.0); return; }
  float a = (1.0 - smoothstep(-uSoft, uSoft, d)) * uAlpha;
  // surface: treat the ink as a shallow glossy tube; normal from the distance field's slope
#ifdef HAS_DERIV
  vec2 g = vec2(dFdx(d), dFdy(d)) * uRes.y;   // slope of the field, from neighbouring pixels: one evaluation, not three
#else
  vec2 g = vec2(0.0);
#endif
  float edge = 1.0 - smoothstep(0.0, 0.016, -d); // flat crown, curved shoulders: no seam down the middle
  vec3 n = normalize(vec3(g * edge * 1.15, 1.0 - edge * 0.55));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.7));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 16.0);
  float inside = smoothstep(0.0, 3.5 / uRes.y, -d); // keep the sheen off the outline so edges stay crisp
  float sheen = pow(edge, 2.2) * inside;
  // subtle cool gradient that drifts through the body, strongest toward the rims
  float m = 0.5 + 0.5 * sin(p.x * 3.1 + p.y * 2.3 + uTime * 0.25);
  vec3 cyber = mix(vec3(0.20, 0.15, 0.40), vec3(0.05, 0.30, 0.36), m);
  vec3 col = uInk + cyber * (0.05 + 0.26 * sheen) + vec3(0.85, 0.9, 1.0) * spec * 0.22 * inside;
  gl_FragColor = vec4(col * a, a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('ink shader:', gl.getShaderInfoLog(s)); return null; }
  return s;
}

export function createInk(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  // glossy version where the GPU supports derivatives, flat ink otherwise: the strokes always render
  const vs = compile(gl, gl.VERTEX_SHADER, VS);
  if (!vs) return null;
  let prog = null;
  for (const deriv of [Boolean(gl.getExtension('OES_standard_derivatives')), false]) {
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS(deriv));
    if (!fs) continue;
    const pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (gl.getProgramParameter(pr, gl.LINK_STATUS)) { prog = pr; break; }
    console.warn('ink program:', gl.getProgramInfoLog(pr));
  }
  if (!prog) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uTime = U('uTime'), uAlpha = U('uAlpha'), uSoft = U('uSoft'), uK = U('uK'), uP = U('uP'), uD = U('uD');
  gl.uniform3f(U('uInk'), 0.043, 0.051, 0.063); // #0b0d10

  const P = new Float32Array(NR * NP * 3).fill(-10);
  const Dd = new Float32Array(ND * 3).fill(-10);
  for (let i = 2; i < Dd.length; i += 3) Dd[i] = 0;
  for (let i = 2; i < P.length; i += 3) P[i] = 0;

  // ribbon definitions: wandering paths in 0..1 viewport space, width as a fraction of height
  const ribbons = [
    { auto: true, w: 0.125, L: 1.6, sp: 0.07, ax: 0.48, ay: 0.34, fx: [0.61, 0.23], fy: [0.47, 0.31], ph: 0.0, life: 0.11 },
    { auto: true, w: 0.092, L: 1.3, sp: 0.095, ax: 0.47, ay: 0.38, fx: [0.43, 0.29], fy: [0.71, 0.17], ph: 2.1, life: 0.083 },
    { auto: true, w: 0.062, L: 1.0, sp: 0.12, ax: 0.46, ay: 0.4, fx: [0.83, 0.37], fy: [0.53, 0.27], ph: 4.4, life: 0.137 },
    { auto: false, w: 0.07, L: 0.55 },
  ].map((r) => ({ ...r, pts: [], x: 0, y: 0, init: false, show: r.auto ? 1 : 0, shed: 1 }));
  const drops = Array.from({ length: ND }, () => ({ x: -10, y: -10, r0: 0, vx: 0, vy: 0, age: 9, life: 1 }));
  let nextDrop = 0;

  let W = 2, H = 2, aspect = 1, thick = 1;
  function resize() {
    // ~0.85 buffer px per CSS px on standard screens, ~1.06 on retina: crisp edges at a sane cost
    const k = Math.min(window.devicePixelRatio || 1, 1.25) * 0.85;
    const w = Math.max(2, Math.floor(canvas.clientWidth * k));
    const h = Math.max(2, Math.floor(canvas.clientHeight * k));
    if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; }
    aspect = W / H;
    thick = Math.min(1, Math.max(0.6, aspect / 1.2)); // narrower strokes on tall phone screens
    gl.viewport(0, 0, W, H);
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uSoft, 1.05 / H);  // about one pixel of anti-aliasing: smooth, not blurry
    gl.uniform1f(uK, 0.08);         // how far apart two ribbons start to pool together
  }
  resize();

  function path(b, t) {
    const T = t * b.sp * 6.2832;
    return {
      x: 0.5 + b.ax * (0.72 * Math.sin(T * b.fx[0] * 2.3 + b.ph) + 0.28 * Math.sin(T * b.fx[1] * 5.1 + b.ph * 1.7)),
      y: 0.5 + b.ay * (0.7 * Math.sin(T * b.fy[0] * 2.9 + b.ph * 0.6) + 0.3 * Math.cos(T * b.fy[1] * 4.3 + b.ph)),
    };
  }

  const NIB = -0.62;
  let alpha = 1;
  function update(dt, t, pointer, live, fade = 1, intro = 1) {
    alpha = fade;
    const step = 0.006;
    ribbons.forEach((b, ri) => {
      let tx, ty, env;
      if (b.auto) {
        const q = path(b, t); tx = q.x * aspect; ty = 1 - q.y;
        // breathing: each ribbon swells and slims a little, but never disappears
        const s = 0.5 + 0.5 * Math.sin(t * b.life * 6.2832 + b.ph * 3.1);
        env = (0.68 + 0.32 * s) * intro;
      } else {
        b.show += ((live ? 1 : 0) - b.show) * (1 - Math.exp(-dt * (live ? 5 : 1.4)));
        tx = pointer.x * aspect; ty = 1 - pointer.y; env = b.show;
      }
      if (!b.init) {
        b.x = tx; b.y = ty; b.init = true;
        if (b.auto) { // lay down the trail it would already have, so strokes are full length from the first frame
          const back = [];
          let acc = 0, px = tx, py = ty;
          for (let k = 1; k < 3000 && acc < b.L * 1.05; k++) {
            const q = path(b, t - k / 60), qx = q.x * aspect, qy = 1 - q.y;
            acc += Math.hypot(qx - px, qy - py); px = qx; py = qy;
            back.push({ x: qx, y: qy });
          }
          b.pts = back.reverse();
        }
      }
      const k = b.auto ? 1 : 1 - Math.exp(-dt * 12);
      b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
      const last = b.pts[b.pts.length - 1];
      if (!last || Math.hypot(b.x - last.x, b.y - last.y) > step) b.pts.push({ x: b.x, y: b.y });
      const maxL = b.L * Math.max(0.05, env);
      let acc = 0;
      for (let i = b.pts.length - 1; i > 0; i--) {
        acc += Math.hypot(b.pts[i].x - b.pts[i - 1].x, b.pts[i].y - b.pts[i - 1].y);
        if (acc > maxL) { b.pts.splice(0, i); break; }
      }
      const pts = b.pts, n = pts.length, base = ri * NP * 3;
      if (n < 3 || env < 0.02) { for (let i = 0; i < NP; i++) { P[base + i * 3] = -10; P[base + i * 3 + 2] = 0; } return; }
      // resample along arc length into NP capsules
      const cum = [0];
      for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      const total = cum[n - 1];
      let j = 0;
      for (let i = 0; i < NP; i++) {
        const s = i / (NP - 1), target = s * total;
        while (j < n - 2 && cum[j + 1] < target) j++;
        const seg = Math.max(1e-6, cum[j + 1] - cum[j]), f = Math.min(1, (target - cum[j]) / seg);
        const x = pts[j].x + (pts[j + 1].x - pts[j].x) * f, y = pts[j].y + (pts[j + 1].y - pts[j].y) * f;
        const dx = pts[j + 1].x - pts[j].x, dy = pts[j + 1].y - pts[j].y;
        const nib = 0.5 + 0.5 * Math.abs(Math.sin(Math.atan2(dy, dx) - NIB));
        const taper = Math.pow(Math.sin(Math.min(1, s * 1.05) * Math.PI * 0.5), 1.6) * (s > 0.94 ? 0.75 + 0.25 * Math.sqrt((1 - s) / 0.06) : 1);
        P[base + i * 3] = x; P[base + i * 3 + 1] = y; P[base + i * 3 + 2] = 0.5 * b.w * thick * taper * nib * Math.min(1, env * 1.4);
      }
      // shed a droplet from the tail now and then
      if (b.auto) {
        b.shed -= dt;
        if (b.shed <= 0 && env > 0.5) {
          b.shed = 1.6 + Math.random() * 2.2;
          const d = drops[nextDrop]; nextDrop = (nextDrop + 1) % ND;
          const i = 3;
          d.x = P[base + i * 3]; d.y = P[base + i * 3 + 1];
          d.r0 = b.w * (0.18 + Math.random() * 0.14);
          d.vx = (P[base + i * 3] - P[base]) * 0.25 + (Math.random() - 0.5) * 0.02;
          d.vy = (P[base + i * 3 + 1] - P[base + 1]) * 0.25 - 0.01;
          d.age = 0; d.life = 1.8 + Math.random() * 1.4;
        }
      }
    });
    drops.forEach((d, i) => {
      d.age += dt;
      const u = d.age / d.life;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= Math.exp(-dt * 0.8); d.vy *= Math.exp(-dt * 0.8);
      const r = u >= 1 ? 0 : d.r0 * Math.sin(Math.min(1, u * 4) * Math.PI * 0.5) * (1 - u * u);
      Dd[i * 3] = r > 0 ? d.x : -10; Dd[i * 3 + 1] = d.y; Dd[i * 3 + 2] = r;
    });
  }

  function render(t) {
    gl.uniform1f(uTime, t);
    gl.uniform1f(uAlpha, alpha);
    gl.uniform3fv(uP, P);
    gl.uniform3fv(uD, Dd);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { update, render, resize };
}
