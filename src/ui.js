// The menu screen.
// Desktop: highlight a bar to see its card in the box, click a section to open its sub-items.
// Phones: the menu sits under the scene, a section drills down in place, details slide up
// in a sheet, and the back gesture closes the sheet, then the section, before leaving.
const narrowQuery = matchMedia('(max-width: 899px)');

export function initUI({ still }) {
  const root = document.documentElement;
  root.classList.add('js');

  const menu = document.querySelector('.menu');
  const pointer = menu.querySelector('.pointer');
  const mains = [...menu.querySelectorAll(':scope > ul > li')];
  const box = document.querySelector('.box');
  const body = box.querySelector('.box__body');
  const closeBtn = box.querySelector('.box__close');
  const scrim = document.querySelector('.scrim');
  const cards = [...box.querySelectorAll('.card')];
  const clock = document.querySelector('[data-clock]');

  let world = null;
  let current = null;
  let shot = 0;
  let shotTimer = 0;
  let sheetOpen = false;
  let opener = null;
  const layers = []; // phone only: what the back gesture should close, innermost last

  for (const li of mains) {
    const sub = li.querySelector('.sub');
    if (sub) sub.hidden = true;
  }

  const narrow = () => narrowQuery.matches;
  const mainOf = (btn) => btn.closest('.menu > ul > li');
  const isMain = (btn) => btn.classList.contains('bar');
  const subOf = (li) => li?.querySelector('.sub') ?? null;

  function showCard(key) {
    for (const c of cards) c.hidden = c.dataset.card !== key;
    box.scrollTop = 0;
    body.scrollTop = 0;
  }

  function placePointer() {
    if (!current) return;
    const m = menu.getBoundingClientRect();
    const r = current.getBoundingClientRect();
    if (!r.height) return;
    const x = r.left - m.left - (isMain(current) ? 40 : 38);
    const y = r.top - m.top + r.height / 2 - 14;
    pointer.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function goToShot(li) {
    const next = Number(li.querySelector('.bar').dataset.shot || 0);
    if (next === shot) return;
    shot = next;
    clearTimeout(shotTimer);
    // short delay so sweeping the mouse over the menu doesn't send the camera everywhere
    shotTimer = setTimeout(() => world?.goTo(shot), 160);
  }

  function highlight(btn, { focus = false } = {}) {
    if (current !== btn) {
      current?.classList.remove('is-active');
      current = btn;
      btn.classList.add('is-active');
      const li = mainOf(btn);
      for (const m of mains) m.querySelector('.bar').classList.toggle('is-current', m === li);
      showCard(btn.dataset.card);
      goToShot(li);
      placePointer();
    }
    if (focus) btn.focus({ preventScroll: true });
  }

  function openSub(li, focusFirst = false) {
    let opened = false;
    for (const m of mains) {
      const sub = subOf(m);
      const open = !!sub && m === li;
      if (sub) {
        sub.hidden = !open;
        m.querySelector('.bar').setAttribute('aria-expanded', String(open));
      }
      m.classList.toggle('is-open', open);
      opened ||= open;
    }
    menu.classList.toggle('is-open', opened);
    requestAnimationFrame(placePointer);
    if (opened && focusFirst) highlight(li.querySelector('.sub__bar'), { focus: true });
    return opened;
  }

  function closeSection() {
    const li = mains.find((m) => m.classList.contains('is-open'));
    openSub(null);
    if (li) highlight(li.querySelector('.bar'), { focus: !narrow() });
  }

  // phone details sheet
  function openSheet() {
    if (sheetOpen) return;
    sheetOpen = true;
    opener = current;
    scrim.hidden = false;
    box.classList.add('is-open');
    pushLayer('sheet');
    closeBtn.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    box.classList.remove('is-open');
    scrim.hidden = true;
    opener?.focus({ preventScroll: true });
  }

  // each phone layer gets a history entry, so the back gesture peels them off in order
  function pushLayer(kind) {
    layers.push(kind);
    history.pushState({ pvLayers: layers.length }, '');
  }
  function back() {
    if (layers.length) history.back();
    else if (sheetOpen) closeSheet();
    else closeSection();
  }
  addEventListener('popstate', () => {
    const kind = layers.pop();
    if (kind === 'sheet') closeSheet();
    else if (kind === 'sub') closeSection();
  });

  menu.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return; // on phones a tap does the work, not a finger passing over
    const b = e.target.closest('.bar, .sub__bar');
    if (b) highlight(b);
  });
  menu.addEventListener('focusin', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (b) highlight(b);
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (!b) return;
    const phone = narrow();
    if (isMain(b)) {
      const li = mainOf(b);
      const sub = subOf(li);
      if (sub && !sub.hidden) {
        // an open section's bar takes you back out
        if (phone && layers.at(-1) === 'sub') back();
        else closeSection();
        return;
      }
      if (sub) {
        openSub(li, !phone && e.detail === 0);
        if (phone) {
          highlight(b);
          pushLayer('sub');
        } else if (e.detail !== 0) {
          highlight(li.querySelector('.sub__bar'));
        }
        return;
      }
      openSub(null);
      highlight(b);
      if (phone) openSheet();
      return;
    }
    highlight(b);
    if (b.dataset.href) {
      window.open(b.dataset.href, '_blank', 'noopener');
      return;
    }
    if (phone) openSheet();
  });
  menu.addEventListener('keydown', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (!b) return;
    const visible = [...menu.querySelectorAll('.bar, .sub:not([hidden]) .sub__bar')].filter((x) => x.offsetParent);
    const i = visible.indexOf(b);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      highlight(visible[(i + step + visible.length) % visible.length], { focus: true });
    } else if (e.key === 'ArrowRight' && isMain(b) && subOf(mainOf(b))?.hidden) {
      e.preventDefault();
      b.click();
    } else if ((e.key === 'ArrowLeft' || e.key === 'Escape') && !isMain(b)) {
      e.preventDefault();
      if (narrow() && layers.at(-1) === 'sub') back();
      else closeSection();
    }
  });

  closeBtn.addEventListener('click', back);
  scrim.addEventListener('click', back);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) {
      e.preventDefault();
      back();
    }
  });
  narrowQuery.addEventListener('change', () => {
    // leaving the phone layout: drop the sheet and forget the phone back-stack
    if (!narrow()) {
      closeSheet();
      layers.length = 0;
    }
    requestAnimationFrame(placePointer);
  });

  document.querySelector('[data-show="controls"]')?.addEventListener('click', () => showCard('controls'));
  addEventListener('resize', () => requestAnimationFrame(placePointer));
  document.fonts?.ready.then(placePointer);

  // a console-style clock, on Melbourne time
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  function tick() {
    const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
    clock.textContent = `${p.day}/${p.month}/${p.year} (${p.weekday.toUpperCase()}) ${p.hour}:${p.minute}:${p.second}`;
  }
  tick();
  setInterval(tick, 1000);

  highlight(mains[0].querySelector('.bar'));

  return {
    attach(w) {
      world = w;
      if (still) {
        // ?still&item=N opens menu item N for screenshots
        const n = Number(new URLSearchParams(location.search).get('item') || 0);
        const li = mains[n] || mains[0];
        if (!openSub(li)) highlight(li.querySelector('.bar'));
        else highlight(li.querySelector('.sub__bar'));
        shot = Number(li.querySelector('.bar').dataset.shot || 0);
        w.jump(shot);
        requestAnimationFrame(placePointer);
      }
    },
    ready() {
      root.classList.add('is-ready');
    },
    fallback() {
      root.classList.add('no-webgl');
    },
  };
}
