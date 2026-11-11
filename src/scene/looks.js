import * as THREE from 'three';

// Two times of day. Scrolling to the end of the page drifts from DAY to DUSK.
const DAY = {
  zenith: '#203cc4',
  horizon: '#b7c4f3',
  horizonSun: '#d4dcfa',
  sea: '#1b2766',
  cloud: '#ffffff',
  cloudShade: '#97a1d8',
  fog: '#bcc8f2',
  sunColor: '#fff1dc',
  sunIntensity: 3.6,
  sunDir: [-0.46, 0.6, 0.66],
  hemiSky: '#d3d8f4',
  hemiGround: '#3a3c58',
  hemiIntensity: 0.62,
  deep: '#14205f',
  exposure: 0.96,
  glow: 0,
};

const DUSK = {
  zenith: '#1a1c58',
  horizon: '#a493cf',
  horizonSun: '#ffad73',
  sea: '#17173f',
  cloud: '#ffcfae',
  cloudShade: '#6e5c99',
  fog: '#b59fce',
  sunColor: '#ffae63',
  sunIntensity: 2.3,
  sunDir: [-0.22, 0.1, -0.97],
  hemiSky: '#a092d6',
  hemiGround: '#251f3e',
  hemiIntensity: 0.75,
  deep: '#15153f',
  exposure: 1.05,
  glow: 1,
};

function compile(look) {
  const out = {};
  for (const [k, v] of Object.entries(look)) {
    if (typeof v === 'string') out[k] = new THREE.Color(v);
    else if (Array.isArray(v)) out[k] = new THREE.Vector3(...v).normalize();
    else out[k] = v;
  }
  return out;
}

const A = compile(DAY);
const B = compile(DUSK);

export function makeLook() {
  return compile(DAY);
}

export function mixLook(target, t) {
  for (const k of Object.keys(A)) {
    const a = A[k];
    const b = B[k];
    if (a.isColor) target[k].copy(a).lerp(b, t);
    else if (a.isVector3) target[k].copy(a).lerp(b, t).normalize();
    else target[k] = a + (b - a) * t;
  }
  return target;
}
