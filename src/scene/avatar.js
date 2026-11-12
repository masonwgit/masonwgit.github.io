import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Mason as a low-poly game character, built from code like a PSP-era model: rigid parts on a
// small skeleton, a painted face texture, flat shading. Arm poses are written as hand positions
// and solved with two-bone IK, so the idle, wave and gesture poses stay easy to tweak.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const spow = (v, n) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);
const gauss = (v, m, s) => Math.exp(-((v - m) ** 2) / (2 * s * s));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// colours taken from his pitch photos: olive skin, near-black hair, charcoal overcoat over a
// pale blue pinstripe shirt, silver chain
const SKIN = '#c78f69';
const COL = {
  hair: '#1a1411',
  coat: '#22252f',
  lapel: '#2b2f3b',
  edge: '#14161c',
  collar: '#dfe6f3',
  trousers: '#262832',
  shoe: '#15161b',
  silver: '#e2e6ef',
  button: '#101116',
};

/* ---------- shape helpers ---------- */

function lerpRing(a, b, k) {
  const L = (p, d = 0) => (a[p] ?? d) + ((b[p] ?? d) - (a[p] ?? d)) * k;
  return { y: L('y'), hw: L('hw'), fd: L('fd'), bd: L('bd'), cx: L('cx'), cz: L('cz'), n: L('n', 2) };
}
function ringAt(rings, y) {
  if (y <= rings[0].y) return lerpRing(rings[0], rings[0], 0);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    if (y <= b.y) return lerpRing(a, b, (y - a.y) / (b.y - a.y));
  }
  const l = rings[rings.length - 1];
  return lerpRing(l, l, 0);
}
// a ring is a superellipse: half width hw, front depth fd, back depth bd; theta 0 faces +z
function ringXZ(r, th, n = 2) {
  const e = r.n ?? n;
  const s = Math.sin(th);
  const c = Math.cos(th);
  return [(r.cx ?? 0) + r.hw * spow(s, e), (r.cz ?? 0) + (c >= 0 ? r.fd : r.bd) * spow(c, e)];
}
// z of the front surface at (x, y), used to lay lapels and the shirt onto the coat
function frontZ(rings, x, y) {
  const r = ringAt(rings, y);
  const e = r.n || 2;
  const s = clamp(Math.abs(x - r.cx) / Math.max(r.hw, 1e-5), 0, 1);
  const sn = Math.pow(s, e / 2);
  const cs = Math.sqrt(Math.max(0, 1 - sn * sn));
  return r.cz + r.fd * Math.pow(cs, 2 / e);
}

function geometry(pos, idx, uvs) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function loft(rings, sides, { caps = [true, true], shape, uv, n = 2 } = {}) {
  const pos = [];
  const uvs = [];
  const idx = [];
  const push = (x, y, z, th, r, centre) => {
    if (shape) [x, y, z] = shape(x, y, z, th, r, centre);
    pos.push(x, y, z);
    if (uv) uvs.push(...uv(x, y, z));
  };
  for (const r of rings) {
    for (let i = 0; i < sides; i++) {
      const th = (i / sides) * Math.PI * 2;
      const [x, z] = ringXZ(r, th, n);
      push(x, r.y, z, th, r, false);
    }
  }
  const R = rings.length;
  for (let j = 0; j < R - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i;
      const b = j * sides + ((i + 1) % sides);
      idx.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }
  const cap = (j, flip) => {
    const r = rings[j];
    if (r.hw < 1e-4) return;
    const c = pos.length / 3;
    push(r.cx ?? 0, r.y, r.cz ?? 0, 0, r, true);
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i;
      const b = j * sides + ((i + 1) % sides);
      if (flip) idx.push(c, b, a);
      else idx.push(c, a, b);
    }
  };
  if (caps[0]) cap(0, true);
  if (caps[1]) cap(R - 1, false);
  return geometry(pos, idx, uv ? uvs : null);
}

function densify(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

// a thin plate laid onto a surface: lapels, the shirt, pocket flaps
function plate(outline, zAt, { lift = 0.004, thick = 0.006, uvScale = 0 } = {}) {
  const pts = densify(outline, 0.018);
  const tris = THREE.ShapeUtils.triangulateShape(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    [],
  );
  const n = pts.length;
  const pos = [];
  const uvs = [];
  for (const k of [1, 0]) {
    for (const [x, y] of pts) {
      pos.push(x, y, zAt(x, y) + lift + thick * k);
      uvs.push(uvScale ? x / uvScale : 0, uvScale ? y / uvScale : 0);
    }
  }
  const idx = [];
  for (const [a, b, c] of tris) idx.push(a, b, c, n + a, n + c, n + b);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(i, n + i, j, j, n + i, n + j);
  }
  return geometry(pos, idx, uvs);
}

