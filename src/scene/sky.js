import * as THREE from 'three';
import { NOISE } from './glsl.js';

// The procedural sky is expensive (cloud noise per pixel), so it's baked into a cube
// map once per time of day and the dome drawn each frame just looks it up.
const BAKE_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uHorizonSun;
  uniform vec3 uSea;
  uniform vec3 uCloud;
  uniform vec3 uCloudShade;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vDir;
  ${NOISE}
  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 sun = normalize(uSunDir);
    float side = pow(max(dot(normalize(d.xz + 1e-5), normalize(sun.xz + 1e-5)), 0.0), 3.0);
    vec3 horizon = mix(uHorizon, uHorizonSun, side * smoothstep(0.45, 0.0, y));
    vec3 col = mix(horizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.5));
    if (y > 0.0) {
      vec2 uv = d.xz / (y + 0.1) * 1.3;
      float n = pv_fbm(vec3(uv.x * 0.42, uv.y * 1.7, 0.3));
      float n2 = pv_fbm(vec3(uv * 2.6, 2.0));
      float c = smoothstep(0.08, 0.6, n + n2 * 0.3);
      c *= smoothstep(0.0, 0.07, y) * (1.0 - smoothstep(0.32, 0.75, y));
      vec3 cc = mix(uCloudShade, uCloud, smoothstep(-0.25, 0.55, n2 + side * 0.3));
      col = mix(col, cc, c * 0.8);
    } else {
      col = mix(horizon, uSea, smoothstep(0.0, -0.15, y));
    }
    float s = max(dot(d, sun), 0.0);
    col += uSunColor * (pow(s, 1200.0) * 8.0 + pow(s, 40.0) * 0.2 + pow(s, 5.0) * 0.07);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function bakeSky(renderer, look, size = 512) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: look.zenith },
      uHorizon: { value: look.horizon },
      uHorizonSun: { value: look.horizonSun },
      uSea: { value: look.sea },
      uCloud: { value: look.cloud },
      uCloudShade: { value: look.cloudShade },
      uSunDir: { value: look.sunDir },
      uSunColor: { value: look.sunColor },
    },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: BAKE_FRAG,
  });
  const geometry = new THREE.SphereGeometry(10, 64, 32);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  new THREE.CubeCamera(0.1, 100, target).update(renderer, scene);
  material.dispose();
  geometry.dispose();
  return target;
}

export function createSkyDome(dayCube, duskCube) {
  const uniforms = {
    uDay: { value: dayCube.texture },
    uDusk: { value: duskCube.texture },
    uMix: { value: 0 },
    uRot: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // pinned to the far plane so the reflectors' oblique clip planes never cut it
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform samplerCube uDay;
      uniform samplerCube uDusk;
      uniform float uMix;
      uniform float uRot;
      varying vec3 vDir;
      void main() {
        vec3 d0 = normalize(vDir);
        float cr = cos(uRot);
        float sr = sin(uRot);
        vec3 d = vec3(cr * d0.x - sr * d0.z, d0.y, sr * d0.x + cr * d0.z);
        gl_FragColor = vec4(mix(textureCube(uDay, d).rgb, textureCube(uDusk, d).rgb, uMix), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4500, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.onBeforeRender = (renderer, scene, cam) => {
    mesh.position.setFromMatrixPosition(cam.matrixWorld);
    mesh.updateMatrixWorld();
  };
  return {
    mesh,
    setMix: (v) => (uniforms.uMix.value = v),
    setRotation: (v) => (uniforms.uRot.value = v),
  };
}
