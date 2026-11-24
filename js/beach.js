'use strict';
// =====================================================================
//  REINO DA PRAIA (5-1): bolas de praia, castelos de areia, caranguejos,
//  gaivotas, a prancha de surf, e o mar (alforrecas, baiacus, ouriços,
//  amêijoas gigantes, algas, correntes). Também os desenhos e os fundos.
// =====================================================================

// ---------------- no areal ----------------
// Bola de praia pequena: empurra-se a correr; rola, salta, flutua na água e derruba caranguejos.
class BeachBall extends Ent {
  constructor(d) { super(d); this.x0 = d.x; this.y0 = d.y; this.r = 8; this.col = d.col || 0; this.onRespawn(); }
  onRespawn() { Object.assign(this, { x: this.x0, y: this.y0, vx: 0, vy: 0, rot: 0, gone: 0 }); }
  box() { return { x: this.x, y: this.y - this.r, hw: this.r, hh: this.r }; }
  update(dt, game) {
    const L = game.level, p = game.player;
    if (this.gone > 0) { this.gone -= dt; if (this.gone <= 0) this.onRespawn(); return; }
    // a Avelã empurra-a (ou salta-lhe em cima)
    if (p.state !== 'dead' && overlaps(playerBox(p), this.box())) {
      const s = Math.sign(this.x - p.x) || 1;
      if (p.vy > 60 && p.y < this.y - this.r) {
        Object.assign(p, { vy: -330, onGround: false, jumping: true, jumpCutDone: true }); this.vy = 140; Sound.sfx('boing');
      } else {
        const push = Math.abs(p.vx) > 20 && Math.sign(p.vx) === s;
        this.vx = push ? p.vx * 1.3 + s * 40 : s * 70;
        this.vy = Math.min(this.vy, -Math.min(150, 50 + Math.abs(p.vx) * 0.25));      // salta pouco: vai a rolar
        this.x = p.x + s * (PLAYER_HW + this.r + 1);
        Sound.sfx('boing');
      }
    }
    const inW = L.isWater(this.x, this.y - this.r);
    if (inW) { this.vy -= 1300 * dt; this.vy *= 1 - Math.min(1, 3 * dt); this.vx *= 1 - Math.min(1, 1.2 * dt); }   // flutua
    else this.vy += PHYS.gravity * dt;
    const prevY = this.y;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const s = Math.sign(this.vx);
    if (s && (SOLID[L.get(Math.floor((this.x + s * this.r) / T), Math.floor((this.y - this.r) / T))])) { this.x -= this.vx * dt; this.vx = -this.vx * 0.6; }
    if (this.vy < 0 && SOLID[L.get(Math.floor(this.x / T), Math.floor((this.y - 2 * this.r) / T))]) this.vy = -this.vy * 0.4;
    if (this.vy >= 0) {
      const f = L.floorAt(this.x, prevY - 3, this.y + 1);
      if (f) {
        this.y = f.y;
        if (this.vy > 140) { this.vy = -this.vy * 0.5; Sound.sfx('boing'); } else this.vy = 0;
        if (f.ch === '/') this.vx -= 260 * dt; else if (f.ch === '\\') this.vx += 260 * dt;     // nas dunas rola sozinha
        else this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), 130 * dt);
      }
    }
    this.rot += this.vx * dt / this.r;
    if (Math.abs(this.vx) > 140) {                       // bola a toda a velocidade: derruba caranguejos e castelos
      for (const e of game.ents) {
        if (e === this || !overlaps(this.box(), e.box ? e.box() : { x: 0, y: 0, hw: 0, hh: 0 })) continue;
        if (e instanceof Enemy && !(e instanceof Boss) && !e.dead && e.hittable) { e.kill(game); this.vx *= -0.4; }
        else if (e instanceof Sandcastle && !e.broken) e.smash(game);
      }
    }
    if (this.y > L.height + 30) this.gone = 2;
  }
  draw(ctx) { Gfx.beachBall(ctx, this.x, this.y - this.r, this.r, this.rot, this.col); }
}

// Bola de praia gigante: é uma mola (salta-se em cima dela); de lado empurra a Avelã.
class BigBall extends Ent {
  constructor(d) { super(d); this.r = d.r || 20; this.squash = 0; this.wob = 0; this.power = d.power || 620; this.col = d.col || 1; }
  box() { return { x: this.x, y: this.y - this.r, hw: this.r - 2, hh: this.r - 2 }; }
  update(dt, game) {
    this.squash = Math.max(0, this.squash - dt * 4); this.wob = Math.max(0, this.wob - dt * 3);
    const p = game.player;
    if (p.state !== 'normal' || !this.touching(game)) return;
    if (p.vy >= 0 && p.y < this.y - this.r * 1.05) {
      Object.assign(p, { y: this.y - 2 * this.r + 2, vy: -this.power, onGround: false, jumping: true, jumpCutDone: true, glide: false, glideArmed: false, airSpinUsed: false });
      this.squash = 1; Sound.sfx('boing'); Sound.sfx('spring');
    } else {
      const s = Math.sign(p.x - this.x) || 1;
      p.x = this.x + s * (this.r + PLAYER_HW - 1); if (Math.sign(p.vx) === -s) p.vx = s * 80; this.wob = 1;
    }
  }
  draw(ctx) {
    const sq = this.squash * 0.25, w = 1 + sq + Math.sin(this.t * 20) * this.wob * 0.05, h = 1 - sq;
    ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y)); ctx.scale(w, h);
    ell(ctx, 0, 1, this.r * 0.9, 3, 'rgba(0,0,0,0.25)');
    Gfx.beachBall(ctx, 0, -this.r, this.r, this.t * 0.2, this.col);
    ctx.restore();
  }
}

// Castelo de areia: parte-se a rebolar, com o pião, em bola ou com uma bola de praia; tem bolotas lá dentro.
class Sandcastle extends Ent {
  box() { return { x: this.x, y: this.y - 11, hw: 13, hh: 11 }; }
  update(dt, game) { if (!this.broken && game.player.attacking && this.touching(game)) this.smash(game); }
  smash(game) {
    this.broken = true; Sound.sfx('crumble'); game.player.score += 50; game.popText(this.x, this.y - 26, '50');
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.4; game.ents.push(new LooseAcorn({ x: this.x, y: this.y - 14, vx: Math.cos(a) * 120, vy: Math.sin(a) * 260, life: 8, delay: 0.3 })); }
    for (let i = 0; i < 14; i++) game.parts.push(new Particle({ x: this.x + (Math.random() - 0.5) * 24, y: this.y - Math.random() * 22, vx: (Math.random() - 0.5) * 160,
      vy: -60 - Math.random() * 140, grav: 700, life: 0.7, size: 2, color: i % 2 ? '#f0d090' : '#d9b070' }));
  }
  draw(ctx) { Gfx.sandcastle(ctx, this); }
}

