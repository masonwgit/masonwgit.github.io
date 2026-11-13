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

if (hasWebGL2() && !params.has('nogl')) {
  import('./scene/world.js')
    .then(({ createWorld }) => {
      const world = createWorld(document.getElementById('scene'), {
        reducedMotion,
        still,
        onReady: () => {
          ui.ready();
          window.__ready = true;
        },
        onFrame: () => {
          window.__frames = (window.__frames || 0) + 1;
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
