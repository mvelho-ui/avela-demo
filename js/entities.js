'use strict';
// =====================================================================
//  Entidades: colecionáveis, inimigos, objectos do cenário e partículas.
// =====================================================================
function playerBox(p) { return { x: p.cx, y: p.cy, hw: 7, hh: 10 }; }
function overlaps(a, b) { return Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh; }

class Ent {
  constructor(d) { Object.assign(this, d); this.alive = true; this.t = Math.random() * 10; }
  box() { return { x: this.x, y: this.y, hw: 6, hh: 6 }; }
  touching(game) { const p = game.player; return p.state !== 'dead' && overlaps(playerBox(p), this.box()); }
  update(dt, game) { this.t += dt; }
  draw(ctx, game) {}
}

// ---------------- colecionáveis ----------------
class Acorn extends Ent {
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    if (p.state === 'dead') return;
    const dx = p.cx - this.x, dy = p.cy - this.y;
    if (dx * dx + dy * dy < 13 * 13) {
      this.alive = false; game.addAcorn(1);
      game.sparkle(this.x, this.y, '#ffe9a8');
    }
  }
  draw(ctx) { Gfx.acorn(ctx, this.x, this.y + Math.sin(this.t * 3) * 1.5, this.t); }
}

class LooseAcorn extends Ent {
  update(dt, game) {
    this.t += dt; this.life -= dt; this.age = (this.age || 0) + dt;
    if (this.life <= 0) { this.alive = false; return; }
    this.vy += PHYS.gravity * 0.7 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const L = game.level;
    if (this.vy > 0) {
      const f = L.floorAt(this.x, this.y - 6, this.y + 4);
      if (f) { this.y = f.y - 4; this.vy *= -0.6; this.vx *= 0.8; }
    }
    if (SOLID[L.get(Math.floor(this.x / T), Math.floor(this.y / T))]) this.vx *= -1;
    const p = game.player;
    if (this.age > (this.delay || 0.4) && p.state !== 'dead' && p.hurtT <= 0) {
      const dx = p.cx - this.x, dy = p.cy - this.y;
      if (dx * dx + dy * dy < 14 * 14) { this.alive = false; game.addAcorn(1); game.sparkle(this.x, this.y, '#ffe9a8'); }
    }
  }
  draw(ctx) { if (this.life > 1 || Math.floor(this.life * 12) % 2) Gfx.acorn(ctx, this.x, this.y, this.t * 2); }
}

class Golden extends Ent {
  box() { return { x: this.x, y: this.y, hw: 8, hh: 8 }; }
  update(dt, game) {
    this.t += dt;
    if (game.player.golden[this.idx]) { this.alive = false; return; }
    if (this.touching(game)) { this.alive = false; game.collectGolden(this.idx, this.x, this.y); }
  }
  draw(ctx) { Gfx.golden(ctx, this.x, this.y + Math.sin(this.t * 2.5) * 2, this.t); }
}

// ---------------- inimigos ----------------
class Enemy extends Ent {
  constructor(d) { super(d); this.dead = false; this.vy = 0; this.deadT = 0; }
  get hittable() { return true; }
  // Os animais estão a ser controlados pelo Driller: derrotá-los parte a máquina de controlo
  // e eles fogem, livres (os que voam fogem pelo ar, os outros dão um salto e correm).
  kill(game) {
    this.dead = true; this.deadT = 0; this.ky = this.y;
    this.away = Math.sign(this.x - game.player.x) || 1; this.dir = this.away;
    this.vy = this.flies ? -50 : this.stays ? 0 : -170;
    game.player.score += 100; game.popText(this.x, this.y - 14, '100');
    game.burst(this.x, this.y - 4); game.heart(this.x, this.y - 12);
    Sound.sfx('kill'); Sound.sfx('free');
  }
  updateDead(dt) {
    this.deadT += dt;
    if (this.flies) { this.x += this.away * 80 * dt; this.y += this.vy * dt; }
    else if (!this.stays) {
      this.vy += 600 * dt; this.y = Math.min(this.ky, this.y + this.vy * dt);
      this.x += this.away * 75 * dt;
    }
    if (this.deadT > 1.2) this.alive = false;
  }
  checkPlayer(game) {
    if (this.dead || !this.hittable || !this.touching(game)) return;
    const p = game.player;
    const stomp = p.vy > 40 && p.y < this.box().y;
    if (p.attacking || stomp) {
      this.kill(game);
      if (!p.onGround && p.state === 'normal') {
        p.vy = Input.state.jump ? -380 : -260; p.jumping = true; p.jumpCutDone = true;
        p.airSpinUsed = false; p.glide = false; p.glideArmed = false;
      }
    } else p.hurt(game, this.x);
  }
}

class Beetle extends Enemy {
  constructor(d) { super(d); this.dir = -1; this.speed = 38; }
  box() { return { x: this.x, y: this.y - 6, hw: 8, hh: 6 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    if (Math.abs(this.x - game.player.x) > VIEW_W) return;   // só se mexe perto do ecrã
    const L = game.level;
    const nx = this.x + this.dir * this.speed * dt;
    const ahead = nx + this.dir * 8;
    const wall = SOLID[L.get(Math.floor(ahead / T), Math.floor((this.y - 6) / T))];
    const floor = L.floorAt(ahead, this.y - 8, this.y + 10);
    if (wall || !floor) this.dir *= -1;
    else {
      this.x = nx;
      const f = L.floorAt(this.x, this.y - 8, this.y + 10);
      if (f) this.y = f.y;
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.beetle(ctx, this); }
}

class Wasp extends Enemy {
  constructor(d) { super(d); this.flies = true; this.x0 = d.x; this.y0 = d.y; this.axis = d.axis || 'x'; this.range = d.range || 42; }
  box() { return { x: this.x, y: this.y, hw: 7, hh: 6 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    if (this.axis === 'y') {                     // sobe e desce (poços)
      this.x = this.x0 + Math.sin(this.t * 3.2) * 5;
      this.y = this.y0 + Math.sin(this.t * 1.3) * this.range;
      this.dir = game.player.x >= this.x ? 1 : -1;
    } else {
      this.x = this.x0 + Math.sin(this.t * 1.1) * this.range;
      this.y = this.y0 + Math.sin(this.t * 3.2) * 7;
      this.dir = Math.cos(this.t * 1.1) >= 0 ? 1 : -1;
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.wasp(ctx, this); }
}

// ---------------- bolota atirada pela Avelã ----------------
class ThrownAcorn extends Ent {
  constructor(d) { super(d); this.life = 1.4; this.rot = 0; }
  box() { return { x: this.x, y: this.y, hw: 4, hh: 4 }; }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0 || this.y > game.level.height + 20) { this.alive = false; return; }
    this.vy += PHYS.throwGravity * dt;
    this.rot += dt * 25 * Math.sign(this.vx || 1);
    const L = game.level;
    for (let i = 0; i < 2; i++) {          // 2 sub-passos para não atravessar paredes finas
      this.x += this.vx * dt / 2; this.y += this.vy * dt / 2;
      const tx = Math.floor(this.x / T), ty = Math.floor(this.y / T), ch = L.get(tx, ty);
      if (SOLID[ch] || (SLOPE[ch] && this.y >= L.surface(ch, tx, ty, this.x))) return this.shatter(game, false);
      for (const e of game.ents) {
        if (e instanceof Enemy && !e.dead && e.hittable && overlaps(this.box(), e.box())) {
          e.kill(game); return this.shatter(game, true);
        }
        if (e instanceof Burr && e.alive && overlaps(this.box(), e.box())) { e.pop(game); return this.shatter(game, true); }
      }
    }
  }
  shatter(game, hit) {
    this.alive = false; game.shards(this.x, this.y);
    if (!hit) Sound.sfx('tock');
  }
  draw(ctx) {
    ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y)); ctx.rotate(this.rot);
    Gfx.acorn(ctx, 0, 0, 0); ctx.restore();
  }
}