// Caranguejo: anda de lado e abre as pinças quando a Avelã se aproxima.
class Crab extends Enemy {
  constructor(d) { super(d); this.dir = -1; this.x0 = d.x0 ?? d.x - 48; this.x1 = d.x1 ?? d.x + 48; this.snap = 0; this.pause = 0; }
  box() { return { x: this.x, y: this.y - 6, hw: 9, hh: 6 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player;
    if (this.pause > 0) this.pause -= dt;
    else { this.x += this.dir * 34 * dt; if (this.x < this.x0) { this.dir = 1; this.pause = 0.5; } if (this.x > this.x1) { this.dir = -1; this.pause = 0.5; } }
    const near = Math.abs(p.x - this.x) < 56 && Math.abs(p.y - this.y) < 40;
    this.snap = near ? Math.min(1, this.snap + dt * 4) : Math.max(0, this.snap - dt * 3);
    this.checkPlayer(game);
  }
  draw(ctx) { Gfx.crab(ctx, this); }
}

// ---------------- a prancha de surf ----------------
// Se a Avelã a perder (ou passar por ela a nadar), aparece outra ao lado dela enquanto ainda há mar para surfar.
class Surfboard extends Ent {
  constructor(d) { super(d); this.x0 = d.x; this.y0 = d.y; this.riding = false; this.wait = 0; }
  onRespawn() { this.riding = false; this.gone = false; this.x = this.x0; this.wait = 0; }
  box() { return { x: this.x, y: this.y + 8, hw: 18, hh: 22 }; }              // agarra-se também a nadar logo por baixo dela
  update(dt, game) {
    const p = game.player, L = game.level;
    if (this.riding) { if (p.state !== 'surf') { this.riding = false; this.gone = true; this.wait = 0; } return; }
    const swimming = p.state === 'normal' && L.isWater(p.x, p.y - 4) && p.x > this.x0 - 40 && p.x < L.surfEnd - 220;
    if (swimming && (this.gone || Math.abs(p.x - this.x) > 70)) {
      if ((this.wait += dt) > 0.8) {
        this.gone = false; this.wait = 0; this.x = p.x + 30;
        game.sparkle(this.x, this.y0 - 6, '#ffffff'); game.splash(this.x, this.y0, 6); Sound.sfx('splash');
      }
    } else this.wait = 0;
    if (!this.gone && p.state === 'normal' && this.touching(game)) p.startSurf(this, game);
  }
  draw(ctx) { if (!this.riding && !this.gone) { ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y0 + Math.sin(this.t * 2.5) * 1.5)); Gfx.surfboard(ctx); ctx.restore(); } }
}
// Onda-rampa: a Avelã a surfar passa por ela e é atirada ao ar.
class WaveRamp extends Ent {
  update(dt, game) {
    const p = game.player;
    if (p.state === 'surf' && !p.surfAir && Math.abs(p.x - this.x) < 12) {
      Object.assign(p, { vy: -(this.power || 600), surfAir: true, jumpCutDone: true }); Sound.sfx('spring'); game.splash(p.x, p.y, 10);
    }
  }
  draw(ctx) { Gfx.waveRamp(ctx, this); }
}
// Bóia: pica... quer dizer, dá um encontrão. Salta-se por cima.
class Buoy extends Ent {
  box() { return { x: this.x, y: this.y - 8 + Math.sin(this.t * 2) * 2, hw: 6, hh: 8 }; }
  update(dt, game) { this.t += dt; if (this.touching(game)) game.player.hurt(game, this.x); }
  draw(ctx) { Gfx.buoy(ctx, this); }
}
// Golfinho: salta ao lado da Avelã durante o surf (não faz nada, é só bonito).
class Dolphin extends Ent {
  constructor(d) { super(d); this.x0 = d.x; this.y0 = d.y; this.timer = d.delay || 1; this.jumpT = -1; }
  update(dt, game) {
    this.timer -= dt;
    if (this.jumpT < 0 && this.timer <= 0 && Math.abs(game.player.x - this.x0) < 260) { this.jumpT = 0; Sound.sfx('splash'); game.splash(this.x0, this.y0, 6); }
    if (this.jumpT >= 0) { this.jumpT += dt; if (this.jumpT > 1.1) { this.jumpT = -1; this.timer = 2.5 + Math.random() * 2; game.splash(this.x0 + 90, this.y0, 6); } }
  }
  draw(ctx) {
    if (this.jumpT < 0) return;
    const u = this.jumpT / 1.1, x = this.x0 + u * 90, y = this.y0 + 6 - Math.sin(u * Math.PI) * 54, a = Math.atan2(-Math.cos(u * Math.PI) * 54 * Math.PI, 90);
    Gfx.dolphin(ctx, x, y, a);
  }
}
// Onda gigante no fim do surf (só se vê): rebenta e a Avelã mergulha.
class BigWave extends Ent { draw(ctx, game) { Gfx.bigWave(ctx, this, game.clock); } }

