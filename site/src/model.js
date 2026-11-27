// Loads the M-01 case once and shares it. The model is inlined into the page, so it is decoded here
// without fetch() and textures are read through <img> (blob: URLs), which strict sandboxes allow.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import caseURL from './model/m01.glb?url';

let promise = null;

function toBuffer(uri) {
  const b64 = uri.slice(uri.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function loadCase() {
  if (promise) return promise;
  promise = (async () => {
    const buf = caseURL.startsWith('data:') ? toBuffer(caseURL) : await (await fetch(caseURL)).arrayBuffer();
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      // GLTFLoader picks ImageBitmapLoader (which uses fetch) when createImageBitmap exists.
      // Hide it for the moment the parser is constructed so textures load through plain <img>.
      const cib = window.createImageBitmap;
      try { window.createImageBitmap = undefined; } catch { /* read-only: fine */ }
      try { loader.parse(buf, '', resolve, reject); }
      finally { try { window.createImageBitmap = cib; } catch { /* ignore */ } }
    });
  })();
  return promise;
}
