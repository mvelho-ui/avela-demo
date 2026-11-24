'use strict';
// =====================================================================
//  Reino da Selva: lianas, troncos a flutuar, crocodilos, piranhas, rãs venenosas,
//  plantas carnívoras e bolhas de ar (para os mergulhos). Entidades e desenhos.
// =====================================================================

// Liana: pendurada de um ramo alto. A Avelã agarra-se ao tocar-lhe no ar, balança com ← → e solta-se com Z.
class Liana extends Ent {
  constructor(d) { super(d); this.len = d.len || 120; this.theta = 0; this.seed = d.x * 0.01; }
  tip() { return { x: this.x + Math.sin(this.theta) * this.len, y: this.y + Math.cos(this.theta) * this.len }; }
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    if (p.state === 'swing' && p.liana === this) { this.theta = p.theta; return; }
    this.theta += (Math.sin(this.t * 1.3 + this.seed) * 0.1 - this.theta) * Math.min(1, dt * 2);   // baloiça devagar
    if (p.state !== 'normal' || p.onGround || p.swingCool > 0 || p.hurtT > 0) return;
    // a mão da Avelã perto da corda?
    const hx = p.x, hy = p.y - 18, b = this.tip();
    const ax = b.x - this.x, ay = b.y - this.y, L2 = ax * ax + ay * ay;
    const u = clamp(((hx - this.x) * ax + (hy - this.y) * ay) / L2, 0, 1);
    const dx = hx - (this.x + ax * u), dy = hy - (this.y + ay * u);
    if (u * this.len > 30 && dx * dx + dy * dy < 100) p.startSwing(this, Math.max(36, u * this.len), game);
  }
  draw(ctx, game) { Gfx.liana(ctx, this, game.player); }
}

// Tronco a flutuar: vai com a corrente; no fim do rio afunda-se e volta a aparecer no início.
class FloatLog extends Ent {
  constructor(d) { super(d); this.platform = true; this.hw = 22; this.state = 'float'; this.dx = 0; this.base = d.y; this.timer = 0; }
  get top() { return this.base - 5 + Math.sin(this.t * 2 + this.x0) * 1.5 + (this.state === 'sink' ? (1 - this.timer) * 14 : 0); }
  update(dt, game) {
    this.t += dt; const ox = this.x;
    if (this.state === 'float') {
      this.x += this.speed * dt;
      if (this.x > this.x1) { this.state = 'sink'; this.timer = 1; }
    } else if (this.state === 'sink') {
      this.x += this.speed * 0.5 * dt; this.timer -= dt;
      if (this.timer <= 0) { this.state = 'gone'; this.timer = 1.2; }
    } else { this.timer -= dt; if (this.timer <= 0) { this.state = 'float'; this.x = this.x0; } }
    this.dx = this.x - ox;
  }
  solid() { return this.state !== 'gone' && !(this.state === 'sink' && this.timer < 0.4); }
  draw(ctx) { if (this.state !== 'gone') Gfx.floatLog(ctx, this); }
}

// Crocodilo: anda devagar à tona; as costas são uma plataforma. De vez em quando abre a boca: cuidado com a cabeça.
class Croc extends Ent {
  constructor(d) { super(d); this.platform = true; this.hw = 24; this.dir = 1; this.base = d.y; this.dx = 0; this.mouth = 0; this.timer = 2 + Math.random(); this.state = 'swim'; }
  get top() { return this.base - 4 + Math.sin(this.t * 1.6) * 1; }
  head() { return { x: this.x + this.dir * 30, y: this.base - 6, hw: 8, hh: 6 }; }
  update(dt, game) {
    this.t += dt; const ox = this.x, p = game.player;
    this.x += this.dir * 22 * dt;
    if (this.x > this.x1) this.dir = -1; else if (this.x < this.x0) this.dir = 1;
    this.timer -= dt;
    if (this.state === 'swim' && this.timer <= 0) { this.state = 'open'; this.timer = 0.9; Sound.sfx('chomp'); }
    else if (this.state === 'open' && this.timer <= 0) { this.state = 'swim'; this.timer = 2.2 + Math.random() * 1.2; }
    this.mouth += ((this.state === 'open' ? 1 : 0) - this.mouth) * Math.min(1, dt * 12);
    if (this.mouth > 0.5 && p.state !== 'dead' && overlaps(playerBox(p), this.head())) p.hurt(game, this.x);
    this.dx = this.x - ox;
  }
  solid() { return true; }
  draw(ctx) { Gfx.croc(ctx, this); }
}

