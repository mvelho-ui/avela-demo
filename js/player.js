'use strict';
// =====================================================================
//  AVELÃ — a esquilo-vermelho (Sciurus vulgaris) com óculos de aviadora.
//  Estados: normal (chão/ar) | climb (a trepar) | loop | dead
// =====================================================================
class Player {
  constructor(level) {
    this.level = level;
    this.lives = 3; this.acorns = 0; this.score = 0;
    this.golden = [false, false, false];
    this.reset(level.start.x, level.start.y);
  }
  reset(x, y) {
    Object.assign(this, {
      x, y, vx: 0, vy: 0, onGround: true, groundCh: '#', groundTx: 0, groundTy: 0,
      state: 'normal', facing: 1, angle: 0, glide: false, glideArmed: false, jumping: false, jumpCutDone: false,
      coyote: 0, jumpBuf: 0, ctrlLock: 0, spinT: 0, spinCool: 0, airSpinUsed: false,
      inv: 0, energy: 100, exhausted: false, turbo: false, anim: 0, idleT: 0,
      loop: null, loopT: 0, loopSpeed: 0, wallDir: 0, skid: false, deadT: 0, hurtT: 0,
      touchWall: null, trail: [], runPhase: 0, hopT: 0, hopDir: 0,
      rolling: false, rollAir: false, rollRot: 0, downHeld: false, throwCool: 0, throwT: 0,
      trunkX: 0, trunkCool: 0, wallSlideT: 0, dropT: 0, super: false, superT: 0, spinCharge: 0, dashing: false,
      crouch: false, lookUp: false, lookT: 0, liana: null, theta: 0, omega: 0, grip: 0, swingCool: 0, plat: null,
      air: PHYS.airMax, airWarn: 0,
    });
  }
  get cx() { return this.x + Math.sin(this.angle) * PLAYER_H / 2; }
  get cy() { return this.y - Math.cos(this.angle) * PLAYER_H / 2; }
  get ball() { return this.state === 'normal' && !this.onGround && this.jumping && !this.glide && this.hurtT <= 0; }
  get attacking() {
    return this.super || this.spinT > 0 || this.ball || this.rolling || this.state === 'loop' ||
      (this.turbo && this.onGround && Math.abs(this.vx) > 330);
  }