// Lagarta: rasteja para cima e para baixo numa parede
class Crawler extends Enemy {
  constructor(d) { super(d); this.stays = true; this.y0 = d.y; this.side = d.side || 1; this.range = d.range || 40; }
  box() { return { x: this.x, y: this.y, hw: 6, hh: 11 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const prev = this.y;
    this.y = this.y0 + Math.sin(this.t * 0.9) * this.range;
    this.up = this.y < prev;
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.caterpillar(ctx, this); }
}

// Ouriço de castanha: bola com picos atirada pelas toupeiras e largada pelas gralhas.
// Faz dano ao tocar; o pião de cauda rebate-o e uma bolota atirada parte-o.
class Burr extends Ent {
  // kind: 'burr' (ouriço), 'rock' (pedra das toupeiras da mina), 'fire' (bola de fogo da salamandra)
  constructor(d) { super(d); this.life = 3; this.bounces = 0; this.rot = 0; this.kind = d.kind || 'burr'; }
  box() { return { x: this.x, y: this.y, hw: 5, hh: 5 }; }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) return this.pop(game);
    const L = game.level;
    this.vy += (this.kind === 'fire' ? 260 : this.kind === 'venom' ? 600 : PHYS.burrGravity) * dt; this.rot += this.vx * dt * 0.12;
    if (this.kind === 'fire' && Math.random() < dt * 45) game.parts.push(new Particle({ kind: 'flame', x: this.x + (Math.random() - 0.5) * 4,
      y: this.y + (Math.random() - 0.5) * 4, vx: -this.vx * 0.15, vy: -30, life: 0.3, size: 2 }));
    const prevY = this.y;
    if (game.wind) this.vx += game.wind * 0.4 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (SOLID[L.get(Math.floor((this.x + Math.sign(this.vx) * 5) / T), Math.floor(this.y / T))]) {
      if (this.kind === 'fire') return this.pop(game);
      this.vx *= -0.5; this.x += this.vx * dt * 2;
    }
    if (this.vy < 0 && SOLID[L.get(Math.floor(this.x / T), Math.floor((this.y - 5) / T))]) this.vy = -this.vy * 0.3;
    if (this.vy > 0) {
      const f = L.floorAt(this.x, prevY + 3, this.y + 5);
      if (f) {
        this.y = f.y - 5;
        if (this.kind === 'venom') { game.ents.push(new VenomPuddle({ x: this.x, y: f.y, fromBoss: true })); return this.pop(game); }   // veneno: fica uma poça
        if (this.bounces++ >= (this.kind === 'fire' ? 0 : 1)) return this.pop(game);
        this.vy *= -0.45; this.vx *= 0.7;
      }
    }
    if (this.y > L.height + 20) { this.alive = false; return; }
    const p = game.player;
    if (p.state === 'dead' || !overlaps(playerBox(p), this.box())) return;
    if (p.spinT > 0) { this.pop(game); p.score += 10; game.popText(this.x, this.y - 8, '10'); Sound.sfx('tock'); }
    else { p.hurt(game, this.x); this.pop(game); }
  }
  pop(game) {
    if (!this.alive) return;
    this.alive = false;
    for (let i = 0; i < 6; i++) game.parts.push(new Particle({ x: this.x, y: this.y, vx: (Math.random() - 0.5) * 120,
      vy: -40 - Math.random() * 80, grav: 600, life: 0.45, size: 2,
      color: { burr: ['#7fb83a', '#d9e98a'], rock: ['#6b625a', '#a09890'], fire: ['#ff7a00', '#ffd23f'], venom: ['#8aff3a', '#3a9a1a'], coconut: ['#6a4020', '#f0e8d0'] }[this.kind][i % 2] }));
  }
  draw(ctx) { Gfx.burr(ctx, this); }
}

