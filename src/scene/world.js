import * as THREE from 'three';
import { bakeSky, createSkyDome } from './sky.js';
import { createWater } from './water.js';
import { createTerrain } from './terrain.js';
import { createPavilion, P } from './pavilion.js';
import { createCrystal, createProps } from './props.js';
import { makeLook, mixLook } from './looks.js';
import { createPath, SHOTS } from './path.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Animates continuously: the water ripples, the crystal turns, the clouds drift and the camera
// sways a little. Visitors who ask for reduced motion (and screenshot mode) get a still scene
// that only redraws when the camera moves between sections.
export function createWorld(canvas, { reducedMotion = false, still = false, onReady, onFrame } = {}) {
  const host = canvas.parentElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: still });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  const rtScale = 0.5;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbcc8f2, 0.00075);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.25, 7000);

  // sky baked once for day and once for dusk; reflections on metal and glass come from the same bakes
  const look = makeLook();
  const dayCube = bakeSky(renderer, mixLook(makeLook(), 0));
  const duskCube = bakeSky(renderer, mixLook(makeLook(), 1));
  const sky = createSkyDome(dayCube, duskCube);
  scene.add(sky.mesh);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = [pmrem.fromCubemap(dayCube.texture).texture, pmrem.fromCubemap(duskCube.texture).texture];
  pmrem.dispose();

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(0, 0, P.midZ);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 1);
  scene.add(sun, sun.target, hemi);

  const water = createWater({ width: 256, height: 256 });
  scene.add(water.mesh);
  const pav = createPavilion({ mirrorSize: { width: 256, height: 256 } });
  scene.add(pav.group);
  const crystal = createCrystal();
  scene.add(crystal.group);
  scene.add(createProps().group);
  scene.add(createTerrain());

  const path = createPath();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  let t = 0;
  let tween = null;
  let time = 0;
  let spin = 0;
  let shadowDusk = -1;
  let raf = 0;
  let last = 0;
  let live = false;
  let readySent = false;
  const ambient = !reducedMotion && !still;

  function requestRender() {
    if (raf || !live) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    path.setAspect(camera.aspect);
    const rw = Math.round(w * dpr * rtScale);
    const rh = Math.round(h * dpr * rtScale);
    water.mesh.getRenderTarget().setSize(rw, rh);
    pav.mirror.getRenderTarget().setSize(rw, rh);
    requestRender();
  }

  function applyLook(dusk) {
    mixLook(look, dusk);
    sky.setMix(dusk);
    water.apply(look, time);
    scene.fog.color.copy(look.fog);
    sun.color.copy(look.sunColor);
    sun.intensity = look.sunIntensity;
    sun.position.copy(sun.target.position).addScaledVector(look.sunDir, 50);
    hemi.color.copy(look.hemiSky);
    hemi.groundColor.copy(look.hemiGround);
    hemi.intensity = look.hemiIntensity;
    renderer.toneMappingExposure = look.exposure;
    crystal.mesh.material.emissiveIntensity = look.glow * 1.4;
    crystal.light.intensity = look.glow * 45;
    scene.environment = dusk > 0.5 ? env[1] : env[0];
    if (Math.abs(dusk - shadowDusk) > 0.03) {
      renderer.shadowMap.needsUpdate = true;
      shadowDusk = dusk;
    }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    let moving = false;

    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.dur);
      t = tween.from + (tween.to - tween.from) * easeInOut(k);
      if (k < 1) moving = true;
      else tween = null;
    }
    if (ambient) {
      time += dt;
      crystal.mesh.rotation.y += dt * (0.32 + spin);
      spin *= Math.exp(-dt * 1.3);
      crystal.group.position.y = crystal.baseY + Math.sin(time * 0.9) * 0.07;
      sky.setRotation(time * 0.0025);
    } else {
      if (spin > 0.02) {
        crystal.mesh.rotation.y += dt * spin;
        spin *= Math.exp(-dt * 1.3);
        moving = true;
      }
      if (moving) time += dt;
    }

    const fov = path.sample(t, camPos, camLook);
    if (ambient) {
      // a slow, small sway so the view never sits dead still
      camLook.x += Math.sin(time * 0.21) * 0.35;
      camLook.y += Math.sin(time * 0.17) * 0.18;
      camPos.x += Math.sin(time * 0.13) * 0.12;
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    applyLook(smooth(3.0, path.last, t));
    renderer.render(scene, camera);
    onFrame?.({ t, moving });

    if (!readySent) {
      readySent = true;
      onReady?.();
    }
    if (moving || ambient) requestRender();
  }

  function goTo(index) {
    const to = THREE.MathUtils.clamp(index, 0, path.last);
    if (to === (tween ? tween.to : t)) return;
    if (reducedMotion) {
      tween = null;
      t = to;
    } else {
      tween = { from: t, to, start: performance.now(), dur: 1000 * Math.min(3.4, 1.2 + 0.55 * Math.abs(to - t)) };
    }
    requestRender();
  }

  // the crystal is clickable: it spins and slows to a stop
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function overCrystal(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(crystal.mesh, false).length > 0;
  }
  canvas.addEventListener('pointermove', (e) => {
    canvas.style.cursor = overCrystal(e) ? 'pointer' : '';
  });
  canvas.addEventListener('click', (e) => {
    if (!overCrystal(e)) return;
    spin = reducedMotion ? 2 : 7;
    requestRender();
  });

  // compile shaders off the main thread where the browser allows it, then start
  const compile = renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve();
  compile
    .catch(() => {})
    .then(() => {
      live = true;
      new ResizeObserver(resize).observe(host);
      resize();
    });

  return {
    goTo,
    jump(index) {
      tween = null;
      t = THREE.MathUtils.clamp(index, 0, path.last);
      requestRender();
    },
    shots: SHOTS,
    debug: {
      renderer,
      scene,
      camera,
      get t() {
        return t;
      },
    },
  };
}
