import * as THREE from 'three';
import { marble, checker } from './materials.js';
import { createFloorMirror } from './water.js';
import { rng } from './noise.js';

export const P = {
  floorY: 0.62,
  halfW: 9.4,
  zFront: -10.4,
  zBack: 8.4,
  colX: [-7.3, -3.45, 3.45, 7.3],
  colZFront: -9.1,
  colZBack: 7.1,
  colH: 6.2,
  beamD: 1.45,
};
P.capTop = P.floorY + P.colH;
P.ceilY = P.capTop + 1.22;
P.midZ = (P.colZFront + P.colZBack) / 2;

export const MATS = {
  lilac: marble({ key: 'lilac', base: '#958fa6', cloud: '#c3bfd0', vein: '#433e58', scale: 1.4, veinFreq: 0.8, veinAmt: 0.35, mottle: 0.75, roughness: 0.34 }),
  jade: marble({ key: 'jade', base: '#2f7a5d', cloud: '#7dbb9f', vein: '#0f3d2c', scale: 0.9, veinFreq: 1.2, veinAmt: 0.75, roughness: 0.12, envMapIntensity: 1.5 }),
  white: marble({ key: 'white', base: '#e4e2ea', cloud: '#f7f6fb', vein: '#9a97af', scale: 0.7, veinFreq: 0.9, veinAmt: 0.5, roughness: 0.3 }),
};

function frame(outerW, outerZ0, outerZ1, innerW, innerZ0, innerZ1) {
  // shape y maps to world -z after rotateX(-PI/2)
  const s = new THREE.Shape();
  s.moveTo(-outerW, -outerZ1);
  s.lineTo(outerW, -outerZ1);
  s.lineTo(outerW, -outerZ0);
  s.lineTo(-outerW, -outerZ0);
  s.closePath();
  const h = new THREE.Path();
  h.moveTo(-innerW, -innerZ1);
  h.lineTo(-innerW, -innerZ0);
  h.lineTo(innerW, -innerZ0);
  h.lineTo(innerW, -innerZ1);
  h.closePath();
  s.holes.push(h);
  return s;
}

function slab(w, z0, z1) {
  const s = new THREE.Shape();
  s.moveTo(-w, -z1);
  s.lineTo(w, -z1);
  s.lineTo(w, -z0);
  s.lineTo(-w, -z0);
  s.closePath();
  return s;
}

function extrudeUp(shape, height, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 4,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

function column() {
  const g = new THREE.Group();
  const add = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const f = P.floorY;
  add(new THREE.BoxGeometry(1.26, 0.28, 1.26), MATS.white, f + 0.14);
  add(new THREE.TorusGeometry(0.55, 0.1, 14, 48).rotateX(Math.PI / 2), MATS.lilac, f + 0.38);

  const shaftBottom = f + 0.4;
  const shaftTop = f + P.colH - 0.5;
  const h = shaftTop - shaftBottom;
  const shaft = new THREE.CylinderGeometry(0.43, 0.49, h, 44, 18);
  const pos = shaft.attributes.position;
  const r = rng(5);
  const bumps = Array.from({ length: 7 }, () => [r() * 6.28, 1 + Math.floor(r() * 4), r() * 3, 0.006 + r() * 0.014]);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const rad = Math.hypot(x, z);
    if (rad < 0.01) continue;
    const a = Math.atan2(z, x);
    let d = 0;
    for (const [ph, k, fy, amp] of bumps) d += Math.sin(a * k + ph + y * fy) * amp;
    const s = (rad + d) / rad;
    pos.setX(i, x * s);
    pos.setZ(i, z * s);
  }
  shaft.computeVertexNormals();
  add(shaft, MATS.lilac, shaftBottom + h / 2);
  add(new THREE.TorusGeometry(0.46, 0.06, 12, 44).rotateX(Math.PI / 2), MATS.lilac, shaftTop);
  add(new THREE.CylinderGeometry(0.66, 0.46, 0.26, 44), MATS.lilac, shaftTop + 0.13);
  add(new THREE.BoxGeometry(1.42, 0.24, 1.42), MATS.white, shaftTop + 0.38);
  return g;
}