// Piranha: nada debaixo de água entre x0 e x1; quando a Avelã passa por cima, salta fora de água.
class Piranha extends Enemy {
  constructor(d) { super(d); this.flies = true; this.state = 'swim'; this.dir = 1; this.home = d.y; this.vy = 0; this.cool = 1 + Math.random(); }
  box() { return { x: this.x, y: this.y, hw: 6, hh: 5 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player;
    this.cool -= dt;
    const L = game.level, chase = p.state !== 'dead' && L.isWater(p.x, p.y - 10) && Math.abs(p.x - this.x) < 90 && Math.abs(p.y - this.y) < 80;
    if (this.state === 'swim' && chase) {                     // a Avelã está na água perto: vai atrás dela
      this.dir = p.x > this.x ? 1 : -1;
      this.x = clamp(this.x + this.dir * 62 * dt, this.x0, this.x1);
      this.y += clamp(p.cy - this.y, -45 * dt, 45 * dt);
      this.y = Math.max(this.y, L.surfaceY ? L.surfaceY : this.y);
    } else if (this.state === 'swim') {
      this.x += this.dir * 40 * dt; this.y += (this.home + Math.sin(this.t * 3) * 4 - this.y) * Math.min(1, dt * 3);
      if (this.x > this.x1) this.dir = -1; else if (this.x < this.x0) this.dir = 1;
      if (this.cool <= 0 && p.state !== 'dead' && Math.abs(p.x - this.x) < 44 && p.y < this.home) { this.state = 'jump'; this.vy = -420; this.dir = p.x > this.x ? 1 : -1; Sound.sfx('splash'); }
    } else {
      this.vy += 900 * dt; this.y += this.vy * dt; this.x += this.dir * 40 * dt;
      if (this.vy > 0 && this.y >= this.home - 8 && L.isWater(this.x, this.y)) { this.state = 'swim'; this.cool = 2 + Math.random(); }
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.piranha(ctx, this); }
}

// Rã venenosa: dá saltos em arco atrás da Avelã.
class Frog extends Enemy {
  constructor(d) { super(d); this.dir = -1; this.vy = 0; this.vx = 0; this.air = false; this.cool = 1 + Math.random(); this.col = d.col || 0; }
  box() { return { x: this.x, y: this.y - 6, hw: 7, hh: 6 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, L = game.level;
    if (Math.abs(this.x - p.x) > VIEW_W) return;
    if (!this.air) {
      this.cool -= dt;
      if (this.cool <= 0) { this.dir = p.x > this.x ? 1 : -1; this.vx = this.dir * 110; this.vy = -300; this.air = true; Sound.sfx('jump'); }
    } else {
      const prevY = this.y;
      this.vy += 900 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (SOLID[L.get(Math.floor((this.x + this.dir * 6) / T), Math.floor((this.y - 6) / T))]) { this.x -= this.vx * dt; this.vx = -this.vx * 0.3; }
      if (this.vy > 0) { const f = L.floorAt(this.x, prevY - 2, this.y + 2); if (f) { this.y = f.y; this.air = false; this.cool = 1.3 + Math.random() * 0.6; } }
      if (this.y > L.height) this.alive = false;
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.frog(ctx, this); }
}

// Planta carnívora: escondida na erva; abre-se e morde quando a Avelã chega perto. Só se lhe acerta aberta.
class Plant extends Enemy {
  constructor(d) { super(d); this.h = 0; this.state = 'shut'; this.timer = 0; this.stays = true; this.dir = -1; }
  get hittable() { return this.h > 0.5; }
  box() { return { x: this.x + this.dir * 16 * this.h, y: this.y - 8 - 12 * this.h, hw: 8, hh: 8 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, dx = p.x - this.x;
    this.timer -= dt;
    if (this.state === 'shut') {
      this.h = Math.max(0, this.h - dt * 4);
      if (this.timer <= 0 && p.state !== 'dead' && Math.abs(dx) < 54 && Math.abs(p.y - this.y) < 40) { this.state = 'bite'; this.timer = 0.8; this.dir = dx > 0 ? 1 : -1; Sound.sfx('chomp'); }
    } else {
      this.h = Math.min(1, this.h + dt * 7);
      if (this.timer <= 0) { this.state = 'shut'; this.timer = 1.1; }
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.plant(ctx, this); }
}

// Bolhas de ar: um respiradouro no fundo da água solta bolhinhas e, de tempos a tempos, uma bolha grande
// que sobe; tocar-lhe debaixo de água enche o ar.
class BubbleVent extends Ent {
  constructor(d) { super(d); this.timer = 1 + Math.random(); }
  update(dt, game) {
    this.t += dt; this.timer -= dt;
    if (Math.random() < dt * 5) game.parts.push(new Particle({ kind: 'bubble', x: this.x + (Math.random() - 0.5) * 6, y: this.y - 4, vy: -40 - Math.random() * 20, life: 1.6, size: 1 }));
    if (this.timer <= 0) { this.timer = 2.6; game.ents.push(new AirBubble({ x: this.x, y: this.y - 8 })); }
  }
  draw(ctx) { Gfx.vent(ctx, this); }
}
class AirBubble extends Ent {
  constructor(d) { super(d); this.r = 3; }
  box() { return { x: this.x, y: this.y, hw: this.r + 2, hh: this.r + 2 }; }
  update(dt, game) {
    this.t += dt; this.r = Math.min(8, this.r + dt * 6);
    this.y -= 38 * dt; this.x += Math.sin(this.t * 3) * 12 * dt;
    const L = game.level;
    if (!L.water.has(L.idx(Math.floor(this.x / T), Math.floor((this.y - 4) / T)))) { this.alive = false; return; }
    const p = game.player;
    if (this.r > 6 && p.state === 'normal' && this.touching(game)) { this.alive = false; p.air = game.airMax(); Sound.sfx('gulp'); game.sparkle(this.x, this.y, '#ffffff'); }
  }
  draw(ctx) { Gfx.airBubble(ctx, this); }
}

// Tirolesa: corda esticada a descer; a Avelã agarra-se no ar e desliza cada vez mais depressa.
class Zipline extends Ent {
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    if (p.state !== 'normal' || p.onGround || p.swingCool > 0 || p.hurtT > 0) return;
    const hx = p.x, hy = p.y - 18, ax = this.x1 - this.x, ay = this.y1 - this.y, L2 = ax * ax + ay * ay;
    const u = clamp(((hx - this.x) * ax + (hy - this.y) * ay) / L2, 0, 1);
    if (u >= 0.95) return;
    const dx = hx - (this.x + ax * u), dy = hy - (this.y + ay * u);
    if (dx * dx + dy * dy < 110) p.startZip(this, u);
  }
  draw(ctx, game) { Gfx.zipline(ctx, this, game.player); }
}

// Macaco: sentado nas copas; atira cocos em arco quando a Avelã está por perto.
class Monkey extends Enemy {
  constructor(d) { super(d); this.cool = 1 + Math.random(); this.throwT = 0; this.dir = -1; }
  box() { return { x: this.x, y: this.y - 9, hw: 7, hh: 9 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, dx = p.x - this.x;
    this.dir = dx > 0 ? 1 : -1; this.cool -= dt; if (this.throwT > 0) this.throwT -= dt;
    if (this.cool <= 0 && p.state !== 'dead' && Math.abs(dx) < 220 && Math.abs(p.y - this.y) < 160) {
      const tf = 0.8, g = PHYS.burrGravity;
      const vx = clamp(dx / tf, -240, 240), vy = clamp(((p.y - 10) - (this.y - 16) - 0.5 * g * tf * tf) / tf, -460, -120);
      game.ents.push(new Burr({ x: this.x + this.dir * 6, y: this.y - 16, vx, vy, kind: 'coconut' }));
      this.cool = 2.2; this.throwT = 0.35; Sound.sfx('toss');
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.monkey(ctx, this); }
}

Object.assign(ENTITY_TYPES, { liana: Liana, log: FloatLog, croc: Croc, piranha: Piranha, frog: Frog, plant: Plant, vent: BubbleVent,
  zipline: Zipline, monkey: Monkey });

// ---------------------------------------------------------------------
//  Desenhos
// ---------------------------------------------------------------------
Object.assign(Gfx, {
  liana(ctx, l, p) {
    const swing = p.state === 'swing' && p.liana === l;
    const th = l.theta, tip = l.tip();
    ctx.strokeStyle = '#4a7a22'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(l.x, l.y);
    const mx = (l.x + tip.x) / 2 + Math.cos(th) * (swing ? 0 : Math.sin(l.t * 2 + l.seed) * 3), my = (l.y + tip.y) / 2;
    ctx.quadraticCurveTo(mx, my, tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = '#7ab83a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(l.x + 1, l.y); ctx.quadraticCurveTo(mx + 1, my, tip.x + 1, tip.y); ctx.stroke();
    for (let k = 1; k < 6; k++) {                          // folhinhas ao longo da liana
      const u = k / 6, x = lerp(l.x, tip.x, u), y = lerp(l.y, tip.y, u);
      ctx.fillStyle = k % 2 ? '#3f9a3a' : '#6cc45a'; ctx.fillRect(Math.round(x) + (k % 2 ? 1 : -4), Math.round(y), 3, 2);
    }
    ctx.fillStyle = '#2f6a1e'; ctx.fillRect(Math.round(l.x) - 3, Math.round(l.y) - 2, 7, 4);   // nó no ramo
  },
  floatLog(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.top);
    ctx.save(); if (e.state === 'sink') ctx.globalAlpha = Math.max(0, e.timer);
    ctx.fillStyle = '#5e3518'; ctx.fillRect(x - 22, y, 44, 8);
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 22, y, 44, 3);
    ctx.fillStyle = '#4a2a12'; ctx.fillRect(x - 12, y + 3, 1, 5); ctx.fillRect(x + 6, y + 2, 1, 5);
    ell(ctx, x + 22, y + 4, 3, 4, '#c9925a'); ell(ctx, x + 22, y + 4, 1.5, 2, '#a8703f');
    ctx.fillStyle = '#5cae4a'; ctx.fillRect(x - 8, y - 1, 5, 1); ctx.fillRect(x + 10, y - 1, 3, 1);
    ctx.fillStyle = 'rgba(220,245,255,0.7)'; ctx.fillRect(x - 25 + Math.floor(e.t * 8) % 3, y + 7, 4, 1); ctx.fillRect(x + 24 - Math.floor(e.t * 8) % 3, y + 7, 4, 1);
    ctx.restore();
  },
  croc(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.top)); ctx.scale(e.dir, 1);
    const G = ['#2a4a1e', '#3e6a2a', '#5e8a3a', '#c9c08a'];
    ctx.fillStyle = G[0]; ctx.fillRect(-26, 1, 48, 7);
    ctx.fillStyle = G[1]; ctx.fillRect(-26, 0, 48, 3);
    ctx.fillStyle = G[2]; for (let k = -22; k < 18; k += 6) ctx.fillRect(k, -1, 3, 2);                 // escamas das costas
    poly(ctx, [[-26, 1], [-38, 4 + Math.sin(e.t * 4)], [-26, 6]], G[0]);                                 // cauda
    const m = e.mouth;                                                                                    // cabeça e boca
    poly(ctx, [[22, 0], [36, 1 - m * 6], [36, 3 - m * 5], [22, 4]], G[1]);
    poly(ctx, [[22, 4], [36, 5 + m * 5], [36, 8], [22, 8]], G[0]);
    if (m > 0.2) { ctx.fillStyle = '#ffffff'; for (let k = 24; k < 36; k += 3) { ctx.fillRect(k, 3 - m * 4, 1, 2); ctx.fillRect(k + 1, 5 + m * 3, 1, 2); } ctx.fillStyle = '#a8122a'; ctx.fillRect(24, 3, 10, 2); }
    ell(ctx, 24, -1, 2.4, 2, G[2]); ctx.fillStyle = '#ffd23f'; ctx.fillRect(24, -2, 2, 1);                  // olho
    ctx.fillStyle = Math.floor(e.t * 4) % 2 ? '#ff3b3b' : '#a8122a'; ctx.fillRect(18, -4, 2, 2);           // antena do Driller
    ctx.fillStyle = '#8a8f99'; ctx.fillRect(18.5, -2, 1, 2);
    ctx.restore();
  },
  piranha(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    poly(ctx, [[-6, 0], [-11, -4], [-11, 4]], '#a8122a');                                                // cauda
    ell(ctx, 0, 0, 7, 5, '#5a6a8a'); ell(ctx, 1, 2, 5, 2.5, '#e8503a');                                   // corpo e barriga vermelha
    ctx.fillStyle = '#ffffff'; ctx.fillRect(4, 2, 1, 2); ctx.fillRect(6, 2, 1, 2);                        // dentes
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(3, -2, 2, 2); ctx.fillStyle = '#1a1020'; ctx.fillRect(4, -2, 1, 1);
    Gfx.ctlLight(ctx, e, 0, -7);
    ctx.restore();
  },
  frog(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const C = [['#1f6ad9', '#4a9aff', '#0a1a3a'], ['#e8203a', '#ff7a5a', '#2a0a10'], ['#ffd23f', '#fff09a', '#3a2a0a']][e.col % 3];
    const st = e.air ? 1 : 0;
    ctx.fillStyle = C[0]; ctx.fillRect(-6, -2 - st * 2, 3, 2 + st * 2); ctx.fillRect(3, -2 - st * 2, 3, 2 + st * 2);   // pernas
    ell(ctx, 0, -5, 6, 4, C[0]); ell(ctx, 1, -6, 4, 2.5, C[1]);
    ctx.fillStyle = C[2]; ctx.fillRect(-3, -6, 2, 1); ctx.fillRect(1, -4, 2, 1); ctx.fillRect(-1, -8, 1, 1);   // manchas
    ell(ctx, 3, -9, 2, 2, C[1]); ctx.fillStyle = '#1a1020'; ctx.fillRect(4, -10, 1, 1);
    Gfx.ctlLight(ctx, e, -1, -13);
    ctx.restore();
  },
  plant(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), h = e.h, d = e.dir;
    ctx.fillStyle = '#2f7a2a'; for (const [dx, a] of [[-7, -0.6], [7, 0.6], [-3, -0.3], [4, 0.3]]) { ctx.save(); ctx.translate(x + dx, y); ctx.rotate(a); ell(ctx, 0, -4, 2.5, 5, '#3f9a3a'); ctx.restore(); }   // folhas
    const hx = x + d * 16 * h, hy = y - 6 - 12 * h;
    ctx.strokeStyle = '#2f7a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, hy + 6, hx, hy); ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.scale(d, 1);
    const open = h * (0.6 + Math.abs(Math.sin(e.t * 18)) * 0.4);
    ctx.save(); ctx.rotate(-0.9 * open); ell(ctx, 4, -1, 7, 4, '#c8203a'); ctx.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) ctx.fillRect(k * 3, 2, 1, 2); ctx.restore();
    ctx.save(); ctx.rotate(0.6 * open); ell(ctx, 4, 1, 7, 4, '#a8122a'); ctx.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) ctx.fillRect(k * 3, -3, 1, 2); ctx.restore();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(1, -3, 2, 1); ctx.fillRect(5, -4, 2, 1);                     // pintas
    ctx.restore();
    if (h > 0.3) Gfx.ctlLight(ctx, e, hx - 1, hy - 10);
  },
  vent(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    ell(ctx, x, y - 2, 8, 3, '#4a5a5a'); ell(ctx, x, y - 3, 4, 1.5, '#1a2a2a');
  },
  airBubble(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), r = Math.round(e.r);
    ctx.strokeStyle = 'rgba(230,250,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(200,240,255,0.25)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - Math.round(r * 0.5), y - Math.round(r * 0.5), 2, 2);
  },
  // cascata (animada): coluna de água a cair, com espuma em baixo
  waterfall(ctx, w, cx, cy, time) {
    if (w.x + w.w < cx - 8 || w.x > cx + VIEW_W + 8) return;
    ctx.fillStyle = 'rgba(120,200,240,0.75)'; ctx.fillRect(w.x, w.top, w.w, w.bottom - w.top);
    for (let k = 0; k < w.w; k += 3) {
      const off = (time * 140 + k * 37) % 40;
      for (let yy = w.top - 40 + off; yy < w.bottom; yy += 40) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(w.x + k, Math.max(w.top, yy), 1, 14); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < 6; k++) { const a = time * 5 + k; ctx.beginPath(); ctx.arc(w.x + w.w / 2 + Math.cos(a * 1.3) * w.w * 0.6, w.bottom - 2 + Math.sin(a) * 2, 3 + (k % 3), 0, Math.PI * 2); ctx.fill(); }
  },
  // raios de sol a atravessar as copas (por cima do cenário, suaves)
  sunbeams(ctx, camX, time) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const span = VIEW_W + 160, x = ((i * 137 - camX * 0.4) % span + span) % span - 80, a = 0.05 + 0.03 * Math.sin(time * 0.7 + i * 1.9);
      ctx.fillStyle = `rgba(255,240,170,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 22, 0); ctx.lineTo(x + 92, VIEW_H); ctx.lineTo(x + 50, VIEW_H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  // fundo da selva: névoa clara, camadas de árvores, troncos grandes e lianas penduradas
  jungleBg(ctx, camX, camY, L, time) {
    const oy = f => Math.round((camY - (L.bgRefY ?? L.height - VIEW_H)) * f);
    if (L.night) return this.jungleNightBg(ctx, camX, camY, L, time, oy);
    const layer = (ox, base, col, h, w, seed) => {
      ctx.fillStyle = col;
      for (let i = -1; i < VIEW_W / w + 2; i++) {
        const k = Math.floor(ox / w) + i, x = k * w - ox, r = hash2(k, seed);
        ctx.beginPath(); ctx.arc(x, base - h * (0.6 + r * 0.5), w * (0.55 + r * 0.25), 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - w * 0.6, base - h * (0.6 + r * 0.5), w * 1.2, VIEW_H);
      }
    };
    layer(camX * 0.1, 150 - oy(0.06), '#4f8a6a', 60, 60, 1);
    layer(camX * 0.2, 175 - oy(0.1), '#3a7454', 70, 48, 2);
    ctx.fillStyle = '#2a5a3e';                                       // troncos grandes
    for (let i = -1; i < 6; i++) { const k = Math.floor(camX * 0.3 / 90) + i, x = k * 90 - camX * 0.3 + hash2(k, 4) * 40; ctx.fillRect(Math.round(x), 0, 10 + Math.round(hash2(k, 5) * 8), VIEW_H); }
    layer(camX * 0.35, 200 - oy(0.16), '#2a6040', 60, 40, 3);
    ctx.strokeStyle = '#1f4a30'; ctx.lineWidth = 2;                  // lianas ao fundo
    for (let i = -1; i < 8; i++) { const k = Math.floor(camX * 0.45 / 60) + i, x = k * 60 - camX * 0.45 + hash2(k, 6) * 30, len = 40 + hash2(k, 7) * 70;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(time + k) * 4, len / 2, x, len); ctx.stroke(); }
  },
});

Object.assign(Gfx, {
  // selva à noite com trovoada (4-2): nuvens pesadas, relâmpagos ao longe e árvores gigantes
  jungleNightBg(ctx, camX, camY, L, time, oy) {
    const k = typeof Game !== 'undefined' && Game.boltK ? Game.boltK() : 0;
    ctx.fillStyle = 'rgba(40,46,80,0.6)';                            // nuvens a passar
    for (let i = -1; i < 7; i++) {
      const w = 110, ox = camX * 0.04 + time * 6, kk = Math.floor(ox / w) + i, x = kk * w - ox, r = hash2(kk, 11);
      ctx.beginPath(); ctx.ellipse(x, 22 + r * 26 - oy(0.02), 70 + r * 30, 16 + r * 8, 0, 0, 7); ctx.fill();
    }
    if (k > 0) {                                                     // o relâmpago: um risco aos ziguezagues e o céu a acender
      ctx.fillStyle = `rgba(190,200,255,${(0.45 * k).toFixed(3)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (k > 0.5) {
        ctx.strokeStyle = '#f4f6ff'; ctx.lineWidth = 2; ctx.beginPath();
        let x = Game.boltX, y = 0; ctx.moveTo(x, y);
        for (let s = 0; s < 9; s++) { x += (hash2(Game.boltSeed, s) - 0.5) * 30; y += 12 + hash2(s, Game.boltSeed) * 8; ctx.lineTo(Math.round(x), Math.round(y)); }
        ctx.stroke(); ctx.lineWidth = 1;
      }
    }
    const layer = (ox, base, col, h, w, seed) => {
      ctx.fillStyle = col;
      for (let i = -1; i < VIEW_W / w + 2; i++) {
        const kk = Math.floor(ox / w) + i, x = kk * w - ox, r = hash2(kk, seed);
        ctx.beginPath(); ctx.arc(x, base - h * (0.6 + r * 0.5), w * (0.55 + r * 0.25), 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - w * 0.6, base - h * (0.6 + r * 0.5), w * 1.2, VIEW_H);
      }
    };
    layer(camX * 0.1, 150 - oy(0.06), k > 0.5 ? '#3e5a6a' : '#22404a', 60, 60, 1);
    ctx.fillStyle = k > 0.5 ? '#2e4a4e' : '#173230';                 // troncos gigantes ao longe
    for (let i = -1; i < 6; i++) { const kk = Math.floor(camX * 0.25 / 80) + i, x = kk * 80 - camX * 0.25 + hash2(kk, 4) * 30; ctx.fillRect(Math.round(x), 0, 14 + Math.round(hash2(kk, 5) * 10), VIEW_H); }
    layer(camX * 0.2, 175 - oy(0.1), k > 0.5 ? '#2e5050' : '#1a3634', 70, 48, 2);
    layer(camX * 0.35, 200 - oy(0.16), k > 0.5 ? '#244440' : '#142c28', 60, 40, 3);
    ctx.strokeStyle = '#10241c'; ctx.lineWidth = 2;
    for (let i = -1; i < 8; i++) { const kk = Math.floor(camX * 0.45 / 60) + i, x = kk * 60 - camX * 0.45 + hash2(kk, 6) * 30, len = 40 + hash2(kk, 7) * 70;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(time * 1.6 + kk) * 6, len / 2, x, len); ctx.stroke(); }
    ctx.lineWidth = 1;
  },
  // pirilampos no chão da selva (por cima do véu da noite)
  fireflies(ctx, cx, cy, time, L) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const S = 80;
    for (let gx = Math.floor(cx / S) - 1; gx <= Math.floor((cx + VIEW_W) / S) + 1; gx++)
      for (let gy = Math.floor(cy / S) - 1; gy <= Math.floor((cy + VIEW_H) / S) + 1; gy++) {
        const h = hash2(gx * 3 + 1, gy * 5 + 2);
        if (h > 0.55) continue;
        const wx = gx * S + hash2(gx, gy) * S + Math.sin(time * 0.8 + h * 20) * 12, wy = gy * S + hash2(gy, gx) * S + Math.cos(time * 0.6 + h * 9) * 8;
        if (wy < (L.firefliesY || 0)) continue;
        const a = Math.max(0, Math.sin(time * 2.2 + h * 40));
        if (a < 0.05) continue;
        const sx = Math.round(wx - cx), sy = Math.round(wy - cy);
        ctx.fillStyle = `rgba(190,255,90,${(0.12 * a).toFixed(3)})`; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(230,255,140,${(0.9 * a).toFixed(3)})`; ctx.fillRect(sx, sy, 1, 1);
      }
    ctx.restore();
  },
  zipline(ctx, z, p) {
    ctx.fillStyle = '#4a2e18'; ctx.fillRect(Math.round(z.x) - 3, Math.round(z.y) - 6, 6, 40); ctx.fillRect(Math.round(z.x1) - 3, Math.round(z.y1) - 6, 6, 40);   // postes
    ctx.strokeStyle = '#c8b890'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(z.x1, z.y1); ctx.stroke();
    ctx.strokeStyle = '#8a7a5a'; ctx.beginPath(); ctx.moveTo(z.x, z.y + 1); ctx.lineTo(z.x1, z.y1 + 1); ctx.stroke();
    const riding = p.state === 'zip' && p.zip === z, u = riding ? p.zu : 0.03;
    const hx = Math.round(lerp(z.x, z.x1, u)), hy = Math.round(lerp(z.y, z.y1, u));
    ctx.fillStyle = '#7a7e89'; ctx.fillRect(hx - 3, hy - 2, 6, 4); ctx.fillStyle = '#4a4e58'; ctx.fillRect(hx - 1, hy + 2, 2, 8);   // roldana e pega
    if (riding && Math.random() < 0.5) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(hx - 4, hy - 3, 1, 1); ctx.fillRect(hx + 3, hy - 2, 1, 1); }   // faíscas
  },
  monkey(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const B = ['#5a3a1e', '#7a5230', '#d9b07a'];
    ctx.strokeStyle = B[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -4); ctx.quadraticCurveTo(-14, -2, -12, -12); ctx.quadraticCurveTo(-10, -16, -7, -13); ctx.stroke();   // cauda
    ell(ctx, 0, -6, 6, 6, B[0]); ell(ctx, 1, -5, 3.5, 4, B[2]);                          // corpo
    ell(ctx, 2, -14, 5, 4.5, B[0]); ell(ctx, 4, -13, 3, 3, B[2]);                      // cabeça
    ell(ctx, -2, -16, 2, 2, B[1]); ell(ctx, 6, -16, 2, 2, B[1]);                         // orelhas
    ctx.fillStyle = '#1a1020'; ctx.fillRect(4, -15, 1, 1); ctx.fillRect(6, -15, 1, 1);
    if (e.throwT > 0) { ctx.strokeStyle = B[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, -8); ctx.lineTo(7, -18); ctx.stroke(); ell(ctx, 8, -20, 3, 3, '#6a4020'); }
    else ell(ctx, 5, -6, 3, 3, '#6a4020');                                                 // coco nas mãos
    Gfx.ctlLight(ctx, e, 1, -21);
    ctx.restore();
  },
  // chuva (ecrã) para a tempestade
  rain(ctx, time) {
    ctx.strokeStyle = 'rgba(170,195,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 110; i++) {
      const sp = 380 + hash2(i, 3) * 180, x = ((hash2(i, 1) * (VIEW_W + 60) - time * 70) % (VIEW_W + 60) + VIEW_W + 60) % (VIEW_W + 60) - 30;
      const y = ((hash2(i, 2) * (VIEW_H + 30) + time * sp) % (VIEW_H + 30)) - 15;
      ctx.moveTo(Math.round(x), Math.round(y)); ctx.lineTo(Math.round(x - 3), Math.round(y + 9));
    }
    ctx.stroke();
  },
});
const _burrDraw = Gfx.burr;
Gfx.burr = function (ctx, e) {
  if (e.kind !== 'coconut') return _burrDraw.call(Gfx, ctx, e);
  const x = Math.round(e.x), y = Math.round(e.y);
  ell(ctx, x, y, 5, 5, '#5a3418'); ell(ctx, x - 1, y - 1, 3.5, 3.5, '#7a4a24');
  ctx.fillStyle = '#2a1a0a'; ctx.fillRect(x - 1, y - 3, 1, 1); ctx.fillRect(x + 1, y - 3, 1, 1); ctx.fillRect(x, y - 1, 1, 1);
};
const _crowDraw = Gfx.crow;
Gfx.crow = function (ctx, e) {                                  // tucano (gralha da Selva)
  if (e.style !== 'toucan') return _crowDraw.call(Gfx, ctx, e);
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
  const f = Math.sin(e.t * 14);
  poly(ctx, [[-7, -1], [-13, -3], [-12, 3]], '#101018');
  poly(ctx, [[-3, -2], [3, -2], [-1, -2 - 8 * f], [-6, -2 - 6 * f]], '#1a1a24');
  ell(ctx, 0, 0, 7, 5, '#14141c'); ell(ctx, 4, 1, 3, 3, '#f0e8a0');
  ell(ctx, 6, -3, 3.5, 3.5, '#14141c');
  poly(ctx, [[8, -5], [18, -2], [16, 1], [8, -1]], '#ff9a1a'); poly(ctx, [[8, -1], [16, 1], [8, 0]], '#e8501a');   // bico grande
  ctx.fillStyle = '#5ad0ff'; ctx.fillRect(6, -4, 2, 2); ctx.fillStyle = '#1a1020'; ctx.fillRect(7, -4, 1, 1);
  poly(ctx, [[-2, -1], [4, -1], [1, -1 - 9 * f], [-5, -1 - 7 * f]], '#24242e');
  Gfx.ctlLight(ctx, e, 4, -9);
  ctx.restore();
};
const _decoDraw = Gfx.deco;
Gfx.deco = function (g, d) {                                    // casa na árvore (com a janela acesa)
  if (d.type !== 'treehouse') return _decoDraw.call(Gfx, g, d);
  const x = Math.round(d.x), y = Math.round(d.y);
  g.fillStyle = '#5a3a1e'; g.fillRect(x - 22, y - 26, 44, 26);
  g.fillStyle = '#7a5230'; for (let k = 0; k < 5; k++) g.fillRect(x - 22, y - 24 + k * 5, 44, 1);
  poly(g, [[x - 28, y - 24], [x, y - 44], [x + 28, y - 24]], '#8a7a3a'); poly(g, [[x - 24, y - 26], [x, y - 40], [x + 24, y - 26]], '#a8964a');   // telhado de palha
  g.fillStyle = '#ffcf5a'; g.fillRect(x + 6, y - 18, 8, 7); g.fillStyle = '#5a3a1e'; g.fillRect(x + 9, y - 18, 1, 7); g.fillRect(x + 6, y - 15, 8, 1);   // janela acesa
  g.fillStyle = '#2a1a0e'; g.fillRect(x - 14, y - 16, 9, 16);                                                                                        // porta
};

// Folha-trampolim: a mola da Selva (usa a física das molas)
const _springDraw = Gfx.spring;
Gfx.spring = function (ctx, e) {
  if (e.style !== 'leaf') return _springDraw.call(Gfx, ctx, e);
  const x = Math.round(e.x), y = Math.round(e.y), s = e.squash;
  ctx.fillStyle = '#2f7a2a'; ctx.fillRect(x - 1, y - 5, 2, 5);
  ctx.save(); ctx.translate(x, y - 5 + s * 2); ctx.scale(1 + s * 0.15, 1 - s * 0.4);
  ell(ctx, 0, 0, 14, 4, '#3f9a3a'); ell(ctx, 0, -1, 12, 2.5, '#6cc45a');
  ctx.fillStyle = '#2f7a2a'; ctx.fillRect(-12, -1, 24, 1);
  ctx.restore();
};