// ---------------- no mar ----------------
// Alforreca: sobe e desce devagar; queima. Só o pião, a rebolar ou uma bolota a vencem.
class Jelly extends Enemy {
  constructor(d) { super(d); this.y0 = d.y; this.range = d.range ?? 36; this.flies = true; }
  box() { return { x: this.x, y: this.y, hw: 8, hh: 8 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    this.y = this.y0 + Math.sin(this.t * 1.1) * this.range;
    const p = game.player;
    if (p.state !== 'dead' && this.touching(game)) { if (p.attacking && !p.ball) this.kill(game); else p.hurt(game, this.x); }
  }
  draw(ctx) { Gfx.jelly(ctx, this); }
}
// Baiacu: nada de um lado para o outro; se a Avelã chega perto, incha e fica cheio de picos.
class Puffer extends Enemy {
  constructor(d) { super(d); this.x0 = d.x0 ?? d.x - 50; this.x1 = d.x1 ?? d.x + 50; this.y0 = d.y; this.dir = 1; this.puff = 0; this.puffT = 0; this.flies = true; }
  box() { const r = 6 + this.puff * 6; return { x: this.x, y: this.y, hw: r, hh: r }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, near = Math.hypot(p.cx - this.x, p.cy - this.y) < 60;
    if (near && this.puffT <= 0) { this.puffT = 1.8; Sound.sfx('gulp'); }
    if (this.puffT > 0) { this.puffT -= dt; this.puff = Math.min(1, this.puff + dt * 5); }
    else { this.puff = Math.max(0, this.puff - dt * 2); this.x += this.dir * 28 * dt; if (this.x < this.x0) this.dir = 1; if (this.x > this.x1) this.dir = -1; }
    this.y = this.y0 + Math.sin(this.t * 2) * 4;
    if (this.puff > 0.5) { if (this.touching(game) && p.state !== 'dead') { if (p.spinT > 0 || p.dashT > 0 || p.super) this.kill(game); else p.hurt(game, this.x); } }
    else this.checkPlayer(game);
  }
  draw(ctx) { Gfx.puffer(ctx, this); }
}
// Ouriço-do-mar: pica como as silvas.
class Urchin extends Bramble {
  box() { return { x: this.x, y: this.y - (this.down ? -5 : 5), hw: 7, hh: 5 }; }
  draw(ctx) { Gfx.urchin(ctx, this); }
}
// Amêijoa gigante: abre e fecha; lá dentro há uma pérola (10 bolotas). Fechar com a Avelã lá dentro magoa.
class Clam extends Ent {
  constructor(d) { super(d); this.state = 'shut'; this.timer = 1.5; this.open = 0; this.pearl = true; }
  box() { return { x: this.x, y: this.y - 8, hw: 14, hh: 8 }; }
  update(dt, game) {
    this.timer -= dt;
    const p = game.player;
    if (this.state === 'shut' && this.timer <= 0) { this.state = 'opening'; }
    else if (this.state === 'opening') { this.open = Math.min(1, this.open + dt * 2.5); if (this.open >= 1) { this.state = 'open'; this.timer = 2.4; } }
    else if (this.state === 'open' && this.timer <= 0) { this.state = 'closing'; Sound.sfx('chomp'); }
    else if (this.state === 'closing') { this.open = Math.max(0, this.open - dt * 6); if (this.open <= 0) { this.state = 'shut'; this.timer = 2.2; } }
    if (!this.touching(game) || p.state === 'dead') return;
    if (this.state === 'closing') p.hurt(game, this.x);
    else if (this.pearl && this.open > 0.6) {
      this.pearl = false; p.acorns += 10; p.score += 200; game.popText(this.x, this.y - 22, '+10'); Sound.sfx('gem'); game.sparkle(this.x, this.y - 8, '#ffffff');
    }
  }
  draw(ctx) { Gfx.clam(ctx, this); }
}
// Alga comprida a ondular (só decoração, desenhada à frente do fundo)
class Kelp extends Ent { draw(ctx) { Gfx.kelp(ctx, this); } }

Object.assign(ENTITY_TYPES, { beachball: BeachBall, bigball: BigBall, sandcastle: Sandcastle, crab: Crab, surfboard: Surfboard, waveramp: WaveRamp,
  buoy: Buoy, dolphin: Dolphin, bigwave: BigWave, jelly: Jelly, puffer: Puffer, urchin: Urchin, clam: Clam, kelp: Kelp });

// =====================================================================
//  Desenhos
// =====================================================================
const BALL_COLS = [['#ff3b3b', '#ffffff', '#2f7dff', '#ffd23f'], ['#ff8a1a', '#ffffff', '#2fc0a0', '#ff4fa0']];
Object.assign(Gfx, {
  beachBall(ctx, x, y, r, rot, col) {
    const C = BALL_COLS[col % 2];
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    for (let k = 0; k < 6; k++) {                                   // gomos a rodar
      const a0 = rot + k * Math.PI / 3;
      ctx.fillStyle = C[k % 4]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r + 1, a0, a0 + Math.PI / 3); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.35, r * 0.2, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,40,0.18)'; ctx.beginPath(); ctx.arc(r * 0.35, r * 0.35, r * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  sandcastle(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    if (e.broken) { ell(ctx, x, y - 2, 14, 3, '#e8c880'); ctx.fillStyle = '#d9b070'; ctx.fillRect(x - 6, y - 5, 4, 3); ctx.fillRect(x + 3, y - 4, 5, 2); return; }
    const S = ['#f0d090', '#d9b070', '#c49a5a'];
    ctx.fillStyle = S[1]; ctx.fillRect(x - 13, y - 10, 26, 10); ctx.fillStyle = S[0]; ctx.fillRect(x - 13, y - 10, 26, 2);
    for (const tx of [-11, 5]) { ctx.fillStyle = S[1]; ctx.fillRect(x + tx, y - 18, 6, 8); ctx.fillStyle = S[0]; ctx.fillRect(x + tx, y - 20, 2, 2); ctx.fillRect(x + tx + 4, y - 20, 2, 2); }
    ctx.fillStyle = S[1]; ctx.fillRect(x - 4, y - 24, 8, 14); ctx.fillStyle = S[0]; ctx.fillRect(x - 4, y - 26, 2, 2); ctx.fillRect(x + 2, y - 26, 2, 2);
    ctx.fillStyle = S[2]; ctx.fillRect(x - 2, y - 7, 4, 7); ctx.fillRect(x - 1, y - 20, 2, 3);
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x, y - 33, 1, 7); poly(ctx, [[x + 1, y - 33], [x + 6, y - 31], [x + 1, y - 29]], '#ff3b3b');   // bandeirinha
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 9, y - 4, 2, 1); ctx.fillRect(x + 8, y - 6, 2, 1);                                         // conchas
  },
  crab(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y));
    const C = ['#e0402a', '#ff6a40', '#a82818'], s = e.snap, leg = Math.sin(e.t * 16) * (e.pause > 0 ? 0 : 1.5);
    ctx.fillStyle = C[2]; for (let k = 0; k < 3; k++) { ctx.fillRect(-11 - k * 1, -4 + k * 1 + (k % 2 ? leg : -leg), 4, 1); ctx.fillRect(7 + k, -4 + k + (k % 2 ? -leg : leg), 4, 1); }
    ell(ctx, 0, -6, 9, 5, C[0]); ell(ctx, 0, -7, 7, 3, C[1]);
    for (const sd of [-1, 1]) {                                     // pinças
      const cx = sd * 11, cy = -10 - s * 5;
      ctx.fillStyle = C[2]; ctx.fillRect(sd * 6 - (sd < 0 ? 2 : 0), -9 - s * 3, 3, 3);
      ell(ctx, cx, cy, 4, 3.5, C[0]); ctx.fillStyle = '#3a0a06'; ctx.fillRect(cx - 1, cy - 4 - s * 2, 2, 3 + s * 2);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -13, 2, 3); ctx.fillRect(2, -13, 2, 3); ctx.fillStyle = '#1a1020'; ctx.fillRect(-3, -12, 1, 1); ctx.fillRect(3, -12, 1, 1);
    Gfx.ctlLight(ctx, e, 0, -15);
    ctx.restore();
  },
  surfboard(ctx) {                                                  // em coordenadas locais: os pés da Avelã em (0, 0)
    ell(ctx, 0, 1, 16, 3, '#ff8a1a'); ell(ctx, 0, 0, 15, 2, '#ffd23f'); ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-2, -1, 4, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(-12, -1, 6, 1);
  },
  waveRamp(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    ctx.fillStyle = 'rgba(40,140,220,0.85)'; ctx.beginPath(); ctx.moveTo(x - 34, y); ctx.quadraticCurveTo(x - 6, y - 4, x + 6, y - 22); ctx.lineTo(x + 12, y); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 2, y - 20); ctx.quadraticCurveTo(x + 10, y - 28, x + 16, y - 18); ctx.quadraticCurveTo(x + 10, y - 22, x + 6, y - 14); ctx.fill();   // espuma a enrolar
    ctx.fillStyle = '#d8f4ff'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 24 + k * 8, y - 3 - k * 4, 3, 1);
  },
  buoy(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y + Math.sin(e.t * 2) * 2);
    ell(ctx, x, y - 6, 7, 8, '#ff3b3b'); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 7, y - 8, 14, 3);
    ctx.fillStyle = '#4a4e58'; ctx.fillRect(x - 1, y - 20, 2, 8); ctx.fillStyle = Math.floor(e.t * 2) % 2 ? '#ffe14a' : '#a87a1a'; ctx.fillRect(x - 2, y - 22, 4, 3);
  },
  dolphin(ctx, x, y, a) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a);
    ell(ctx, 0, 0, 14, 5, '#5a8ac0'); ell(ctx, 1, 2, 10, 2.5, '#d8e8f4');
    poly(ctx, [[12, -1], [19, 0], [12, 2]], '#5a8ac0'); poly(ctx, [[-2, -4], [2, -10], [5, -4]], '#4a7ab0');
    poly(ctx, [[-13, 0], [-19, -5], [-17, 0], [-19, 5]], '#4a7ab0'); ctx.fillStyle = '#1a1020'; ctx.fillRect(8, -2, 1, 1);
    ctx.restore();
  },
  bigWave(ctx, e, time) {
    const x = Math.round(e.x), y = Math.round(e.y), h = 70;
    ctx.fillStyle = 'rgba(30,120,210,0.92)'; ctx.beginPath(); ctx.moveTo(x - 90, y); ctx.quadraticCurveTo(x - 30, y - 10, x - 10, y - h); ctx.quadraticCurveTo(x + 20, y - h - 18, x + 40, y - h + 6);
    ctx.quadraticCurveTo(x + 18, y - h + 4, x + 14, y - h + 26); ctx.quadraticCurveTo(x + 30, y - 10, x + 60, y); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 9; k++) { const a = k / 8, fx = x - 10 + a * 50 + Math.sin(time * 6 + k) * 2, fy = y - h - 8 + Math.sin(a * Math.PI) * -8 + a * 10; ctx.fillRect(Math.round(fx), Math.round(fy), 4, 3); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let k = 0; k < 6; k++) ctx.fillRect(x - 70 + k * 18, y - 4 - k * 2, 8, 1);
  },
  jelly(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), pulse = Math.sin(e.t * 3) * 1.5;
    ctx.strokeStyle = 'rgba(255,170,220,0.8)'; ctx.lineWidth = 1;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 3, y + 2); ctx.quadraticCurveTo(x + k * 3 + Math.sin(e.t * 4 + k) * 3, y + 9, x + k * 3, y + 16); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,140,210,0.85)'; ctx.beginPath(); ctx.ellipse(x, y, 9 + pulse, 7 - pulse * 0.5, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 9 - pulse, y - 1, 18 + pulse * 2, 3);
    ctx.fillStyle = 'rgba(255,230,250,0.9)'; ctx.fillRect(x - 4, y - 5, 3, 2);
    Gfx.ctlLight(ctx, e, x, y - 9);
  },
  puffer(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), r = 6 + e.puff * 6;
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir, 1);
    if (e.puff > 0.3) { ctx.fillStyle = '#e8d8a0'; for (let k = 0; k < 10; k++) { const a = k * 0.628; ctx.fillRect(Math.round(Math.cos(a) * (r + 2)) - 1, Math.round(Math.sin(a) * (r + 2)) - 1, 2, 2); } }
    ell(ctx, 0, 0, r, r * (0.8 + e.puff * 0.2), '#e8b840'); ell(ctx, 1, r * 0.3, r * 0.7, r * 0.4, '#f8e8b0');
    poly(ctx, [[-r, 0], [-r - 5, -4], [-r - 5, 4]], '#d8a030');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(r * 0.3), -3, 3, 3); ctx.fillStyle = '#1a1020'; ctx.fillRect(Math.round(r * 0.3) + 1, -2, 1, 1);
    ctx.fillStyle = '#8a4a20'; ctx.fillRect(Math.round(r * 0.8), 1, 2, 1);
    Gfx.ctlLight(ctx, e, 0, -r - 2);
    ctx.restore();
  },
  urchin(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y) + (e.down ? 0 : 0), cy = e.down ? y + 5 : y - 5;
    ctx.strokeStyle = '#3a1a4a'; ctx.lineWidth = 1;
    for (let k = 0; k < 12; k++) { const a = k * 0.5236 + Math.sin(e.t * 2 + k) * 0.05; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(a) * 9, cy + Math.sin(a) * 8); ctx.stroke(); }
    ell(ctx, x, cy, 5, 4, '#5a2a6a'); ell(ctx, x - 1, cy - 1, 2, 1.5, '#8a5a9a');
  },
  clam(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), o = e.open;
    ell(ctx, x, y - 4, 15, 5, '#7a6aa0');                             // concha de baixo
    if (o > 0.1) { ell(ctx, x, y - 6, 12, 3, '#ffb8c8'); if (e.pearl) { ell(ctx, x, y - 8, 3.5, 3.5, '#ffffff'); ctx.fillStyle = '#e0e8ff'; ctx.fillRect(x - 1, y - 10, 1, 1); } }
    ctx.save(); ctx.translate(x - 14, y - 6); ctx.rotate(-o * 0.9);   // concha de cima, articulada atrás
    ctx.fillStyle = '#9a8ac0'; ctx.beginPath(); ctx.ellipse(14, 0, 15, 6, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#6a5a90'; for (let k = 0; k < 5; k++) ctx.fillRect(4 + k * 5, -5 + Math.abs(k - 2), 1, 4);
    ctx.restore();
  },
  kelp(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), h = e.h || 60, n = Math.floor(h / 8);
    let px = x, py = y;
    for (let i = 1; i <= n; i++) {
      const nx = x + Math.sin(e.t * 1.3 + i * 0.5 + x) * i * 0.9, ny = y - i * 8;
      ctx.strokeStyle = i % 2 ? '#2a8a4a' : '#3aa85a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
      if (i % 2) ell(ctx, nx + 4, ny + 2, 4, 2, '#4ac06a', 0.5); else ell(ctx, nx - 4, ny + 2, 4, 2, '#3aa85a', -0.5);
      px = nx; py = ny;
    }
    ctx.lineWidth = 1;
  },
  // corrente debaixo de água: riscos e bolhinhas a passar
  currents(ctx, L, cx, time) {
    for (const c of L.currents || []) {
      if (c.x1 < cx || c.x0 > cx + VIEW_W) continue;
      ctx.fillStyle = 'rgba(220,245,255,0.55)';
      for (let k = 0; k < 26; k++) {
        const span = c.x1 - c.x0, x = c.x0 + ((hash2(k, 7) * span + time * c.vx * 0.9) % span), y = c.y0 + 4 + hash2(k, 9) * (c.y1 - c.y0 - 8);
        ctx.fillRect(Math.round(x), Math.round(y), 6 + Math.round(hash2(k, 3) * 8), 1);
      }
    }
  },
  // escuridão do fundo do mar (quanto mais fundo, mais escuro)
  seaDepth(ctx, cx, cy, L) {
    const x0 = Math.max(0, L.seaFrom * T - cx), y0 = Math.max(0, Math.round(L.seaY + 4 - cy));
    if (x0 >= VIEW_W || y0 >= VIEW_H) return;
    ctx.fillStyle = 'rgba(30,130,215,0.24)'; ctx.fillRect(x0, y0, VIEW_W - x0, VIEW_H - y0);   // tudo o que está debaixo de água fica azul
    const k = clamp((cy + VIEW_H / 2 - L.seaY - 80) / 420, 0, 1);
    if (k > 0) { ctx.fillStyle = `rgba(4,18,52,${((L.seaDark ?? 0.4) * k).toFixed(3)})`; ctx.fillRect(x0, y0, VIEW_W - x0, VIEW_H - y0); }
  },
  // ---------------- fundo da praia e do mar ----------------
  beachBg(ctx, camX, camY, L, time) {
    const oy = f => Math.round((camY - (L.bgRefY ?? L.height - VIEW_H)) * f);
    const seaS = Math.round(L.seaY - camY);
    // sol e nuvens
    ctx.fillStyle = 'rgba(255,250,210,0.5)'; ctx.beginPath(); ctx.arc(300, 30 - oy(0.03), 22, 0, 7); ctx.fill();
    ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(300, 30 - oy(0.03), 14, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = -1; i < 5; i++) { const w = 130, ox = camX * 0.05 + time * 4, k = Math.floor(ox / w) + i, x = k * w - ox, r = hash2(k, 21), y = 24 + r * 30 - oy(0.04);
      ctx.beginPath(); ctx.ellipse(x, y, 26 + r * 14, 6 + r * 3, 0, 0, 7); ctx.ellipse(x + 14, y - 5, 14, 6, 0, 0, 7); ctx.fill(); }
    // o mar ao fundo, até ao horizonte
    const hz = 112 - oy(0.12);
    if (hz < VIEW_H) {
      const g = ctx.createLinearGradient(0, hz, 0, VIEW_H); g.addColorStop(0, '#5ab8e8'); g.addColorStop(1, '#2a86c8');
      ctx.fillStyle = g; ctx.fillRect(0, hz, VIEW_W, VIEW_H - hz);
      // ilhota com farol
      const ix = ((620 - camX * 0.08) % 900 + 900) % 900 - 200;
      ctx.fillStyle = '#6a8a7a'; ctx.beginPath(); ctx.ellipse(ix, hz + 1, 46, 10, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(ix - 3, hz - 26, 6, 18); ctx.fillStyle = '#e0402a'; ctx.fillRect(ix - 3, hz - 20, 6, 3); ctx.fillRect(ix - 3, hz - 13, 6, 3);
      ctx.fillStyle = '#ffe14a'; ctx.fillRect(ix - 2, hz - 29, 4, 3);
      if (Math.floor(time * 1.5) % 2) { ctx.fillStyle = 'rgba(255,240,150,0.35)'; ctx.beginPath(); ctx.moveTo(ix, hz - 28); ctx.lineTo(ix + 40, hz - 34); ctx.lineTo(ix + 40, hz - 22); ctx.fill(); }
      // barco à vela
      const bx = ((time * 6 + 200 - camX * 0.1) % 700 + 700) % 700 - 150;
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(bx - 8, hz + 4, 16, 3); ctx.fillStyle = '#ffffff'; poly(ctx, [[bx, hz - 10], [bx, hz + 3], [bx + 8, hz + 3]], '#ffffff'); poly(ctx, [[bx - 1, hz - 6], [bx - 1, hz + 3], [bx - 7, hz + 3]], '#ffe0a0');
      // brilhos
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 0; k < 24; k++) { const x = ((hash2(k, 4) * VIEW_W - camX * (0.15 + hash2(k, 5) * 0.2)) % VIEW_W + VIEW_W) % VIEW_W, y = hz + 4 + hash2(k, 6) * (VIEW_H - hz);
        if (Math.sin(time * 3 + k) > 0.2) ctx.fillRect(Math.round(x), Math.round(y), 3 + (k % 3), 1); }
    }
    // dunas ao longe (só no areal)
    ctx.fillStyle = '#f0d898';
    for (let i = -1; i < 6; i++) { const w = 120, ox = camX * 0.3, k = Math.floor(ox / w) + i, x = k * w - ox, r = hash2(k, 31);
      if (k * w / 0.3 > (L.seaFrom || 1e9) * T) continue;
      ctx.beginPath(); ctx.ellipse(x, hz + 26 - oy(0.18) + r * 6, 70 + r * 20, 18 + r * 8, 0, Math.PI, 0); ctx.fill(); }
    // debaixo de água
    if (seaS < VIEW_H) {
      const y0 = Math.max(0, seaS), deep = clamp((camY - L.seaY) / 500, 0, 1);
      const g = ctx.createLinearGradient(0, y0, 0, VIEW_H);
      g.addColorStop(0, deep > 0.3 ? '#1a5a9a' : '#2a7ac0'); g.addColorStop(1, '#0c2c60');
      ctx.fillStyle = g; ctx.fillRect(0, y0, VIEW_W, VIEW_H - y0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';                                   // raios de luz da superfície
      for (let i = 0; i < 5; i++) { const span = VIEW_W + 160, x = ((i * 151 - camX * 0.35 + time * 6) % span + span) % span - 80, a = 0.05 + 0.03 * Math.sin(time * 0.8 + i * 1.7);
        ctx.fillStyle = `rgba(140,220,255,${a.toFixed(3)})`; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 18, y0); ctx.lineTo(x + 70, VIEW_H); ctx.lineTo(x + 34, VIEW_H); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#123a6a';                                                               // rochas e algas ao longe
      for (let i = -1; i < 6; i++) { const w = 100, ox = camX * 0.25, k = Math.floor(ox / w) + i, x = k * w - ox, r = hash2(k, 41), base = VIEW_H + 40 - oy(0.25);
        ctx.beginPath(); ctx.ellipse(x, base, 40 + r * 30, 30 + r * 40, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(Math.round(x + 20), Math.round(base - 70 - r * 30), 2, 70); }
      ctx.fillStyle = 'rgba(160,210,240,0.5)';                                                // cardume
      const fx = ((time * 30 - camX * 0.4) % (VIEW_W + 200) + VIEW_W + 200) % (VIEW_W + 200) - 100, fy = Math.max(y0 + 20, 60 + Math.sin(time * 0.5) * 20);
      for (let k = 0; k < 9; k++) { const x = fx + (k % 3) * 9 + Math.sin(time * 4 + k) * 2, y = fy + Math.floor(k / 3) * 6 + (k % 2) * 3; ctx.fillRect(Math.round(x), Math.round(y), 5, 2); ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 2, 4); }
    }
  },
});