export function createPavilion({ mirrorSize }) {
  const group = new THREE.Group();
  const f = P.floorY;

  // stepped platform down into the water
  const steps = [
    { pad: 0.36, top: f - 0.025 },
    { pad: 0.98, top: f - 0.25 },
    { pad: 1.6, top: f - 0.47 },
  ];
  for (const s of steps) {
    const w = P.halfW + s.pad;
    const geo = extrudeUp(slab(w, P.zFront - s.pad, P.zBack + s.pad), s.top + 3, 0.03);
    const m = new THREE.Mesh(geo, MATS.white);
    m.position.y = -3;
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  }

  // checkerboard: translucent tiles over a mirror
  const floorW = P.halfW * 2;
  const floorD = P.zBack - P.zFront;
  const tiles = new THREE.Mesh(
    new THREE.PlaneGeometry(floorW, floorD).rotateX(-Math.PI / 2),
    checker({ key: 'floor', a: '#f1f2f8', b: '#0c1142', size: 1.12, alphaA: 0.95, alphaB: 0.8, grazing: 0.5, roughness: 0.14, transparent: true })
  );
  tiles.position.set(0, f, (P.zFront + P.zBack) / 2);
  tiles.receiveShadow = true;
  tiles.renderOrder = 2;

  const mirror = createFloorMirror({
    width: floorW,
    depth: floorD,
    textureWidth: mirrorSize.width,
    textureHeight: mirrorSize.height,
    hideDuringPass: [tiles],
  });
  mirror.position.set(0, f - 0.02, (P.zFront + P.zBack) / 2);
  group.add(mirror, tiles);

  // columns: front, back and two along each side
  const spots = [];
  for (const x of P.colX) spots.push([x, P.colZFront], [x, P.colZBack]);
  const gap = (P.colZBack - P.colZFront) / 3;
  for (const x of [P.colX[0], P.colX[3]]) {
    spots.push([x, P.colZFront + gap], [x, P.colZFront + gap * 2]);
  }
  const proto = column();
  for (const [x, z] of spots) {
    const c = proto.clone();
    c.position.set(x, 0, z);
    group.add(c);
  }

  // entablature: jade architrave, frieze and cornice, then a white roof slab
  const ox = P.colX[3];
  const hd = P.beamD / 2;
  // og/ig = how far the band reaches past the column line on the outside/inside
  const layers = [
    { og: 0, ig: 0, h: 0.62, mat: MATS.jade, bevel: 0.05 },
    { og: -0.07, ig: -0.07, h: 0.38, mat: MATS.jade, bevel: 0.03 },
    { og: 0.26, ig: 0.1, h: 0.26, mat: MATS.jade, bevel: 0.09 },
  ];
  let y = P.capTop;
  for (const l of layers) {
    const geo = extrudeUp(
      frame(
        ox + hd + l.og, P.colZFront - hd - l.og, P.colZBack + hd + l.og,
        ox - hd - l.ig, P.colZFront + hd + l.ig, P.colZBack - hd - l.ig
      ),
      l.h,
      l.bevel
    );
    const m = new THREE.Mesh(geo, l.mat);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    y += l.h;
  }
  const roof = new THREE.Mesh(extrudeUp(slab(ox + hd + 0.42, P.colZFront - hd - 0.42, P.colZBack + hd + 0.42), 0.5, 0.06), MATS.white);
  roof.position.y = y;
  roof.castShadow = true;
  group.add(roof);
  const attic = new THREE.Mesh(extrudeUp(slab(ox + hd - 0.3, P.colZFront - hd + 0.3, P.colZBack + hd - 0.3), 0.32, 0.05), MATS.white);
  attic.position.y = y + 0.46;
  attic.castShadow = true;
  group.add(attic);

  // recessed checkerboard ceiling
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry((ox - hd) * 2, P.colZBack - P.colZFront - P.beamD).rotateX(Math.PI / 2),
    checker({ key: 'ceiling', a: '#ebeaf2', b: '#16161f', size: 0.62, roughness: 0.4, emissive: 0.22 })
  );
  ceil.position.set(0, P.ceilY, P.midZ);
  ceil.receiveShadow = true;
  group.add(ceil);

  return { group, mirror, tiles };
}
