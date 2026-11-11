import * as THREE from 'three';
import { P, MATS } from './pavilion.js';
import { gold, gildedChecker, marble } from './materials.js';
import { rng } from './noise.js';

const V2 = THREE.Vector2;

export function createCrystal() {
  const pts = [new V2(0, 0.62), new V2(0.4, 0.62), new V2(0.74, 0.35), new V2(0.74, 0.27), new V2(0, -0.98)];
  const geo = new THREE.LatheGeometry(pts, 8);
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#2b3a8f',
    metalness: 0.45,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 1,
    iridescenceIOR: 1.9,
    iridescenceThicknessMinimum: 120,
    iridescenceThicknessMaximum: 820,
    envMapIntensity: 3.2,
    flatShading: true,
    emissive: '#4c63ff',
    emissiveIntensity: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mesh);
  group.position.set(0, P.ceilY - 1.95, -2.6);
  const light = new THREE.PointLight('#a4b3ff', 0, 34, 2);
  group.add(light);
  return { group, mesh, light, baseY: group.position.y };
}

function leafGeometry(len, width, curl, segs = 12) {
  const verts = [];
  const index = [];
  let cy = 0;
  let cz = 0;
  const ds = len / segs;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const th = curl * t * t;
    if (i > 0) {
      cy += Math.cos(th) * ds;
      cz += Math.sin(th) * ds;
    }
    const w = width * Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.6))) * (1 - 0.3 * t) + 0.004;
    // surface normal of the ribbon, used to fold the edges back into a V
    const ny = -Math.sin(th);
    const nz = Math.cos(th);
    const fold = w * 0.42;
    verts.push(-w, cy - ny * fold, cz - nz * fold);
    verts.push(0, cy, cz);
    verts.push(w, cy - ny * fold, cz - nz * fold);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 3;
    const b = a + 3;
    index.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function plant() {
  const group = new THREE.Group();
  const r = rng(42);
  const greens = ['#2e7a39', '#3c9045', '#235f2d', '#4a9a4c'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, side: THREE.DoubleSide }));
  const reds = ['#8a2638', '#a8384a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, side: THREE.DoubleSide }));
  const count = 24;
  for (let i = 0; i < count; i++) {
    const red = i % 6 === 2;
    const len = 1.35 + r() * 1.05;
    const leaf = new THREE.Mesh(leafGeometry(len, 0.075 + r() * 0.04, 0.9 + r() * 1.5), red ? reds[i % 2] : greens[i % 4]);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = (i / count) * Math.PI * 2 + r() * 0.5;
    leaf.rotation.x = 0.1 + r() * 0.35;
    leaf.position.set((r() - 0.5) * 0.18, 0, (r() - 0.5) * 0.18);
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

export function createProps() {
  const group = new THREE.Group();
  const f = P.floorY;

  // gilded planter with a plant, front left
  const planter = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.05, 1.0), gildedChecker({ key: 'planter', size: 0.25 }));
  box.position.y = 0.525;
  box.castShadow = true;
  box.receiveShadow = true;
  const soil = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.02, 0.88), new THREE.MeshStandardMaterial({ color: '#2b2118', roughness: 1 }));
  soil.position.y = 1.0;
  const leaves = plant();
  leaves.position.y = 0.98;
  planter.add(box, soil, leaves);
  planter.position.set(-5.35, f, -6.7);
  planter.scale.setScalar(1.15);
  planter.rotation.y = 0.18;
  group.add(planter);

  // round table with a gold bowl, front right
  const table = new THREE.Group();
  const stone = marble({ key: 'granite', base: '#9d9cab', cloud: '#c9c8d4', vein: '#4d4b5e', scale: 3.2, veinFreq: 0.6, veinAmt: 0.25, mottle: 1, roughness: 0.22 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.1, 72), stone);
  top.position.y = 1.02;
  const ped = new THREE.Mesh(
    new THREE.LatheGeometry([new V2(0.001, 0), new V2(0.5, 0), new V2(0.5, 0.05), new V2(0.16, 0.12), new V2(0.09, 0.3), new V2(0.085, 0.55), new V2(0.17, 0.64), new V2(0.09, 0.74), new V2(0.11, 0.92), new V2(0.3, 0.97), new V2(0.001, 0.97)], 48),
    gold({ roughness: 0.2 })
  );
  const bowlPts = [new V2(0.001, 0.0), new V2(0.2, 0.0), new V2(0.22, 0.04)];
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    bowlPts.push(new V2(0.22 + Math.sin(a) * 0.38, 0.04 + (1 - Math.cos(a)) * 0.3));
  }
  bowlPts.push(new V2(0.62, 0.345), new V2(0.585, 0.35));
  for (let i = 12; i >= 0; i--) {
    const a = (i / 12) * (Math.PI / 2);
    bowlPts.push(new V2(0.001 + Math.sin(a) * 0.575, 0.08 + (1 - Math.cos(a)) * 0.265));
  }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 64), new THREE.MeshStandardMaterial({ color: '#f2c45e', metalness: 0.6, roughness: 0.32, envMapIntensity: 1.5, side: THREE.DoubleSide }));
  bowl.position.y = 1.07;
  for (const m of [top, ped, bowl]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  table.add(top, ped, bowl);
  table.position.set(5.25, f, -6.2);
  table.scale.setScalar(1.22);
  group.add(table);

  return { group };
}

export { MATS };