// gaivota: o abutre do deserto com outra roupa (pousa num poste, mergulha e volta)
const _vultureDraw = Gfx.vulture;
Gfx.vulture = function (ctx, e) {
  if (e.style !== 'gull') return _vultureDraw.call(Gfx, ctx, e);
  ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
  if (e.state === 'perch') {
    ell(ctx, 0, -8, 7, 6, '#f4f4f4'); ell(ctx, -3, -8, 5, 4, '#a8b0bc');
    ell(ctx, 5, -14, 3.5, 3.5, '#ffffff'); poly(ctx, [[7, -15], [12, -14], [7, -12]], '#ffb83a'); ctx.fillStyle = '#e0402a'; ctx.fillRect(10, -13, 1, 1);
    ctx.fillStyle = '#1a1020'; ctx.fillRect(6, -15, 1, 1); ctx.fillStyle = '#ffb83a'; ctx.fillRect(-2, -2, 1, 2); ctx.fillRect(2, -2, 1, 2);
    Gfx.ctlLight(ctx, e, 4, -21);
  } else {
    const f = Math.sin(e.t * (e.state === 'swoop' ? 7 : 12));
    poly(ctx, [[-3, -1], [-20, -5 - 9 * f], [-16, 0], [-3, 2]], '#a8b0bc'); poly(ctx, [[-20, -5 - 9 * f], [-24, -7 - 10 * f], [-18, -3 - 8 * f]], '#3a3e48');
    ell(ctx, 0, 0, 8, 3.5, '#f4f4f4'); ell(ctx, 9, -2, 3, 2.6, '#ffffff'); poly(ctx, [[11, -3], [16, -1], [11, 0]], '#ffb83a');
    ctx.fillStyle = '#1a1020'; ctx.fillRect(10, -3, 1, 1);
    poly(ctx, [[-2, -1], [12, -6 - 10 * f], [10, 1], [-2, 2]], '#d8dee8');
    Gfx.ctlLight(ctx, e, 8, -7);
  }
  ctx.restore();
};

