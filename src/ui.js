// The menu screen.
// Desktop: highlight a bar to see its card in the box, click a section to open its items.
// Phones: the menu sits under the scene, a section drills down in place and details slide up
// in a sheet. Every section and item has its own address (#work/chase) that can be shared,
// and the back button steps back through them.
const narrowQuery = matchMedia('(max-width: 899px)');

// Little menu sounds made on the fly with Web Audio (no files). Off unless switched on.
function createSound() {
  let ctx = null;
  let on = false;
  let last = 0;
  try {
    on = localStorage.getItem('pv-sound') === 'on';
  } catch {}

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, { type = 'sine', gain = 0.05, at = 0 } = {}) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  // browsers only let audio start from a click or key press
  const unlock = () => on && ensure();
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });

  return {
    get on() {
      return on;
    },
    set(v) {
      on = v;
      try {
        localStorage.setItem('pv-sound', v ? 'on' : 'off');
      } catch {}
    },
    tick() {
      if (!on || !ctx || ctx.state !== 'running') return;
      const now = performance.now();
      if (now - last < 55) return;
      last = now;
      tone(1750, 0.05, { type: 'triangle', gain: 0.03 });
    },
    select() {
      if (!on) return;
      tone(988, 0.18, { gain: 0.045 });
      tone(1480, 0.26, { gain: 0.04, at: 0.075 });
    },
    back() {
      if (!on) return;
      tone(740, 0.14, { gain: 0.04 });
      tone(494, 0.2, { gain: 0.035, at: 0.065 });
    },
  };
}

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
  const soundBtn = document.querySelector('[data-sound]');
  const sound = createSound();

  let world = null;
  let current = null;
  let shot = 0;
  let shotTimer = 0;
  let sheetOpen = false;
  let booting = true; // no focus jumps while the page sets itself up from the address
  let opener = null;
  let depth = history.state?.pvDepth ?? 0; // how many of our own entries sit on the history stack

  for (const li of mains) {
    const sub = li.querySelector('.sub');
    if (sub) sub.hidden = true;
  }

  const narrow = () => narrowQuery.matches;
  const mainOf = (btn) => btn.closest('.menu > ul > li');
  const isMain = (btn) => btn.classList.contains('bar');
  const subOf = (li) => li?.querySelector('.sub') ?? null;
  const barOf = (li) => li.querySelector('.bar');
  const keyOf = (li) => barOf(li).dataset.card;

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
    const next = Number(barOf(li).dataset.shot || 0);
    if (next === shot) return;
    shot = next;
    clearTimeout(shotTimer);
    // short delay so sweeping the mouse over the menu doesn't send the camera everywhere
    shotTimer = setTimeout(() => world?.goTo(shot), 160);
  }

  // returns true when the highlighted bar actually changed
  function highlight(btn, { focus = false } = {}) {
    let changed = false;
    if (current !== btn) {
      changed = true;
      current?.classList.remove('is-active');
      current = btn;
      btn.classList.add('is-active');
      const li = mainOf(btn);
      for (const m of mains) barOf(m).classList.toggle('is-current', m === li);
      showCard(btn.dataset.card);
      goToShot(li);
      placePointer();
    }
    if (focus) btn.focus({ preventScroll: true });
    return changed;
  }

  function openSub(li) {
    let opened = false;
    for (const m of mains) {
      const sub = subOf(m);
      const open = !!sub && m === li;
      if (sub) {
        sub.hidden = !open;
        barOf(m).setAttribute('aria-expanded', String(open));
      }
      m.classList.toggle('is-open', open);
      opened ||= open;
    }
    menu.classList.toggle('is-open', opened);
    requestAnimationFrame(placePointer);
    return opened;
  }

  // the phone details sheet
  function setSheet(open) {
    if (open === sheetOpen) return;
    sheetOpen = open;
    box.classList.toggle('is-open', open);
    scrim.hidden = !open;
    if (booting) return;
    if (open) {
      opener = current;
      closeBtn.focus({ preventScroll: true });
    } else {
      opener?.focus({ preventScroll: true });
    }
  }

  // ---- addresses: '' (start), '#about', '#work', '#work/chase', '#controls' ----
  const urlFor = (hash) => hash || location.pathname + location.search;
  const parentOf = (hash) => {
    const parts = hash.replace(/^#/, '').split('/');
    return parts.length > 1 ? `#${parts[0]}` : '';
  };

  function parse(hash) {
    const [sec, item] = decodeURIComponent(hash.replace(/^#/, '')).split('/');
    if (sec === 'controls') return { controls: true };
    const li = mains.find((m) => keyOf(m) === sec);
    if (!li) return null;
    const itemBtn = item ? [...li.querySelectorAll('.sub__bar')].find((b) => b.dataset.card === item) ?? null : null;
    return { li, itemBtn };
  }

  // put the menu, card, camera and sheet into the state an address describes
  function applyHash(hash) {
    const st = parse(hash);
    if (!st) {
      const was = current ? mainOf(current) : null;
      openSub(null);
      setSheet(false);
      highlight(was ? barOf(was) : barOf(mains[0]));
      return;
    }
    if (st.controls) {
      showCard('controls');
      setSheet(narrow());
      return;
    }
    const { li, itemBtn } = st;
    const hasSub = !!subOf(li);
    openSub(hasSub ? li : null);
    highlight(itemBtn || barOf(li));
    setSheet(narrow() && (!!itemBtn || !hasSub));
  }

  function navigate(hash) {
    if ((location.hash || '') === hash) {
      applyHash(hash);
      return;
    }
    depth += 1;
    history.pushState({ pvDepth: depth }, '', urlFor(hash));
    applyHash(hash);
  }

  // step out to a shallower address; on phones that's the same as pressing back
  function leave(target) {
    sound.back();
    if (narrow() && depth > 0) {
      history.back();
      return;
    }
    if (depth === 0) {
      history.replaceState({ pvDepth: 0 }, '', urlFor(target));
      applyHash(target);
      return;
    }
    navigate(target);
  }

  addEventListener('popstate', (e) => {
    depth = e.state?.pvDepth ?? 0;
    applyHash(location.hash);
  });

  menu.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return; // on phones a tap does the work, not a finger passing over
    const b = e.target.closest('.bar, .sub__bar');
    if (b && highlight(b)) sound.tick();
  });
  menu.addEventListener('focusin', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (b) highlight(b);
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (!b) return;
    const li = mainOf(b);
    if (isMain(b)) {
      const sub = subOf(li);
      if (sub && !sub.hidden) {
        // an open section's bar closes it (on phones it's the back bar)
        leave('');
        if (!narrow()) highlight(b, { focus: e.detail === 0 });
        return;
      }
      sound.select();
      navigate(`#${b.dataset.card}`);
      // from the keyboard, land on the first item so the arrows carry on down the list
      if (sub && e.detail === 0 && !narrow()) highlight(li.querySelector('.sub__bar'), { focus: true });
      return;
    }
    sound.select();
    if (b.dataset.href) {
      window.open(b.dataset.href, '_blank', 'noopener');
      return;
    }
    navigate(`#${keyOf(li)}/${b.dataset.card}`);
  });
  menu.addEventListener('keydown', (e) => {
    const b = e.target.closest('.bar, .sub__bar');
    if (!b) return;
    const visible = [...menu.querySelectorAll('.bar, .sub:not([hidden]) .sub__bar')].filter((x) => x.offsetParent);
    const i = visible.indexOf(b);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      if (highlight(visible[(i + step + visible.length) % visible.length], { focus: true })) sound.tick();
    } else if (e.key === 'ArrowRight' && isMain(b) && subOf(mainOf(b))?.hidden) {
      e.preventDefault();
      b.click();
    } else if ((e.key === 'ArrowLeft' || e.key === 'Escape') && !isMain(b)) {
      e.preventDefault();
      const li = mainOf(b);
      leave('');
      if (!narrow()) highlight(barOf(li), { focus: true });
    }
  });

  closeBtn.addEventListener('click', () => leave(parentOf(location.hash)));
  scrim.addEventListener('click', () => leave(parentOf(location.hash)));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) {
      e.preventDefault();
      leave(parentOf(location.hash));
    }
  });
  narrowQuery.addEventListener('change', () => {
    if (!narrow()) setSheet(false);
    requestAnimationFrame(placePointer);
  });

  document.querySelector('[data-show="controls"]')?.addEventListener('click', () => navigate('#controls'));

  function paintSound() {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', String(sound.on));
    soundBtn.textContent = sound.on ? 'Sound on' : 'Sound off';
  }
  soundBtn?.addEventListener('click', () => {
    sound.set(!sound.on);
    paintSound();
    sound.select();
  });
  paintSound();

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

  applyHash(location.hash);
  booting = false;

  return {
    attach(w) {
      world = w;
      if (still) {
        // ?still&item=N opens menu item N for screenshots
        const n = Number(new URLSearchParams(location.search).get('item') || 0);
        const li = mains[n] || mains[0];
        if (!openSub(li)) highlight(barOf(li));
        else highlight(li.querySelector('.sub__bar'));
        shot = Number(barOf(li).dataset.shot || 0);
        w.jump(shot);
        requestAnimationFrame(placePointer);
        return;
      }
      // arriving on a shared address: start the camera on that section's shot
      w.jump(shot);
    },
    ready() {
      root.classList.add('is-ready');
    },
    fallback() {
      root.classList.add('no-webgl');
    },
  };
}
