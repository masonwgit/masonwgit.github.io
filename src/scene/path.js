import * as THREE from 'three';

// One camera shot per page section, framed for the scene panel beside the text.
// fov is vertical. `phone` overrides the framing when the panel is tall and narrow.
export const SHOTS = [
  { name: 'The pavilion', pos: [0, 1.75, 7.6], look: [0, 3.5, -40], fov: 60, phone: { look: [0, 0.6, -40], fov: 70 } },
  { name: 'The crystal', pos: [-2.6, 3.3, 5.4], look: [0, 5.0, -2.6], fov: 56 },
  { name: 'Out to sea', pos: [0.6, 1.8, -11.4], look: [-16, 9, -150], fov: 56 },
  { name: 'The cliffs', pos: [-30, 3.6, -100], look: [42, 30, -320], fov: 56 },
  { name: 'Late light', pos: [36, 9, -232], look: [108, 52, -410], fov: 56 },
  { name: 'Dusk', pos: [9, 3.4, -46], look: [0, 3.6, -1], fov: 52 },
];

function curves(phone) {
  const pick = (s, k) => (phone && s.phone?.[k]) || s[k];
  return {
    pos: new THREE.CatmullRomCurve3(SHOTS.map((s) => new THREE.Vector3(...pick(s, 'pos'))), false, 'centripetal'),
    look: new THREE.CatmullRomCurve3(SHOTS.map((s) => new THREE.Vector3(...pick(s, 'look'))), false, 'centripetal'),
    fov: SHOTS.map((s) => pick(s, 'fov')),
  };
}

export function createPath() {
  const wide = curves(false);
  const tall = curves(true);
  let c = wide;
  const last = SHOTS.length - 1;
  return {
    last,
    setAspect(aspect) {
      c = aspect < 0.7 ? tall : wide;
    },
    // t runs 0..last; returns the vertical fov
    sample(t, outPos, outLook) {
      const k = THREE.MathUtils.clamp(t, 0, last);
      c.pos.getPoint(k / last, outPos);
      c.look.getPoint(k / last, outLook);
      const i = Math.min(last - 1, Math.floor(k));
      return THREE.MathUtils.lerp(c.fov[i], c.fov[i + 1], k - i);
    },
  };
}