// decorações da praia e do fundo do mar (pré-desenhadas com os tiles)
const _decoBeach = Gfx.deco;
Gfx.deco = function (g, d) {
  const x = Math.round(d.x), y = Math.round(d.y), r = k => hash2(d.seed || 1, k);
  switch (d.type) {
    case 'umbrella': {
      const C = [['#ff3b3b', '#ffffff'], ['#2f7dff', '#ffd23f'], ['#2fc0a0', '#ffffff']][d.col || 0];
      g.fillStyle = '#d8d8d8'; g.fillRect(x, y - 34, 2, 34);
      for (let k = 0; k < 6; k++) { g.fillStyle = C[k % 2]; g.beginPath(); g.moveTo(x + 1, y - 40); g.lineTo(x - 22 + k * 7.6, y - 30); g.lineTo(x - 22 + (k + 1) * 7.6, y - 30); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(x + 4, y - 1, 18, 3, 0, 0, 7); g.fill();
      return;
    }
    case 'towel': g.fillStyle = ['#ff8a1a', '#2f7dff', '#ff4fa0'][d.col || 0]; g.fillRect(x - 12, y - 2, 24, 2); g.fillStyle = '#ffffff'; for (let k = 0; k < 4; k++) g.fillRect(x - 10 + k * 6, y - 2, 2, 2); return;
    case 'shell': ell(g, x, y - 2, 3, 2.5, r(1) > 0.5 ? '#ffe0d0' : '#f0b8a0'); g.fillStyle = '#c88070'; g.fillRect(x - 1, y - 4, 1, 3); g.fillRect(x + 1, y - 4, 1, 3); return;
    case 'starfish': g.fillStyle = r(2) > 0.5 ? '#ff7a4a' : '#ffb03a'; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 1.2566; g.fillRect(Math.round(x + Math.cos(a) * 3) - 1, Math.round(y - 3 + Math.sin(a) * 3) - 1, 2, 2); } g.fillRect(x - 1, y - 4, 3, 3); return;
    case 'bucket': g.fillStyle = '#ffd23f'; g.fillRect(x - 4, y - 7, 8, 7); g.fillStyle = '#ff3b3b'; g.fillRect(x - 5, y - 8, 10, 2); g.fillStyle = '#2f7dff'; g.fillRect(x + 6, y - 10, 2, 10); g.fillRect(x + 5, y - 2, 4, 2); return;
    case 'seagrass': for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? '#3a9a5a' : '#2a7a4a'; g.fillRect(x - 5 + k * 2 + Math.floor(r(k) * 2), y - 4 - Math.floor(r(k + 5) * 8), 1, 12); } return;
    case 'coral': {
      const C = ['#ff6a8a', '#ff9a4a', '#c86aff'][Math.floor(r(3) * 3)];
      g.fillStyle = C; g.fillRect(x - 1, y - 12, 3, 12);
      for (let k = 0; k < 3; k++) { const h = 5 + Math.floor(r(k) * 6), sx = x - 6 + k * 5; g.fillRect(sx, y - 8 - h, 2, h); g.fillRect(Math.min(sx, x), y - 9, Math.abs(sx - x) + 2, 2); ell(g, sx + 1, y - 9 - h, 2, 2, C); }
      return;
    }
    case 'post': g.fillStyle = '#6a4423'; g.fillRect(x - 3, y - d.h, 6, d.h); g.fillStyle = '#8a5a30'; g.fillRect(x - 3, y - d.h, 2, d.h); g.fillStyle = '#4a2e18'; g.fillRect(x - 4, y - d.h, 8, 2); return;
    case 'tower': {                                                  // posto de nadador-salvador
      g.fillStyle = '#a86a30'; for (const px of [x - 22, x + 20]) g.fillRect(px, y - d.h, 3, d.h);
      g.fillStyle = '#c88a48'; for (let k = 1; k < 6; k++) g.fillRect(x - 22, y - k * 12, 45, 1);
      g.fillStyle = '#e0402a'; g.fillRect(x - 26, y - d.h - 14, 53, 4); g.fillStyle = '#ffffff'; for (let k = 0; k < 6; k++) g.fillRect(x - 26 + k * 9, y - d.h - 14, 4, 4);
      g.fillStyle = '#a86a30'; g.fillRect(x - 24, y - d.h - 10, 2, 10); g.fillRect(x + 22, y - d.h - 10, 2, 10);
      g.fillStyle = '#4a4e58'; g.fillRect(x + 26, y - d.h - 36, 1, 22); g.fillStyle = '#ffd23f'; g.fillRect(x + 27, y - d.h - 36, 9, 6); g.fillStyle = '#ff3b3b'; g.fillRect(x + 27, y - d.h - 33, 9, 3);
      return;
    }
    case 'lighthouse': {
      g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x - 6, y - 74); g.lineTo(x + 6, y - 74); g.lineTo(x + 10, y); g.fill();
      g.fillStyle = '#e0402a'; for (let k = 0; k < 3; k++) { const yy = y - 18 - k * 22; g.fillRect(x - 9 + k, yy, 18 - k * 2, 8); }
      g.fillStyle = '#3a3e48'; g.fillRect(x - 8, y - 78, 16, 4); g.fillStyle = '#ffe14a'; g.fillRect(x - 5, y - 88, 10, 10); g.fillStyle = '#3a3e48'; g.fillRect(x - 6, y - 92, 12, 4); g.fillRect(x - 1, y - 96, 2, 4);
      g.fillStyle = '#5a5e69'; g.fillRect(x - 3, y - 10, 6, 10);
      return;
    }
    case 'shipwreck': {                                              // o barco dos esquilos antigos: mastro partido, vela rasgada, figura de proa
      const W = ['#5a3a24', '#7a5232', '#3a2414'];
      const h = d.hull;                                              // proa e popa (o casco do meio são tiles)
      if (h) {
        g.fillStyle = W[1]; g.beginPath();                          // proa: curva do convés até à quilha
        g.moveTo(h.x0, h.deck); g.lineTo(h.x0 - 34, h.deck - 12); g.quadraticCurveTo(h.x0 - 30, h.keel - 30, h.x0 + 4, h.keel - 18);
        g.lineTo(h.x0 + 64, h.keel); g.lineTo(h.x0 + 64, h.keel - 32); g.lineTo(h.x0 + 32, h.keel - 32); g.lineTo(h.x0, h.keel - 48); g.lineTo(h.x0, h.deck); g.fill();
        g.fillStyle = W[2]; g.beginPath(); g.moveTo(h.x0 - 34, h.deck - 12); g.quadraticCurveTo(h.x0 - 30, h.keel - 30, h.x0 + 4, h.keel - 18); g.lineTo(h.x0 + 4, h.keel - 15); g.quadraticCurveTo(h.x0 - 34, h.keel - 28, h.x0 - 38, h.deck - 11); g.fill();
        g.fillStyle = W[0]; g.fillRect(h.x0 - 34, h.deck - 13, 34, 3);   // amurada
        poly(g, [[h.x1, h.deck], [h.x1 + 34, h.deck - 26], [h.x1 + 36, h.deck - 6], [h.x1 - 24, h.keel]], W[1]);
        g.fillStyle = W[2]; g.fillRect(h.x1 + 4, h.deck - 30, 30, 4);
        for (let k = 0; k < 4; k++) { g.fillStyle = W[2]; g.fillRect(h.x0 - 26 + k * 4, h.deck + 4 + k * 12, 24 - k * 4, 1); g.fillRect(h.x1 - 4 + k * 3, h.deck - 18 + k * 9, 30 - k * 8, 1); }
        for (const px of d.portholes || []) { ell(g, px, h.deck + 26, 4, 4, '#2a1a10'); ell(g, px, h.deck + 26, 3, 3, '#3a6a8a'); }
      }
      g.save(); g.translate(d.mx, d.my); g.rotate(-0.18);
      g.fillStyle = W[0]; g.fillRect(-3, -d.mh, 6, d.mh); g.fillStyle = W[1]; g.fillRect(-3, -d.mh, 2, d.mh);
      g.fillStyle = W[2]; g.fillRect(-26, -d.mh + 10, 52, 3);
      g.fillStyle = 'rgba(220,200,160,0.85)'; g.beginPath(); g.moveTo(-24, -d.mh + 13); g.lineTo(22, -d.mh + 13); g.lineTo(18, -d.mh + 58); g.lineTo(6, -d.mh + 50); g.lineTo(-4, -d.mh + 62); g.lineTo(-20, -d.mh + 52); g.fill();
      g.fillStyle = '#d9b34a'; g.fillRect(-4, -d.mh + 26, 8, 4); g.fillRect(-5, -d.mh + 30, 10, 8); g.fillRect(-1, -d.mh + 38, 2, 2);   // bolota dourada na vela
      g.restore();
      // figura de proa: um esquilo de madeira com a bolota
      const fx = d.fx, fy = d.fy;
      ell(g, fx - 4, fy - 6, 5, 7, W[1]); ell(g, fx - 8, fy - 14, 4, 4, W[1]); poly(g, [[fx - 11, fy - 17], [fx - 10, fy - 22], [fx - 8, fy - 17]], W[0]);
      ell(g, fx + 3, fy - 12, 5, 9, W[0]); ell(g, fx - 10, fy - 6, 2.5, 3, '#d9b34a');
      return;
    }
  }
  return _decoBeach.call(Gfx, g, d);
};