// Toupeira mineira: sai da toca, aponta e atira um ouriço em arco. Só se lhe acerta cá fora.
class Mole extends Enemy {
  constructor(d) { super(d); this.phase = 'hidden'; this.timer = 0.5 + Math.random(); this.h = 0; this.dir = -1; this.thrown = false; }
  get hittable() { return this.h > 0.5; }
  box() { return { x: this.x, y: this.y - 8 * this.h, hw: 8, hh: 7 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, dx = p.x - this.x;
    const near = p.state !== 'dead' && Math.abs(dx) < 240 && Math.abs(p.y - this.y) < 150;
    this.timer -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    if (this.phase === 'hidden') {
      this.h = Math.max(0, this.h - dt * 6);
      if (this.timer <= 0 && near) { this.phase = 'up'; this.timer = 1.1; this.thrown = false; }
    } else {
      this.h = Math.min(1, this.h + dt * 6);
      this.dir = dx >= 0 ? 1 : -1;
      if (!this.thrown && this.timer < 0.6) { this.thrown = true; this.throwBurr(game); }
      if (this.timer <= 0) { this.phase = 'hidden'; this.timer = 1.0 + Math.random() * 0.9; }
    }
    this.checkPlayer(game);
  }
  throwBurr(game) {
    const p = game.player, tf = 0.85, g = PHYS.burrGravity;
    const vx = clamp((p.x - this.x) / tf, -230, 230);
    const vy = clamp(((p.y - 10) - (this.y - 14) - 0.5 * g * tf * tf) / tf, -480, -140);
    game.ents.push(new Burr({ x: this.x + this.dir * 6, y: this.y - 14, vx, vy, kind: this.kind || 'burr' }));
    this.throwT = 0.25; Sound.sfx('toss');
  }
  draw(ctx) { Gfx.mole(ctx, this); }
}

// Gralha capanga do Barão: voa por cima, persegue a Avelã e larga ouriços quando lhe passa por cima.
class Crow extends Enemy {
  constructor(d) { super(d); this.flies = true; this.x0 = d.x; this.y0 = d.y; this.cool = 1.2; this.dir = -1; this.dropT = 0; }
  box() { return { x: this.x, y: this.y, hw: 9, hh: 7 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, dx = p.x - this.x;
    const chasing = p.state !== 'dead' && Math.abs(dx) < 200 && p.y > this.y && p.y - this.y < 280;
    const tx = chasing ? clamp(p.x, this.x0 - 170, this.x0 + 170) : this.x0 + Math.sin(this.t * 0.7) * 70;
    const prev = this.x;
    this.x += clamp(tx - this.x, -75 * dt, 75 * dt);
    this.y = this.y0 + Math.sin(this.t * 2.4) * 5;
    if (Math.abs(this.x - prev) > 0.01) this.dir = this.x > prev ? 1 : -1;
    this.cool -= dt; if (this.dropT > 0) this.dropT -= dt;
    if (chasing && Math.abs(dx) < 22 && this.cool <= 0) {
      game.ents.push(new Burr({ x: this.x, y: this.y + 8, vx: (this.x - prev) / dt * 0.5, vy: 30, kind: this.style === 'toucan' ? 'coconut' : 'burr' }));
      this.cool = 1.8; this.dropT = 0.3; Sound.sfx('toss');
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.crow(ctx, this); }
}

// Morcego: dorme pendurado no tecto dos túneis; acorda quando a Avelã passa, persegue-a e volta.
class Bat extends Enemy {
  constructor(d) { super(d); this.flies = true; this.hx = d.x; this.hy = d.y; this.state = 'hang'; this.timer = 0; this.dir = 1; }
  box() { return { x: this.x, y: this.y, hw: 7, hh: 5 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player;
    if (this.state === 'hang') {
      this.x = this.hx; this.y = this.hy + 6;
      if (p.state !== 'dead' && Math.abs(p.x - this.x) < 100 && p.y > this.y && p.y - this.y < 100) { this.state = 'fly'; this.timer = 2.4; Sound.sfx('bat'); }
    } else if (this.state === 'fly') {
      this.timer -= dt;
      const dx = p.x - this.x, dy = p.cy - this.y, d = Math.hypot(dx, dy) || 1;
      this.x += dx / d * 95 * dt; this.y += dy / d * 95 * dt + Math.sin(this.t * 10) * 50 * dt;
      this.dir = dx > 0 ? 1 : -1;
      if (this.timer <= 0 || p.state === 'dead') this.state = 'back';
    } else {
      const dx = this.hx - this.x, dy = this.hy + 6 - this.y, d = Math.hypot(dx, dy);
      if (d < 3) this.state = 'hang';
      else { this.x += dx / d * 80 * dt; this.y += dy / d * 80 * dt; this.dir = dx > 0 ? 1 : -1; }
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.bat(ctx, this); }
}

// =====================================================================
//  CHEFE: BARÃO GRALHA — 7 pontos de vida, 3 fases.
//   fase 1 (7-6): paira e faz voos picados
//   fase 2 (5-4): + rajadas de vento (pousado numa copa) e larga ouriços
//   fase 3 (3-1): mais rápido, ouriços em leque
//  Acerta-se com bola, pião, a rebolar ou com bolotas atiradas.
// =====================================================================
class Boss extends Enemy {
  constructor(d) { super(d); this.ax0 = d.ax0; this.ax1 = d.ax1; this.floor = d.floor; this.hx = d.x; this.hy = d.y; this.talked = false; this.reset(); }
  reset() {
    Object.assign(this, { x: this.hx, y: this.hy, state: 'wait', hp: 7, maxHp: 7, inv: 0, timer: 0, dead: false, alive: true,
      dir: -1, phase: 1, dropCool: 1, step: 0, vy: 0, windDir: 0, burst: false, controlled: true, spoke: false });
  }
  get hittable() { return !['wait', 'intro', 'defeat', 'freed'].includes(this.state) && this.inv <= 0; }
  get top() { return this.floor - 120; }
  get mid() { return (this.ax0 + this.ax1) / 2; }
  box() { return { x: this.x, y: this.y, hw: 16, hh: 12 }; }
  kill(game) { this.hit(game, false); }                 // bolota atirada: tira 1 ponto de vida
  update(dt, game) {
    this.t += dt; this.timer -= dt; this.dropCool -= dt;
    if (this.inv > 0) this.inv -= dt;
    const p = game.player;
    if (this.state !== 'gust') game.wind = 0;
    switch (this.state) {
      case 'wait':
        if (p.state !== 'dead' && p.x > this.ax0 + 40) { this.state = 'intro'; this.timer = 2.4; game.startBoss(this); Sound.sfx('caw'); }
        return;
      case 'intro':
        this.x += (this.mid + 70 - this.x) * Math.min(1, dt * 2); this.y += (this.top - this.y) * Math.min(1, dt * 2);
        this.dir = p.x > this.x ? 1 : -1;
        if (this.timer <= 0) {
          if (!this.talked) { this.talked = true; game.story(this.before || STORY.bossBefore); }   // a conversa antes da luta
          else this.next(game);
        }
        return;
      case 'hover': {
        const tx = this.mid + Math.sin(this.t * 0.9) * 120;
        this.x += clamp(tx - this.x, -160 * dt, 160 * dt);
        this.y += (this.top + Math.sin(this.t * 2.2) * 8 - this.y) * Math.min(1, dt * 4);
        this.dir = p.x > this.x ? 1 : -1;
        if (this.phase >= 2 && this.dropCool <= 0 && Math.abs(p.x - this.x) < 28) this.drop(game);
        if (this.timer <= 0) this.next(game);
        break;
      }
      case 'dive': {
        const u = clamp(1 - this.timer / this.dur, 0, 1);
        this.x = lerp(this.sx, this.ex, u);
        this.y = this.sy + (this.floor - 16 - this.sy) * Math.sin(u * Math.PI);
        this.dir = this.ex > this.sx ? 1 : -1;
        if (u >= 1) this.next(game);
        break;
      }
      case 'gust':
        this.x += (this.px - this.x) * Math.min(1, dt * 4); this.y += (this.py - this.y) * Math.min(1, dt * 4);
        this.dir = this.windDir;
        game.wind = this.timer < this.gustLen - 0.5 ? this.windDir * (this.phase >= 3 ? 470 : 380) : 0;
        if (game.wind && Math.random() < dt * 30) game.windStreak(this.windDir);
        if (this.timer <= 0) { game.wind = 0; this.next(game); }
        break;
      case 'hurt':
        this.y += (this.top - 20 - this.y) * Math.min(1, dt * 3);
        if (this.timer <= 0) this.next(game);
        break;
      case 'defeat':
        this.vy += 600 * dt; this.y += this.vy * dt;
        if (this.y >= this.floor - 12) {
          this.y = this.floor - 12; this.state = 'freed'; this.timer = 1.6; this.controlled = false;
          game.bossDefeated(this);
        }
        return;
      case 'freed':                                      // a máquina parte-se: o Barão volta a si
        this.dir = p.x > this.x ? 1 : -1;
        if (this.timer <= 0 && !this.spoke) { this.spoke = true; game.bossEnding(this); }
        return;
    }
    if (p.state !== 'dead' && overlaps(playerBox(p), this.box())) {
      if (p.attacking) this.hit(game, true);
      else if (this.inv <= 0) p.hurt(game, this.x);
    }
  }
  hit(game, bounce) {
    if (this.inv > 0 || !this.hittable) return;
    const p = game.player;
    this.hp--; this.inv = 1.4; game.wind = 0;
    Sound.sfx('bosshit'); game.burst(this.x, this.y); if (!this.noFeathers) game.feathers(this.x, this.y, 8);
    if (bounce) Object.assign(p, { vx: (p.x < this.x ? -1 : 1) * 220, vy: -300, onGround: false, jumping: true,
      jumpCutDone: true, rolling: false, state: 'normal', glide: false, glideArmed: false });
    if (this.hp <= 0) {
      this.state = 'defeat'; this.vy = -240; this.t = 0;
      game.freeMinions();                                 // morceguinhos, estalactites e pedras do chefe acabam aqui
      p.score += 5000; game.popText(this.x, this.y - 30, '5000'); Sound.sfx('caw');
      return;
    }
    this.phase = this.hp <= 3 ? 3 : this.hp <= 5 ? 2 : 1;
    this.state = 'hurt'; this.timer = 0.8;
  }
  next(game) {
    const p = game.player;
    const seq = { 1: ['hover', 'dive'], 2: ['hover', 'dive', 'hover', 'gust'], 3: ['dive', 'hover', 'gust', 'dive'] }[this.phase];
    const s = seq[this.step++ % seq.length];
    this.state = s;
    if (s === 'hover') this.timer = this.phase === 1 ? 2.2 : this.phase === 2 ? 1.8 : 1.1;
    else if (s === 'dive') {
      this.dur = this.phase === 3 ? 1.0 : 1.3; this.timer = this.dur; this.sx = this.x; this.sy = this.y;
      this.ex = clamp(p.x + (p.x - this.x), this.ax0 + 30, this.ax1 - 30); Sound.sfx('caw');
    } else if (s === 'gust') {
      const left = p.x > this.mid;
      this.windDir = left ? 1 : -1; this.px = left ? this.ax0 + 72 : this.ax1 - 72; this.py = this.floor - 4 * T - 14;
      this.gustLen = this.phase >= 3 ? 2.8 : 2.4; this.timer = this.gustLen; Sound.sfx('wind');
    }
  }
  drop(game) {
    const n = this.phase >= 3 ? 3 : 1;
    for (let i = 0; i < n; i++) game.ents.push(new Burr({ x: this.x, y: this.y + 14, vx: (i - (n - 1) / 2) * 80, vy: 20 }));
    this.dropCool = this.phase >= 3 ? 1.0 : 1.5; Sound.sfx('toss');
  }
  draw(ctx) { Gfx.baron(ctx, this); }
}

// =====================================================================
//  CHEFE DO REINO DA MINA — o Morcego (2-3)
//   dorme pendurado no tecto da arena; 7 pontos de vida
//   fase 1 (7-6): paira e mergulha
//   fase 2 (5-4): + guincho (o tecto treme e caem estalactites, uma por cima da Avelã) e larga pedras
//   fase 3 (3-1): mais rápido, mais estalactites e chama dois morceguinhos
// =====================================================================
class BatBoss extends Boss {
  constructor(d) {
    super(d);
    Object.assign(this, { title: 'MORCEGO', music: 'boss2', who: 'morcego', before: STORY.batBefore, after: STORY.batAfter,
      finalLine: 'ENTÃO VAMOS LÁ. DESERTO, AÍ VOU EU!', leaveAfter: true });
  }
  reset() {
    super.reset(); this.screamed = false;
    if (this.game) for (const e of this.game.ents) if (e.fromBoss) e.alive = false;      // limpa estalactites e morceguinhos
  }
  get hittable() { return !['wait', 'intro', 'defeat', 'freed', 'leaving'].includes(this.state) && this.inv <= 0; }
  get top() { return this.floor - 118; }
  box() { return { x: this.x, y: this.y, hw: 15, hh: 12 }; }
  touchPlayer(game) {
    const p = game.player;
    if (p.state !== 'dead' && overlaps(playerBox(p), this.box())) {
      if (p.attacking) this.hit(game, true); else if (this.inv <= 0) p.hurt(game, this.x);
    }
  }
  update(dt, game) {
    this.game = game;
    const p = game.player;
    if (this.state === 'wait') {                      // a dormir no tecto
      this.t += dt; this.x = this.hx; this.y = this.hy;
      if (p.state !== 'dead' && p.x > this.ax0 + 40) { this.state = 'intro'; this.timer = 2.4; game.startBoss(this); Sound.sfx('bat'); }
      return;
    }
    if (this.state === 'leaving') {                   // libertado: sobe pelo poço do elevador à frente da Avelã
      this.t += dt; this.dir = 1;
      this.x += ((this.sx0 + this.sx1) / 2 - this.x) * Math.min(1, dt * 1.5);
      if (Math.abs(this.x - (this.sx0 + this.sx1) / 2) < 30) this.y -= 120 * dt; else this.y += (this.top - this.y) * Math.min(1, dt * 2);
      if (this.y < this.ceil - 300) this.alive = false;
      return;
    }
    if (this.state === 'screech' || this.state === 'swarm') {
      this.t += dt; this.timer -= dt; this.dropCool -= dt;
      if (this.inv > 0) this.inv -= dt;
      const hy = this.state === 'screech' ? this.ceil + 26 : this.top;
      this.x += (this.mid - this.x) * Math.min(1, dt * 3); this.y += (hy - this.y) * Math.min(1, dt * 3);
      this.dir = p.x > this.x ? 1 : -1;
      if (!this.screamed && this.timer < (this.state === 'screech' ? 1.0 : 0.5)) {
        this.screamed = true;
        if (this.state === 'screech') this.screech(game); else this.swarm(game);
      }
      if (this.timer <= 0) this.next(game);
      this.touchPlayer(game);
      return;
    }
    super.update(dt, game);
  }
  next(game) {
    const p = game.player;
    const seq = { 1: ['hover', 'dive'], 2: ['hover', 'screech', 'dive'], 3: ['dive', 'screech', 'hover', 'swarm', 'dive'] }[this.phase];
    const s = seq[this.step++ % seq.length];
    this.state = s; this.screamed = false;
    if (s === 'hover') this.timer = this.phase === 1 ? 2.0 : this.phase === 2 ? 1.6 : 1.1;
    else if (s === 'dive') {
      this.dur = this.phase === 3 ? 0.95 : 1.25; this.timer = this.dur; this.sx = this.x; this.sy = this.y;
      this.ex = clamp(p.x + (p.x - this.x), this.ax0 + 30, this.ax1 - 30); Sound.sfx('bat');
    } else if (s === 'screech') this.timer = this.phase >= 3 ? 1.4 : 1.7;
    else this.timer = 1.0;
  }
  // guincho: ondas de som, o tecto treme e caem estalactites (uma sempre por cima da Avelã)
  screech(game) {
    Sound.sfx('bat'); Sound.sfx('crumble');
    for (let k = 0; k < 3; k++) game.parts.push(new Particle({ kind: 'ring', x: this.x, y: this.y, life: 0.5 + k * 0.2, color: k % 2 ? '#c8a0ff' : '#ffffff' }));
    const lim = x => clamp(x, this.ax0 + 20, this.sx0 - 12);
    const xs = [lim(game.player.x)], n = this.phase >= 3 ? 6 : 4;
    while (xs.length < n) { const x = lim(this.ax0 + 24 + Math.random() * (this.sx0 - this.ax0 - 36)); if (xs.every(q => Math.abs(q - x) > 30)) xs.push(x); }
    xs.forEach((x, i) => game.ents.push(new Stalactite({ x: Math.round(x), y: this.ceil, state: 'shake', timer: 0.45 + i * 0.12, fromBoss: true })));
  }
  swarm(game) {                                       // chama dois morceguinhos (no máximo dois de cada vez)
    Sound.sfx('bat');
    const alive = game.ents.filter(e => e instanceof Bat && e.fromBoss && !e.dead).length;
    for (let i = alive; i < 2; i++) {
      const b = new Bat({ x: this.x + (i ? 14 : -14), y: this.y, fromBoss: true });
      b.hx = this.ax0 + 40 + i * (this.sx0 - this.ax0 - 80); b.hy = this.ceil; b.state = 'fly'; b.timer = 3;
      game.ents.push(b);
    }
  }
  drop(game) {
    game.ents.push(new Burr({ x: this.x, y: this.y + 14, vx: 0, vy: 20, kind: 'rock', fromBoss: true }));
    this.dropCool = this.phase >= 3 ? 1.1 : 1.6; Sound.sfx('toss');
  }
  draw(ctx) { Gfx.batboss(ctx, this); }
}

// Poça de veneno da Cobra Real: arde no chão uns segundos
class VenomPuddle extends Ent {
  constructor(d) { super(d); this.life = 2.0; }
  box() { return { x: this.x, y: this.y - 2, hw: 10, hh: 3 }; }
  update(dt, game) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }
    if (Math.random() < dt * 6) game.parts.push(new Particle({ x: this.x + (Math.random() - 0.5) * 16, y: this.y - 2, vy: -20, life: 0.5, size: 1, color: '#8aff3a' }));
    if (this.touching(game)) game.player.hurt(game, this.x);
  }
  draw(ctx) { Gfx.venomPuddle(ctx, this); }
}

// =====================================================================
//  CHEFE DO REINO DO DESERTO — a Cobra Real (3-3), na câmara debaixo da pirâmide
//   7 pontos de vida; o corpo enrolado fica na areia, só a cabeça ataca e só a cabeça se acerta
//   fase 1 (7-6): balança e dá botes com a cabeça (depois do bote a cabeça fica baixa: é a altura de lhe acertar)
//   fase 2 (5-4): + cospe veneno em arco (3 bolas) que deixa poças no chão
//   fase 3 (3-1): mergulha na areia, persegue a Avelã por baixo (a areia mexe-se e treme) e salta do chão
//                 debaixo dela; botes mais rápidos e veneno em leque (5 bolas)
// =====================================================================
class CobraBoss extends Boss {
  constructor(d) {
    super(d);
    Object.assign(this, { title: 'COBRA REAL', music: 'boss3', who: 'cobra', noFeathers: true, teachSpin: true, before: STORY.cobraBefore, after: STORY.cobraAfter, afterTail: STORY.cobraTail,
      finalLine: 'ÁRVORES MAIORES QUE ESTA PIRÂMIDE? ENTÃO VOU ESTAR EM CASA. SELVA, AÍ VOU EU!' });
  }
  reset() {
    super.reset();
    Object.assign(this, { bx: this.hx, rise: 0, sub: '', bulgeX: this.hx, face: -1 });
    this.x = this.hx; this.y = this.floor - 10;
    if (this.game) for (const e of this.game.ents) if (e.fromBoss) e.alive = false;
  }
  get hittable() { return ['sway', 'recover', 'spit', 'aim'].includes(this.state) && this.inv <= 0 && this.rise > 0.7; }
  get top() { return this.floor - 80; }
  box() { return { x: this.x, y: this.y, hw: 11, hh: 9 }; }
  rest() { return { x: this.bx + this.face * 16, y: this.floor - 74 * this.rise - 6 }; }
  moveHead(tx, ty, k, dt) { this.x += (tx - this.x) * Math.min(1, dt * k); this.y += (ty - this.y) * Math.min(1, dt * k); }
  update(dt, game) {
    this.game = game; this.t += dt; this.timer -= dt;
    if (this.inv > 0) this.inv -= dt;
    const p = game.player;
    if (!['strike', 'recover'].includes(this.state)) this.face = p.x > this.bx ? 1 : -1;
    this.dir = this.face;
    switch (this.state) {
      case 'wait':
        this.rise = 0; this.x = this.bx; this.y = this.floor - 6;
        if (p.state !== 'dead' && p.x > this.ax0 + 40) { this.state = 'intro'; this.timer = 2.4; game.startBoss(this); Sound.sfx('rattle'); }
        return;
      case 'intro': {
        this.rise = Math.min(1, this.rise + dt * 0.7); const r = this.rest(); this.moveHead(r.x, r.y, 4, dt);
        if (Math.random() < dt * 20) game.dust(this.bx + (Math.random() - 0.5) * 30, this.floor, 1);
        if (this.timer <= 0) { if (!this.talked) { this.talked = true; game.story(this.before); } else this.next(game); }
        return;
      }
      case 'sway': {
        const r = this.rest(); this.moveHead(r.x + Math.sin(this.t * 2.2) * 24, r.y + Math.sin(this.t * 4.4) * 6, 5, dt);
        if (this.timer <= 0) this.next(game);
        break;
      }
      case 'aim': {                                     // puxa a cabeça atrás antes do bote
        const r = this.rest(); this.moveHead(r.x - this.face * 14, r.y - 10, 8, dt);
        if (this.timer <= 0) {
          const dx = clamp(p.cx - this.bx, -175, 175), ty = clamp(p.cy, this.floor - 90, this.floor - 10);
          Object.assign(this, { state: 'strike', timer: this.phase >= 3 ? 0.16 : 0.22, sx: this.x, sy: this.y, ex: clamp(this.bx + dx, this.ax0 + 14, this.ax1 - 14), ey: ty });
          this.dur = this.timer; Sound.sfx('toss');
        }
        break;
      }
      case 'strike': {
        const u = clamp(1 - this.timer / this.dur, 0, 1);
        this.x = lerp(this.sx, this.ex, u); this.y = lerp(this.sy, this.ey, u);
        if (u >= 1) { this.state = 'recover'; this.timer = this.phase >= 3 ? 0.5 : 0.75; game.dust(this.x, this.floor, 3); }
        break;
      }
      case 'recover':                                   // a cabeça fica cá em baixo: é agora!
        if (this.timer <= 0) this.next(game);
        break;
      case 'spit': {
        const r = this.rest(); this.moveHead(r.x, r.y - 14, 5, dt);
        if (!this.spat && this.timer < 0.55) { this.spat = true; this.spit(game); }
        if (this.timer <= 0) this.next(game);
        break;
      }
      case 'burrow':
        if (this.sub === 'down') {                      // mergulha na areia
          this.rise = Math.max(0, this.rise - dt * 2.4); const r = this.rest(); this.moveHead(r.x, this.floor - 4, 8, dt);
          if (Math.random() < dt * 30) game.dust(this.bx + (Math.random() - 0.5) * 30, this.floor, 1);
          if (this.rise <= 0) { this.sub = 'under'; this.timer = 1.5; this.bulgeX = this.bx; Sound.sfx('sink'); }
        } else if (this.sub === 'under') {              // por baixo da areia, atrás da Avelã
          if (this.timer > 0.45) this.bulgeX += clamp(p.x - this.bulgeX, -170 * dt, 170 * dt);
          this.bulgeX = clamp(this.bulgeX, this.ax0 + 24, this.ax1 - 24);
          this.x = this.bulgeX; this.y = this.floor + 4;
          if (Math.random() < dt * (this.timer < 0.45 ? 60 : 25)) game.dust(this.bulgeX + (Math.random() - 0.5) * 18, this.floor, 1);
          if (this.timer <= 0) { this.sub = 'erupt'; this.bx = this.bulgeX; this.timer = 0.3; Sound.sfx('bosshit'); game.dust(this.bx, this.floor, 10); }
        } else {                                        // salta do chão!
          this.rise = Math.min(1, this.rise + dt * 5); this.x = this.bx; this.y = lerp(this.floor, this.floor - 96, 1 - Math.max(0, this.timer) / 0.3);
          if (this.timer <= 0) { this.state = 'recover'; this.timer = 0.55; this.rise = 1; }
        }
        break;
      case 'hurt': {
        const r = this.rest(); this.moveHead(r.x - this.face * 10, r.y - 16, 6, dt);
        if (this.timer <= 0) this.next(game);
        break;
      }
      case 'defeat':
        this.rise = Math.max(0.35, this.rise - dt); this.moveHead(this.bx + this.face * 26, this.floor - 12, 3, dt);
        if (this.t > 1.2) { this.state = 'freed'; this.timer = 1.6; this.controlled = false; game.bossDefeated(this); }
        return;
      case 'freed':
        if (this.timer <= 0 && !this.spoke) { this.spoke = true; game.bossEnding(this); }
        return;
    }
    const dangerous = ['sway', 'aim', 'strike', 'recover', 'spit', 'hurt'].includes(this.state) || (this.state === 'burrow' && this.sub === 'erupt');
    if (dangerous && p.state !== 'dead' && overlaps(playerBox(p), this.box())) {
      if (p.attacking && this.hittable) this.hit(game, true);
      else if (this.inv <= 0 && this.state !== 'hurt') p.hurt(game, this.x);
    }
  }
  next(game) {
    const seq = { 1: ['sway', 'strike', 'sway', 'strike', 'strike'], 2: ['sway', 'strike', 'spit', 'sway', 'spit', 'strike'], 3: ['burrow', 'strike', 'spit', 'burrow', 'strike', 'spit'] }[this.phase];
    const s = seq[this.step++ % seq.length];
    this.spat = false;
    if (s === 'sway') { this.state = 'sway'; this.timer = this.phase === 1 ? 1.5 : this.phase === 2 ? 1.2 : 0.8; }
    else if (s === 'strike') { this.state = 'aim'; this.timer = this.phase >= 3 ? 0.28 : 0.45; Sound.sfx('rattle'); }
    else if (s === 'spit') { this.state = 'spit'; this.timer = 1.0; }
    else { this.state = 'burrow'; this.sub = 'down'; }
  }
  spit(game) {                                          // veneno em arco para onde está a Avelã
    const p = game.player, n = this.phase >= 3 ? 5 : 3, tf = 0.8, g = 600;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 34;
      const vx = clamp((p.x + off - this.x) / tf, -260, 260), vy = clamp(((p.y - 8) - this.y - 0.5 * g * tf * tf) / tf, -420, -120);
      game.ents.push(new Burr({ x: this.x + this.face * 8, y: this.y + 2, vx, vy, kind: 'venom', fromBoss: true }));
    }
    Sound.sfx('toss'); Sound.sfx('splash');
  }
  draw(ctx) { Gfx.cobra(ctx, this); }
}

// Elevador da mina: fica parado até o Morcego estar livre; quando a Avelã sobe para ele, leva-a à superfície.
class Elevator extends Ent {
  constructor(d) { super(d); this.y0 = d.y; this.ready = false; this.riding = false; }
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    if (this.ready && !this.riding && p.state === 'normal' && p.onGround && Math.abs(p.x - this.x) < 20 && Math.abs(p.y - this.y) < 3) game.startRide(this);
  }
  draw(ctx) { Gfx.elevator(ctx, this); }
}

// Textos da história que os inimigos/chefe disparam
const STORY = {
  cobraBefore: [
    { who: 'avela', text: 'QUE SÍTIO... ESTÁTUAS DE ESQUILOS POR TODO O LADO. QUEM É QUE CONSTRUIU ISTO?' },
    { who: 'cobra', ctl: true, text: '...SSSS... UMA ESQUILO... NA PIRÂMIDE DO DRILLER...' },
    { who: 'avela', text: 'OUTRA VEZ ESSA BROCA NA CABEÇA! O DRILLER ANDA A FAZER COLECÇÃO DE CHEFES, É?' },
    { who: 'cobra', ctl: true, text: '...O OURO DEBAIXO DA AREIA É DELE. SSSAI... OU FICAS ENTERRADA COM AS ESTÁTUAS.' },
    { who: 'avela', text: 'HOJE JÁ ME ENGOLIU UM MAR DE AREIA INTEIRO. NÃO É UMA COBRA QUE ME VAI ASSUSTAR!' },
  ],
  cobraAfter: [
    { who: 'cobra', text: 'SSSS... A MINHA CABEÇA... QUE ZUMBIDO HORRÍVEL. QUEM ÉS TU, PEQUENA?' },
    { who: 'avela', text: 'SOU A AVELÃ. TINHAS UMA MÁQUINA DO DRILLER NA CABEÇA. JÁ LIBERTEI O BARÃO GRALHA E O MORCEGO DA MINA.' },
    { who: 'cobra', text: 'UMA ESQUILO... HÁ SÉCULOS QUE NÃO VIA UMA CÁ EM BAIXO. AS ESTÁTUAS LÁ FORA... UM DIA CONTO-TE ESSA HISTÓRIA.' },
    { who: 'avela', text: 'E O DRILLER? O QUE É QUE ELE QUERIA DAQUI?' },
    { who: 'cobra', text: 'O OURO DEBAIXO DA AREIA. ENCHEU AS MÁQUINAS E FOI PARA SUL, PARA A SELVA. DIZ QUE LÁ HÁ ÁRVORES MAIORES QUE ESTA PIRÂMIDE.' },
    { who: 'cobra', text: 'TEM CUIDADO COM O LEÃO. SE O DRILLER JÁ O APANHOU, NÃO VAI SER FÁCIL.' },
  ],
  cobraTail: [
    { who: 'cobra', text: 'E LEVA UM TRUQUE MEU: ENROLA-TE NO CHÃO (↓), GANHA BALANÇO (Z, Z, Z...) E SOLTA-TE! CHAMO-LHE SPIN.' },
    { who: 'avela', text: 'COMO TU QUANDO SAÍSTE DA AREIA?! ...E ISSO PARTE PEDRA?' },
    { who: 'cobra', text: 'SSSS... AS PAREDES RACHADAS, SIM. EXPERIMENTA NAQUELA ALI AO FUNDO: É A SAÍDA DA PIRÂMIDE.' },
  ],
  batBefore: [
    { who: 'avela', text: 'UFF, QUE CALOR... JÁ NEM SEI A QUE PROFUNDIDADE ESTOU. OLÁ? HÁ ALGUÉM AQUI EM BAIXO?' },
    { who: 'morcego', ctl: true, text: '...UMA ESQUILO... NAS GALERIAS DO DRILLER...' },
    { who: 'avela', text: 'DO DRILLER?! ...TENS UMA BROCA NA CABEÇA, IGUAL À DO BARÃO GRALHA. FOI ELE QUE TE PÔS ISSO?' },
    { who: 'morcego', ctl: true, text: '...OS DIAMANTES SÃO DO DRILLER. NINGUÉM SAI DA MINA.' },
    { who: 'avela', text: 'ISSO É O QUE VAMOS VER. DESCE DAÍ, QUE EU DESLIGO-TE ESSA TRALHA!' },
  ],
  batAfter: [
    { who: 'morcego', text: 'AI, AS MINHAS ASAS... ONDE É QUE EU ESTOU? E TU, QUEM ÉS?' },
    { who: 'avela', text: 'SOU A AVELÃ. TINHAS UMA BROCA ESPETADA NA CABEÇA E PUSESTE A MINA INTEIRA A ATACAR-ME!' },
    { who: 'morcego', text: 'O DRILLER... CHEGOU COM MÁQUINAS TÃO BARULHENTAS QUE ATÉ ME DOÍAM AS ORELHAS. QUERIA OS DIAMANTES DO FUNDO DA MINA.' },
    { who: 'avela', text: 'O BARÃO GRALHA ESTAVA IGUAL. JÁ O LIBERTEI.' },
    { who: 'morcego', text: 'O GRALHA? ESSE VAIDOSO AINDA ME DEVE UMA CARTOLA! ...OBRIGADO, PEQUENA. OUVE: AS TOUPEIRAS JÁ ESTÃO A VOLTAR PARA AS TOCAS.' },
    { who: 'avela', text: 'E O DRILLER? PARA ONDE FOI?' },
    { who: 'morcego', text: 'LEVOU AS MÁQUINAS LÁ PARA CIMA, PARA O DESERTO. DIZ QUE DEBAIXO DA AREIA HÁ UMA COISA AINDA MAIOR QUE OS DIAMANTES.' },
    { who: 'morcego', text: 'VÊS AQUELE ELEVADOR VELHO? SOBE ATÉ À SUPERFÍCIE. RANGE QUE SE FARTA, MAS AGUENTA. EU VOU À FRENTE.' },
  ],
  bossBefore: [
    { who: 'avela', text: 'BARÃO! ANDO À TUA PROCURA HÁ DIAS! OS BICHOS DO BOSQUE PASSARAM-SE E AS BOLOTAS ESTÃO A DESAPARECER...' },
    { who: 'barao', ctl: true, text: '...CRA... ESQUILO... DETECTADA...' },
    { who: 'avela', text: 'ESQUILO? SOU EU, A AVELÃ! A TUA ALUNA DE VOO! ...ESPERA. PORQUE TENS OS OLHOS VERMELHOS?' },
    { who: 'barao', ctl: true, text: '...ORDENS DO DRILLER. NINGUÉM PASSA.' },
    { who: 'avela', text: 'QUE TRALHA É ESSA NA TUA CARTOLA?! AGUENTA, BARÃO, EU TIRO-TE ISSO!' },
  ],
  bossAfter: [
    { who: 'barao', text: 'AI... A MINHA CABEÇA. AVELÃ? O QUE FAZES AQUI, MIÚDA?' },
    { who: 'avela', text: 'ESTAVAS A ATACAR-ME! TINHAS UMA MÁQUINA ESQUISITA NA CARTOLA E OS OLHOS A BRILHAR.' },
    { who: 'barao', text: 'O DRILLER... LEMBRO-ME DE UM BARULHO DE BROCAS E DEPOIS... MAIS NADA.' },
    { who: 'avela', text: 'QUEM É ESSE DRILLER? FOI ELE QUE PÔS OS BICHOS DO BOSQUE TODOS ESQUISITOS?' },
    { who: 'barao', text: 'UM GÉNIO MALUCO. QUER MANDAR EM TODOS OS REINOS ANIMAIS PARA ESCAVAR A NATUREZA ATÉ AO ÚLTIMO TESOURO.' },
    { who: 'avela', text: 'ENTÃO VOU ATRÁS DELE.' },
    { who: 'barao', text: 'SOZINHA? ...AINDA TENS OS ÓCULOS QUE TE DEI. LEMBRAS-TE DO TEU PRIMEIRO VOO? ATERRASTE EM CIMA DE UM CARDO!' },
    { who: 'avela', text: 'E TU RISTE-TE UMA SEMANA INTEIRA! DESTA VEZ NÃO FALHO A ATERRAGEM.' },
    { who: 'barao', text: 'COMEÇA PELA MINA ABANDONADA. AS TOUPEIRAS ANDAM A ESCAVAR PARA ELE. E TEM CUIDADO, PEQUENA.' },
  ],
};

// ---------------- inimigos da mina ----------------
// Aranha das minas: espera no tecto e desce pelo fio quando a Avelã passa por baixo.
class Spider extends Enemy {
  constructor(d) { super(d); this.top = d.y; this.y = d.y + 6; this.dropTo = d.dropTo || d.y + 80; this.state = 'top'; this.timer = 0; this.stays = true; }
  box() { return { x: this.x, y: this.y, hw: 6, hh: 5 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player;
    if (this.state === 'top') { if (p.state !== 'dead' && Math.abs(p.x - this.x) < 38 && p.y > this.top && p.y - this.top < 120) { this.state = 'drop'; Sound.sfx('bat'); } }
    else if (this.state === 'drop') { this.y += 230 * dt; if (this.y >= this.dropTo) { this.y = this.dropTo; this.state = 'wait'; this.timer = 0.9; } }
    else if (this.state === 'wait') { this.timer -= dt; if (this.timer <= 0) this.state = 'climb'; }
    else { this.y -= 60 * dt; if (this.y <= this.top + 6) { this.y = this.top + 6; this.state = 'top'; } }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.spider(ctx, this); }
}

// Toupeira-broca: patrulha devagar; se vê a Avelã na mesma galeria, acelera a broca e investe.
class DrillMole extends Enemy {
  constructor(d) { super(d); this.dir = -1; this.state = 'walk'; this.timer = 0; }
  box() { return { x: this.x, y: this.y - 7, hw: 9, hh: 7 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, L = game.level;
    if (Math.abs(this.x - p.x) > VIEW_W) return;
    const blocked = nx => { const ahead = nx + this.dir * 10;
      return SOLID[L.get(Math.floor(ahead / T), Math.floor((this.y - 6) / T))] || !L.floorAt(ahead, this.y - 8, this.y + 10); };
    if (this.state === 'walk') {
      const nx = this.x + this.dir * 28 * dt;
      if (blocked(nx)) this.dir *= -1; else this.x = nx;
      const dx = p.x - this.x;
      if (p.state !== 'dead' && Math.abs(p.y - this.y) < 20 && Math.abs(dx) < 170 && Math.sign(dx) === this.dir) { this.state = 'rev'; this.timer = 0.55; Sound.sfx('turbo'); }
    } else if (this.state === 'rev') {
      this.timer -= dt; if (this.timer <= 0) { this.state = 'charge'; this.timer = 1.5; }
    } else if (this.state === 'charge') {
      this.timer -= dt;
      const nx = this.x + this.dir * 240 * dt;
      if (blocked(nx) || this.timer <= 0) { this.state = 'stun'; this.timer = 1; game.dust(this.x + this.dir * 10, this.y, 5); Sound.sfx('land'); }
      else { this.x = nx; if (Math.random() < dt * 20) game.dust(this.x - this.dir * 8, this.y, 1); }
    } else { this.timer -= dt; if (this.timer <= 0) { this.state = 'walk'; this.dir *= -1; } }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.drillmole(ctx, this); }
}

// Salamandra-de-pintas-amarelas: anda devagar e cospe bolas de fogo à Avelã.
class Salamander extends Enemy {
  constructor(d) { super(d); this.dir = -1; this.cool = 1 + Math.random(); this.spitT = 0; }
  box() { return { x: this.x, y: this.y - 4, hw: 10, hh: 4 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, L = game.level;
    if (Math.abs(this.x - p.x) > VIEW_W) return;
    this.cool -= dt;
    if (this.spitT > 0) {
      this.spitT -= dt;
      if (this.spitT <= 0) {
        game.ents.push(new Burr({ x: this.x + this.dir * 10, y: this.y - 6, vx: this.dir * 170, vy: -70, kind: 'fire' }));
        Sound.sfx('toss'); this.cool = 2.6;
      }
    } else {
      const nx = this.x + this.dir * 22 * dt, ahead = nx + this.dir * 12;
      if (SOLID[L.get(Math.floor(ahead / T), Math.floor((this.y - 4) / T))] || !L.floorAt(ahead, this.y - 8, this.y + 10)) this.dir *= -1;
      else this.x = nx;
      const dx = p.x - this.x;
      if (this.cool <= 0 && p.state !== 'dead' && Math.abs(dx) < 180 && Math.abs(p.y - this.y) < 60) { this.dir = Math.sign(dx) || 1; this.spitT = 0.45; }
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.salamander(ctx, this); }
}

// Estalactite: treme quando a Avelã passa por baixo e cai. Quem passa a correr nem dá por ela.
class Stalactite extends Ent {
  constructor(d) { super(d); this.y0 = d.y; this.state = d.state || 'hang'; this.timer = d.timer || 0; this.vy = 0; }
  box() { return { x: this.x, y: this.y + 8, hw: 4, hh: 7 }; }
  update(dt, game) {
    this.t += dt;
    const p = game.player, L = game.level;
    if (this.state === 'hang') {
      if (p.state !== 'dead' && Math.abs(p.x - this.x) < 34 && p.y > this.y && p.y - this.y < 110) { this.state = 'shake'; this.timer = 0.3; Sound.sfx('crumble'); }
      return;
    }
    if (this.state === 'shake') { this.timer -= dt; if (this.timer <= 0) this.state = 'fall'; return; }
    const prevY = this.y;
    this.vy = Math.min(560, this.vy + 900 * dt); this.y += this.vy * dt;
    const f = L.floorAt(this.x, prevY + 14, this.y + 15);
    if (f) {
      this.alive = false; game.dust(this.x, f.y, 4); Sound.sfx('land');
      for (let i = 0; i < 6; i++) game.parts.push(new Particle({ x: this.x, y: f.y - 3, vx: (Math.random() - 0.5) * 140,
        vy: -60 - Math.random() * 90, grav: 600, life: 0.5, size: 2, color: i % 2 ? '#8a8178' : '#4b4540' }));
      return;
    }
    if (this.touching(game)) { if (p.spinT > 0 || p.super) { this.alive = false; game.dust(this.x, this.y + 8, 4); Sound.sfx('tock'); } else p.hurt(game, this.x); }
  }
  draw(ctx) { Gfx.stalactite(ctx, this); }
}

// ---------------- inimigos do deserto ----------------
// Escorpião: patrulha as dunas; se a Avelã estiver à frente e perto, levanta a cauda e dá uma ferroada.
class Scorpion extends Enemy {
  constructor(d) { super(d); this.dir = -1; this.state = 'walk'; this.timer = 0; this.cool = 0; }
  box() { return { x: this.x, y: this.y - 7, hw: 9, hh: 7 }; }
  stingBox() { return { x: this.x + this.dir * 17, y: this.y - 9, hw: 7, hh: 6 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, L = game.level;
    if (Math.abs(this.x - p.x) > VIEW_W) return;
    this.cool -= dt;
    if (this.state === 'walk') {
      const nx = this.x + this.dir * 26 * dt, ahead = nx + this.dir * 10;
      const wall = SOLID[L.get(Math.floor(ahead / T), Math.floor((this.y - 6) / T))], floor = L.floorAt(ahead, this.y - 8, this.y + 10);
      if (wall || !floor) this.dir *= -1;
      else { this.x = nx; const f = L.floorAt(this.x, this.y - 8, this.y + 10); if (f) this.y = f.y; }
      const dx = p.x - this.x;
      if (this.cool <= 0 && p.state !== 'dead' && Math.sign(dx) === this.dir && Math.abs(dx) < 46 && Math.abs(p.y - this.y) < 26) { this.state = 'aim'; this.timer = 0.3; }
    } else if (this.state === 'aim') {
      this.timer -= dt; if (this.timer <= 0) { this.state = 'sting'; this.timer = 0.22; Sound.sfx('toss'); }
    } else {
      this.timer -= dt;
      if (p.state !== 'dead' && overlaps(playerBox(p), this.stingBox())) p.hurt(game, this.x);
      if (this.timer <= 0) { this.state = 'walk'; this.cool = 1.2; }
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.scorpion(ctx, this); }
}

// Abutre: pousado numa árvore seca ou numa rocha; quando a Avelã passa, mergulha em arco e volta ao poleiro.
class Vulture extends Enemy {
  constructor(d) { super(d); this.flies = true; this.hx = d.x; this.hy = d.y; this.state = 'perch'; this.timer = 0; this.dir = -1; this.cool = 0.5; }
  box() { return this.state === 'perch' ? { x: this.x, y: this.y - 9, hw: 8, hh: 8 } : { x: this.x, y: this.y, hw: 11, hh: 6 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player;
    this.cool -= dt;
    if (this.state === 'perch') {
      this.x = this.hx; this.y = this.hy;
      const dx = p.x - this.x; this.dir = dx > 0 ? 1 : -1;
      if (this.cool <= 0 && p.state !== 'dead' && Math.abs(dx) < 150 && Math.abs(dx) > 24 && p.y > this.y - 10 && p.y - this.y < 200) {
        Object.assign(this, { state: 'swoop', timer: 0, sx: this.x, sy: this.y - 10, ex: this.x + 2 * dx, py: p.cy, dur: 1.4 });
        Sound.sfx('screech');
      }
    } else if (this.state === 'swoop') {
      this.timer += dt;
      const u = Math.min(1, this.timer / this.dur);
      this.x = lerp(this.sx, this.ex, u); this.y = this.sy + (this.py - this.sy) * Math.sin(u * Math.PI);
      this.dir = this.ex > this.sx ? 1 : -1;
      if (u >= 1) this.state = 'back';
    } else {
      const dx = this.hx - this.x, dy = this.hy - this.y, d = Math.hypot(dx, dy);
      if (d < 3) { this.state = 'perch'; this.cool = 2.2; }
      else { this.x += dx / d * 110 * dt; this.y += dy / d * 110 * dt; this.dir = dx > 0 ? 1 : -1; }
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.vulture(ctx, this); }
}

// Cascavel: escondida na areia (só se vêem os olhos); chocalha, levanta-se e dá um bote para a frente.
class Rattler extends Enemy {
  constructor(d) { super(d); this.state = 'hide'; this.timer = 0; this.h = 0; this.reach = 0; this.dir = -1; this.cool = 0.5; this.stays = true; }
  get hittable() { return this.h > 0.5; }
  box() { return { x: this.x + this.dir * this.reach * 0.5, y: this.y - 7 - 4 * this.h, hw: 7 + this.reach * 0.5, hh: 6 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, dx = p.x - this.x;
    this.cool -= dt;
    if (this.state === 'hide') {
      this.h = Math.max(0, this.h - dt * 5); this.reach = Math.max(0, this.reach - dt * 120);
      if (this.cool <= 0 && p.state !== 'dead' && Math.abs(dx) < 80 && Math.abs(p.y - this.y) < 30) {
        this.state = 'rattle'; this.timer = 0.5; this.dir = dx > 0 ? 1 : -1; Sound.sfx('rattle');
      }
    } else if (this.state === 'rattle') {
      this.h = Math.min(1, this.h + dt * 6); this.timer -= dt;
      if (this.timer <= 0) { this.state = 'strike'; this.timer = 0.2; this.dir = dx > 0 ? 1 : -1; }
    } else if (this.state === 'strike') {
      this.reach += (44 - this.reach) * Math.min(1, dt * 22); this.timer -= dt;
      if (this.timer <= 0) { this.state = 'hold'; this.timer = 0.3; }
    } else {
      this.timer -= dt; this.reach = Math.max(0, this.reach - dt * 90);
      if (this.timer <= 0) { this.state = 'hide'; this.cool = 1.4; }
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.rattler(ctx, this); }
}

// Borboleta (ambiente, sem colisão)
class Butterfly extends Ent {
  constructor(d) { super(d); this.x0 = d.x; this.y0 = d.y; this.col = ['#ffd84a', '#ff8fc8', '#9fd8ff', '#ffffff'][Math.floor(Math.random() * 4)]; }
  update(dt) {
    this.t += dt;
    this.x = this.x0 + Math.sin(this.t * 0.9) * 26 + Math.sin(this.t * 2.3) * 6;
    this.y = this.y0 + Math.sin(this.t * 1.7) * 10;
  }
  draw(ctx) { Gfx.butterfly(ctx, this); }
}

// ---------------- cenário ----------------
class Bramble extends Ent {
  box() { return { x: this.x, y: this.y - 5, hw: 7, hh: 5 }; }
  update(dt, game) { if (this.touching(game)) game.player.hurt(game, this.x); }
  draw(ctx) { Gfx.bramble(ctx, this); }
}

// Cacto: pica como as silvas (h = altura em tiles, 1 ou 2)
class Cactus extends Bramble {
  box() { const h = (this.h || 1) * 14; return { x: this.x, y: this.y - h / 2, hw: 5, hh: h / 2 }; }
  draw(ctx) { Gfx.cactus(ctx, this); }
}

class Spring extends Ent {
  constructor(d) { super(d); this.squash = 0; }
  box() { return { x: this.x, y: this.y - 5, hw: 8, hh: 6 }; }
  update(dt, game) {
    this.squash = Math.max(0, this.squash - dt * 4);
    const p = game.player;
    if (p.state === 'normal' && p.vy >= 0 && this.touching(game) && p.y <= this.y + 2) {
      Object.assign(p, { y: this.y - 10, vy: -(this.power || PHYS.springV), onGround: false, jumping: true,
        jumpCutDone: true, glide: false, glideArmed: false, airSpinUsed: false });
      if (this.vert) p.vx *= 0.25;                                // folha das copas (4-2): atira a direito, para passar o alçapão
      this.squash = 1; Sound.sfx('spring');
    }
  }
  draw(ctx) { Gfx.spring(ctx, this); }
}

class Checkpoint extends Ent {
  constructor(d) { super(d); this.active = false; }
  box() { return { x: this.x, y: this.y - 16, hw: 8, hh: 18 }; }
  update(dt, game) {
    this.t += dt;
    if (!this.active && this.touching(game)) {
      this.active = true; game.setCheckpoint(this.x, this.y);
      game.sparkle(this.x, this.y - 26, '#ffe066'); Sound.sfx('check');
    }
  }
  draw(ctx) { Gfx.checkpoint(ctx, this); }
}

class Goal extends Ent {
  constructor(d) { super(d); this.reached = false; }
  box() { return { x: this.x, y: this.y - 24, hw: 10, hh: 26 }; }
  update(dt, game) {
    this.t += dt;
    if (!this.reached && this.touching(game)) { this.reached = true; game.levelClear(); }
  }
  draw(ctx) { Gfx.goal(ctx, this); }
}

// ---------------- partículas ----------------
class Particle {
  constructor(o) {
    Object.assign(this, { vx: 0, vy: 0, grav: 0, size: 2, color: '#fff', life: 0.5, kind: 'dot', text: '' }, o);
    this.max = this.life;
  }
  update(dt) {
    this.life -= dt; this.vy += this.grav * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    return this.life > 0;
  }
}

const ENTITY_TYPES = {
  acorn: Acorn, golden: Golden, beetle: Beetle, wasp: Wasp, bramble: Bramble,
  spring: Spring, check: Checkpoint, goal: Goal, crawler: Crawler,
  mole: Mole, crow: Crow, butterfly: Butterfly, bat: Bat, boss: Boss,
  spider: Spider, drillmole: DrillMole, salamander: Salamander, stalactite: Stalactite, batboss: BatBoss, elevator: Elevator,
  scorpion: Scorpion, vulture: Vulture, rattler: Rattler, cactus: Cactus, cobra: CobraBoss,
};
function spawnEntities(level) {
  return level.defs.map(d => new ENTITY_TYPES[d.type](d));
}
