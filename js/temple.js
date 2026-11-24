'use strict';
// =====================================================================
//  TEMPLO PERDIDO (4-3): armadilhas, pantera e o chefe do Reino da Selva,
//  o Leão. Também os desenhos destas coisas todas.
// =====================================================================

// ---------------- armadilhas ----------------
// Cabeça de pedra na parede: os olhos acendem-se e cospe um dardo a direito.
class DartTrap extends Ent {
  constructor(d) { super(d); this.period = d.period || 2.2; this.clock = (d.phase || 0) * this.period; this.dir = d.dir || 1; }
  update(dt, game) {
    const p = game.player;
    if (Math.abs(p.x - this.x) > 420 || Math.abs(p.y - this.y) > 140) { this.clock = (this.phase || 0) * this.period; this.glow = 0; return; }
    this.clock += dt;
    this.glow = clamp((this.clock - (this.period - 0.45)) / 0.45, 0, 1);    // aviso: os olhos acendem-se
    if (this.clock >= this.period) {
      this.clock = 0; this.glow = 0;
      game.ents.push(new Dart({ x: this.x + this.dir * 8, y: this.y, vx: this.dir * 250 }));
      Sound.sfx('dart');
    }
  }
  draw(ctx) { Gfx.dartTrap(ctx, this); }
}
class Dart extends Ent {
  constructor(d) { super(d); this.life = 3; }
  box() { return { x: this.x, y: this.y, hw: 6, hh: 2 }; }
  update(dt, game) {
    this.life -= dt; this.x += this.vx * dt;
    const L = game.level, p = game.player;
    if (this.life <= 0 || SOLID[L.get(Math.floor((this.x + Math.sign(this.vx) * 6) / T), Math.floor(this.y / T))]) {
      this.alive = false; game.dust(this.x, this.y + 2, 2); return;
    }
    if (!this.touching(game)) return;
    if (p.spinT > 0 || p.super) { this.alive = false; Sound.sfx('tock'); game.sparkle(this.x, this.y, '#ffffff'); }
    else { this.alive = false; p.hurt(game, this.x); }
  }
  draw(ctx) { Gfx.dart(ctx, this); }
}

// Esmagador: bloco de pedra preso ao tecto; treme quando a Avelã passa por baixo, cai, fica 1 s no
// chão e volta a subir devagar. Em cima dele anda-se (é uma plataforma).
class Crusher extends Ent {
  constructor(d) {
    super(d); this.y0 = d.y; this.hw = d.hw || 16; this.hb = 32; this.platform = true; this.dx = 0;
    this.state = 'up'; this.timer = 0; this.vy = 0; this.floorY = null;
  }
  get top() { return this.y; }
  solid() { return true; }
  onRespawn() { Object.assign(this, { state: 'up', y: this.y0, vy: 0, timer: 0, armed: true, onT: 0 }); }
  update(dt, game) {
    const L = game.level, p = game.player;
    if (this.floorY === null) { let ty = Math.floor((this.y0 + this.hb) / T); while (ty < L.rows && !SOLID[L.get(Math.floor(this.x / T), ty)]) ty++; this.floorY = ty * T; }
    const prevY = this.y;
    this.timer -= dt;
    const riding = p.plat === this && p.onGround && p.state === 'normal';
    if (this.state === 'up') {
      // em cima dele, lá no alto (poço do nicho): ao fim de 0,4 s desce com a Avelã, como um elevador
      if (!riding) { this.armed = true; this.onT = 0; }
      else if (this.armed !== false && (this.onT = (this.onT || 0) + dt) > 0.4) { this.state = 'shake'; this.timer = 0.35; this.armed = false; Sound.sfx('crumble'); }
      if (this.state === 'up' && p.state !== 'dead' && Math.abs(p.x - this.x) < this.hw + 12 && p.y > this.y + this.hb && p.y - this.y < 260) { this.state = 'shake'; this.timer = 0.35; Sound.sfx('crumble'); }
    } else if (this.state === 'shake') {
      if (this.timer <= 0) { this.state = 'fall'; this.vy = 0; }
    } else if (this.state === 'fall') {
      this.vy = Math.min(riding ? 300 : 720, this.vy + 1900 * dt); this.y += this.vy * dt;   // com a Avelã em cima desce mais devagar
      if (this.y + this.hb >= this.floorY) {
        this.y = this.floorY - this.hb; this.state = 'down'; this.timer = 1.0; Sound.sfx('land'); Sound.sfx('smash');
        game.dust(this.x - this.hw, this.floorY, 4); game.dust(this.x + this.hw, this.floorY, 4);
        if (Math.abs(p.x - this.x) < 160) game.flash = Math.max(game.flash, 0.06);
      }
    } else if (this.state === 'down') {
      if (this.timer <= 0) this.state = 'rise';
    } else if (this.state === 'rise') {
      this.y = Math.max(this.y0, this.y - 55 * dt);
      if (this.y <= this.y0) { this.state = 'up'; if (riding) this.armed = false; }   // chegou lá acima com ela: só volta a descer quando ela sair e voltar
    }
    this.dy = this.y - prevY;
    if (p.state === 'dead' || p.plat === this) return;
    const inX = Math.abs(p.x - this.x) < this.hw + PLAYER_HW - 1, inY = p.y > this.y + 6 && p.y - PLAYER_H < this.y + this.hb;
    if (!inX || !inY) return;
    if (this.state === 'fall' && p.y - PLAYER_H > this.y + 4) p.hurt(game, this.x);     // apanhada por baixo
    else { p.x = this.x + Math.sign(p.x - this.x || 1) * (this.hw + PLAYER_HW); p.vx = 0; }   // de lado: é uma parede
  }
  draw(ctx) { Gfx.crusher(ctx, this); }
}