// =====================================================================
//  RECIFE DE CORAL (5-2): peças feitas para o dash
// =====================================================================
// Anel de bolhas: atravessá-lo recarrega o dash logo (para encadear dashes) e dá uma bolota; volta 3 s depois.
class BubbleRing extends Ent {
  constructor(d) { super(d); this.r = 13; this.gone = 0; }
  onRespawn() { this.gone = 0; }
  update(dt, game) {
    if (this.gone > 0) { this.gone -= dt; return; }
    const p = game.player;
    if (p.state === 'dead' || Math.hypot(p.cx - this.x, p.cy - this.y) > this.r + 6) return;
    this.gone = 3; p.dashCool = 0; p.acorns++; p.score += 20;
    Sound.sfx('ring');
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; game.parts.push(new Particle({ kind: 'bubble', x: this.x + Math.cos(a) * this.r, y: this.y + Math.sin(a) * this.r, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20, life: 0.6, size: 1 })); }
  }
  draw(ctx) { Gfx.bubbleRing(ctx, this); }
}

// Moreia: escondida num buraco da rocha (só se vêem os olhos); quando a Avelã passa à frente, salta para fora,
// morde e recolhe. Só se vence quando está cá fora (dash, pião, bolota). dir: +1 olha para a direita, −1 para a esquerda.
class Moray extends Enemy {
  constructor(d) { super(d); this.dir = d.dir || 1; this.ext = 0; this.state = 'hide'; this.timer = 0.5 + Math.random(); this.stays = true; this.reach = d.reach || 58; }
  get hittable() { return this.ext > 0.35; }
  box() { return { x: this.x + this.dir * (6 + this.ext * this.reach), y: this.y, hw: 8, hh: 6 }; }
  update(dt, game) {
    this.t += dt;
    if (this.dead) return this.updateDead(dt);
    const p = game.player, dx = (p.x - this.x) * this.dir;
    this.timer -= dt;
    if (this.state === 'hide') {
      this.ext = Math.max(0, this.ext - dt * 3);
      if (this.timer <= 0 && p.state !== 'dead' && dx > 0 && dx < this.reach + 40 && Math.abs(p.cy - this.y) < 26) { this.state = 'out'; this.timer = 0.18; Sound.sfx('chomp'); }
    } else if (this.state === 'out') {
      this.ext = Math.min(1, this.ext + dt / 0.18);
      if (this.timer <= 0) { this.state = 'hold'; this.timer = 0.55; }
    } else if (this.state === 'hold') {
      if (this.timer <= 0) { this.state = 'back'; }
    } else {
      this.ext = Math.max(0, this.ext - dt * 2.4);
      if (this.ext <= 0) { this.state = 'hide'; this.timer = 1.2; }
    }
    if (this.ext > 0.1) this.checkPlayer(game);
  }
  draw(ctx) { Gfx.moray(ctx, this); }
}

