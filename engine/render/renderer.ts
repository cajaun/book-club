// gpu renderer setup, webgpu where available and webgl2 everywhere else

import * as THREE from "three/webgpu";

export type Renderer = THREE.WebGPURenderer;

export async function createRenderer(canvas: HTMLCanvasElement, forceWebGL: boolean, onLost: () => void): Promise<Renderer> {
  const r = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL });
  await r.init();
  r.setClearColor(0x000000, 0);
  // neutral tone mapping stays close to identity for the 0.9x lit book faces and only rolls off bright cream
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.0;
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  (r as unknown as { onDeviceLost: () => void }).onDeviceLost = onLost;
  canvas.addEventListener("webglcontextlost", onLost);
  return r;
}

export const backendName = (r: Renderer) => ((r.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL2");

// phone screens show the same image dimmer than a desktop monitor so they get more exposure
export const exposureFor = (w: number, h: number) => (Math.min(w, h) < 600 ? 2.0 : 1.0);

// compiles a scene's pipelines ahead of time, renders once where compileAsync is missing
export async function precompile(r: Renderer, scene: THREE.Scene, camera: THREE.Camera) {
  const c = r as unknown as { compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<void> };
  if (c.compileAsync) await c.compileAsync(scene, camera);
  else r.render(scene, camera);
}

export function canvasTexture(c: HTMLCanvasElement, flipY = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = flipY;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