// a single sheet that follows a curved surface closely, for wide patches like the shirt front
function sheet(y0, y1, rows, cols, xRange, zAt, { lift = 0.003, uvScale = 0.08 } = {}) {
  const pos = [];
  const uvs = [];
  const idx = [];
  for (let j = 0; j <= rows; j++) {
    const y = y0 + ((y1 - y0) * j) / rows;
    const [xa, xb] = xRange(y);
    for (let i = 0; i <= cols; i++) {
      const x = xa + ((xb - xa) * i) / cols;
      pos.push(x, y, zAt(x, y) + lift);
      uvs.push(x / uvScale, y / uvScale);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const c = a + cols + 1;
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  return geometry(pos, idx, uvs);
}

/* ---------- body measurements (metres, standing on y = 0, facing +z) ---------- */

const HIPS_Y = 0.96;
const CHEST_Y = 1.08;
const NECK = new THREE.Vector3(0, 0.43, -0.005); // from the chest
const HEAD = new THREE.Vector3(0, 0.062, 0.012); // from the neck
const SHOULDER = new THREE.Vector3(0.185, 0.36, -0.012); // from the chest
const L_UPPER = 0.29;
const L_FORE = 0.255;
const HIP = new THREE.Vector3(0.09, -0.03, 0); // from the hips
const L_THIGH = 0.43;
const L_SHIN = 0.415;

// head, chin at y = 0; n > 2 squares the face off a little
const HEAD_RINGS = [
  { y: 0.0, cz: 0.047, hw: 0.03, fd: 0.018, bd: 0.014 },
  { y: 0.02, cz: 0.03, hw: 0.058, fd: 0.049, bd: 0.043 },
  { y: 0.048, cz: 0.012, hw: 0.075, fd: 0.08, bd: 0.066 },
  { y: 0.082, cz: 0.003, hw: 0.084, fd: 0.09, bd: 0.088 },
  { y: 0.118, cz: -0.004, hw: 0.085, fd: 0.092, bd: 0.1 },
  { y: 0.152, cz: -0.007, hw: 0.085, fd: 0.094, bd: 0.106 },
  { y: 0.186, cz: -0.01, hw: 0.081, fd: 0.086, bd: 0.105 },
  { y: 0.216, cz: -0.012, hw: 0.073, fd: 0.071, bd: 0.092 },
  { y: 0.24, cz: -0.014, hw: 0.053, fd: 0.047, bd: 0.064 },
  { y: 0.252, cz: -0.016, hw: 0, fd: 0, bd: 0 },
].map((r) => ({ n: 2.3, ...r }));
const HEAD_TOP = 0.252;
const HEAD_DROP = -0.04; // chin sits this far below the head pivot
const FACE_W = 0.19;
const FACE_H = 0.25;

// coat from the waist up, in body height
const COAT_UP = [
  { y: 1.0, hw: 0.184, fd: 0.127, bd: 0.131 },
  { y: 1.08, hw: 0.178, fd: 0.124, bd: 0.126 },
  { y: 1.19, hw: 0.188, fd: 0.131, bd: 0.126 },
  { y: 1.31, hw: 0.204, fd: 0.136, bd: 0.126 },
  { y: 1.405, hw: 0.219, fd: 0.122, bd: 0.12 },
  { y: 1.452, hw: 0.214, fd: 0.1, bd: 0.106 },
  { y: 1.472, hw: 0.198, fd: 0.093, bd: 0.1 },
  { y: 1.49, hw: 0.166, fd: 0.084, bd: 0.092 },
  { y: 1.515, hw: 0.104, fd: 0.074, bd: 0.082 },
  { y: 1.535, hw: 0.074, fd: 0.064, bd: 0.072 },
].map((r) => ({ n: 2.6, ...r }));
// and the skirt of the coat, down to just above the knee
const COAT_LOW = [
  { y: 0.565, hw: 0.222, fd: 0.152, bd: 0.157 },
  { y: 0.66, hw: 0.214, fd: 0.147, bd: 0.152 },
  { y: 0.8, hw: 0.203, fd: 0.14, bd: 0.145 },
  { y: 0.95, hw: 0.192, fd: 0.132, bd: 0.138 },
  { y: 1.04, hw: 0.182, fd: 0.126, bd: 0.13 },
].map((r) => ({ n: 2.6, ...r }));

/* ---------- textures ---------- */

function faceTextures() {
  return [false, true].map((closed) => {
    const S = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const KX = S / FACE_W;
    const KY = S / FACE_H;
    const X = (x) => (0.5 + x / FACE_W) * S;
    const Y = (y) => (1 - y / FACE_H) * S;
    const blob = (x, y, rx, ry, rgb, a) => {
      g.save();
      g.translate(X(x), Y(y));
      g.scale(rx * KX, ry * KY);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, `rgba(${rgb},${a})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(-1, -1, 2, 2);
      g.restore();
    };
    const curve = (pts, width, color) => {
      g.beginPath();
      g.moveTo(X(pts[0][0]), Y(pts[0][1]));
      for (let i = 1; i < pts.length; i += 2) g.quadraticCurveTo(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]));
      g.lineWidth = width * KX;
      g.lineCap = 'round';
      g.strokeStyle = color;
      g.stroke();
    };

    g.fillStyle = SKIN;
    g.fillRect(0, 0, S, S);
    // warmth in the cheeks, shade at the temples and under the brow
    blob(-0.05, 0.085, 0.03, 0.022, '205,110,90', 0.16);
    blob(0.05, 0.085, 0.03, 0.022, '205,110,90', 0.16);
    blob(-0.075, 0.16, 0.025, 0.05, '120,72,50', 0.18);
    blob(0.075, 0.16, 0.025, 0.05, '120,72,50', 0.18);
    // light stubble: chin, upper lip and jaw
    blob(0, 0.02, 0.04, 0.03, '58,40,30', 0.3);
    blob(0, 0.07, 0.032, 0.0085, '58,40,30', 0.22);
    blob(-0.05, 0.035, 0.032, 0.032, '58,40,30', 0.12);
    blob(0.05, 0.035, 0.032, 0.032, '58,40,30', 0.12);
    // smile lines
    for (const s of [-1, 1]) curve([[s * 0.023, 0.084], [s * 0.034, 0.077], [s * 0.035, 0.067]], 0.002, 'rgba(118,68,48,0.16)');

    // a wide, open smile
    const mouth = () => {
      g.beginPath();
      g.moveTo(X(-0.031), Y(0.0618));
      g.quadraticCurveTo(X(0), Y(0.0555), X(0.031), Y(0.0618));
      g.quadraticCurveTo(X(0.012), Y(0.04), X(0), Y(0.0425));
      g.quadraticCurveTo(X(-0.012), Y(0.04), X(-0.031), Y(0.0618));
      g.closePath();
    };
    g.save();
    mouth();
    g.fillStyle = '#3e1c1b';
    g.fill();
    g.clip();
    g.fillStyle = '#f0e9e0';
    g.beginPath();
    g.moveTo(X(-0.031), Y(0.0618));
    g.quadraticCurveTo(X(0), Y(0.0555), X(0.031), Y(0.0618));
    g.lineTo(X(0.03), Y(0.0545));
    g.quadraticCurveTo(X(0), Y(0.0475), X(-0.03), Y(0.0545));
    g.closePath();
    g.fill();
    g.restore();
    curve([[-0.033, 0.0625], [0, 0.0565], [0.033, 0.0625]], 0.0018, 'rgba(110,50,45,0.7)');
    curve([[-0.022, 0.044], [0, 0.0375], [0.022, 0.044]], 0.0032, 'rgba(160,85,75,0.45)');
    for (const s of [-1, 1]) curve([[s * 0.031, 0.0618], [s * 0.0345, 0.0628], [s * 0.036, 0.066]], 0.0016, 'rgba(110,60,45,0.55)');

    // eyes, narrowed by the smile
    for (const s of [-1, 1]) {
      const cx = s * 0.034;
      const ix = cx - s * 0.0135;
      const ox = cx + s * 0.014;
      if (closed) {
        curve([[ix, 0.1215], [cx, 0.1265], [ox, 0.1225]], 0.0022, '#22160f');
      } else {
        g.save();
        g.beginPath();
        g.moveTo(X(ix), Y(0.1215));
        g.quadraticCurveTo(X(cx), Y(0.1318), X(ox), Y(0.1228));
        g.quadraticCurveTo(X(cx), Y(0.1158), X(ix), Y(0.1215));
        g.closePath();
        g.fillStyle = '#efe6dc';
        g.fill();
        g.clip();
        const irx = cx - s * 0.0008;
        g.fillStyle = '#3a2416';
        g.beginPath();
        g.ellipse(X(irx), Y(0.1228), 0.0058 * KX, 0.0058 * KY, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#100906';
        g.beginPath();
        g.ellipse(X(irx), Y(0.1228), 0.0028 * KX, 0.0028 * KY, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath();
        g.ellipse(X(irx + 0.0018), Y(0.1246), 0.0012 * KX, 0.0012 * KY, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
        curve([[ix - s * 0.001, 0.1213], [cx, 0.1322], [ox + s * 0.0015, 0.1222]], 0.0024, '#20140e');
        curve([[ix, 0.1205], [cx, 0.1152], [ox, 0.1222]], 0.0009, 'rgba(90,55,40,0.55)');
      }
      // crease above, and the cheek lift under the eye
      curve([[ix + s * 0.002, 0.1285], [cx, 0.1365], [ox, 0.1285]], 0.0011, 'rgba(110,68,50,0.35)');
      curve([[ix + s * 0.003, 0.1155], [cx, 0.1105], [ox - s * 0.002, 0.117]], 0.0012, 'rgba(120,72,52,0.22)');
      // thick, dark brows
      g.beginPath();
      g.moveTo(X(s * 0.0125), Y(0.1392));
      g.quadraticCurveTo(X(s * 0.034), Y(0.1505), X(s * 0.0565), Y(0.1428));
      g.lineTo(X(s * 0.056), Y(0.1462));
      g.quadraticCurveTo(X(s * 0.034), Y(0.1575), X(s * 0.012), Y(0.1468));
      g.closePath();
      g.fillStyle = '#1e1511';
      g.fill();
    }
    // shade down the sides of the nose
    blob(-0.013, 0.112, 0.006, 0.02, '130,80,58', 0.22);
    blob(0.013, 0.112, 0.006, 0.02, '130,80,58', 0.22);

    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

function stripeTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 4;
  const g = cv.getContext('2d');
  g.fillStyle = '#c7d4ea';
  g.fillRect(0, 0, 64, 4);
  g.fillStyle = '#93a8cf';
  for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 2, 4);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

/* ---------- the model ---------- */

function headSculpt(th, y) {
  const a = Math.abs(th > Math.PI ? th - Math.PI * 2 : th);
  let k = 1;
  k -= 0.04 * gauss(a, 0.39, 0.17) * gauss(y, 0.121, 0.012); // eye sockets
  k += 0.035 * gauss(a, 0.8, 0.28) * gauss(y, 0.078, 0.026); // full cheeks
  k += 0.018 * gauss(a, 0, 0.32) * gauss(y, 0.152, 0.012); // brow
  k -= 0.025 * gauss(a, 1.25, 0.3) * gauss(y, 0.165, 0.03); // temples
  return k;
}
function headPoint(th, y) {
  const r = ringAt(HEAD_RINGS, y);
  const [x, z] = ringXZ(r, th);
  const k = headSculpt(th, y);
  return [r.cx + (x - r.cx) * k, r.cz + (z - r.cz) * k];
}

// where the hair starts, by angle from the front (0) round to the back (pi)
function hairline(a) {
  const P = [
    [0, 0.181],
    [0.62, 0.18],
    [0.95, 0.166],
    [1.25, 0.152],
    [1.45, 0.108],
    [1.66, 0.15],
    [2.05, 0.12],
    [2.6, 0.072],
    [Math.PI, 0.056],
  ];
  for (let i = 0; i < P.length - 1; i++) {
    if (a <= P[i + 1][0]) return P[i][1] + ((P[i + 1][1] - P[i][1]) * (a - P[i][0])) / (P[i + 1][0] - P[i][0]);
  }
  return P[P.length - 1][1];
}

function hairGeometry() {
  const N = 20;
  const ROWS = [0, 0.14, 0.3, 0.48, 0.66, 0.84];
  const C = new THREE.Vector3(0, 0.125, -0.012);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const thick = (a, s) => {
    const front = smooth(1.2, 0.3, a);
    const back = smooth(1.8, 2.8, a);
    const edge = 0.003 + 0.011 * front;
    const body = 0.006 + 0.013 * front + 0.007 * back;
    return edge + (body - edge) * smooth(0, 0.35, s) + 0.003 * s * s;
  };
  const pos = [];
  const v = new THREE.Vector3();
  const at = (th, y, t) => {
    const [x, z] = headPoint(th, y);
    v.set(x, y, z);
    const d = v.clone().sub(C).normalize();
    v.addScaledVector(d, t);
    pos.push(v.x, v.y, v.z);
  };
  const edgeY = [];
  for (let j = 0; j < ROWS.length; j++) {
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      const a = Math.abs(th > Math.PI ? th - Math.PI * 2 : th);
      const s = ROWS[j];
      let hl = hairline(a);
      // the fringe hangs in short points
      if (a < 1.0) hl += (i % 2 === 1 ? -0.008 : 0.003) * (1 - a * 0.7);
      if (j === 0) edgeY.push(hl);
      const y = hl + (HEAD_TOP - 0.004 - hl) * s;
      at(th, y, thick(a, s) + (j > 0 ? (rand() - 0.5) * 0.0045 : 0));
    }
  }
  const apex = pos.length / 3;
  const top = ringAt(HEAD_RINGS, HEAD_TOP);
  pos.push(top.cx, HEAD_TOP + 0.02, top.cz - 0.004);
  // the underside of the hair edge, tucked against the scalp
  const rim = pos.length / 3;
  for (let i = 0; i < N; i++) at((i / N) * Math.PI * 2, edgeY[i], -0.002);

  const idx = [];
  for (let j = 0; j < ROWS.length - 1; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * N + i;
      const b = j * N + ((i + 1) % N);
      idx.push(a, b, a + N, b, b + N, a + N);
    }
  }
  const last = (ROWS.length - 1) * N;
  for (let i = 0; i < N; i++) idx.push(last + i, last + ((i + 1) % N), apex);
  for (let i = 0; i < N; i++) {
    const a = i;
    const b = (i + 1) % N;
    idx.push(rim + a, rim + b, a, rim + b, b, a);
  }
  return geometry(pos, idx);
}

function noseGeometry() {
  const fz = (y) => headPoint(0, y)[1];
  const P = [
    [0, 0.139, fz(0.139) + 0.003], // 0 bridge
    [0.0105, 0.118, headPoint(0.12, 0.118)[1] + 0.005], // 1 left side
    [-0.0105, 0.118, headPoint(-0.12, 0.118)[1] + 0.005], // 2 right side
    [0, 0.09, fz(0.09) + 0.026], // 3 tip
    [0.0195, 0.086, fz(0.086) + 0.006], // 4 left wing
    [-0.0195, 0.086, fz(0.086) + 0.006], // 5 right wing
    [0, 0.0805, fz(0.0805) + 0.012], // 6 under
  ];
  const pos = P.flat();
  const idx = [0, 2, 3, 0, 3, 1, 2, 5, 3, 1, 3, 4, 3, 5, 6, 3, 6, 4, 4, 6, 5];
  return geometry(pos, idx);
}

function handGeometry() {
  // left hand: fingers down -y, palm facing -x (towards the leg), thumb forward
  const g = loft(
    [
      { y: 0.012, hw: 0.019, fd: 0.025, bd: 0.022 },
      { y: -0.02, hw: 0.022, fd: 0.036, bd: 0.03 },
      { y: -0.064, hw: 0.02, fd: 0.042, bd: 0.04 },
      { y: -0.096, hw: 0.017, fd: 0.04, bd: 0.04 },
      { y: -0.145, hw: 0.014, fd: 0.034, bd: 0.036 },
      { y: -0.172, hw: 0.009, fd: 0.024, bd: 0.026 },
      { y: -0.18, hw: 0, fd: 0, bd: 0 },
    ],
    8,
    {
      caps: [true, false],
      shape: (x, y, z) => [x - 0.4 * Math.max(0, -0.085 - y) ** 1.2, y, z],
    },
  );
  const thumb = loft(
    [
      { y: 0.0, hw: 0.012, fd: 0.013, bd: 0.013 },
      { y: -0.042, hw: 0.011, fd: 0.011, bd: 0.011 },
      { y: -0.068, hw: 0, fd: 0, bd: 0 },
    ],
    6,
    { caps: [true, false] },
  );
  thumb.rotateX(-0.75);
  thumb.rotateZ(-0.35);
  thumb.translate(-0.008, -0.03, 0.03);
  return mergeGeometries([g, thumb]);
}

function mergeGeometries(list) {
  const pos = [];
  const idx = [];
  let off = 0;
  for (const g of list) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const ix = g.getIndex();
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    off += p.count;
  }
  return geometry(pos, idx);
}

function shoeGeometry() {
  // built along the foot then turned so the ring axis runs heel to toe; the sole is flattened
  return loft(
    [
      { y: -0.068, hw: 0.038, fd: 0.046, bd: 0.03, cz: -0.046 },
      { y: -0.045, hw: 0.045, fd: 0.062, bd: 0.036, cz: -0.046 },
      { y: 0.04, hw: 0.049, fd: 0.05, bd: 0.04, cz: -0.05 },
      { y: 0.13, hw: 0.05, fd: 0.034, bd: 0.04, cz: -0.054 },
      { y: 0.188, hw: 0.041, fd: 0.024, bd: 0.04, cz: -0.06 },
      { y: 0.212, hw: 0.021, fd: 0.012, bd: 0.03, cz: -0.066 },
    ],
    10,
    { n: 2.6, shape: (x, y, z) => [x, Math.max(z, -0.085), y] },
  );
}

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, flatShading: true, side: THREE.DoubleSide, ...o });
}

function bone(parent, p) {
  const o = new THREE.Object3D();
  if (p) o.position.copy(p);
  parent.add(o);
  return o;
}

function buildMason() {
  const [faceOpen, faceShut] = faceTextures();
  const M = {
    skin: mat(SKIN, { roughness: 0.68 }),
    face: mat('#ffffff', { map: faceOpen, roughness: 0.68 }),
    hair: mat(COL.hair, { roughness: 0.78 }),
    coat: mat(COL.coat, { roughness: 0.85 }),
    lapel: mat(COL.lapel, { roughness: 0.7 }),
    edge: mat(COL.edge, { roughness: 0.9 }),
    shirt: mat('#ffffff', { map: stripeTexture(), roughness: 0.8 }),
    collar: mat(COL.collar, { roughness: 0.8 }),
    trousers: mat(COL.trousers, { roughness: 0.9 }),
    shoe: mat(COL.shoe, { roughness: 0.32, metalness: 0.15 }),
    silver: mat(COL.silver, { roughness: 0.22, metalness: 1 }),
    button: mat(COL.button, { roughness: 0.35 }),
  };
  const add = (parent, geo, m, at) => {
    const mesh = new THREE.Mesh(geo, m);
    if (at) mesh.position.copy(at);
    parent.add(mesh);
    return mesh;
  };
  const toBone = (geo, y) => geo.translate(0, -y, 0);

  const root = new THREE.Group();
  const hips = bone(root, new THREE.Vector3(0, HIPS_Y, 0));
  const chest = bone(hips, new THREE.Vector3(0, CHEST_Y - HIPS_Y, 0));
  const torso = bone(chest); // breathes, without scaling the arms and head
  const neck = bone(chest, NECK);
  const head = bone(neck, HEAD);

  // coat
  add(torso, toBone(loft(COAT_UP, 16, { caps: [false, true], n: 2.6 }), CHEST_Y), M.coat);
  add(hips, toBone(loft(COAT_LOW, 16, { caps: [false, false], n: 2.6 }), HIPS_Y), M.coat);
  const zUp = (x, y) => frontZ(COAT_UP, x, y);
  const zLow = (x, y) => frontZ(COAT_LOW, x, y);
  // pale blue shirt in the opening, lapels either side, the collar standing up at the back
  const vee = (y) => {
    const w = 0.057 * clamp((y - 1.18) / 0.346, 0, 1);
    return [-w, w];
  };
  add(torso, toBone(sheet(1.18, 1.54, 12, 6, vee, zUp), CHEST_Y), M.shirt);
  for (const s of [-1, 1]) {
    const lapel = [
      [0, 1.18],
      [0.114, 1.392],
      [0.128, 1.448],
      [0.099, 1.452],
      [0.086, 1.506],
      [0.052, 1.526],
    ].map(([x, y]) => [x * s, y]);
    if (s < 0) lapel.reverse();
    add(torso, toBone(plate(lapel, zUp, { lift: 0.004, thick: 0.011 }), CHEST_Y), M.lapel);
    const flap = [
      [0.02, 1.548],
      [0.068, 1.512],
      [0.05, 1.452],
    ].map(([x, y]) => [x * s, y]);
    if (s < 0) flap.reverse();
    add(torso, toBone(plate(flap, zUp, { lift: 0.016, thick: 0.004 }), CHEST_Y), M.collar);
    const pocket = [
      [0.06, 0.845],
      [0.172, 0.845],
      [0.172, 0.815],
      [0.06, 0.815],
    ].map(([x, y]) => [x * s, y]);
    if (s > 0) pocket.reverse();
    add(hips, toBone(plate(pocket, zLow, { lift: 0.003, thick: 0.006 }), HIPS_Y), M.lapel);
  }
  const band = [];
  for (let i = 0; i <= 10; i++) {
    const th = 0.75 + (i / 10) * (Math.PI * 2 - 1.5);
    for (const [y, hw, fd, bd] of [
      [1.5, 0.098, 0.076, 0.09],
      [1.556, 0.086, 0.07, 0.083],
    ]) {
      const [x, z] = ringXZ({ hw, fd, bd, n: 2.4 }, th);
      band.push(x, y - CHEST_Y, z);
    }
  }
  const bandIdx = [];
  for (let i = 0; i < 10; i++) bandIdx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 2, i * 2 + 3, i * 2 + 1);
  add(torso, geometry(band, bandIdx), M.coat);
  // front edge of the coat below the lapels, and buttons
  add(torso, toBone(plate([[-0.018, 1.18], [-0.012, 1.18], [-0.012, 1.0], [-0.018, 1.0]], zUp, { lift: 0.001, thick: 0.003 }), CHEST_Y), M.edge);
  add(hips, toBone(plate([[-0.018, 1.0], [-0.012, 1.0], [-0.014, 0.567], [-0.02, 0.567]], zLow, { lift: 0.001, thick: 0.003 }), HIPS_Y), M.edge);
  const btn = new THREE.CylinderGeometry(0.011, 0.011, 0.006, 8).rotateX(Math.PI / 2);
  for (const y of [1.145, 1.03]) add(torso, btn, M.button, new THREE.Vector3(0.004, y - CHEST_Y, zUp(0.004, y) + 0.004));
  add(hips, btn, M.button, new THREE.Vector3(0.004, 0.91 - HIPS_Y, zLow(0.004, 0.91) + 0.004));

  // silver chain with a small pendant, as in the photos
  const chainPts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const x = Math.sin((u - 0.5) * Math.PI * 1.08) * 0.058;
    const y = 1.545 - Math.cos((u - 0.5) * Math.PI) * 0.125;
    const z = Math.max(Math.cos((u - 0.5) * Math.PI * 1.08) * 0.05, zUp(x, y) + 0.005);
    chainPts.push(new THREE.Vector3(x, y - CHEST_Y, z));
  }
  add(torso, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chainPts), 28, 0.0022, 4, false), M.silver);
  const pendant = add(torso, new THREE.OctahedronGeometry(0.009, 0).scale(0.8, 1.4, 0.5), M.silver);
  pendant.position.set(0, 1.405 - CHEST_Y, zUp(0, 1.405) + 0.009);

  // neck and head
  add(
    neck,
    loft(
      [
        { y: -0.06, hw: 0.062, fd: 0.056, bd: 0.06 },
        { y: 0.02, hw: 0.06, fd: 0.054, bd: 0.058 },
        { y: 0.09, hw: 0.058, fd: 0.052, bd: 0.056 },
      ],
      10,
    ),
    M.skin,
  );
  const face = new THREE.Group();
  face.position.set(0, HEAD_DROP, 0.012);
  face.scale.setScalar(1.1);
  head.add(face);
  const headMesh = add(
    face,
    loft(HEAD_RINGS, 16, {
      caps: [true, false],
      n: 2.3,
      shape: (x, y, z, th, r, centre) => {
        if (centre) return [x, y, z];
        const k = headSculpt(th, y);
        const cx = r.cx ?? 0;
        const cz = r.cz ?? 0;
        return [cx + (x - cx) * k, y, cz + (z - cz) * k];
      },
      uv: (x, y) => [0.5 + x / FACE_W, y / FACE_H],
    }),
    M.face,
  );
  add(face, hairGeometry(), M.hair);
  add(face, noseGeometry(), M.skin);
  const ear = new THREE.SphereGeometry(1, 6, 5);
  for (const s of [-1, 1]) {
    const e = add(face, ear, M.skin);
    const r = ringAt(HEAD_RINGS, 0.118);
    e.position.set(s * (r.hw - 0.001), 0.116, -0.014);
    e.scale.set(0.011, 0.03, 0.019);
    e.rotation.set(0, s * -0.35, s * 0.08);
  }

  // arms: coat sleeves, a strip of shirt cuff, hands
  const upperGeo = loft(
    [
      { y: 0.032, hw: 0.04, fd: 0.04, bd: 0.04 },
      { y: 0.01, hw: 0.058, fd: 0.057, bd: 0.057 },
      { y: -0.05, hw: 0.062, fd: 0.06, bd: 0.06 },
      { y: -0.18, hw: 0.056, fd: 0.054, bd: 0.054 },
      { y: -0.29, hw: 0.05, fd: 0.05, bd: 0.05 },
      { y: -0.32, hw: 0.038, fd: 0.038, bd: 0.038 },
    ],
    8,
  );
  const foreGeo = loft(
    [
      { y: 0.03, hw: 0.043, fd: 0.043, bd: 0.043 },
      { y: 0.0, hw: 0.05, fd: 0.05, bd: 0.05 },
      { y: -0.1, hw: 0.05, fd: 0.047, bd: 0.05 },
      { y: -0.215, hw: 0.045, fd: 0.044, bd: 0.045 },
      { y: -0.243, hw: 0.049, fd: 0.048, bd: 0.049 },
      { y: -0.248, hw: 0.036, fd: 0.036, bd: 0.036 },
    ],
    8,
    { caps: [true, false] },
  );
  const cuffGeo = new THREE.CylinderGeometry(0.036, 0.037, 0.022, 8);
  const handL = handGeometry();
  const handR = handL.clone().scale(-1, 1, 1);
  const arms = {};
  for (const s of [-1, 1]) {
    const shoulder = bone(chest, SHOULDER.clone().setX(SHOULDER.x * s));
    const elbow = bone(shoulder, new THREE.Vector3(0, -L_UPPER, 0));
    const wrist = bone(elbow, new THREE.Vector3(0, -L_FORE, 0));
    add(shoulder, upperGeo, M.coat);
    add(elbow, foreGeo, M.coat);
    add(wrist, cuffGeo, M.collar, new THREE.Vector3(0, 0.004, 0));
    add(wrist, s > 0 ? handL : handR, M.skin);
    arms[s] = {
      side: s,
      shoulder,
      elbow,
      wrist,
      base: shoulder.position.clone(),
      target: new THREE.Vector3(),
      pole: new THREE.Vector3(),
      roll: 0,
      flex: 0,
    };
  }

  // legs
  const thighGeo = loft(
    [
      { y: 0.07, hw: 0.07, fd: 0.07, bd: 0.07 },
      { y: 0.0, hw: 0.092, fd: 0.09, bd: 0.092 },
      { y: -0.2, hw: 0.081, fd: 0.081, bd: 0.079 },
      { y: -0.43, hw: 0.06, fd: 0.06, bd: 0.058 },
      { y: -0.46, hw: 0.048, fd: 0.048, bd: 0.048 },
    ],
    8,
  );
  const shinGeo = loft(
    [
      { y: 0.035, hw: 0.054, fd: 0.054, bd: 0.054 },
      { y: 0.0, hw: 0.063, fd: 0.063, bd: 0.065 },
      { y: -0.12, hw: 0.063, fd: 0.06, bd: 0.069 },
      { y: -0.33, hw: 0.05, fd: 0.05, bd: 0.05 },
      { y: -0.395, hw: 0.055, fd: 0.058, bd: 0.055 },
    ],
    8,
    { caps: [true, false] },
  );
  const shoeGeo = shoeGeometry();
  const legs = {};
  for (const s of [-1, 1]) {
    const thigh = bone(hips, HIP.clone().setX(HIP.x * s));
    const knee = bone(thigh, new THREE.Vector3(0, -L_THIGH, 0));
    const ankle = bone(knee, new THREE.Vector3(0, -L_SHIN, 0));
    add(thigh, thighGeo, M.trousers);
    add(knee, shinGeo, M.trousers);
    add(ankle, shoeGeo, M.shoe);
    legs[s] = { thigh, knee, ankle };
  }

  return { root, hips, chest, torso, neck, head, headMesh, arms, legs, M, faceOpen, faceShut };
}

/* ---------- two-bone IK for the arms, in chest space ---------- */

const _m = new THREE.Matrix4();
const _qU = new THREE.Quaternion();
const _qF = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
function solveArm(arm) {
  const S = arm.shoulder.position;
  const dir = arm.target.clone().sub(S);
  const d = clamp(dir.length(), 0.08, (L_UPPER + L_FORE) * 0.985);
  dir.normalize();
  const pv = arm.pole.clone();
  pv.addScaledVector(dir, -pv.dot(dir)).normalize();
  const a = (L_UPPER * L_UPPER - L_FORE * L_FORE + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L_UPPER * L_UPPER - a * a));
  const E = S.clone().addScaledVector(dir, a).addScaledVector(pv, h);
  const W = S.clone().addScaledVector(dir, d);
  const up = E.clone().sub(S).normalize();
  const fo = W.sub(E).normalize();
  // the elbow hinge; also the axis the palm faces along
  const X = new THREE.Vector3().crossVectors(dir, pv).normalize();
  const frame = (along, q) => {
    const Y = along.clone().negate();
    const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
    const X2 = new THREE.Vector3().crossVectors(Y, Z);
    _m.makeBasis(X2, Y, Z);
    q.setFromRotationMatrix(_m);
  };
  frame(up, _qU);
  frame(fo, _qF);
  arm.shoulder.quaternion.copy(_qU);
  arm.elbow.quaternion.copy(_qU).invert().multiply(_qF);
  _e.set(arm.flex, arm.roll, 0);
  arm.wrist.quaternion.setFromEuler(_e);
}

/* ---------- poses ---------- */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function armGoal(side, lead, act, t) {
  const g = { target: V(side * 0.226, -0.16, 0.045), pole: V(side * 0.35, -0.25, -0.9), roll: 0, flex: 0.12, k: 5 };
  if (!act) return g;
  const k = t - act.start;
  if (act.name === 'clasp') {
    Object.assign(g, { target: V(side * 0.03, -0.085, 0.215), pole: V(side * 0.8, -0.5, -0.35), roll: side * 0.25, flex: 0.1, k: 3.5 });
  } else if (act.name === 'wave' && lead) {
    const w = Math.sin(k * 10);
    Object.assign(g, { target: V(side * (0.38 + 0.05 * w), 0.58, 0.07), pole: V(side * 1, -0.35, -0.2), roll: 0, flex: -0.15 + 0.25 * w, k: 10 });
  } else if (act.name === 'present' && lead) {
    Object.assign(g, { target: V(side * 0.41, 0.03, 0.26), pole: V(side * 0.35, -0.85, -0.45), roll: side * -1.15, flex: -0.25, k: 7 });
  }
  return g;
}

/* ---------- renderer ---------- */

export function createAvatar(canvas, { reducedMotion = false, still = false } = {}) {
  const host = canvas.parentElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: still });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.5;
  room.dispose?.();
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight('#e6ebff', '#6f6070', 0.75);
  const key = new THREE.DirectionalLight('#fff1e0', 2.3);
  key.position.set(2.2, 3.2, 3.8);
  const rim = new THREE.DirectionalLight('#cfd9ff', 2.7);
  rim.position.set(-2.6, 2.4, -3.0);
  const rim2 = new THREE.DirectionalLight('#dde3ff', 1.6);
  rim2.position.set(2.8, 1.6, -2.4);
  scene.add(hemi, key, rim, rim2);
  const keyDay = key.color.clone();
  const keyDusk = new THREE.Color('#ffc08a');
  const rimDay = rim.color.clone();
  const rimDusk = new THREE.Color('#ffb0c4');

  const mason = buildMason();
  scene.add(mason.root);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.62).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: '#20264f', transparent: true, opacity: 0.42, depthWrite: false }),
  );
  shadow.position.y = 0.002;
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 40);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const animated = !reducedMotion && !still;

  let facing = 1;
  let figureX = 0.5;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let act = null;
  let nextIdle = 9;
  let blinkAt = 2.5;
  let blinkEnd = 0;
  let greeted = false;
  let live = false;
  let pointer = null;
  let dusk = 0;
  let hovering = false;
  const look = { yaw: 0, pitch: 0, tilt: 0 };

  function readLayout() {
    const cs = getComputedStyle(host);
    facing = Number(cs.getPropertyValue('--face')) || 1;
    figureX = Number(cs.getPropertyValue('--fx')) || 0.5;
    mason.root.rotation.y = facing * 0.32;
  }

  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    readLayout();
    const aspect = w / h;
    camera.aspect = aspect;
    // fit 2.05 m of height, and at least 1.1 m of width
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(1.025 / half, 0.55 / (half * aspect));
    const yc = 0.95;
    camera.position.set(0, yc + 0.2, dist);
    camera.lookAt(0, yc, 0);
    camera.setViewOffset(w, h, (0.5 - figureX) * w, 0, w, h);
    camera.updateProjectionMatrix();
    pose(0);
    render();
  }

  function start(name, dur) {
    act = { name, start: clock, dur };
  }

  function lookGoal() {
    let yaw = -facing * 0.22 + Math.sin(clock * 0.23) * 0.2 + Math.sin(clock * 0.61) * 0.07;
    let pitch = Math.sin(clock * 0.37) * 0.05;
    let tilt = 0;
    if (animated && pointer && clock - pointer.t < 5) {
      // look at the cursor: cast it onto a plane in front of him
      const r = canvas.getBoundingClientRect();
      ndc.set(((pointer.x - r.left) / r.width) * 2 - 1, -((pointer.y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, (1.4 - ray.ray.origin.z) / ray.ray.direction.z);
      const headAt = new THREE.Vector3(0, 1.66, 0.05).applyAxisAngle(THREE.Object3D.DEFAULT_UP, mason.root.rotation.y);
      const d = p.sub(headAt).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -mason.root.rotation.y);
      yaw = Math.atan2(d.x, d.z);
      pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    }
    if (act?.name === 'wave') {
      yaw = -facing * 0.3;
      pitch = 0.04;
      tilt = facing * 0.1;
    } else if (act?.name === 'present') {
      yaw = facing * 0.55;
      pitch = -0.05;
    } else if (act?.name === 'look') {
      yaw = facing * 0.65;
      pitch = 0.08;
    }
    if (act?.name === 'nod') pitch -= Math.sin(clamp((clock - act.start) / 0.55, 0, 1) * Math.PI) * 0.2;
    return { yaw: clamp(yaw, -0.8, 0.8), pitch: clamp(pitch, -0.35, 0.3), tilt };
  }

  function pose(dt) {
    const k = dt === 0 ? 1 : 0;
    const t = clock;
    if (act && t - act.start > act.dur) act = null;
    // arms
    for (const s of [-1, 1]) {
      const arm = mason.arms[s];
      const g = armGoal(s, s === facing, act, t);
      const f = k || damp(g.k, dt);
      arm.target.lerp(g.target, f);
      arm.pole.lerp(g.pole, f);
      arm.roll += (g.roll - arm.roll) * f;
      arm.flex += (g.flex - arm.flex) * f;
      solveArm(arm);
    }
    // head and neck
    const lg = lookGoal();
    const lf = k || damp(act ? 7 : 4, dt);
    look.yaw += (lg.yaw - look.yaw) * lf;
    look.pitch += (lg.pitch - look.pitch) * lf;
    look.tilt += (lg.tilt - look.tilt) * lf;
    mason.neck.rotation.set(-look.pitch * 0.35, look.yaw * 0.35, look.tilt * 0.4);
    mason.head.rotation.set(-look.pitch * 0.65, look.yaw * 0.65, look.tilt * 0.6, 'YXZ');
    // breathing and a slow sway; weight on one leg
    const br = animated ? Math.sin(t * 1.7) : 0;
    const sw = animated ? Math.sin(t * 0.52) : 0;
    mason.torso.scale.set(1 + 0.006 * br, 1 + 0.003 * br, 1 + 0.012 * br);
    for (const s of [-1, 1]) mason.arms[s].shoulder.position.y = mason.arms[s].base.y + 0.003 * br;
    mason.hips.rotation.set(0, animated ? Math.sin(t * 0.31) * 0.02 : 0, 0.028 * facing + sw * 0.008);
    mason.chest.rotation.set(0.02 + 0.006 * br, (act?.name === 'present' ? facing * 0.1 : 0) + (animated ? Math.sin(t * 0.27) * 0.025 : 0), -0.034 * facing - sw * 0.012);
    const relaxed = -facing;
    for (const s of [-1, 1]) {
      const L = mason.legs[s];
      const r = s === relaxed;
      L.thigh.rotation.set(r ? -0.07 : 0.01, s * 0.06, (r ? 0.03 : -0.02) * s - 0.028 * facing);
      L.knee.rotation.set(r ? 0.13 : 0.0, 0, 0);
      L.ankle.rotation.set(r ? -0.06 : -0.01, s * 0.12, -L.thigh.rotation.z * 0.9);
    }
    // blink
    mason.M.face.map = animated && t > blinkAt && t < blinkEnd ? mason.faceShut : mason.faceOpen;
  }

  function render() {
    if (!live) return;
    renderer.render(scene, camera);
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;
    if (clock > blinkEnd) {
      blinkAt = clock + 2.2 + Math.random() * 3.5;
      blinkEnd = blinkAt + 0.12;
    }
    if (!greeted && clock > 1.1) {
      greeted = true;
      start('wave', 2.3);
    }
    if (!act && clock > nextIdle) {
      const idle = Math.random() < 0.55 ? ['clasp', 4.5] : ['look', 2.6];
      start(...idle);
      nextIdle = clock + idle[1] + 8 + Math.random() * 7;
    }
    pose(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  function setDusk(v) {
    if (Math.abs(v - dusk) < 0.002) return;
    dusk = v;
    key.color.copy(keyDay).lerp(keyDusk, v);
    key.intensity = 2.3 - 0.4 * v;
    rim.color.copy(rimDay).lerp(rimDusk, v);
    if (!animated) render();
  }

  function hit(e) {
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return false;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(mason.root, true).length > 0;
  }
  if (animated) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') pointer = { x: e.clientX, y: e.clientY, t: clock };
      const over = !!e.target.closest?.('.stage') && hit(e);
      if (over !== hovering) document.documentElement.classList.toggle('is-avatar-hover', (hovering = over));
    });
    addEventListener('click', (e) => {
      if (!e.target.closest?.('.stage') || !hit(e)) return;
      if (act?.name !== 'wave') start('wave', 2.3);
    });
  }

  renderer.compileAsync(scene, camera).catch(() => {}).then(() => {
    live = true;
    new ResizeObserver(resize).observe(host);
    resize();
    host.classList.add('is-live');
    if (animated) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });

  return {
    setDusk,
    react(kind) {
      if (!animated) return;
      if (kind === 'select') start(matchMedia('(max-width: 899px)').matches ? 'nod' : 'present', 1.9);
    },
    debug: {
      renderer,
      scene,
      camera,
      mason,
      pose(name, at = 0.6) {
        start(name, 99);
        clock = act.start + at;
        pose(0);
        render();
      },
      frame(y0, y1) {
        const h = y1 - y0;
        const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        camera.position.set(0, (y0 + y1) / 2 + 0.02, h / 2 / half);
        camera.lookAt(0, (y0 + y1) / 2, 0);
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
        render();
      },
      render,
    },
  };
}