// Interruptor de concha: abre o portão de coral com o mesmo id quando a Avelã lhe dá com o dash (ou com o pião).
class ShellSwitch extends Ent {
  constructor(d) { super(d); this.isSwitch = true; this.hold = 0; this.flash = 0; }
  get pressed() { return this.hold > 0; }
  box() { return { x: this.x, y: this.y, hw: 11, hh: 11 }; }
  update(dt, game) {
    if (this.hold > 0) this.hold -= dt;
    if (this.flash > 0) this.flash -= dt;
    const p = game.player;
    if (this.hold <= 0 && (p.dashT > 0 || p.spinT > 0) && this.touching(game)) {
      this.hold = 0.45; this.flash = 0.6; Sound.sfx('select'); Sound.sfx('smash'); game.sparkle(this.x, this.y, '#fff3a0');
      if (p.dashT > 0) { p.dashT = 0; p.vx = -p.dashDX * 120; p.vy = -p.dashDY * 120; }   // ressalta
    }
  }
  draw(ctx) { Gfx.shellSwitch(ctx, this); }
}

// Anémona: pica como os ouriços; os tentáculos ondulam
class Anemone extends Bramble {
  box() { return { x: this.x, y: this.y - 6, hw: 8, hh: 6 }; }
  draw(ctx) { Gfx.anemone(ctx, this); }
}

