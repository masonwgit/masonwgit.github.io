import * as THREE from 'three';
import { NOISE } from './glsl.js';

// Patch a MeshStandardMaterial with world/object position varyings and a colour hook.
function patch(mat, { key, uniforms = {}, fragmentPre = '', fragmentColor = '', fragmentRough = '', fragmentEmissive = '' }) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vPvWorld;\nvarying vec3 vPvObj;\nvarying vec3 vPvNormal;'
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vPvObj = transformed;
        vPvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vPvNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vPvWorld;
        varying vec3 vPvObj;
        varying vec3 vPvNormal;
        ${NOISE}
        ${fragmentPre}`
      )
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fragmentColor}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${fragmentRough}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${fragmentEmissive}`);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

const col = (c) => ({ value: new THREE.Color(c) });

// Solid (3D) marble, so columns and beams never show a texture seam.
export function marble({ key, base, cloud, vein, scale = 1, veinFreq = 1, veinAmt = 0.85, mottle = 0, roughness = 0.3, envMapIntensity = 1 }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0, envMapIntensity });
  return patch(mat, {
    key: 'marble-' + key,
    uniforms: {
      uBase: col(base), uCloud: col(cloud), uVein: col(vein),
      uScale: { value: scale }, uVeinFreq: { value: veinFreq }, uVeinAmt: { value: veinAmt }, uMottle: { value: mottle },
    },
    fragmentPre: `uniform vec3 uBase; uniform vec3 uCloud; uniform vec3 uVein;
      uniform float uScale; uniform float uVeinFreq; uniform float uVeinAmt; uniform float uMottle;`,
    fragmentColor: `
      vec3 mp = vPvWorld * uScale;
      float turb = pv_fbm2(mp * 0.7);
      float v = abs(sin((mp.y * 0.8 + mp.x * 0.45 + mp.z * 0.3) * uVeinFreq + turb * 6.5));
      float vein = pow(1.0 - v, 10.0);
      float cl = pv_snoise(mp * 1.6 + 4.3) * 0.5 + 0.5;
      vec3 mc = mix(uBase, uCloud, smoothstep(0.3, 0.85, cl));
      float speck = smoothstep(0.45, 0.8, pv_snoise(mp * 7.0)) * uMottle;
      mc = mix(mc, uVein, clamp(vein * uVeinAmt + speck * 0.55, 0.0, 1.0));
      diffuseColor.rgb = mc;
    `,
  });
}

// Checkerboard in world XZ. Used for the floor (translucent over a mirror) and the ceiling.
// On the floor the tiles turn more see-through at grazing angles, so the mirror shows
// through like a glossy finish (Fresnel) instead of a flat wash.
export function checker({ key, a, b, size, alphaA = 1, alphaB = 1, grazing = 1, roughness = 0.2, transparent = false, emissive = 0 }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0, transparent });
  if (transparent) {
    mat.depthWrite = false;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -2;
  }
  return patch(mat, {
    key: 'checker-' + key,
    uniforms: {
      uA: col(a), uB: col(b), uSize: { value: size },
      uAlphaA: { value: alphaA }, uAlphaB: { value: alphaB }, uGrazing: { value: grazing }, uSelfLit: { value: emissive },
    },
    fragmentPre: `uniform vec3 uA; uniform vec3 uB; uniform float uSize; uniform float uAlphaA; uniform float uAlphaB; uniform float uGrazing; uniform float uSelfLit;`,
    fragmentColor: `
      float ck = pv_checker(vPvWorld.xz / uSize);
      diffuseColor.rgb = mix(uA, uB, ck);
      float tileAlpha = mix(uAlphaA, uAlphaB, ck);
      float fres = pow(1.0 - clamp(normalize(cameraPosition - vPvWorld).y, 0.0, 1.0), 3.0);
      diffuseColor.a *= mix(tileAlpha, tileAlpha * uGrazing, fres * mix(0.45, 1.0, ck));
    `,
    fragmentEmissive: 'totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;',
  });
}

// Gold with a faint checker, as if it were mirroring the floor.
export function gildedChecker({ key, size = 0.25 }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.24 });
  return patch(mat, {
    key: 'gilt-' + key,
    uniforms: { uSize: { value: size } },
    fragmentPre: 'uniform float uSize;',
    fragmentColor: `
      vec3 q = floor(vPvObj / uSize + 0.0001);
      float ck = mod(q.x + q.y + q.z, 2.0);
      diffuseColor.rgb = mix(vec3(0.83, 0.62, 0.22), vec3(0.32, 0.22, 0.07), ck * 0.85);
    `,
  });
}

// Stratified white cliffs: horizontal bands by height, vertical fluting on steep faces, moss on flat tops.
export function strata() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, envMapIntensity: 0.6 });
  return patch(mat, {
    key: 'strata',
    fragmentColor: `
      vec3 p = vPvWorld;
      vec3 n = normalize(vPvNormal);
      float warp = pv_snoise(vec3(p.xz * 0.012, 1.7)) * 3.0;
      float b = p.y * 0.2 + warp;
      float band = fract(b);
      float bandId = floor(b);
      float tone = pv_hash(bandId * 1.37 + 0.5);
      vec3 cHi = vec3(0.95, 0.95, 0.97);
      vec3 cMid = vec3(0.83, 0.84, 0.89);
      vec3 c = mix(cMid, cHi, tone);
      c *= 0.8 + 0.2 * smoothstep(0.0, 0.45, band);
      float steep = 1.0 - smoothstep(0.45, 0.8, n.y);
      float wx = n.x * n.x / (n.x * n.x + n.z * n.z + 1e-4);
      float along = mix(p.x, p.z, wx);
      float flute = 1.0 - abs(pv_snoise(vec3(along * 0.07, p.y * 0.006, 3.1)));
      float flute2 = pv_snoise(vec3(along * 0.9, p.y * 0.03 + bandId * 0.7, 9.4)) * 0.5 + 0.5;
      float streaks = smoothstep(0.55, 0.95, flute) * 0.55 + smoothstep(0.45, 0.85, flute2) * 0.45 * tone;
      c *= mix(1.0, 1.0 - 0.3 * streaks, steep);
      float topness = smoothstep(0.72, 0.93, n.y);
      float mossN = pv_snoise(vec3(p.xz * 0.045, 7.0)) * 0.5 + 0.5;
      vec3 moss = mix(vec3(0.13, 0.3, 0.16), vec3(0.36, 0.55, 0.24), mossN);
      c = mix(c, moss, topness * smoothstep(0.3, 0.55, mossN));
      c *= mix(0.5, 1.0, smoothstep(-1.0, 7.0, p.y));
      diffuseColor.rgb = c;
    `,
  });
}

export function gold({ roughness = 0.18 } = {}) {
  return new THREE.MeshStandardMaterial({ color: '#ecbf58', metalness: 0.85, roughness, envMapIntensity: 1.6 });
}
