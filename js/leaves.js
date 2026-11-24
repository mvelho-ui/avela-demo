'use strict';
// =====================================================================
//  Folhas de outono: caem do céu, ficam pousadas no chão e levantam-se
//  quando a Avelã passa a correr, rebola ou aterra com força. O vento do
//  Barão Gralha também as sopra. Só activo em níveis com L.autumn.
// =====================================================================
const Leaves = {
  list: [], on: false,
  COLORS: ['#d9542a', '#f0803a', '#e0b02a', '#b5471a', '#f2cc45', '#8a4a1a'],

  init(L) {
    this.list = []; this.on = !!L.autumn;
    if (!this.on) return;
    let s = 777;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let tx = 1; tx < L.cols - 1; tx++) {
      for (let ty = 1; ty < L.rows; ty++) {           // primeira superfície de terra exposta ao céu
        const ch = L.get(tx, ty), up = L.get(tx, ty - 1);
        if (ch === '.' || ch === 'T' || ch === 'L' || ONEWAY[ch]) continue;   // ar, troncos, copas, pontes
        if (!(ch === '#' || SLOPE[ch]) || (up !== '.' && up !== 'T')) break;
        if (rnd() < 0.42) {
          const n = 3 + Math.floor(rnd() * 7);
          for (let i = 0; i < n; i++) {
            const x = tx * T + rnd() * T;
            const f = L.floorAt(x, ty * T - 2, ty * T + T);
            if (f) this.list.push(this.leaf(x, f.y, true, rnd));
          }
        }
        break;
      }
    }
  },
  leaf(x, y, rest, rnd = Math.random) {
    return { x, y, vx: 0, vy: 0, rest, t: rnd() * 6, c: this.COLORS[Math.floor(rnd() * this.COLORS.length)], w: rnd() < 0.5 ? 3 : 2 };
  },
  kick(x, y, radius, power, vx) {
    for (const f of this.list) {
      if (!f.rest || Math.abs(f.x - x) > radius || Math.abs(f.y - y) > 8) continue;
      f.rest = false; f.vy = -(power * (0.6 + Math.random() * 0.6)); f.vx = vx * 0.35 + (Math.random() - 0.5) * 80;
    }
  },
  update(dt, game) {
    if (!this.on) return;
    const L = game.level, p = game.player, wind = game.wind || 0;
    // folhas novas a cair do céu
    if (Math.random() < dt * 3.5) {
      const x = game.camX + Math.random() * VIEW_W * 1.3 - VIEW_W * 0.15, y = game.camY - 6;
      if (L.get(Math.floor(x / T), Math.floor(y / T)) === '.') { const f = this.leaf(x, y, false); f.vy = 20; this.list.push(f); }
    }
    // a correr ou a rebolar pelo chão: levanta as folhas à volta dos pés
    if (p.state === 'normal' && p.onGround && (Math.abs(p.vx) > 80 || p.rolling))
      this.kick(p.x, p.y, 9, 50 + Math.abs(p.vx) * 0.45, p.vx);
    for (const f of this.list) {
      if (f.rest) {
        if (wind && Math.abs(f.x - game.camX - VIEW_W / 2) < VIEW_W && Math.random() < dt * 1.5) { f.rest = false; f.vy = -40 - Math.random() * 70; }
        continue;
      }
      f.t += dt;
      f.vy = Math.min(f.vy + 260 * dt, 34);                     // cai devagar
      f.vx += (wind * 0.6 - f.vx * 1.2) * dt + Math.sin(f.t * 3) * 30 * dt;
      const py = f.y;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (SOLID[L.get(Math.floor(f.x / T), Math.floor(f.y / T))] && f.vy < 0) f.vy = 10;
      if (f.vy > 0) {
        const fl = L.floorAt(f.x, py - 1, f.y);
        if (fl) { f.y = fl.y; f.rest = true; f.vx = 0; }
      }
      if (f.y > L.height || f.x < 0 || f.x > L.width) f.dead = true;
    }
    if (this.list.length > 1400) {                               // limita: tira as mais antigas longe da câmara
      const cx = game.camX + VIEW_W / 2;
      this.list = this.list.filter((f, i) => !f.dead && (i > 300 || Math.abs(f.x - cx) < VIEW_W));
    } else if (Math.random() < 0.02) this.list = this.list.filter(f => !f.dead);
  },
  draw(ctx, cx, cy) {
    if (!this.on) return;
    for (const f of this.list) {
      if (f.dead || f.x < cx - 4 || f.x > cx + VIEW_W + 4 || f.y < cy - 4 || f.y > cy + VIEW_H + 4) continue;
      ctx.fillStyle = f.c;
      if (f.rest) ctx.fillRect(Math.round(f.x), Math.round(f.y) - 1, f.w, 1);
      else {
        const sw = Math.sin(f.t * 2.6) * 3;
        ctx.fillRect(Math.round(f.x + sw), Math.round(f.y) - 1, Math.cos(f.t * 2.6) > 0 ? 3 : 2, 2);
      }
    }
  },
};