Object.assign(ENTITY_TYPES, { ring: BubbleRing, moray: Moray, shellswitch: ShellSwitch, anemone: Anemone });

Object.assign(Gfx, {
  bubbleRing(ctx, e) {
    const used = e.gone > 0, n = 12, a0 = e.t * 1.6;
    ctx.save(); ctx.globalAlpha = used ? 0.18 : 0.9;
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2, x = e.x + Math.cos(a) * e.r, y = e.y + Math.sin(a) * e.r * 1.1;
      ctx.fillStyle = i % 3 ? 'rgba(200,240,255,0.9)' : '#ffffff'; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), i % 2 ? 1.6 : 2.2, 0, 7); ctx.fill();
    }
    if (!used) { ctx.strokeStyle = `rgba(255,230,120,${(0.35 + 0.25 * Math.sin(e.t * 6)).toFixed(2)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r - 3, (e.r - 3) * 1.1, 0, 0, 7); ctx.stroke(); }
    ctx.restore();
  },
  moray(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), L = e.ext * e.reach;
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir, 1);
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(2, 0, 6, 8, 0, 0, 7); ctx.fill();          // buraco
    if (L > 1) {
      for (let s = 0; s <= L; s += 3) { const yy = Math.sin(s * 0.25 - e.t * 10) * 2; ell(ctx, 4 + s, yy, 5, 4.5, s % 6 ? '#6a8a2a' : '#7a9a32'); }   // corpo
      for (let s = 0; s <= L; s += 6) { ctx.fillStyle = '#4a6a1a'; ctx.fillRect(4 + s, Math.round(Math.sin(s * 0.25 - e.t * 10) * 2) - 1, 2, 2); }
    }
    const hx = 6 + L, hy = L > 1 ? Math.sin(L * 0.25 - e.t * 10) * 2 : 0, open = e.state === 'out' || e.state === 'hold';
    ell(ctx, hx, hy, 6.5, 5, '#7a9a32'); ell(ctx, hx + 2, hy + 2, 4, 2, '#c8d88a');
    if (open) { poly(ctx, [[hx + 2, hy], [hx + 9, hy - 3], [hx + 9, hy + 4]], '#3a0a10'); ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 5, hy - 2, 1, 2); ctx.fillRect(hx + 7, hy + 2, 1, 2); }
    ctx.fillStyle = '#fff04a'; ctx.fillRect(Math.round(hx) + 1, Math.round(hy) - 3, 2, 2); ctx.fillStyle = '#1a1020'; ctx.fillRect(Math.round(hx) + 2, Math.round(hy) - 3, 1, 1);
    Gfx.ctlLight(ctx, e, hx - 2, hy - 6);
    ctx.restore();
  },
  shellSwitch(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), on = e.hold > 0 || e.flash > 0;
    if (on) { ctx.fillStyle = 'rgba(255,240,150,0.35)'; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); }
    ctx.fillStyle = on ? '#ffd8a0' : '#f0a070';
    ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.arc(x, y + 2, 11, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();   // leque da vieira
    ctx.strokeStyle = on ? '#fff4c8' : '#c06a40'; ctx.lineWidth = 1;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x + k * 3.4, y - 8 + Math.abs(k) * 1.2); ctx.stroke(); }
    ctx.fillStyle = on ? '#ffe8b0' : '#d08050'; ctx.fillRect(x - 4, y + 7, 8, 3);
    if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 2, 2, 2); }
  },
  anemone(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    ell(ctx, x, y - 2, 6, 3, '#a03a7a');
    for (let k = -3; k <= 3; k++) {
      const a = Math.sin(e.t * 2.2 + k) * 0.35, len = 8 + (k % 2 ? 2 : 0);
      ctx.strokeStyle = k % 2 ? '#ff7ac8' : '#ffa8e0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + k * 1.6, y - 3); ctx.quadraticCurveTo(x + k * 2.4 + a * 6, y - 3 - len * 0.6, x + k * 3 + a * 8, y - 3 - len); ctx.stroke();
      ctx.fillStyle = '#fff0fa'; ctx.fillRect(Math.round(x + k * 3 + a * 8) - 1, Math.round(y - 3 - len) - 1, 2, 2);
    }
    ctx.lineWidth = 1;
  },
});
