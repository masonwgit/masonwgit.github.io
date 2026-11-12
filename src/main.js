import '@fontsource/marcellus/400.css';
import '@fontsource-variable/hanken-grotesk/index.css';
import './styles.css';
import { initUI } from './ui.js';

const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = params.has('still');
const ui = initUI({ still });

function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

let avatar = null;

if (hasWebGL2() && !params.has('nogl')) {
  // Mason as a low-poly character, drawn on his own small canvas in front of the scene
  import('./scene/avatar.js')
    .then(({ createAvatar }) => {
      avatar = createAvatar(document.querySelector('.character__gl'), { reducedMotion, still });
      document.querySelector('.menu')?.addEventListener('click', (e) => {
        if (e.target.closest('.sub__bar:not([data-href])')) avatar.react('select');
      });
      if (params.has('debug')) window.pvAvatar = avatar;
    })
    .catch((err) => {
      console.error(err);
      document.documentElement.classList.add('no-avatar');
    });
  import('./scene/world.js')
    .then(({ createWorld }) => {
      const world = createWorld(document.getElementById('scene'), {
        reducedMotion,
        still,
        onReady: () => {
          ui.ready();
          window.__ready = true;
        },
        onFrame: ({ dusk }) => {
          window.__frames = (window.__frames || 0) + 1;
          avatar?.setDusk(dusk);
        },
      });
      ui.attach(world);
      if (params.has('debug')) window.pv = world;
    })
    .catch((err) => {
      console.error(err);
      ui.fallback();
    });
} else {
  ui.fallback();
}
