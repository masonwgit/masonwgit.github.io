import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const WaterShader = {
  name: 'PavilionWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#14205f') },
    uFogColor: { value: new THREE.Color('#a9b5ea') },
    uFogDensity: { value: 0.00075 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#ffffff') },
    uDistort: { value: 1 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec3 uDeep;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform float uDistort;
    varying vec4 vUv;
    varying vec3 vWorld;

    vec2 swell(vec2 p, float t) {
      vec2 g = vec2(0.0);
      vec2 d1 = normalize(vec2(0.12, 1.0));  g += d1 * 0.016 * cos(dot(p, d1) * 0.9 - t * 1.05);
      vec2 d2 = normalize(vec2(-0.32, 1.0)); g += d2 * 0.012 * cos(dot(p, d2) * 1.8 - t * 1.5);
      vec2 d3 = normalize(vec2(0.55, 0.85)); g += d3 * 0.010 * cos(dot(p, d3) * 3.3 - t * 2.2);
      vec2 d4 = normalize(vec2(-0.8, 0.6));  g += d4 * 0.007 * cos(dot(p, d4) * 5.9 - t * 3.0);
      vec2 d5 = normalize(vec2(0.9, 0.35));  g += d5 * 0.006 * cos(dot(p, d5) * 7.7 - t * 3.6);
      vec2 d6 = normalize(vec2(-0.25, -1.0)); g += d6 * 0.005 * cos(dot(p, d6) * 10.3 - t * 4.1);
      return g;
    }

    void main() {
      vec3 toCam = cameraPosition - vWorld;
      float dist = length(toCam);
      vec3 V = toCam / dist;
      float calm = 1.0 / (1.0 + dist * 0.006);
      vec2 g = swell(vWorld.xz, uTime) * mix(0.35, 1.0, calm);
      vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

      vec4 uv = vUv;
      uv.x += g.x * 0.55 * uDistort * uv.w;
      uv.y += g.y * 1.6 * uDistort * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;

      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
      float r = mix(0.42, 0.86, fres);
      vec3 col = mix(uDeep, refl * vec3(0.6, 0.7, 1.0), r);

      vec3 H = normalize(normalize(uSunDir) + V);
      col += uSunColor * pow(max(dot(N, H), 0.0), 500.0) * 3.0;

      float f = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
      col = mix(col, uFogColor, f);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

const MirrorShader = {
  name: 'PavilionFloorMirror',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    void main() {
      vec3 base = texture2DProj(tDiffuse, vUv).rgb;
      gl_FragColor = vec4(base * color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function createWater({ width, height }) {
  const water = new Reflector(new THREE.PlaneGeometry(14000, 14000), {
    textureWidth: width,
    textureHeight: height,
    clipBias: 0.002,
    shader: WaterShader,
    multisample: 0,
  });
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = -5;

  const u = water.material.uniforms;
  function apply(look, time) {
    u.uTime.value = time;
    u.uDeep.value.copy(look.deep);
    u.uFogColor.value.copy(look.fog);
    u.uSunDir.value.copy(look.sunDir);
    u.uSunColor.value.copy(look.sunColor).multiplyScalar(look.sunIntensity * 0.5);
  }
  return { mesh: water, apply };
}

// Mirror that sits a hair under the checkerboard; the checker layer above hides itself
// while this renders so it doesn't block its own reflection.
export function createFloorMirror({ width, depth, textureWidth, textureHeight, hideDuringPass }) {
  const mirror = new Reflector(new THREE.PlaneGeometry(width, depth), {
    textureWidth,
    textureHeight,
    color: 0x9294aa,
    shader: MirrorShader,
    multisample: 0,
  });
  mirror.rotation.x = -Math.PI / 2;
  const base = mirror.onBeforeRender;
  mirror.onBeforeRender = function (renderer, scene, camera, ...rest) {
    for (const o of hideDuringPass) o.visible = false;
    base.call(this, renderer, scene, camera, ...rest);
    for (const o of hideDuringPass) o.visible = true;
  };
  return mirror;
}