// Pedregulho gigante: cai de um buraco no tecto quando a Avelã passa e rola atrás dela pelo corredor;
// desfaz-se no fim (endX).
class Boulder extends Ent {
  constructor(d) { super(d); this.x0 = d.x; this.yTop = d.y; this.r = d.r || 26; this.onRespawn(); }
  onRespawn() { Object.assign(this, { state: 'idle', x: this.x0, y: this.yTop, vx: 0, vy: 0, rot: 0, rumble: 0 }); }
  update(dt, game) {
    const L = game.level, p = game.player;
    if (this.state === 'idle') {
      if (p.state !== 'dead' && p.x > this.trigX && p.x < this.endX) { this.state = 'drop'; Sound.sfx('crumble'); game.flash = 0.08; }
      return;
    }
    if (this.state === 'gone') return;
    if (this.state === 'drop') {
      this.vy = Math.min(600, this.vy + 1100 * dt); const prevY = this.y; this.y += this.vy * dt;
      const f = L.floorAt(this.x, prevY - 2, this.y + 2);
      if (f) { this.y = f.y; this.state = 'roll'; this.vx = 60; Sound.sfx('smash'); game.dust(this.x - 20, f.y, 6); game.dust(this.x + 20, f.y, 6); }
    } else {
      let f = null;
      for (const off of [0, -this.r * 0.8, this.r * 0.8]) { f = L.floorAt(this.x + off, this.y - 20, this.y + 30); if (f) break; }
      const down = f && f.ch === '\\';
      this.vx = Math.min(down ? 330 : 270, this.vx + (down ? 420 : 200) * dt);
      this.x += this.vx * dt;
      if (f) { this.y += (f.y - this.y) * Math.min(1, dt * 14); this.vy = 0; }
      else { this.vy += 900 * dt; this.y += this.vy * dt; }
      this.rot += this.vx * dt / this.r;
      this.rumble -= dt;
      if (this.rumble <= 0) { this.rumble = 0.22; Sound.sfx('rumble'); game.dust(this.x - this.r * 0.6, this.y, 2); }
      if (this.x >= this.endX) {                         // bate na parede e desfaz-se
        this.state = 'gone'; Sound.sfx('smash'); game.flash = 0.15;
        for (let i = 0; i < 16; i++) game.parts.push(new Particle({ x: this.x + (Math.random() - 0.5) * this.r, y: this.y - this.r + (Math.random() - 0.5) * this.r,
          vx: (Math.random() - 0.6) * 260, vy: -120 - Math.random() * 200, grav: 700, life: 1.0, size: 2 + (i % 3), color: i % 2 ? '#7a8478' : '#555e52' }));
        return;
      }
    }
    if (p.state !== 'dead' && Math.hypot(p.cx - this.x, p.cy - (this.y - this.r)) < this.r + 8) {
      if (p.super) return;
      p.hurt(game, this.x - 40);
    }
  }
  draw(ctx) { if (this.state !== 'idle' && this.state !== 'gone') Gfx.boulder(ctx, this); }
}

// Placa no chão + portão de pedra: o portão abre enquanto a Avelã está em cima da placa e,
// quando ela sai, fecha devagar (tic-tac). Só se passa a tempo com spin ou com turbo.
class Plate extends Ent {
  box() { return { x: this.x, y: this.y - 2, hw: 12, hh: 3 }; }
  update(dt, game) {
    const p = game.player;
    this.pressed = p.state === 'normal' && p.onGround && Math.abs(p.x - this.x) < 14 && Math.abs(p.y - this.y) < 4;
    if (this.pressed && !this.was) Sound.sfx('select');
    this.was = this.pressed;
  }
  draw(ctx) { Gfx.plate(ctx, this); }
}
class Gate extends Ent {
  constructor(d) { super(d); this.h = d.h || 3; this.open = 0; this.closeT = d.closeT || 3.0; this.tick = 0; }
  onRespawn(game) { this.open = 0; this.apply(game.level, game.player, true); }
  update(dt, game) {
    const L = game.level, p = game.player;
    const plate = this.plate || (this.plate = game.ents.find(e => e instanceof Plate && e.id === this.id));
    if (plate && plate.pressed) this.open = Math.min(1, this.open + dt * 4);
    else if (this.open > 0) {
      this.open = Math.max(0, this.open - dt / this.closeT);
      this.tick -= dt; if (this.tick <= 0) { this.tick = this.open > 0.35 ? 0.3 : 0.15; Sound.sfx('tick'); }
      if (this.open === 0) Sound.sfx('land');
    }
    this.apply(L, p, false);
  }
  apply(L, p, quiet) {                                  // tiles 'D' (sólido) onde a porta tapa; 'd' (fundo) onde já abriu
    const tx = Math.floor(this.x / T), bottom = this.ty0 * T + this.h * T * (1 - this.open);
    for (let k = 0; k < this.h; k++) {
      const covered = bottom > (this.ty0 + k) * T + 2;
      L.set(tx, this.ty0 + k, covered ? 'D' : 'd');
    }
    if (quiet || p.state === 'dead') return;
    if (Math.abs(p.x - (tx * T + 8)) < 8 + PLAYER_HW && p.y - PLAYER_H < bottom && p.y > this.ty0 * T) {
      p.x = tx * T - PLAYER_HW - 1; if (p.vx > 0) p.vx = 0;                  // a porta empurra-a para trás
    }
  }
  draw(ctx) { Gfx.gate(ctx, this); }
}

