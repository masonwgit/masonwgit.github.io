import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, simplex2 } from './noise.js';
import { strata } from './materials.js';

// Bryce-style mesas: stacked, slightly shrinking slabs with sheer faceted walls.
// Zones are laid out around the view from the pavilion: open water dead ahead,
// tall stacks either side, a hazy range at the back and a few behind the pavilion.
const ZONES = [
  { n: 5, x: [-460, -140], z: [-330, -600], r: [30, 66], h: [60, 135] },
  { n: 6, x: [140, 480], z: [-300, -580], r: [30, 68], h: [75, 170] },
  { n: 4, x: [-210, -40], z: [-560, -780], r: [40, 90], h: [55, 110] },
  { n: 4, x: [60, 260], z: [-620, -820], r: [45, 95], h: [60, 120] },
  { n: 11, x: [-1300, 1300], z: [-1050, -1500], r: [70, 170], h: [50, 140] },
  { n: 5, x: [-900, -420], z: [-250, -700], r: [60, 140], h: [70, 150] },
  { n: 5, x: [420, 900], z: [-250, -700], r: [60, 140], h: [70, 160] },
  { n: 7, x: [-700, 700], z: [260, 760], r: [50, 130], h: [60, 150] },
];

function blob(rand, noise, radius, stretch, points = 34) {
  const shape = new THREE.Shape();
  const seed = rand() * 100;
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wobble = 1 + 0.2 * noise(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + seed) + 0.08 * noise(Math.cos(a) * 4 + seed, Math.sin(a) * 4 - seed);
    const r = radius * wobble;
    const x = Math.cos(a) * r * stretch;
    const y = Math.sin(a) * r / stretch;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function mesa(rand, noise, { x, z, radius, height }) {
  const parts = [];
  const stretch = 0.75 + rand() * 0.6;
  const turn = rand() * Math.PI;
  let y = -6;
  let r = radius;
  let left = height + 6;
  while (left > 2 && r > 8) {
    const slabH = Math.min(left, 9 + rand() * 22);
    const g = new THREE.ExtrudeGeometry(blob(rand, noise, r, stretch, 30 + Math.floor(rand() * 10)), {
      depth: slabH,
      bevelEnabled: false,
      curveSegments: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.rotateY(turn + (rand() - 0.5) * 0.15);
    g.translate(x + (rand() - 0.5) * r * 0.12, y, z + (rand() - 0.5) * r * 0.12);
    parts.push(g);
    y += slabH;
    left -= slabH;
    r *= 0.8 + rand() * 0.17;
  }
  return parts;
}

export function createTerrain() {
  const rand = rng(1997);
  const noise = simplex2(7);
  const parts = [];
  for (const zone of ZONES) {
    for (let i = 0; i < zone.n; i++) {
      const x = zone.x[0] + rand() * (zone.x[1] - zone.x[0]);
      const z = zone.z[0] + rand() * (zone.z[1] - zone.z[0]);
      const radius = zone.r[0] + rand() * (zone.r[1] - zone.r[0]);
      const height = zone.h[0] + Math.pow(rand(), 0.8) * (zone.h[1] - zone.h[0]);
      parts.push(...mesa(rand, noise, { x, z, radius, height }));
    }
  }
  const geo = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, strata());
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}