  update(dt, inp, game) {
    if (this.state === 'dead') {
      this.vy += PHYS.gravity * dt; this.y += this.vy * dt; this.deadT += dt; return;
    }
    this.anim += dt;
    this.runPhase += (this.onGround ? Math.abs(this.vx) * 0.075 : 0) * dt;
    const spd = this.state === 'loop' ? Math.abs(this.loopSpeed) : this.onGround ? Math.abs(this.vx) : 0;
    this.rollRot += (spd > 0 ? spd / 8.5 : this.spinCharge > 0 ? 30 + this.spinCharge * 8 : 18) * dt;   // rotação da bola (a carregar o spin gira no sítio)
    this.downHeld = inp.down;
    if (this.throwCool > 0) this.throwCool -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    if (this.trunkCool > 0) this.trunkCool -= dt;
    if (this.swingCool > 0) this.swingCool -= dt;
    if (this.wallSlideT > 0) this.wallSlideT -= dt;
    if (this.dropT > 0) this.dropT -= dt;
    if (this.inv > 0) this.inv -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.ctrlLock > 0) this.ctrlLock -= dt;
    if (this.spinCool > 0) this.spinCool -= dt;
    if (this.spinT > 0) this.spinT -= dt;
    if (this.coyote > 0) this.coyote -= dt;
    this.jumpBuf = inp.jumpPressed ? 0.12 : Math.max(0, this.jumpBuf - dt);
    const d = this.ctrlLock > 0 || this.hurtT > 0 ? 0 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);

    // --- turbo (energia) ---
    const wantTurbo = inp.turbo && this.state === 'normal' && (d !== 0 || Math.abs(this.vx) > 40);
    if (this.energy <= 0) this.exhausted = true;
    if (this.exhausted && this.energy > 30) this.exhausted = false;
    const was = this.turbo;
    this.turbo = wantTurbo && !this.exhausted;
    if (this.turbo && !was && this.onGround) { Sound.sfx('turbo'); game.dust(this.x, this.y, 6); }
    this.energy = this.turbo ? Math.max(0, this.energy - PHYS.turboDrain * dt)
      : Math.min(100, this.energy + PHYS.turboRegen * dt);

    // --- pião de cauda ---
    if (inp.spinPressed && this.spinCool <= 0 && this.state !== 'climb' && this.state !== 'trunk' && this.hurtT <= 0) {
      this.spinT = PHYS.spinTime; this.spinCool = PHYS.spinCool;
      Sound.sfx('spin');
      if (this.state === 'normal' && !this.onGround && !this.airSpinUsed) {
        this.vy = Math.min(this.vy, -PHYS.spinLift); this.airSpinUsed = true; this.glide = false;
      }
    }

    // --- atirar bolota ---
    if (inp.throwPressed) this.throwAcorn(inp, game);

    // --- Super Avelã: 3 pedras preciosas + 50 bolotas; gasta 1 bolota por segundo ---
    if (inp.superPressed) this.toggleSuper(game);
    if (this.super) {
      this.superT += dt;
      if (this.superT >= 1) { this.superT -= 1; this.acorns = Math.max(0, this.acorns - 1); if (this.acorns === 0) this.endSuper(); }
      if (Math.random() < dt * 45) game.flame(this.cx, this.cy);
    }

    if (game.wind && this.state === 'normal') {          // rajadas do Barão Gralha
      if (this.onGround) this.x += game.wind * 0.16 * dt; else this.vx += game.wind * dt;
    }
    if (this.state === 'loop') this.updateLoop(dt, d, inp, game);
    else if (this.state === 'climb') this.updateClimb(dt, d, inp, game);
    else if (this.state === 'trunk') this.updateTrunk(dt, d, inp, game);
    else if (this.state === 'swing') this.updateSwing(dt, d, inp, game);
    else if (this.state === 'zip') this.updateZip(dt, d, inp, game);
    else if (this.state === 'surf') this.updateSurf(dt, d, inp, game);
    else if (this.onGround) this.updateGround(dt, d, inp, game);
    else this.updateAir(dt, d, inp, game);

    if (this.state === 'normal') {
      if (d !== 0 && (this.onGround || this.glide)) this.facing = d;
      else if (!this.onGround && d !== 0 && Math.abs(this.vx) < 60) this.facing = d;
      let target = 0;
      if (this.onGround) target = this.groundCh === '/' ? -Math.PI / 4 : this.groundCh === '\\' ? Math.PI / 4 : 0;
      this.angle += (target - this.angle) * Math.min(1, dt * 18);
    }
    this.idleT = (this.onGround && Math.abs(this.vx) < 1 && d === 0) ? this.idleT + dt : 0;

    // rasto (turbo e velocidade alta)
    if (Math.abs(this.vx) > 320 || this.state === 'loop' || this.turbo) {
      this.trail.unshift({ x: this.x, y: this.y, a: this.angle });
      if (this.trail.length > 10) this.trail.pop();
    } else if (this.trail.length) this.trail.pop();

    if (this.y > this.level.height + 40) game.killPlayer();
  }

  // ---------------- chão ----------------
  updateGround(dt, d, inp, game) {
    const L = this.level;
    // spin (aprendido com a Cobra Real): parada, ↓ + Z carrega (cada Z dá mais embalo); largar ↓ dispara a rebolar
    if (this.spinCharge > 0) {
      if (inp.down) {
        this.vx = 0;
        if (this.jumpBuf > 0) { this.jumpBuf = 0; this.spinCharge = Math.min(5, this.spinCharge + 1); Sound.sfx('rev'); game.dust(this.x - this.facing * 8, this.y, 3); }
        return;
      }
      this.vx = this.facing * Math.min(PHYS.absMax, 330 + this.spinCharge * 45);
      Object.assign(this, { spinCharge: 0, rolling: true, dashing: true, skid: false });
      Sound.sfx('dash'); game.dust(this.x - this.facing * 10, this.y, 8);
    } else if (game.hasSpin && inp.down && this.jumpBuf > 0 && Math.abs(this.vx) < 40 && !ONEWAY[this.groundCh] && !SLOPE[this.groundCh]) {
      this.jumpBuf = 0; this.spinCharge = 1; this.vx = 0; this.rolling = false; this.crouch = false; Sound.sfx('rev'); game.dust(this.x - this.facing * 8, this.y, 3);
      return;
    }
    if (!this.rolling) this.dashing = false;
    if (inp.down && this.jumpBuf > 0 && ONEWAY[this.groundCh]) {          // ↓+Z: descer das folhas/pontes
      this.jumpBuf = 0; this.onGround = false; this.dropT = 0.25; this.y += 3; this.vy = 40; this.rolling = false; return;
    }
    if (inp.down && ONEWAY[this.groundCh] && Math.abs(this.vx) < 60 && this.trunkCool <= 0 && this.trunkAt(this.x, this.y + T + 2)) {
      this.y += 12; this.enterTrunk(); return;                               // ↓ em cima de um tronco: desce por ele
    }
    if (inp.up && this.trunkCool <= 0 && this.trunkAt(this.x, this.y - PLAYER_H * 0.5)) { this.enterTrunk(); return; }
    // parada: ↓ agacha-se (é daqui que se carrega o spin), ↑ olha para cima; a câmara acompanha ao fim de meio segundo
    const still = Math.abs(this.vx) < 30 && d === 0 && !this.rolling;
    this.crouch = still && inp.down; this.lookUp = still && inp.up && !inp.down;
    this.lookT = this.crouch || this.lookUp ? this.lookT + dt : 0;
    if (this.crouch) this.vx = 0;
    if (!this.rolling && inp.down && Math.abs(this.vx) > PHYS.rollStart) { this.rolling = true; this.skid = false; Sound.sfx('roll'); }
    if (this.rolling) this.rollPhysics(dt, d, inp, game);
    else this.runPhysics(dt, d, game);
    this.vx = clamp(this.vx, -PHYS.absMax, PHYS.absMax);

    // salto (a rebolar ou a correr, sai sempre em bola)
    if (this.jumpBuf > 0) { this.doJump(); }

    const prevX = this.x;
    this.x += this.vx * dt;
    this.touchWall = this.collideX(12);
    if (inp.up && this.onGround && !this.rolling) {
      for (const dir of [this.facing, -this.facing]) {
        if (this.wallAt(dir) === 'H') { this.enterClimb(dir); return; }
      }
    }
    if (!this.onGround) return;   // saltou neste passo

    const f = L.floorAt(this.x, this.y - 14, this.y + 14) ||
      L.floorAt(this.x - 5, this.y - 6, this.y + 6) || L.floorAt(this.x + 5, this.y - 6, this.y + 6) ||
      game.platformAt(this.x, this.y - 6, this.y + 6);                    // troncos e crocodilos
    if (f) this.setGround(f);
    else {
      this.onGround = false; this.coyote = 0.1; this.vy = 0;
      // rampas que acabam no ar (3-2): a Avelã sai disparada na direcção da rampa
      if (L.rampLaunch && this.groundCh === '/' && this.vx > 150) { this.vy = -this.vx * 0.75; this.coyote = 0; Sound.sfx('spring'); }
      if (this.rolling) {             // caiu de um beiral a rebolar: continua em bola
        this.rolling = false; this.rollAir = true; this.jumping = true; this.jumpCutDone = true;
      }
    }

    // entrada no looping
    for (const lp of L.loops) {
      if (lp.armed && this.vx >= PHYS.loopEnter && prevX < lp.cx && this.x >= lp.cx &&
        Math.abs(this.y - (lp.cy + lp.r)) < 6) {
        lp.armed = false; this.state = 'loop'; this.loop = lp; this.loopT = 0;
        this.loopSpeed = this.vx; Sound.sfx('loop'); break;
      }
    }
  }
  runPhysics(dt, d, game) {
    const max = this.turbo ? PHYS.turboMax : PHYS.maxRun;
    if (this.groundCh === '/') this.vx -= PHYS.slopeAcc * dt;
    else if (this.groundCh === '\\') this.vx += PHYS.slopeAcc * dt;
    const wasSkid = this.skid;
    this.skid = false;
    if (d !== 0) {
      if (this.vx * d >= 0) {
        if (Math.abs(this.vx) < max) {
          this.vx += d * PHYS.accel * (this.turbo ? 1.8 : 1) * dt;
          if (Math.abs(this.vx) > max) this.vx = d * max;
        } else this.vx -= Math.sign(this.vx) * PHYS.friction * 0.08 * dt;   // mantém o embalo
      } else {
        this.vx += d * PHYS.decel * dt;
        if (Math.abs(this.vx) > 110) this.skid = true;
      }
    } else {
      const onSlope = SLOPE[this.groundCh];
      if (!(onSlope && Math.abs(this.vx) > 60)) {
        const f = PHYS.friction * dt;
        this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
      }
    }
    if (this.skid && !wasSkid) Sound.sfx('skid');
    if (this.skid && Math.random() < 0.5) game.dust(this.x + this.facing * 4, this.y, 1);
  }
  // A rebolar: pouco atrito, as descidas dão mais embalo.
  //  ↓ + direcção do movimento -> rebola sem parar (velocidade de corrida, ou de turbo)
  //  só ↓ -> quase sem atrito  ·  sem ↓ -> atrito normal até se levantar
  rollPhysics(dt, d, inp, game) {
    const sl = this.groundCh === '/' ? -1 : this.groundCh === '\\' ? 1 : 0;
    if (sl) this.vx += sl * PHYS.slopeAcc * (Math.sign(this.vx) === sl ? 1.35 : 1) * dt;
    if (d !== 0 && this.vx * d < 0) this.vx += d * PHYS.decel * 0.45 * dt;   // travar
    const max = this.turbo ? PHYS.turboMax : PHYS.maxRun;
    if (inp.down && d !== 0 && this.vx * d > 0 && Math.abs(this.vx) < max) {
      this.vx += d * PHYS.accel * PHYS.rollPush * (this.turbo ? 1.8 : 1) * dt;
      if (Math.abs(this.vx) > max) this.vx = d * max;
    } else {
      const push = inp.down && d !== 0 && this.vx * d > 0;   // acima da velocidade máxima: perde devagar
      const f = (push ? 30 : inp.down ? PHYS.rollFrictionHeld : PHYS.rollFriction) * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    }
    if (this.vx !== 0) this.facing = Math.sign(this.vx);
    if (Math.abs(this.vx) < PHYS.rollMin) this.rolling = false;
    if (Math.random() < 0.12) game.dust(this.x - this.facing * 5, this.y, 1);
  }
  throwAcorn(inp, game) {
    if (this.throwCool > 0 || this.hurtT > 0 || this.state === 'loop') return;
    if (this.acorns <= 0) { Sound.sfx('empty'); this.throwCool = 0.2; return; }
    if (game.ents.filter(e => e instanceof ThrownAcorn).length >= PHYS.throwMax) return;
    const climbing = this.state === 'climb';
    const dir = climbing ? -this.wallDir : this.facing;
    let vx = dir * PHYS.throwV, vy = -60;
    if (inp.up && !climbing) { vx = dir * PHYS.throwV * 0.75; vy = -PHYS.throwV * 0.75; }
    else if (inp.down && !this.onGround && !climbing) { vx = dir * PHYS.throwV * 0.75; vy = PHYS.throwV * 0.7; }
    if (this.vx * dir > 0 && !climbing) vx += this.vx * 0.6;
    this.acorns--; this.throwCool = PHYS.throwCool; this.throwT = 0.18;
    game.ents.push(new ThrownAcorn({ x: this.x + dir * 8, y: this.y - 14, vx, vy }));
    Sound.sfx('throw');
  }
  doJump() {
    this.rolling = false; this.dashing = false; this.spinCharge = 0;
    this.jumpBuf = 0; this.coyote = 0;
    this.vy = -PHYS.jumpV; this.onGround = false; this.jumping = true;
    this.jumpCutDone = false; this.airSpinUsed = false; this.glideArmed = false;
    Sound.sfx('jump');
  }
  setGround(f) {
    this.y = f.y; this.groundCh = f.ch; this.groundTx = f.tx; this.groundTy = f.ty; this.plat = f.plat || null;
  }

  // ---------------- ar ----------------
  updateAir(dt, d, inp, game) {
    const L = this.level;
    this.crouch = this.lookUp = false; this.lookT = 0;
    if (this.jumpBuf > 0 && this.wallSlideT > 0) {                          // salto de parede
      this.jumpBuf = 0; this.wallSlideT = 0;
      this.vx = -this.wallDir * PHYS.wallJumpVX * 1.05; this.vy = -PHYS.wallJumpVY * 1.12;
      this.facing = -this.wallDir; this.ctrlLock = 0.15; this.jumping = true; this.jumpCutDone = true;
      this.airSpinUsed = false; this.glide = false; this.glideArmed = false;
      game.dust(this.x + this.wallDir * PLAYER_HW, this.y - 8, 4); Sound.sfx('jump'); return;
    }
    if (inp.up && this.trunkCool <= 0 && this.hurtT <= 0 && this.trunkAt(this.x, this.y - PLAYER_H * 0.5)) { this.enterTrunk(); return; }
    if (this.coyote > 0 && this.jumpBuf > 0 && !this.jumping) this.doJump();
    else if (inp.jumpPressed && this.hurtT <= 0) this.glideArmed = true;      // novo toque já no ar: abre a membrana
    if (!inp.jump) this.glideArmed = false;                                   // largar o Z fecha-a
    const max = Math.max(PHYS.maxRun, Math.abs(this.vx));
    if (d !== 0) this.vx = clamp(this.vx + d * PHYS.airAccel * dt, -max, max);
    if (this.hopT > 0) { this.hopT -= dt; this.vx = this.hopDir * 100; }   // subir para o topo da parede

    if (this.jumping && !inp.jump && !this.jumpCutDone) {
      if (this.vy < -PHYS.jumpV * PHYS.jumpCut) this.vy = -PHYS.jumpV * PHYS.jumpCut;
      this.jumpCutDone = true;
    }
    // planar: só com um segundo toque no ar (manter o salto carregado só faz saltar mais alto)
    this.glide = this.glideArmed && inp.jump && this.vy > 0 && this.hurtT <= 0;
    this.vy += PHYS.gravity * dt;
    if (this.glide) {
      if (this.vy > PHYS.glideFall) this.vy = Math.max(PHYS.glideFall, this.vy - 2200 * dt);
      if (d !== 0 && this.vx * d < PHYS.glideMax) this.vx = d * Math.min(PHYS.glideMax, this.vx * d + PHYS.glideAccel * dt);
      else this.vx *= 1 - 0.15 * dt;   // a planar mais depressa que o normal: perde pouco
      this.jumping = false;
    }
    this.vy = Math.min(this.vy, PHYS.maxFall);

    this.x += this.vx * dt;
    const w = this.collideX(6);
    if (w && SOLID[w.ch] && w.ch !== 'H' && d === w.dir) {                  // encostada a uma parede no ar: desliza
      this.wallSlideT = 0.12; this.wallDir = w.dir; this.facing = w.dir; this.glide = false;
      if (this.vy > PHYS.wallSlide) this.vy = PHYS.wallSlide;
      if (this.vy > 0 && Math.random() < 0.2) game.dust(this.x + w.dir * PLAYER_HW, this.y - 4, 1);
    }
    if (w && w.ch === 'H' && this.hopT <= 0 && this.vy > -150 && (d === w.dir || this.glide)) { this.enterClimb(w.dir); return; }

    const prevY = this.y;
    this.y += this.vy * dt;
    if (this.vy < 0) { this.ceiling(); return; }
    const reach = 4 + Math.abs(this.vx * dt);
    let f = L.floorAt(this.x, prevY - reach, this.y);
    if (!f) f = L.floorAt(this.x - 5, prevY - 2, this.y) || L.floorAt(this.x + 5, prevY - 2, this.y) || game.platformAt(this.x, prevY - 2, this.y);
    if (f && (!ONEWAY[f.ch] || (prevY <= f.y + 3 && this.dropT <= 0))) this.land(f, game);
  }
  land(f, game) {
    const impact = this.vy;
    const wasBall = this.jumping && !this.glide;
    this.setGround(f);
    if (f.ch === '\\') this.vx += impact * 0.45;
    else if (f.ch === '/') this.vx -= impact * 0.45;
    // continua a rebolar se vinha a rebolar, ou se aterra em bola com ↓ premido
    this.rolling = this.state === 'normal' && Math.abs(this.vx) > PHYS.rollStart &&
      (this.rollAir || (this.downHeld && wasBall));
    this.rollAir = false;
    this.vy = 0; this.onGround = true; this.jumping = false; this.glide = false; this.glideArmed = false;
    this.airSpinUsed = false; this.state = 'normal'; this.hopT = 0;
    if (impact > 300) { game.dust(this.x, this.y, 5); Sound.sfx('land'); Leaves.kick(this.x, this.y, 18, 60 + impact * 0.25, this.vx); }
  }
  collideX(stepH) {
    const L = this.level;
    const top = this.y - PLAYER_H + 2, bot = this.y - stepH;
    const r0 = Math.floor(top / T), r1 = Math.floor(bot / T);
    for (const dir of [1, -1]) {
      const tx = Math.floor((this.x + dir * PLAYER_HW) / T);
      for (let ty = r0; ty <= r1; ty++) {
        const ch = L.get(tx, ty);
        if (!SOLID[ch]) continue;
        this.x = dir > 0 ? tx * T - PLAYER_HW - 0.01 : (tx + 1) * T + PLAYER_HW + 0.01;
        if (this.vx * dir > 0) this.vx = 0;
        return { dir, ch, tx, ty };
      }
    }
    return null;
  }
  wallAt(dir) {
    const tx = Math.floor((this.x + dir * (PLAYER_HW + 1.5)) / T);
    return this.level.get(tx, Math.floor((this.y - PLAYER_H * 0.6) / T));
  }
  ceiling() {
    const L = this.level;
    const ty = Math.floor((this.y - PLAYER_H) / T);
    for (const ex of [this.x - PLAYER_HW + 1, this.x + PLAYER_HW - 1]) {
      if (SOLID[L.get(Math.floor(ex / T), ty)]) {
        this.y = (ty + 1) * T + PLAYER_H; this.vy = 0; return true;
      }
    }
    return false;
  }

  // ---------------- trepar ----------------
  enterClimb(dir) {
    Object.assign(this, { state: 'climb', wallDir: dir, facing: dir, vx: 0, vy: 0, glide: false, glideArmed: false,
      jumping: false, airSpinUsed: false, onGround: false, spinT: 0 });
  }
  updateClimb(dt, d, inp, game) {
    const L = this.level;
    if (this.jumpBuf > 0) {         // salto de parede
      this.jumpBuf = 0; this.state = 'normal'; this.onGround = false;
      this.vx = -this.wallDir * PHYS.wallJumpVX; this.vy = -PHYS.wallJumpVY;
      this.facing = -this.wallDir; this.ctrlLock = 0.14; this.jumping = true; this.jumpCutDone = true;
      Sound.sfx('jump'); return;
    }
    if (d === -this.wallDir) { this.state = 'normal'; this.vx = -this.wallDir * 60; return; }
    const v = inp.up ? -PHYS.climbSpeed : inp.down ? PHYS.climbSpeed : 0;
    this.vy = v;
    if (v !== 0 && Math.floor(this.anim * 8) !== Math.floor((this.anim - dt) * 8)) Sound.sfx('climb');
    const prevY = this.y;
    this.y += v * dt;
    if (v < 0) this.ceiling();
    const tx = Math.floor((this.x + this.wallDir * (PLAYER_HW + 2)) / T);
    const mid = L.get(tx, Math.floor((this.y - PLAYER_H * 0.6) / T));
    if (mid !== 'H') {
      this.state = 'normal'; this.onGround = false;
      if (v < 0) { this.vy = -250; this.hopT = 0.3; this.hopDir = this.wallDir; this.ctrlLock = 0.12; }
      return;
    }
    if (v > 0) {
      const f = L.floorAt(this.x, prevY - 2, this.y);
      if (f) this.land(f, game);
    }
  }

  // ---------------- troncos de árvore (trepar pela frente) ----------------
  trunkAt(x, y) { const ch = this.level.get(Math.floor(x / T), Math.floor(y / T)); return ch === 'T' || ch === 'E' || ch === 'Y'; }   // tronco, escada ou árvore seca
  enterTrunk() {
    const L = this.level, ty = Math.floor((this.y - PLAYER_H * 0.5) / T);
    let a = Math.floor(this.x / T), b = a;
    while (L.get(a - 1, ty) === 'T') a--;
    while (L.get(b + 1, ty) === 'T') b++;
    Object.assign(this, { state: 'trunk', trunkX: (a + b + 1) * T / 2, vx: 0, vy: 0, angle: 0, glide: false, glideArmed: false, jumping: false,
      rolling: false, onGround: false, spinT: 0, airSpinUsed: false, wallSlideT: 0 });
  }
  updateTrunk(dt, d, inp, game) {
    this.x += (this.trunkX - this.x) * Math.min(1, dt * 14);
    if (d) this.facing = d;
    if (this.jumpBuf > 0) {                                     // saltar do tronco
      this.jumpBuf = 0; this.state = 'normal'; this.trunkCool = 0.3;
      this.vx = d * 200; this.vy = -PHYS.jumpV * 0.92; this.jumping = true; this.jumpCutDone = false;
      Sound.sfx('jump'); return;
    }
    const v = inp.up ? -PHYS.climbSpeed * 1.1 : inp.down ? PHYS.climbSpeed * 1.3 : 0;
    this.vy = v;
    if (v !== 0 && Math.floor(this.anim * 8) !== Math.floor((this.anim - dt) * 8)) Sound.sfx('climb');
    const prevY = this.y;
    this.y += v * dt;
    if (v < 0 && this.ceiling()) return;
    if (v < 0 && !this.trunkAt(this.x, this.y - PLAYER_H * 0.7)) {   // topo: sobe para a copa
      this.state = 'normal'; this.vy = -290; this.trunkCool = 0.35; return;
    }
    if (v > 0) {
      const f = this.level.floorAt(this.x, prevY - 2, this.y);
      if (f && !ONEWAY[f.ch]) { this.land(f, game); this.trunkCool = 0.3; return; }
      if (!this.trunkAt(this.x, this.y - 4) && !f) { this.state = 'normal'; this.trunkCool = 0.3; }
    }
  }

  // ---------------- lianas ----------------
  startSwing(l, r, game) {
    const th = Math.atan2(this.x - l.x, (this.y - 18) - l.y);
    const om = (this.vx * Math.cos(th) - this.vy * Math.sin(th)) / r;      // velocidade tangencial
    Object.assign(this, { state: 'swing', liana: l, grip: r, theta: th, omega: clamp(om, -4, 4), vx: 0, vy: 0, onGround: false,
      glide: false, glideArmed: false, jumping: false, rolling: false, spinT: 0, airSpinUsed: false, wallSlideT: 0 });
    Sound.sfx('grab');
  }
  updateSwing(dt, d, inp, game) {
    const l = this.liana, g = 900;
    this.omega += (-g / this.grip * Math.sin(this.theta)) * dt;
    if (d !== 0) this.omega += d * 2.2 * dt * (Math.sign(this.omega) === d || Math.abs(this.omega) < 0.3 ? 1 : 0.5);   // dar balanço
    this.omega *= 1 - 0.12 * dt;
    if (inp.up) this.grip = Math.max(36, this.grip - 70 * dt);
    if (inp.down) this.grip = Math.min(l.len, this.grip + 70 * dt);
    this.theta = clamp(this.theta + this.omega * dt, -1.35, 1.35);
    if (Math.abs(this.theta) >= 1.35) this.omega *= -0.3;
    const hx = l.x + Math.sin(this.theta) * this.grip, hy = l.y + Math.cos(this.theta) * this.grip;
    this.x = hx + Math.sin(this.theta) * 4; this.y = hy + Math.cos(this.theta) * 20;
    this.angle = -this.theta * 0.7; if (Math.abs(this.omega) > 0.2) this.facing = Math.sign(this.omega) * Math.sign(Math.cos(this.theta)) || this.facing;
    if (this.jumpBuf > 0) {                                     // soltar: sai disparada na direcção do balanço
      this.jumpBuf = 0;
      const v = this.omega * this.grip;
      Object.assign(this, { state: 'normal', liana: null, vx: v * Math.cos(this.theta) * 1.1, vy: -v * Math.sin(this.theta) - 170, angle: 0,
        jumping: true, jumpCutDone: true, swingCool: 0.35, airSpinUsed: false });
      if (this.vx !== 0) this.facing = Math.sign(this.vx);
      Sound.sfx('jump');
    }
  }

  // ---------------- prancha de surf (5-1) ----------------
  startSurf(b, game) {
    Object.assign(this, { state: 'surf', board: b, surfAir: false, vx: Math.max(200, this.vx), vy: 0, onGround: false, glide: false, glideArmed: false,
      jumping: false, rolling: false, spinT: 0, angle: 0, facing: 1, crouch: false, lookUp: false });
    b.riding = true; Sound.sfx('splash'); game.splash(this.x, this.y, 8);
  }
  updateSurf(dt, d, inp, game) {
    const L = game.level, sy = L.seaY + 3 + Math.sin(game.time * 3 + this.x * 0.04);
    this.vx += clamp(330 + d * 80 - this.vx, -360 * dt, 360 * dt);                    // ← trava, → acelera
    this.facing = 1;
    if (this.surfAir) {
      if (!inp.jump && !this.jumpCutDone && this.vy < -120) { this.vy *= PHYS.jumpCut; this.jumpCutDone = true; }
      this.vy = Math.min(PHYS.maxFall, this.vy + PHYS.gravity * dt); this.y += this.vy * dt;
      if (this.vy > 0 && this.y >= sy) { this.y = sy; this.vy = 0; this.surfAir = false; game.splash(this.x, sy, 6); Sound.sfx('splash'); }
    } else {
      this.y = sy;
      if (this.jumpBuf > 0) { this.jumpBuf = 0; this.vy = -PHYS.jumpV * 1.1; this.surfAir = true; this.jumpCutDone = false; Sound.sfx('jump'); }
      if (Math.random() < dt * 30) game.parts.push(new Particle({ x: this.x - 14, y: sy - 2, vx: -60 - Math.random() * 60, vy: -40 - Math.random() * 60, grav: 500, life: 0.4, size: 1, color: '#ffffff' }));
    }
    this.x += this.vx * dt;
    this.angle = this.surfAir ? clamp(this.vy * 0.0006, -0.3, 0.3) : Math.sin(game.time * 3 + this.x * 0.04) * 0.05;
    if (SOLID[L.get(Math.floor((this.x + 14) / T), Math.floor((this.y - 4) / T))]) return this.endSurf(game, true);   // contra uma rocha
    if (L.surfEnd && this.x >= L.surfEnd) this.endSurf(game, false);                                                  // a onda gigante: mergulho
  }
  endSurf(game, crash) {
    Object.assign(this, { state: 'normal', board: null, surfAir: false, angle: 0, vy: crash ? -200 : 160, vx: crash ? -60 : 120, onGround: false, jumping: false });
    game.splash(this.x, this.y, 12); Sound.sfx('splash');
    if (crash) this.hurt(game, this.x + 20);
  }

  // ---------------- tirolesa ----------------
  startZip(z, u) {
    Object.assign(this, { state: 'zip', zip: z, zu: u, zv: Math.max(160, Math.abs(this.vx)), vx: 0, vy: 0, onGround: false,
      glide: false, glideArmed: false, jumping: false, rolling: false, spinT: 0, wallSlideT: 0, facing: z.x1 > z.x ? 1 : -1 });
    Sound.sfx('grab');
  }
  updateZip(dt, d, inp, game) {
    const z = this.zip, ax = z.x1 - z.x, ay = z.y1 - z.y, len = Math.hypot(ax, ay), sn = ay / len, cs = ax / len;
    this.zv = Math.min(520, this.zv + 700 * sn * dt);
    this.zu += this.zv * dt / len;
    const hx = z.x + ax * Math.min(1, this.zu), hy = z.y + ay * Math.min(1, this.zu);
    this.x = hx; this.y = hy + 22; this.angle = 0;
    if (Math.random() < dt * 20) game.parts.push(new Particle({ kind: 'spark', x: hx, y: hy - 2, vx: -cs * 40, vy: -30, life: 0.25, color: '#ffe14a' }));
    if (this.jumpBuf > 0 || this.zu >= 1) {                     // solta (Z) ou chega ao fim
      const jumped = this.jumpBuf > 0; this.jumpBuf = 0;
      Object.assign(this, { state: 'normal', zip: null, vx: this.zv * cs, vy: jumped ? -260 : this.zv * sn * 0.3, jumping: jumped, jumpCutDone: true, swingCool: 0.4 });
      if (jumped) Sound.sfx('jump');
    }
  }

  // ---------------- looping ----------------
  updateLoop(dt, d, inp, game) {
    const lp = this.loop, r = lp.r;
    let s = this.loopSpeed;
    s -= PHYS.loopG * Math.sin(this.loopT) * dt;
    if (d === 1) s += PHYS.accel * 0.3 * dt;
    if (this.turbo) s += 220 * dt;
    s = Math.min(s, PHYS.absMax);
    this.loopT += (s / r) * dt;
    this.loopSpeed = s;
    const t = this.loopT;
    this.x = lp.cx + r * Math.sin(t);
    this.y = lp.cy + r * Math.cos(t);
    this.angle = -t;
    this.vx = Math.cos(t) * s; this.vy = -Math.sin(t) * s;
    if (t >= Math.PI * 2 || t <= 0) {  // sai do looping a rebolar
      this.state = 'normal'; this.onGround = true; this.x = lp.cx; this.y = lp.cy + r;
      this.vx = s; this.vy = 0; this.angle = 0; this.groundCh = '#';
      this.rolling = Math.abs(s) > PHYS.rollMin; return;
    }
    if (this.jumpBuf > 0) {         // salto perpendicular à pista
      this.jumpBuf = 0; this.state = 'normal'; this.onGround = false; this.jumping = true; this.rolling = false;
      this.vx += -Math.sin(t) * PHYS.jumpV; this.vy += -Math.cos(t) * PHYS.jumpV;
      this.jumpCutDone = true; Sound.sfx('jump'); return;
    }
    const need = -Math.cos(t);       // >0 na metade de cima
    if (need > 0 && s * s < PHYS.loopG * r * need) {
      this.state = 'normal'; this.onGround = false; this.jumping = true; this.jumpCutDone = true; this.rolling = false;
    }
  }

  toggleSuper(game) {
    if (this.super) { this.endSuper(); return; }
    if (game.stones >= 3 && this.acorns >= 50 && this.hurtT <= 0) {
      this.super = true; this.superT = 0; Sound.sfx('super');
      game.superBurst(this);
    } else Sound.sfx('empty');
  }
  endSuper() { if (this.super) { this.super = false; Sound.sfx('unsuper'); } }

  // ---------------- dano ----------------
  hurt(game, fromX) {
    if (this.inv > 0 || this.state === 'dead' || game.state === 'clear' || this.super || game.ride) return;   // Super Avelã e elevador: nada lhe toca
    if (this.acorns > 0) {
      const lost = Math.ceil(this.acorns / 2);
      game.scatter(this.cx, this.cy, Math.min(lost, 8));
      this.acorns -= lost;
      this.inv = PHYS.hurtInv;
      if (this.state === 'surf') { Sound.sfx('hurt'); Sound.sfx('scatter'); return; }   // na prancha perde bolotas, mas não cai
      this.hurtT = 0.5;
      this.state = 'normal'; this.onGround = false; this.glide = false; this.jumping = false;
      this.rolling = false; this.rollAir = false;
      this.vx = (this.x < fromX ? -1 : 1) * 150; this.vy = -260; this.angle = 0;
      Sound.sfx('hurt'); Sound.sfx('scatter');
    } else game.killPlayer();
  }
}