// ---------------- pantera ----------------
// Patrulha devagar; se vê a Avelã à frente e perto, agacha-se e salta-lhe em cima.
class Panther extends Enemy {
  constructor(d) { super(d); this.dir = -1; this.vx = 0; this.vy = 0; this.state = 'walk'; this.timer = 0; this.x0 = d.x0 ?? d.x - 70; this.x1 = d.x1 ?? d.x + 70; }
  box() { return { x: this.x, y: this.y - 8, hw: 12, hh: 8 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const L = game.level, p = game.player, dx = p.x - this.x;
    this.timer -= dt;
    if (this.state === 'walk') {
      this.x += this.dir * 40 * dt;
      if (this.x < this.x0) this.dir = 1; if (this.x > this.x1) this.dir = -1;
      if (p.state !== 'dead' && Math.abs(dx) < 140 && Math.abs(p.y - this.y) < 40 && Math.sign(dx) === this.dir) { this.state = 'crouch'; this.timer = 0.45; Sound.sfx('growl'); }
    } else if (this.state === 'crouch') {
      if (this.timer <= 0) { this.state = 'leap'; this.vx = this.dir * clamp(Math.abs(dx) * 1.6, 120, 260); this.vy = -300; }
    } else if (this.state === 'leap') {
      const prevY = this.y; this.vy += 900 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (SOLID[L.get(Math.floor((this.x + this.dir * 12) / T), Math.floor((this.y - 8) / T))]) { this.x -= this.vx * dt; this.vx = 0; }
      if (this.vy > 0) { const f = L.floorAt(this.x, prevY - 2, this.y + 2); if (f) { this.y = f.y; this.state = 'rest'; this.timer = 0.8; game.dust(this.x, f.y, 3); } }
      if (this.y > L.height + 40) this.alive = false;
    } else if (this.state === 'rest') {
      if (this.timer <= 0) { this.state = 'walk'; this.dir = dx > 0 ? 1 : -1; this.x0 = Math.min(this.x0, this.x - 20); this.x1 = Math.max(this.x1, this.x + 20); }
    }
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.panther(ctx, this); }
}

// ---------------- onda de choque (aterragem do Leão) ----------------
class Shockwave extends Ent {
  constructor(d) { super(d); this.life = d.life || 1.4; }
  box() { return { x: this.x, y: this.y - 6, hw: 6, hh: 6 }; }
  update(dt, game) {
    this.life -= dt; this.x += this.vx * dt;
    if (this.life <= 0 || this.x < this.ax0 || this.x > this.ax1) { this.alive = false; return; }
    if (Math.random() < dt * 30) game.dust(this.x, this.y, 1);
    if (this.touching(game) && !game.player.super) game.player.hurt(game, this.x - this.vx);
  }
  draw(ctx) { Gfx.shockwave(ctx, this); }
}

// =====================================================================
//  CHEFE DO REINO DA SELVA — o Leão (4-3), na Sala do Sol do templo
//   7 pontos de vida; só se lhe acerta quando está tonto (depois de bater na parede)
//   ou a recompor-se de um salto.
//   fase 1 (7-6): passeia e investe de um lado ao outro (salta-se por cima ou foge-se para as varandas)
//   fase 2 (5-4): + salto para cima da Avelã; ao aterrar solta duas ondas de choque pelo chão
//   fase 3 (3-1): + rugido (empurra a Avelã e caem pedras do tecto); tudo mais rápido
// =====================================================================
class LionBoss extends Boss {
  constructor(d) {
    super(d);
    Object.assign(this, { title: 'LEÃO', music: 'boss4', who: 'leao', noFeathers: true, givesTank: true,
      before: STORY.lionBefore, after: STORY.lionAfter, afterTail: STORY.lionTail,
      finalLine: 'PRAIA, AÍ VOU EU! DRILLER, VAIS VER QUE UMA ESQUILO TAMBÉM SABE MERGULHAR.' });
  }
  reset() {
    super.reset();
    Object.assign(this, { x: this.hx, y: this.floor, vx: 0, vy: 0, face: -1, roarT: 0 });
    if (this.game) for (const e of this.game.ents) if (e.fromBoss) e.alive = false;
  }
  get hittable() { return ['dizzy', 'land'].includes(this.state) && this.inv <= 0; }
  box() { return { x: this.x + this.face * 4, y: this.y - 16, hw: 22, hh: 14 }; }
  update(dt, game) {
    this.game = game; this.t += dt; this.timer -= dt;
    if (this.inv > 0) this.inv -= dt;
    const p = game.player, lo = this.ax0 + 30, hi = this.ax1 - 30;
    if (this.state !== 'roar') game.wind = 0;
    switch (this.state) {
      case 'wait':
        if (p.state !== 'dead' && p.x > this.ax0 + 40) { this.state = 'intro'; this.timer = 2.0; game.startBoss(this); Sound.sfx('roar'); this.roarT = 1; }
        return;
      case 'intro':
        this.face = p.x > this.x ? 1 : -1; this.roarT = Math.max(0, this.roarT - dt);
        if (this.timer <= 0) { if (!this.talked) { this.talked = true; game.story(this.before); } else this.next(game); }
        return;
      case 'pace': {                                     // passeia, sempre de olho na Avelã
        this.face = p.x > this.x ? 1 : -1;
        const tx = clamp(p.x - this.face * 90, lo, hi);
        this.x += clamp(tx - this.x, -70 * dt, 70 * dt);
        if (this.timer <= 0) this.next(game);
        break;
      }
      case 'crouch':                                     // aviso: baixa-se e raspa o chão
        if (Math.random() < dt * 14) game.dust(this.x - this.face * 20, this.floor, 1);
        if (this.timer <= 0) {
          if (this.sub === 'leap') {
            const tf = 0.85, g = 1150, tx = clamp(p.x, lo, hi);
            Object.assign(this, { state: 'leap', vx: (tx - this.x) / tf, vy: -g * tf / 2, g });
            this.face = this.vx > 0 ? 1 : -1; Sound.sfx('jump');
          } else { this.state = 'charge'; this.vx = this.face * (this.phase >= 3 ? 390 : 310); Sound.sfx('roar'); }
        }
        break;
      case 'charge':
        this.x += this.vx * dt;
        if (Math.random() < dt * 20) game.dust(this.x - this.face * 18, this.floor, 1);
        if (this.x <= lo || this.x >= hi) {              // bate na parede: fica tonto
          this.x = clamp(this.x, lo, hi); this.state = 'dizzy'; this.timer = this.phase >= 3 ? 1.0 : 1.4;
          Sound.sfx('smash'); game.flash = 0.1; game.dust(this.x + this.face * 24, this.floor - 10, 8);
          if (this.phase >= 2) this.stones(game, 2);
        }
        break;
      case 'leap': {
        this.vy += this.g * dt; this.x = clamp(this.x + this.vx * dt, lo, hi); this.y += this.vy * dt;
        if (this.vy > 0 && this.y >= this.floor) {
          this.y = this.floor; this.state = 'land'; this.timer = 0.75; Sound.sfx('smash'); game.flash = 0.08;
          game.dust(this.x - 20, this.floor, 6); game.dust(this.x + 20, this.floor, 6);
          for (const s of [-1, 1]) game.ents.push(new Shockwave({ x: this.x + s * 26, y: this.floor, vx: s * (this.phase >= 3 ? 280 : 230), ax0: this.ax0 + 8, ax1: this.ax1 - 8, fromBoss: true }));
        }
        break;
      }
      case 'roar':                                       // rugido: empurra a Avelã e o tecto deixa cair pedras
        this.face = p.x > this.x ? 1 : -1;
        this.roarT = 1;
        game.wind = this.timer > 0.3 ? this.face * 330 : 0;
        if (game.wind && Math.random() < dt * 25) game.windStreak(this.face);
        if (!this.dropped && this.timer < 1.0) { this.dropped = true; this.stones(game, 4); }
        if (this.timer <= 0) { game.wind = 0; this.roarT = 0; this.next(game); }
        break;
      case 'dizzy': case 'land':
        if (this.timer <= 0) this.next(game);
        break;
      case 'hurt':
        this.x = clamp(this.x - this.face * 90 * dt, lo, hi);
        if (this.timer <= 0) this.next(game);
        break;
      case 'defeat':
        if (this.t > 1.3) { this.state = 'freed'; this.timer = 1.6; this.controlled = false; game.bossDefeated(this); }
        return;
      case 'freed':
        this.face = p.x > this.x ? 1 : -1;
        if (this.timer <= 0 && !this.spoke) { this.spoke = true; game.bossEnding(this); }
        return;
    }
    this.dir = this.face;
    if (p.state === 'dead' || !overlaps(playerBox(p), this.box())) return;
    if (p.attacking && this.hittable) { this.hit(game, true); return; }
    const stomp = p.vy > 40 && p.y < this.y - 22;
    if (stomp && !this.hittable) {                       // nas costas dele não magoa, mas também não lhe faz nada
      Object.assign(p, { vy: -300, onGround: false, jumping: true, jumpCutDone: true }); Sound.sfx('tock'); return;
    }
    if (this.inv <= 0 && !['hurt', 'dizzy', 'land'].includes(this.state)) p.hurt(game, this.x);   // tonto ou a recompor-se não magoa
  }
  hit(game, bounce) {
    super.hit(game, bounce);
    if (this.state === 'hurt') { this.timer = 0.7; Sound.sfx('roar'); }
    if (this.state === 'defeat') { this.t = 0; this.vy = 0; this.y = this.floor; }
  }
  next(game) {
    const seq = { 1: ['pace', 'charge', 'pace', 'charge'], 2: ['pace', 'leap', 'charge', 'pace', 'leap', 'leap', 'charge'],
      3: ['roar', 'charge', 'leap', 'leap', 'pace', 'charge', 'leap'] }[this.phase];
    const s = seq[this.step++ % seq.length];
    this.dropped = false;
    if (s === 'pace') { this.state = 'pace'; this.timer = this.phase === 1 ? 1.5 : this.phase === 2 ? 1.1 : 0.7; }
    else if (s === 'charge') { this.state = 'crouch'; this.sub = 'charge'; this.timer = this.phase >= 3 ? 0.45 : 0.65; this.face = game.player.x > this.x ? 1 : -1; Sound.sfx('growl'); }
    else if (s === 'leap') { this.state = 'crouch'; this.sub = 'leap'; this.timer = this.phase >= 3 ? 0.35 : 0.5; this.face = game.player.x > this.x ? 1 : -1; Sound.sfx('growl'); }
    else { this.state = 'roar'; this.timer = 1.6; Sound.sfx('roar'); }
  }
  stones(game, n) {                                      // pedras a cair do tecto (uma por cima da Avelã)
    const p = game.player, xs = [clamp(p.x, this.ax0 + 16, this.ax1 - 16)];
    while (xs.length < n) xs.push(this.ax0 + 24 + Math.random() * (this.ax1 - this.ax0 - 48));
    xs.forEach((x, i) => game.ents.push(new Stalactite({ x: Math.round(x), y: this.ceil, state: 'shake', timer: 0.5 + i * 0.15, fromBoss: true, rock: true })));
  }
  draw(ctx) { Gfx.lion(ctx, this); }
}

Object.assign(STORY, {
  lionBefore: [
    { who: 'avela', text: 'MAIS ESTÁTUAS DE ESQUILOS... IGUAIS ÀS DO DESERTO. QUEM É QUE ANDOU A CONSTRUIR TEMPLOS POR TODO O LADO?' },
    { who: 'leao', ctl: true, text: '...GRRR... UMA ESQUILO... NA SALA DO SOL...' },
    { who: 'avela', text: 'TU DEVES SER O LEÃO. A COBRA REAL AVISOU-ME... E ESSA BROCA NO MEIO DA JUBA DIZ O RESTO.' },
    { who: 'leao', ctl: true, text: '...O TEMPLO É DO DRILLER. NINGUÉM SAI DAQUI INTEIRO.' },
    { who: 'avela', text: 'JÁ FUGI DE UM PEDREGULHO DESTE TAMANHO HOJE. UM GATO GRANDE NÃO ME ASSUSTA!' },
  ],
  lionAfter: [
    { who: 'leao', text: 'GRRR... QUE DOR DE CABEÇA. PARECE QUE ME PASSOU UMA MANADA DE ELEFANTES POR CIMA.' },
    { who: 'avela', text: 'FOI SÓ UMA ESQUILO. SOU A AVELÃ. TINHAS UMA MÁQUINA DO DRILLER ESPETADA NA JUBA.' },
    { who: 'leao', text: 'UMA ESQUILO NA SALA DO SOL... OS VELHOS DA SELVA DIZIAM QUE UM DIA ISTO IA ACONTECER.' },
    { who: 'avela', text: 'OS VELHOS DA SELVA? E AS ESTÁTUAS? JÁ AS VI NO DESERTO, TODAS COM UMA BOLOTA DOURADA NAS PATAS.' },
    { who: 'leao', text: 'FOI UM POVO DE ESQUILOS QUE FEZ ESTE TEMPLO, HÁ MUITO TEMPO. DIZEM QUE UM DIA ATRAVESSARAM O MAR... MAS ISSO SÃO HISTÓRIAS DE AVÓS.' },
    { who: 'avela', text: 'E O DRILLER? O QUE É QUE ELE QUERIA DAQUI?' },
    { who: 'leao', text: 'O JADE DAS PAREDES. ARRANCOU-O TODO, ENCHEU AS MÁQUINAS E FOI PARA A PRAIA. ANDA A CONSTRUIR QUALQUER COISA NO FUNDO DO MAR.' },
    { who: 'avela', text: 'NO FUNDO DO MAR?! NO RIO JÁ QUASE FIQUEI SEM AR...' },
  ],
  lionTail: [
    { who: 'leao', item: 'tank', text: 'ENTÃO LEVA ISTO. OS MERGULHADORES DO DRILLER FUGIRAM QUANDO EU RUGI E DEIXARAM CÁ UMA BOTIJA.' },
    { who: 'avela', item: 'tank', text: 'UMA BOTIJA DE OXIGÉNIO! COM ISTO AGUENTO O DOBRO DEBAIXO DE ÁGUA.' },
    { who: 'leao', text: 'E QUANDO VOLTARES, CONTA-ME COMO É O FUNDO DO MAR. UM LEÃO NÃO NADA LÁ GRANDE COISA.' },
  ],
});

Object.assign(ENTITY_TYPES, { darttrap: DartTrap, crusher: Crusher, boulder: Boulder, plate: Plate, gate: Gate, panther: Panther, lion: LionBoss });

// =====================================================================
//  Desenhos
// =====================================================================
Object.assign(Gfx, {
  dartTrap(ctx, e) {                                     // cara de pedra com olhos que se acendem
    const x = Math.round(e.x), y = Math.round(e.y);
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir, 1);
    ctx.fillStyle = '#5a6458'; ctx.fillRect(-7, -9, 12, 18); ctx.fillStyle = '#7a8478'; ctx.fillRect(-7, -9, 12, 2);
    ctx.fillStyle = '#3a4238'; ctx.fillRect(-5, -2, 10, 1); ctx.fillRect(3, -1, 4, 3);       // boca (o cano)
    ctx.fillStyle = '#1a1e1a'; ctx.fillRect(5, 0, 2, 1);
    const gl = e.glow || 0;
    ctx.fillStyle = gl > 0 ? `rgb(${Math.round(120 + 135 * gl)},${Math.round(40 + 20 * gl)},30)` : '#2a2e28';
    ctx.fillRect(-4, -6, 2, 2); ctx.fillRect(1, -6, 2, 2);
    ctx.fillStyle = '#4aa844'; ctx.fillRect(-7, -10, 5, 1);                                 // musgo
    ctx.restore();
  },
  dart(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), s = Math.sign(e.vx);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 6, y, 12, 1);
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(s > 0 ? x + 5 : x - 7, y - 1, 2, 3);
    ctx.fillStyle = '#e8303a'; ctx.fillRect(s > 0 ? x - 7 : x + 5, y - 1, 2, 3);           // penas
  },
  crusher(ctx, e) {
    const x = Math.round(e.x + (e.state === 'shake' ? (Math.random() - 0.5) * 2 : 0)), y = Math.round(e.y), w = e.hw * 2, h = e.hb;
    ctx.strokeStyle = '#4a4e48'; ctx.lineWidth = 2;                                        // correntes até ao tecto
    for (const cx of [x - e.hw + 5, x + e.hw - 5]) { ctx.beginPath(); ctx.moveTo(cx, e.y0 - 60); ctx.lineTo(cx, y); ctx.stroke(); }
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6a7468'; ctx.fillRect(x - e.hw, y, w, h);
    ctx.fillStyle = '#8a9488'; ctx.fillRect(x - e.hw, y, w, 3);
    ctx.fillStyle = '#4a5248'; ctx.fillRect(x - e.hw, y + h - 3, w, 3); ctx.fillRect(x + e.hw - 2, y, 2, h);
    ctx.fillStyle = '#3a4038';                                                             // cara zangada gravada
    ctx.fillRect(x - 9, y + 8, 6, 2); ctx.fillRect(x + 3, y + 8, 6, 2);
    ctx.fillStyle = e.state === 'shake' || e.state === 'fall' ? '#ff5a3a' : '#2a2e28'; ctx.fillRect(x - 7, y + 11, 3, 3); ctx.fillRect(x + 4, y + 11, 3, 3);
    ctx.fillStyle = '#3a4038'; ctx.fillRect(x - 8, y + 19, 16, 2);
    ctx.fillStyle = '#c8ccd4';                                                             // dentes por baixo
    for (let k = -e.hw + 2; k < e.hw - 2; k += 5) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + 2, y + h + 4); ctx.lineTo(x + k + 4, y + h); ctx.fill(); }
    ctx.fillStyle = '#4aa844'; ctx.fillRect(x - e.hw, y, 6, 1); ctx.fillRect(x + 4, y, 5, 1);
  },
  boulder(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y - e.r), r = e.r;
    ell(ctx, x, Math.round(e.y) - 1, r * 0.9, 4, 'rgba(0,0,0,0.35)');
    ell(ctx, x, y, r, r, '#6a7066'); ell(ctx, x - 5, y - 6, r * 0.75, r * 0.7, '#80877a'); ell(ctx, x - 10, y - 12, 6, 5, '#9aa294');
    ctx.save(); ctx.translate(x, y); ctx.rotate(e.rot);
    ctx.fillStyle = '#4a5046';
    for (let k = 0; k < 5; k++) { const a = k * 1.26; ctx.fillRect(Math.round(Math.cos(a) * r * 0.55) - 2, Math.round(Math.sin(a) * r * 0.55) - 2, 4, 3); }
    ctx.fillStyle = '#d9b34a'; ctx.fillRect(-2, -3, 4, 2); ctx.fillRect(-3, -1, 6, 4); ctx.fillRect(-1, 3, 2, 1);   // bolota gravada
    ctx.restore();
  },
  plate(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), d = e.pressed ? 2 : 0;
    ctx.fillStyle = '#3a4238'; ctx.fillRect(x - 13, y - 2, 26, 2);
    ctx.fillStyle = e.pressed ? '#d9b34a' : '#8a9488'; ctx.fillRect(x - 11, y - 5 + d, 22, 3 - d);
    ctx.fillStyle = e.pressed ? '#fff3a0' : '#a8b0a4'; ctx.fillRect(x - 11, y - 5 + d, 22, 1);
    ctx.fillStyle = e.pressed ? '#ffffff' : '#5a6458'; ctx.fillRect(x - 2, y - 4 + d, 4, 1);
  },
  gate(ctx, e) {
    const x = Math.floor(e.x / T) * T, top = e.ty0 * T, h = e.h * T, bottom = top + h * (1 - e.open);
    if (bottom <= top + 1) return;
    ctx.fillStyle = '#5a6458'; ctx.fillRect(x + 1, top, 14, bottom - top);
    ctx.fillStyle = '#7a8478'; ctx.fillRect(x + 1, top, 3, bottom - top);
    ctx.fillStyle = '#3a4238'; for (let yy = top + 8; yy < bottom - 2; yy += 12) ctx.fillRect(x + 1, yy, 14, 1);
    ctx.fillStyle = '#c8ccd4'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + 2 + k * 4, bottom); ctx.lineTo(x + 4 + k * 4, bottom + 4); ctx.lineTo(x + 6 + k * 4, bottom); ctx.fill(); }
    ctx.fillStyle = '#d9b34a'; ctx.fillRect(x + 6, top + 4, 4, 4);
  },
  panther(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const crouch = e.state === 'crouch', leap = e.state === 'leap', run = Math.sin(e.t * 12);
    const by = crouch ? -6 : -9, K = ['#1a1a24', '#2a2a38', '#3a3a4c'];
    ctx.strokeStyle = K[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, by - 1); ctx.quadraticCurveTo(-20, by - 10 + run * 2, -16, by - 14); ctx.stroke(); ctx.lineWidth = 1;   // cauda
    if (!leap) { ctx.fillStyle = K[0]; ctx.fillRect(-9 + run * 2, by + 3, 3, -by - 3); ctx.fillRect(6 - run * 2, by + 3, 3, -by - 3); ctx.fillRect(-5 - run * 2, by + 3, 3, -by - 3); ctx.fillRect(2 + run * 2, by + 3, 3, -by - 3); }
    else { ctx.fillStyle = K[0]; ctx.fillRect(-14, by + 2, 6, 2); ctx.fillRect(9, by + 1, 6, 2); }
    ell(ctx, 0, by, 12, 5, K[1]); ell(ctx, -1, by - 1, 9, 3, K[2]);                     // corpo
    ell(ctx, 12, by - 4 + (crouch ? 2 : 0), 5, 4.5, K[1]);                               // cabeça
    poly(ctx, [[9, by - 8], [10, by - 11], [12, by - 8]], K[1]); poly(ctx, [[13, by - 8], [14, by - 11], [15, by - 8]], K[1]);
    ctx.fillStyle = '#8aff5a'; ctx.fillRect(13, by - 5 + (crouch ? 2 : 0), 2, 1);       // olho verde
    ctx.fillStyle = '#e8e0d0'; if (crouch || leap) { ctx.fillRect(15, by - 1, 1, 2); ctx.fillRect(13, by - 1, 1, 2); }
    Gfx.ctlLight(ctx, e, 11, by - 12);
    ctx.restore();
  },
  shockwave(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), s = Math.sign(e.vx), a = Math.min(1, e.life * 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#d8c8a0'; ctx.beginPath(); ctx.moveTo(x - s * 10, y); ctx.quadraticCurveTo(x - s * 2, y - 16, x + s * 6, y); ctx.fill();
    ctx.fillStyle = '#fff3d0'; ctx.beginPath(); ctx.moveTo(x - s * 4, y); ctx.quadraticCurveTo(x + s, y - 10, x + s * 5, y); ctx.fill();
    ctx.globalAlpha = 1;
  },
  tank(ctx, x, y, s = 1) {                               // botija de oxigénio (para as caixas de diálogo)
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(s, s);
    ctx.fillStyle = '#d8dce4'; ctx.fillRect(-2, -10, 4, 2); ctx.fillStyle = '#7a7e89'; ctx.fillRect(-1, -12, 2, 2); ctx.fillRect(1, -12, 3, 1);
    ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.ellipse(0, -5, 4, 3, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-4, -5, 8, 12); ctx.beginPath(); ctx.ellipse(0, 7, 4, 2, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fff0a0'; ctx.fillRect(-3, -5, 1, 11);
    ctx.fillStyle = '#4a7acf'; ctx.fillRect(-4, 0, 8, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, 0, 2, 1);
    ctx.restore();
  },
  // Leão: corpo dourado, juba enorme, cauda com borla; broca do Driller no meio da juba
  lion(ctx, b) {
    const st = b.state, crouch = st === 'crouch', run = st === 'charge' || st === 'pace' || (st === 'hurt'),
      down = st === 'defeat' || st === 'freed', dizzy = st === 'dizzy', open = b.roarT > 0 || st === 'roar' || st === 'crouch' || st === 'charge';
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.scale(b.face || b.dir || 1, 1);
    if (b.inv > 0 && Math.floor(b.inv * 16) % 2) ctx.globalAlpha = 0.45;
    const B = ['#c98a3a', '#e0a850', '#f4cc80', '#8a4a1e', '#b0602a', '#6a3414'];
    const by = down ? -9 : crouch ? -16 : -22, ph = Math.sin(b.t * (st === 'charge' ? 16 : 8)) * (run ? 1 : 0);
    // cauda
    ctx.strokeStyle = B[0]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, by - 2); ctx.quadraticCurveTo(-34, by - 4 + ph * 4, -32, by - 16 + (down ? 12 : 0)); ctx.stroke(); ctx.lineWidth = 1;
    ell(ctx, -32, by - 17 + (down ? 12 : 0), 3.5, 3.5, B[5]);
    // patas
    if (!down) {
      const leg = (lx, o) => { ctx.fillStyle = B[0]; ctx.fillRect(lx + o * 4, by + 6, 6, -by - 6); ctx.fillStyle = B[2]; ctx.fillRect(lx + o * 4 - 1, -3, 8, 3); };
      if (st === 'leap') { ctx.fillStyle = B[0]; ctx.fillRect(-24, by + 4, 10, 5); ctx.fillRect(14, by + 2, 12, 5); }
      else { leg(-18, ph); leg(-10, -ph); leg(8, -ph); leg(16, ph); }
    } else { ctx.fillStyle = B[0]; ctx.fillRect(-18, -5, 30, 5); }
    // corpo
    ell(ctx, -2, by, 22, 11, B[0]); ell(ctx, -3, by - 2, 19, 8, B[1]); ell(ctx, 0, by + 5, 14, 4, B[2]);
    // juba e cabeça
    const hx = down ? 22 : 18, hy = down ? -12 : by - 8 + (crouch ? 6 : 0);
    for (let k = 0; k < 10; k++) { const a = k * 0.63 + Math.sin(b.t * 3 + k) * 0.05; ell(ctx, hx - 2 + Math.cos(a) * 11, hy + Math.sin(a) * 11, 6, 6, k % 2 ? B[3] : B[4]); }
    ell(ctx, hx - 2, hy, 12, 12, B[4]);
    ell(ctx, hx + 2, hy + 1, 8, 8, B[1]);                                                 // cara
    ell(ctx, hx + 8, hy + 4, 4.5, 3.5, B[2]);                                             // focinho
    ctx.fillStyle = '#4a2a1a'; ctx.fillRect(hx + 10, hy + 1, 3, 2);                       // nariz
    if (open) { poly(ctx, [[hx + 5, hy + 6], [hx + 13, hy + 5], [hx + 12, hy + 11], [hx + 5, hy + 9]], '#5a0a10'); ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 7, hy + 6, 1, 2); ctx.fillRect(hx + 11, hy + 5, 1, 2); }
    else { ctx.fillStyle = '#4a2a1a'; ctx.fillRect(hx + 6, hy + 7, 6, 1); }
    ctx.fillStyle = '#4a2a1a'; ctx.fillRect(hx - 1, hy - 7, 4, 3); ctx.fillRect(hx + 6, hy - 7, 4, 3);   // orelhas
    if (down && st === 'defeat') { ctx.fillStyle = '#2a1a10'; ctx.fillRect(hx + 2, hy - 2, 3, 1); ctx.fillRect(hx + 7, hy - 2, 3, 1); }
    else if (b.controlled !== false) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(hx + 2, hy - 3, 3, 2); ctx.fillRect(hx + 7, hy - 3, 3, 2); ctx.fillStyle = '#fff0a0'; ctx.fillRect(hx + 3, hy - 3, 1, 1); }
    else { ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 2, hy - 3, 3, 2); ctx.fillRect(hx + 7, hy - 3, 3, 2); ctx.fillStyle = '#1a1008'; ctx.fillRect(hx + 4, hy - 3, 1, 2); ctx.fillRect(hx + 9, hy - 3, 1, 2); }
    if (b.controlled !== false) {                                                         // broca do Driller espetada na juba
      ctx.fillStyle = '#8a8f99'; ctx.fillRect(hx - 6, hy - 14, 9, 4);
      poly(ctx, [[hx - 4, hy - 14], [hx + 1, hy - 14], [hx - 1.5, hy - 24]], '#b8bcc6');
      ctx.fillStyle = '#5a5e69'; const sp = Math.floor(b.t * 8) % 3; for (let k = 0; k < 3; k++) ctx.fillRect(hx - 3 + (k + sp) % 3, hy - 21 + k * 2, 2, 1);
      ctx.fillStyle = Math.floor(b.t * 5) % 2 ? '#ff3b3b' : '#a8122a'; ctx.fillRect(hx - 6, hy - 12, 2, 2);
    }
    if (dizzy) { ctx.fillStyle = '#ffe14a'; for (let k = 0; k < 3; k++) { const a = b.t * 6 + k * 2.1, sx = Math.round(hx + Math.cos(a) * 12), sy = Math.round(hy - 20 + Math.sin(a) * 3); ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); } }
    if (st === 'freed' && b.timer > 0) { ctx.fillStyle = '#ffe14a'; for (let k = 0; k < 3; k++) { const a = b.t * 5 + k * 2.1, sx = Math.round(hx + Math.cos(a) * 12), sy = Math.round(hy - 20 + Math.sin(a) * 3); ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); } }
    ctx.restore();
  },
});
