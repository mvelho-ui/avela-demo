'use strict';
// Teclado + comando (Gamepad API) + botões tácteis.
const Input = (() => {
  const KEYS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['KeyZ', 'Space', 'KeyK'], turbo: ['KeyX', 'ShiftLeft', 'ShiftRight', 'KeyL'],
    spin: ['KeyC', 'KeyJ'], throw: ['KeyV', 'KeyU'], super: ['KeyQ', 'KeyE'], start: ['Enter', 'NumpadEnter'], pause: ['Escape', 'KeyP'],
    mute: ['KeyM'],
  };
  const ACTIONS = Object.keys(KEYS);
  const down = new Set();
  const touch = {};
  const state = {};   // estado actual (held) e arestas (xxxPressed)
  const prev = {};
  ACTIONS.forEach(a => { state[a] = false; state[a + 'Pressed'] = false; prev[a] = false; touch[a] = false; });
  const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
  const latched = new Set();   // toques registados no evento (não se perdem toques muito rápidos)
  let anyKeyCb = null;

  window.addEventListener('keydown', e => {
    if (PREVENT.has(e.code)) e.preventDefault();
    down.add(e.code);
    if (!e.repeat) for (const a of ACTIONS) if (KEYS[a].includes(e.code)) latched.add(a);
    if (anyKeyCb) anyKeyCb();
  });
  window.addEventListener('keyup', e => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  function bindTouch() {
    const box = document.getElementById('touch');
    if (!box) return;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse || 'ontouchstart' in window) box.classList.add('on');
    box.querySelectorAll('button').forEach(b => {
      const a = b.dataset.a;
      const on = e => { e.preventDefault(); touch[a] = true; latched.add(a); b.classList.add('down'); if (anyKeyCb) anyKeyCb(); };
      const off = e => { e.preventDefault(); touch[a] = false; b.classList.remove('down'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  function pad() {
    const r = {};
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gps && Array.from(gps).find(g => g && g.connected);
    if (!gp) return r;
    const b = i => gp.buttons[i] && gp.buttons[i].pressed;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    r.left = b(14) || ax < -0.4; r.right = b(15) || ax > 0.4;
    r.up = b(12) || ay < -0.5; r.down = b(13) || ay > 0.5;
    r.jump = b(0); r.spin = b(2); r.throw = b(3); r.super = b(4) || b(6); r.turbo = b(1) || b(5) || b(7);
    r.start = b(9); r.pause = b(9) || b(8);
    return r;
  }

  // Chamado uma vez por frame. As arestas acumulam até serem consumidas (clearEdges).
  function poll() {
    const p = pad();
    for (const a of ACTIONS) {
      const held = KEYS[a].some(k => down.has(k)) || touch[a] || !!p[a];
      if ((held && !prev[a]) || latched.has(a)) state[a + 'Pressed'] = true;
      state[a] = held;
      prev[a] = held;
    }
    latched.clear();
    if (p.jump || p.start) { if (anyKeyCb) anyKeyCb(); }
  }
  function clearEdges() { for (const a of ACTIONS) state[a + 'Pressed'] = false; }
  function onAnyKey(cb) { anyKeyCb = cb; }

  return { state, poll, clearEdges, bindTouch, onAnyKey, touch };
})();
