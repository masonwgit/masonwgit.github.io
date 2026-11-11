// The menu screen: highlight a bar to see its card, open a section for its sub-items,
// and the camera moves to that section's shot. Works with mouse, touch and keyboard.
export function initUI({ still }) {
  const root = document.documentElement;
  root.classList.add('js');

  const menu = document.querySelector('.menu');
  const pointer = menu.querySelector('.pointer');
  const mains = [...menu.querySelectorAll(':scope > ul > li')];
  const box = document.querySelector('.box');
  const cards = [...box.querySelectorAll('.card')];
  const clock = document.querySelector('[data-clock]');

  let world = null;
  let current = null;
  let shot = 0;
  let shotTimer = 0;

  for (const li of mains) {
    const sub = li.querySelector('.sub');
    if (sub) sub.hidden = true;
  }

  const mainOf = (btn) => btn.closest('.menu > ul > li');
  const isMain = (btn) => btn.classList.contains('bar');

  function showCard(key) {
    for (const c of cards) c.hidden = c.dataset.card !== key;
    box.scrollTop = 0;
  }

  function placePointer() {
    if (!current) return;
    const m = menu.getBoundingClientRect();
    const r = current.getBoundingClientRect();
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
    if (focus) btn.focus();
  }

  function openSub(li, focusFirst = false) {
    let opened = false;
    for (const m of mains) {
      const sub = m.querySelector('.sub');
      if (!sub) continue;
      const open = m === li;
      sub.hidden = !open;
      m.querySelector('.bar').setAttribute('aria-expanded', String(open));
      opened ||= open;
    }
    requestAnimationFrame(placePointer);
    if (opened && focusFirst) highlight(li.querySelector('.sub__bar'), { focus: true });
    return opened;
  }

  menu.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (b) highlight(b);
  });
  menu.addEventListener('focusin', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (b) highlight(b);
  });
  const narrow = matchMedia('(max-width: 899px)');
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (!b) return;
    // on phones the details box sits under the menu, so bring it into view after a tap
    if (narrow.matches && (!isMain(b) || !mainOf(b).querySelector('.sub'))) {
      requestAnimationFrame(() => box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
    if (isMain(b)) {
      const li = mainOf(b);
      const sub = li.querySelector('.sub');
      if (sub && !sub.hidden) {
        openSub(null);
        highlight(b);
      } else if (!openSub(li, e.detail === 0)) {
        highlight(b);
      } else if (e.detail !== 0) {
        highlight(li.querySelector('.sub__bar'));
      }
      return;
    }
    highlight(b);
    if (b.dataset.href) window.open(b.dataset.href, '_blank', 'noopener');
  });
  menu.addEventListener('keydown', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (!b) return;
    const visible = [...menu.querySelectorAll('.bar, .sub:not([hidden]) .sub__bar')];
    const i = visible.indexOf(b);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      highlight(visible[(i + step + visible.length) % visible.length], { focus: true });
    } else if (e.key === 'ArrowRight' && isMain(b)) {
      e.preventDefault();
      openSub(mainOf(b), true);
    } else if ((e.key === 'ArrowLeft' || e.key === 'Escape') && !isMain(b)) {
      e.preventDefault();
      const li = mainOf(b);
      openSub(null);
      highlight(li.querySelector('.bar'), { focus: true });
    }
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
