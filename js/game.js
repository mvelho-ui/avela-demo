'use strict';
// =====================================================================
//  Ciclo principal, estados, câmara, HUD e ecrãs.
// =====================================================================
const NOINPUT = { left: false, right: false, up: false, down: false, jump: false, turbo: false, spin: false, throw: false };

const Game = {
  state: 'title', clock: 0, time: 0,
  camX: 0, camY: 0, camLook: 0,
  ents: [], parts: [],
  deadTimer: 0, clearT: 0, nextLife: 100, tapStart: false, bonus: null, menu: 0, stSel: 1,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    // nomes e faróis de cada nível (para o menu e o modo de teste)
    this.meta = LEVELS.map(f => { const L = f(); return { name: L.name, code: L.code, boss: !!L.hasBoss,
      checks: L.defs.filter(d => d.type === 'check').map(d => ({ x: d.x, y: d.y })) }; });
    this.startSel = LEVELS.map(() => 0); this.pauseSel = 0; this.devLevel = 0;
    this.devStones = 0; this.devSpin = false; this.hasSpin = false; this.stones = 0; this.goldenBag = 0; this.gemFx = null; this.storyQ = null; this.card = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    Input.bindTouch();
    Input.onAnyKey(() => Sound.init());
    this.canvas.addEventListener('pointerdown', () => { Sound.init(); this.tapStart = true; });
    this.loadLevel();
    let last = performance.now(), acc = 0;
    const frame = now => {
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.1) dt = 0.1;
      acc += dt;
      Input.poll();
      let first = true;
      while (acc >= STEP) {
        this.update(STEP);
        if (first) { Input.clearEdges(); this.tapStart = false; first = false; }
        acc -= STEP;
      }
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
  resize() {
    const s = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
    const k = s >= 1 && s - Math.floor(s) < 0.35 ? Math.floor(s) : s;
    this.canvas.style.width = Math.floor(VIEW_W * k) + 'px';
    this.canvas.style.height = Math.floor(VIEW_H * k) + 'px';
  },

  // n = índice do nível; keep = jogador anterior (passa vidas e pontos ao nível seguinte)
  loadLevel(n = 0, keep = null) {
    this.levelIndex = n;
    this.level = LEVELS[n]();
    Gfx.buildTiles(this.level);
    this.player = new Player(this.level);
    if (keep) { this.player.lives = keep.lives; this.player.score = keep.score; }
    this.ents = spawnEntities(this.level);
    this.parts = [];
    this.checkpoint = { x: this.level.start.x, y: this.level.start.y };
    this.time = 0; this.nextLife = 100; this.bonus = null;
    this.arena = null; this.boss = null; this.wind = 0; this.clearTimer = 0; this.bossBanner = 0;
    this.flash = 0; this.freeze = 0; this.ride = null; this.zoneBelow = false; this.bolt = 0; this.boltIn = 3; this.thunderIn = 0;
    Leaves.init(this.level);
    for (const lp of this.level.loops) { const ch = this.level.get(Math.floor(lp.cx / T), Math.floor(lp.cy / T)); lp.inside = ch === 'U' || ch === 'B'; }
    this.snapCamera();
  },
  // start = 0 início; k > 0 começa no farol k (modo de teste)
  newGame(n = 0, keep = null, start = 0) {
    if (!keep) { this.stones = DEV ? this.devStones : 0; this.goldenBag = 0; this.hasSpin = DEV && this.devSpin; this.hasTank = false; }   // jogo novo
    this.loadLevel(n, keep); this.gemFx = null;
    if (!keep && this.level.tank) this.hasTank = true;                 // do Reino da Praia em diante a Avelã já tem a botija do Leão
    this.player.air = this.airMax();
    if (start > 0) {
      const c = this.meta[n].checks[start - 1];
      this.checkpoint = { x: c.x, y: c.y };
      this.player.reset(c.x, c.y);
      for (const e of this.ents) if (e instanceof Checkpoint && Math.abs(e.x - c.x) < 1) e.active = true;
      this.snapCamera();
    }
    const arr = this.ents.find(e => e instanceof Elevator && e.arrive);     // 3-1: a Avelã chega do fundo da mina no elevador
    if (arr) {
      if (start === 0) {
        arr.y = arr.top + 72; arr.riding = true;
        this.ride = { el: arr, done: false, t: 0, y0: arr.y, arrive: true };
        Object.assign(this.player, { x: arr.x, y: arr.y, facing: 1 }); this.snapCamera();
      } else this.finishArrival(arr);
    }
    this.state = 'play';
    this.zoneBelow = this.inZone();
    Music.play(this.zoneMusic());
    this.card = { t: 3.2 };                                       // cartão "1-1 BOSQUE DAS AVELÃS"
    if (start === 0 && this.level.introStory) this.story(this.level.introStory);
  },
  menuItems() {
    if (!DEV) return [{ label: 'JOGAR', level: 0 }, { label: 'TESTE DE SOM' }];
    const n = this.devLevel, m = this.meta[n];
    return [{ label: 'NÍVEL ' + m.code + ' · ' + m.name, level: n, pick: 'level' },
      { label: 'PARTIDA: ' + this.startLabel(n), level: n, pick: 'start' },
      { label: 'PEDRAS ' + this.devStones + '/3 · SPIN ' + (this.devSpin ? 'SIM' : 'NÃO'), stones: true }, { label: 'TESTE DE SOM' }];
  },
  startLabel(n) {
    const k = this.startSel[n], m = this.meta[n];
    return k === 0 ? 'INÍCIO' : m.boss && k === m.checks.length ? 'ANTES DO CHEFE' : 'FAROL ' + k;
  },
  toTitle() { this.loadLevel(0); this.state = 'title'; Music.stop(); },
  hasNextLevel() { return this.levelIndex + 1 < LEVELS.length; },
  touchUI() { const t = document.getElementById('touch'); return !!(t && t.classList.contains('on')); },   // telemóvel/tablet: botões no ecrã

  // ---------------- actualização ----------------
  update(dt) {
    this.clock += dt;
    const I = Input.state;
    if (I.mutePressed) Sound.toggleMute();
    const go = I.startPressed || I.jumpPressed || this.tapStart;
    switch (this.state) {
      case 'title':
      case 'soundtest':
        this.camX = (this.clock * 45) % (this.level.width - VIEW_W);
        this.camY = this.level.height - VIEW_H - 150;
        for (const e of this.ents) e.t += dt;
        if (this.state === 'soundtest') { this.updateSoundTest(I); break; }
        // o browser só deixa tocar som depois da primeira tecla/toque
        if (Sound.ready && Music.current() !== 'title') Music.play('title');
        const items = this.menuItems(), nItems = items.length;
        if (this.menu >= nItems) this.menu = 0;
        if (I.upPressed) { this.menu = (this.menu + nItems - 1) % nItems; Sound.sfx('select'); }
        if (I.downPressed) { this.menu = (this.menu + 1) % nItems; Sound.sfx('select'); }
        const it = items[this.menu];
        if (DEV && it.pick === 'level' && (I.leftPressed || I.rightPressed)) {       // nível
          const k = LEVELS.length;
          this.devLevel = (this.devLevel + (I.rightPressed ? 1 : k - 1)) % k; Sound.sfx('select');
        }
        if (DEV && it.pick === 'start' && (I.leftPressed || I.rightPressed)) {       // ponto de partida
          const k = this.meta[it.level].checks.length + 1;
          this.startSel[it.level] = (this.startSel[it.level] + (I.rightPressed ? 1 : k - 1)) % k;
          Sound.sfx('select');
        }
        if (DEV && it.stones && (I.leftPressed || I.rightPressed || go)) {         // pedras para testar a Super Avelã
          const k = ((this.devStones + (this.devSpin ? 4 : 0)) + (I.leftPressed ? 7 : 1)) % 8;   // ← → percorre pedras 0-3, sem e com spin
          this.devStones = k % 4; this.devSpin = k >= 4; Sound.sfx('select'); break;
        }
        if (go) {
          Sound.init(); Sound.sfx('select');
          if (it.level !== undefined) this.newGame(it.level, null, DEV ? this.startSel[it.level] : 0);
          else { this.state = 'soundtest'; Music.stop(); }
        }
        break;
      case 'play':
        if (this.flash > 0) this.flash -= dt;
        if (this.freeze > 0) { this.freeze -= dt; break; }          // pausa da transformação
        if (I.pausePressed) { this.state = 'pause'; this.pauseSel = 0; Music.pause(); break; }
        this.time += dt;
        this.step(dt, I);
        break;
      case 'pause':
        if (I.upPressed || I.downPressed) { this.pauseSel = 1 - this.pauseSel; Sound.sfx('select'); }
        if (I.pausePressed || ((I.startPressed || I.jumpPressed || this.tapStart) && this.pauseSel === 0)) { this.state = 'play'; Music.resume(); }
        else if ((I.startPressed || I.jumpPressed || this.tapStart) && this.pauseSel === 1) this.toTitle();
        break;
      case 'clear':
        this.clearT += dt;
        this.step(dt, NOINPUT);
        if (this.clearT > 3 && go) {
          // depois de um chefe (ou no último nível feito) aparece o "CONTINUA..."
          // depois de um chefe aparece o "CONTINUA..." (menos quando o elevador já leva ao reino seguinte)
          if (!this.hasNextLevel() || (this.level.hasBoss && !this.level.elevator)) { this.state = 'continua'; this.clearT = 0; Music.play('title'); }
          else this.newGame(this.levelIndex + 1, this.player);
        }
        break;
      case 'story':
        this.updateStory(dt, I, go);
        break;
      case 'continua':
        this.clearT += dt;
        if (this.clearT > 1.5 && go) {
          if (this.hasNextLevel()) this.newGame(this.levelIndex + 1, this.player);
          else this.toTitle();
        }
        break;
      case 'gameover':
        this.clearT += dt;
        if (this.clearT > 1.5 && go) this.toTitle();
        break;
    }
  },
  step(dt, I) {
    const p = this.player, L = this.level;
    if (L.sandstorm) {                                                  // tempestade de areia: vento em rajadas (quase sempre pelas costas)
      const t = this.time;
      this.wind = 70 + 90 * Math.sin(t * 0.5) + 30 * Math.sin(t * 1.9);
      if (L.darkBelow !== undefined && p.y > L.darkBelow) this.wind = 0;      // debaixo de terra não há vento
      L.windNow = this.wind;
      if (Math.random() < dt * Math.abs(this.wind) * 0.06) this.windStreak(Math.sign(this.wind) || 1);
    }
    if (L.lightning) {                                                  // trovoada: relâmpago a cada 7–13 s e o trovão logo a seguir
      this.boltIn -= dt; if (this.bolt > 0) this.bolt -= dt;
      if (this.boltIn <= 0) {
        this.bolt = 0.5; this.boltX = 40 + Math.random() * (VIEW_W - 80); this.boltSeed = Math.floor(Math.random() * 1000);
        this.boltIn = 7 + Math.random() * 6; this.thunderIn = 0.2 + Math.random() * 0.6;
      }
      if (this.thunderIn > 0 && (this.thunderIn -= dt) <= 0) Sound.sfx('thunder');
    }
    if (L.musicAfter && p.state !== 'dead' && this.state === 'play') {   // praia → mar: muda uma vez (só volta se ela andar bem para trás)
      const z = this.zoneBelow ? p.x > L.musicAfterX - 320 : p.x > L.musicAfterX;
      if (z !== !!this.zoneBelow) { this.zoneBelow = z; Music.play(z ? L.musicAfter : L.music); }
    }
    if (L.musicBelow && p.state !== 'dead' && this.state === 'play' && !this.arena) {   // música das ruínas lá em baixo (nunca a meio de uma luta)
      const below = p.y > L.darkBelow;
      if (below !== !!this.zoneBelow) { this.zoneBelow = below; Music.play(this.zoneMusic()); }
    }
    for (const tc of L.torches || []) if (Math.abs(tc.x - this.camX - VIEW_W / 2) < VIEW_W && Math.random() < dt * 9)
      this.parts.push(new Particle({ kind: 'flame', x: tc.x + (Math.random() - 0.5) * 3, y: tc.y, vx: (Math.random() - 0.5) * 8, vy: -26, life: 0.4, size: 1 }));
    for (const sf of L.sandfalls || []) if (Math.abs(sf.x - this.camX - VIEW_W / 2) < VIEW_W && Math.random() < dt * 14)
      this.parts.push(new Particle({ x: sf.x + (Math.random() - 0.5) * 6, y: sf.top + Math.random() * (sf.bottom - sf.top), vy: 90, grav: 200, life: 0.5, size: 1, color: '#f0c888' }));
    if (L.fragile.length && p.dashing && p.rolling && Math.abs(p.vx) > 200) {     // o spin parte as paredes rachadas
      const ax = p.x + Math.sign(p.vx) * (PLAYER_HW + 2 + Math.abs(p.vx) * dt);
      for (const dy of [4, 12, 20]) { const tx = Math.floor(ax / T), ty = Math.floor((p.y - dy) / T); if (L.get(tx, ty) === 'F') this.smashWall(tx, ty); }
    }
    if (this.ride) this.updateRide(dt); else p.update(dt, I, this);
    if (L.lavaTiles.length && p.state === 'normal' && L.isLava(p.x, p.y - 2)) this.burn(p);
    if (L.quickTiles.length && p.state === 'normal' && !this.ride) {           // areia movediça: prende, afunda e morde
      const inQ = L.isQuick(p.x, p.y - 2);
      const sink = inQ && L.sinkZone && p.x > L.sinkZone[0] && p.x < L.sinkZone[1];
      if (sink) {                                                         // o mar de areia não morde: engole
        if (!p.quickT) { Sound.sfx('sink'); this.dust(p.x, p.y, 8); }
        p.quickT = (p.quickT || 0) + dt;
        const tx = Math.floor(p.x / T); let ty = Math.floor((p.y - 2) / T);
        while (L.quick.has(L.idx(tx, ty - 1))) ty--;
        if (p.y - 26 > ty * T + 3) {                                      // já debaixo da areia: desce, desce...
          if (!p.sinking) { p.sinking = true; Sound.sfx('sink'); }
          Object.assign(p, { vx: 0, vy: 150, ctrlLock: 0.1, jumpBuf: 0, glide: false, rolling: false });
        } else {
          p.vx *= 1 - Math.min(1, 7 * dt); if (p.vy > 26) p.vy = 26; p.rolling = false;
          if (I.jumpPressed) { p.vy = -70; p.onGround = false; this.dust(p.x, p.y, 4); }   // esbraceja, mas a areia não larga
          if (Math.random() < dt * 6) this.dust(p.x + (Math.random() - 0.5) * 12, p.y - 2, 1);
        }
      } else if (inQ) {
        if (!p.quickT) { Sound.sfx('sink'); this.dust(p.x, p.y, 6); }
        p.quickT = (p.quickT || 0) + dt;
        p.vx *= 1 - Math.min(1, 6 * dt); if (p.vy > 28) p.vy = 28; p.rolling = false;
        if (I.jumpPressed) { p.vy = -270; p.onGround = false; p.jumping = true; p.jumpCutDone = true; Sound.sfx('jump'); this.dust(p.x, p.y, 4); }
        if (p.quickT > 1.1) {                                                 // morde como um inimigo e cospe-a cá para fora
          p.hurt(this, p.x - p.facing * 10); p.quickT = 0.01;
          if (p.state !== 'dead') Object.assign(p, { vy: -400, onGround: false, jumping: false, y: p.y - 3 });
        }
        if (Math.random() < dt * 6) this.dust(p.x + (Math.random() - 0.5) * 12, p.y - 2, 1);
      } else {
        if (p.sinking) {                                                  // caiu pelo tecto da caverna, com uma cascata de areia
          p.sinking = false;
          for (let i = 0; i < 14; i++) this.parts.push(new Particle({ x: p.x + (Math.random() - 0.5) * 20, y: p.y - 20 - Math.random() * 10, vx: (Math.random() - 0.5) * 40, vy: 40 + Math.random() * 80, grav: 400, life: 0.9, size: 2, color: i % 2 ? '#e8bc78' : '#c8964e' }));
          Sound.sfx('crumble');
        }
        p.quickT = 0;
      }
    }
    p.inDeep = false; p.swimming = false;
    if (L.waterTiles.length && p.state === 'normal' && !this.ride) {            // oásis: a água trava e faz salpicos
      const inW = L.isWater(p.x, p.y - 6);
      if (inW !== !!p.wasInWater && Math.abs(p.vy) > 60) {
        const tx = Math.floor(p.x / T); let ty = Math.floor((p.y - 6) / T);
        while (L.water.has(L.idx(tx, ty - 1))) ty--;
        if (L.water.has(L.idx(tx, ty)) || L.water.has(L.idx(tx, ty + 1))) this.splash(p.x, ty * T + 4, inW ? 9 : 5);
      }
      if (inW && L.deepWater) {                                           // Selva: nadar, mergulhar e ficar sem ar
        const under = L.isWater(p.x, p.y - 22);
        p.inDeep = true; p.swimming = !p.onGround;
        if (I.jumpPressed && !p.onGround && p.dashT <= 0) { p.vy = under ? -200 : -330; p.jumping = false; p.glide = false; p.strokeT = 0.35; Sound.sfx('stroke'); this.parts.push(new Particle({ kind: 'bubble', x: p.x, y: p.y - 16, vy: -40, life: 1, size: 1 })); }
        if (p.dashT > 0) {                                                // dash: impulso que abranda até 3/4 (acaba à velocidade de nado)
          const f = 0.75 + 0.25 * clamp(p.dashT / PHYS.swimDashTime, 0, 1);
          p.vx = p.dashDX * PHYS.swimDashV * f; p.vy = p.dashDY * PHYS.swimDashV * f;
          if (p.dashDY < 0 || p.dashDY > 0.3) p.onGround = false;
          if (Math.random() < dt * 45) this.parts.push(new Particle({ kind: 'bubble', x: p.x - p.dashDX * 12, y: p.y - 11 - p.dashDY * 12, vx: -p.dashDX * 30, vy: -30, life: 0.6, size: 1 }));
        } else if (under && p.vy > 70) p.vy = 70;
        if (L.current) p.vx += L.current * dt;
        for (const c of L.currents || []) if (p.x > c.x0 && p.x < c.x1 && p.y > c.y0 && p.y < c.y1 + 22) p.vx += (c.vx - p.vx) * Math.min(1, dt * 2.5);   // corrente forte (túnel de coral)
        if (under) {
          p.air -= dt;
          if (p.air < 6 && Math.floor(p.air) !== p.airWarn) { p.airWarn = Math.floor(p.air); if (p.airWarn >= 0) { this.popText(p.x, p.y - 30, String(p.airWarn)); Sound.sfx('warn'); } }
          if (p.air <= 0) { this.killPlayer(); p.air = this.airMax(); }
          if (Math.random() < dt * 2) this.parts.push(new Particle({ kind: 'bubble', x: p.x + p.facing * 6, y: p.y - 20, vy: -35, life: 1.2, size: 1 }));
        } else { p.air = this.airMax(); p.airWarn = 99; }
      } else if (p.state === 'normal') { p.air = this.airMax(); p.airWarn = 99; }
      if (inW && p.dashT <= 0) {
        p.vx *= 1 - Math.min(1, 2.4 * dt); if (p.vy > 110) p.vy = 110;
        if (Math.random() < dt * 4) this.parts.push(new Particle({ x: p.x + (Math.random() - 0.5) * 10, y: p.y - 10, vy: -30, life: 0.6, size: 1, color: '#ffffff' }));
      }
      p.wasInWater = inW;
    }
    if (L.lavaTiles.length && Math.random() < dt * 14) {                 // brasas a subir da lava que se vê
      const [tx, ty] = L.lavaTiles[Math.floor(Math.random() * L.lavaTiles.length)];
      if (Math.abs(tx * T - this.camX - VIEW_W / 2) < VIEW_W && Math.abs(ty * T - this.camY - VIEW_H / 2) < VIEW_H)
        this.parts.push(new Particle({ kind: 'flame', x: tx * T + Math.random() * T, y: ty * T + 4, vx: (Math.random() - 0.5) * 10, vy: -25 - Math.random() * 30, life: 0.8, size: Math.random() < 0.3 ? 2 : 1 }));
    }
    if (this.arena && p.x < this.arena.x0 + PLAYER_HW + 2) { p.x = this.arena.x0 + PLAYER_HW + 2; if (p.vx < 0) p.vx = 0; }
    if (this.bossBanner > 0) this.bossBanner -= dt;
    if (this.card && (this.card.t -= dt) <= 0) this.card = null;
    if (this.gemFx && (this.gemFx.t += dt) > 1.5) this.gemFx = null;
    if (this.clearTimer > 0 && (this.clearTimer -= dt) <= 0 && this.state === 'play') this.levelClear();
    this.level.update(dt, p, this);
    for (const e of this.ents) e.update(dt, this);
    if (p.onGround && p.plat && p.state === 'normal') {                 // a Avelã vai com o tronco / crocodilo
      if (!p.plat.alive || !p.plat.solid()) p.plat = null;
      else { p.x += p.plat.dx; p.y = p.plat.top; }
    }
    this.ents = this.ents.filter(e => e.alive);
    this.parts = this.parts.filter(q => q.update(dt));
    Leaves.update(dt, this);
    if (this.level.leaves && Math.random() < dt * 2.2) {                  // folhas a cair
      this.parts.push(new Particle({ kind: 'leaf', x: this.camX + Math.random() * VIEW_W, y: this.camY - 4,
        vx: -12 + Math.random() * 20, vy: 18 + Math.random() * 14, life: 9,
        color: ['#e8a33a', '#c9752a', '#7cc242', '#a6d65a'][Math.floor(Math.random() * 4)] }));
    }
    if (p.state === 'dead') {
      this.deadTimer += dt;
      if (this.deadTimer > 2.2) {
        if (p.lives <= 0) { this.state = 'gameover'; this.clearT = 0; Music.play('gameover'); }
        else this.respawn();
      }
    }
    this.updateCamera(dt);
  },
  // lava: queima (como um inimigo) e atira a Avelã para cima; invulnerável ou Super, só salta
  burn(p) {
    if (p.inv <= 0 && !p.super) p.hurt(this, p.x - p.facing * 10);
    if (p.state === 'dead') return;
    Object.assign(p, { vy: -430, onGround: false, jumping: false, rolling: false, glide: false, glideArmed: false, y: p.y - 3 });
    Sound.sfx('spring'); for (let i = 0; i < 6; i++) this.flame(p.x, p.y - 4);
  },
  // elevador da mina: sobe devagar até à estação de cima; lá em cima, nível concluído
  startRide(el) {
    const p = this.player;
    this.ride = { el, done: false, t: 0, y0: el.y }; el.riding = true; this.arena = null;
    Object.assign(p, { x: el.x, vx: 0, rolling: false, spinT: 0 });
    Sound.sfx('crumble');
  },
  updateRide(dt) {
    const r = this.ride, el = r.el, p = this.player;
    if (!r.done) {
      r.t += dt;
      el.y = Math.max(el.top, el.y - Math.min(130, 15 + r.t * 50) * dt);
      if (Math.random() < dt * 2.5) Sound.sfx('climb');
      if (el.y <= el.top) {
        r.done = true; Sound.sfx('land');
        if (r.arrive) { this.ride = null; this.finishArrival(el); return; }     // chegou ao deserto: a grade abre
        this.levelClear();
      }
    }
    Object.assign(p, { x: clamp(p.x, el.x - 14, el.x + 14), y: el.y, vx: 0, vy: 0, onGround: true, state: 'normal',
      rolling: false, glide: false, jumping: false, angle: 0, groundCh: '#' });
    p.anim += dt;
  },
  finishArrival(el) {
    el.y = el.top; el.riding = false; el.arrived = true;
    for (const tx of el.shaftCols) this.level.set(tx, el.shaftRow, 'P');          // o estrado do elevador fica como chão
  },
  splash(x, y, n = 8) {
    for (let i = 0; i < n; i++) this.parts.push(new Particle({ x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 120,
      vy: -90 - Math.random() * 110, grav: 600, life: 0.6, size: 2, color: i % 2 ? '#bff0ff' : '#ffffff' }));
    Sound.sfx('splash');
  },
  rideProgress() { const r = this.ride; return r ? clamp((r.y0 - r.el.y) / (r.y0 - r.el.top), 0, 1) : 0; },
  smashWall(tx, ty) {                                                 // parte a parede rachada inteira (os tiles 'F' ligados)
    const L = this.level, q = [[tx, ty]];
    while (q.length) {
      const [x, y] = q.pop(), i = L.fragile.findIndex(f => f.tx === x && f.ty === y);
      if (i < 0) continue;
      const f = L.fragile.splice(i, 1)[0]; L.set(x, y, f.bg);
      for (let k = 0; k < 5; k++) this.parts.push(new Particle({ x: x * T + Math.random() * T, y: y * T + Math.random() * T, vx: (Math.random() - 0.3) * 200 * Math.sign(this.player.vx || 1),
        vy: -80 - Math.random() * 140, grav: 600, life: 0.8, size: 2 + (k % 2), color: k % 2 ? '#a8703f' : '#6a4024' }));
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    this.flash = 0.12; Sound.sfx('smash');
  },
  // troncos e crocodilos: plataformas que se mexem
  platformAt(x, yMin, yMax) {
    for (const e of this.ents) {
      if (!e.platform || !e.solid()) continue;
      const top = e.top;
      if (Math.abs(x - e.x) < e.hw + 4 && top >= yMin - 1 && top <= yMax + 1) return { y: top, ch: 'P', tx: -1, ty: -1, plat: e };
    }
    return null;
  },
  airMax() { return PHYS.airMax * (this.hasTank ? 2 : 1); },   // a botija do Leão dá o dobro do ar
  // zona com outra música: debaixo de terra (L.musicBelow, por altura) ou, na praia, do mergulho em diante (L.musicAfter, por x)
  inZone() { const L = this.level, p = this.player; return L.musicAfter ? p.x > L.musicAfterX : !!(L.musicBelow && p.y > L.darkBelow); },
  zoneMusic() { const L = this.level; return this.inZone() ? (L.musicAfter || L.musicBelow) : L.music; },
  respawn() {
    const p = this.player;
    p.reset(this.checkpoint.x, this.checkpoint.y);
    p.inv = 1.2; p.air = this.airMax();                               // com a botija, renasce com o ar todo
    for (const e of this.ents) if (e instanceof Boss) e.reset();       // o Barão volta ao início
    for (const e of this.ents) if (e.onRespawn) e.onRespawn(this);     // armadilhas do templo voltam ao sítio
    this.arena = null; this.boss = null; this.wind = 0;
    for (const lp of this.level.loops) lp.armed = true;
    this.snapCamera();
    this.zoneBelow = this.inZone();
    Music.play(this.zoneMusic());
  },
  updateCamera(dt) {
    const p = this.player, L = this.level;
    if (p.state === 'dead') return;
    const look = clamp(p.vx * 0.32, -96, 96);
    this.camLook += (look - this.camLook) * Math.min(1, dt * 2.5);
    const tx = p.x + this.camLook - VIEW_W / 2;
    const pan = p.lookT > 0.45 ? (p.crouch || p.spinCharge > 0 ? 70 : p.lookUp ? -70 : 0) : 0;   // olhar para baixo / para cima
    this.camPan = (this.camPan || 0) + (pan - (this.camPan || 0)) * Math.min(1, dt * 4);
    const ty = this.arena ? this.arena.floor - VIEW_H + 34 : p.y - 20 - VIEW_H / 2 + this.camPan;
    this.camX += (tx - this.camX) * Math.min(1, dt * 12);
    this.camY += (ty - this.camY) * Math.min(1, dt * 7);
    if (!this.arena) this.camY = clamp(this.camY, p.y - VIEW_H + 24, p.y - 40);
    this.camX = clamp(this.camX, 0, L.width - VIEW_W);
    if (this.arena) this.camX = clamp(this.camX, this.arena.x0, this.arena.x1 - VIEW_W);
    this.camY = clamp(this.camY, 0, L.height - VIEW_H);
  },
  snapCamera() {
    const p = this.player, L = this.level;
    this.camLook = 0;
    this.camX = clamp(p.x - VIEW_W / 2, 0, L.width - VIEW_W);
    this.camY = clamp(p.y - 20 - VIEW_H / 2, 0, L.height - VIEW_H);
  },

  // ---------------- eventos chamados pelas entidades ----------------
  killPlayer() {
    const p = this.player;
    if (p.state === 'dead' || this.state === 'clear') return;   // na meta já não se morre
    Object.assign(p, { state: 'dead', vy: -380, vx: 0, angle: 0, spinT: 0, glide: false, acorns: 0 });
    p.lives--;
    this.deadTimer = 0;
    Music.stop(); Sound.sfx('die');
  },
  addAcorn(n) {
    const p = this.player;
    p.acorns += n; p.score += 10 * n;
    Sound.sfx('acorn');
    if (p.acorns >= this.nextLife) {
      this.nextLife += 100; p.lives++; Music.jingle('life'); this.popText(p.x, p.y - 30, '1UP');
    }
  },
  collectGolden(idx, x, y) {
    this.player.golden[idx] = true; this.player.score += 1000;
    Sound.sfx('golden'); this.sparkle(x, y, '#fff3a0'); this.sparkle(x, y, '#ffd23f');
    // contam todas, de qualquer nível: cada 9 avelãs douradas juntam-se numa pedra preciosa
    if (++this.goldenBag >= 9) {
      this.goldenBag -= 9;
      if (this.stones < 3) {
        const kind = this.stones++;
        this.gemFx = { kind, t: 0 }; this.flash = 0.25; Sound.sfx('gem');
        this.popText(x, y - 26, ['JADE!', 'RUBI!', 'DIAMANTE!'][kind]);
      } else { this.player.lives++; Music.jingle('life'); this.popText(x, y - 26, '1UP'); }   // já com as 3 pedras: vida extra
    }
    this.popText(x, y - 14, '1000');
  },
  setCheckpoint(x, y) { this.checkpoint = { x, y }; },
  // ---------------- chefe ----------------
  startBoss(b) { this.arena = { x0: b.ax0, x1: b.ax1, floor: b.floor }; this.boss = b; this.bossBanner = 2.6; Music.play(b.music || 'boss'); },
  // tudo o que o chefe lançou: os animais ficam livres, o resto desfaz-se
  freeMinions() {
    for (const e of this.ents) {
      if (!e.fromBoss || !e.alive) continue;
      if (e instanceof Enemy) { if (!e.dead) e.kill(this); }
      else { e.alive = false; this.dust(e.x, e.y + 8, 3); }
    }
  },
  bossDefeated(b) {
    Music.stop(); this.wind = 0;
    for (let i = 0; i < 18; i++) {                       // as bolotas roubadas voltam ao bosque
      const a = -Math.PI / 2 + (i - 8.5) * 0.16;
      this.ents.push(new LooseAcorn({ x: b.x, y: b.y - 10, vx: Math.cos(a) * (150 + (i % 3) * 40), vy: Math.sin(a) * 320, life: 10, delay: 0.5 }));
    }
    this.feathers(b.x, b.y, 14);
    this.burst(b.x + 10, b.y - 30); this.burst(b.x + 14, b.y - 36);   // a máquina do Driller parte-se
    Sound.sfx('bosshit');
  },
  // Depois de libertado, o Barão conta tudo; se apanhaste as 9 avelãs douradas, ganhas uma pedra preciosa
  bossEnding(b) {
    const pages = (b.after || STORY.bossAfter).slice(), who = b.who || 'barao', bag = this.goldenBag, n = this.stones;
    const GEMS = ['UM JADE', 'UM RUBI', 'UM DIAMANTE'];
    if (n === 0) pages.push({ who, text: 'AS AVELÃS DOURADAS QUE ANDAS A APANHAR... QUANDO JUNTARES 9, VIRAM UMA PEDRA PRECIOSA. JÁ TENS ' + bag + '.' });
    else if (n < 3) pages.push({ who, gem: n - 1, text: (n === 1 ? 'ESSE JADE QUE TRAZES VEIO' : 'ESSAS PEDRAS QUE TRAZES VIERAM') +
      ' DAS AVELÃS DOURADAS! MAIS ' + (9 - bag) + ' E JUNTA-SE ' + GEMS[n] + '.' });
    else pages.push({ who, gem: 2, text: 'AS TRÊS PEDRAS PRECIOSAS! COM ELAS E MUITAS BOLOTAS PODES VIRAR A SUPER AVELÃ.' });
    if (b.afterTail) pages.push(...b.afterTail);
    pages.push({ who: 'avela', text: b.finalLine || 'VOU LIBERTÁ-LOS A TODOS. E DEPOIS VAMOS VOAR OS DOIS!' });
    this.story(pages, () => {
      if (b.leaveAfter) b.state = 'leaving';
      if (b.givesTank) { this.hasTank = true; Sound.sfx('gem'); }   // o Leão dá a botija de oxigénio
      const el = this.ents.find(e => e instanceof Elevator);
      if (el) { el.ready = true; Sound.sfx('select'); }         // o elevador acende a luz verde
      else if (b.teachSpin) {                                   // a Cobra Real ensina o spin: a saída é pela parede rachada
        this.hasSpin = true; this.arena = null; Sound.sfx('gem');
        this.zoneBelow = this.inZone(); Music.play(this.zoneMusic());
      } else this.levelClear();
    });
  },

  // ---------------- história (caixas de diálogo) ----------------
  story(pages, done) {
    this.storyQ = { pages, i: 0, t: 0, done, back: this.state === 'story' ? 'play' : this.state };
    this.state = 'story';
    if (pages[0].gem !== undefined) Sound.sfx('gem');
  },
  updateStory(dt, I, go) {
    const s = this.storyQ, pg = s.pages[s.i];
    s.t += dt;
    if (s.t * 45 < pg.text.length && Math.random() < dt * 14) Sound.sfx('talk');
    if (I.pausePressed) s.i = s.pages.length;                    // ESC salta a conversa
    else if (go) {
      if (s.t * 45 < pg.text.length) s.t = pg.text.length / 45 + 0.01;   // mostra o texto todo
      else { s.i++; s.t = 0; if (s.pages[s.i] && s.pages[s.i].gem !== undefined) Sound.sfx('gem'); }
    }
    if (s.i >= s.pages.length) { this.state = s.back; this.storyQ = null; if (s.done) s.done(); }
  },
  wrap(text, max) {
    const out = []; let line = '';
    for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (t.length > max && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line);
    return out;
  },
  windStreak(dir) {
    const x = dir > 0 ? this.camX - 10 : this.camX + VIEW_W + 10;
    this.parts.push(new Particle({ kind: 'wind', x, y: this.camY + 20 + Math.random() * (VIEW_H - 40), vx: dir * (260 + Math.random() * 120), life: 1.6 }));
  },
  feathers(x, y, n) {
    for (let i = 0; i < n; i++) this.parts.push(new Particle({ kind: 'feather', x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 60, grav: 120, life: 1.4, color: i % 3 ? '#1d2333' : '#e8203a' }));
  },
  levelClear() {
    const p = this.player;
    this.state = 'clear'; this.clearT = 0;
    Music.play('clear');
    const timeBonus = Math.max(0, Math.round(240 - this.time)) * 20;
    const acornBonus = p.acorns * 20;
    this.bonus = { timeBonus, acornBonus, golden: p.golden.filter(Boolean).length };
    p.score += timeBonus + acornBonus;
  },

  // ---------------- partículas ----------------
  dust(x, y, n) {
    for (let i = 0; i < n; i++) this.parts.push(new Particle({ kind: 'dust', x: x + (Math.random() - 0.5) * 8, y: y - 2,
      vx: (Math.random() - 0.5) * 60, vy: -15 - Math.random() * 25, life: 0.35 + Math.random() * 0.2, size: 3, color: '#efe3c4' }));
  },
  sparkle(x, y, color) {
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2;
      this.parts.push(new Particle({ kind: 'spark', x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.35, color })); }
  },
  burst(x, y) {
    for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
      this.parts.push(new Particle({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4, size: 2, color: i % 2 ? '#ffffff' : '#ffe066' })); }
  },
  debris(x, y) {
    for (let i = 0; i < 7; i++) this.parts.push(new Particle({ x: x + (Math.random() - 0.5) * 14, y, vx: (Math.random() - 0.5) * 60,
      vy: -60 * Math.random(), grav: 700, life: 0.9, size: 3, color: i % 2 ? '#8d7b68' : '#5d4d3e' }));
  },
  shards(x, y) {
    for (let i = 0; i < 6; i++) this.parts.push(new Particle({ x, y, vx: (Math.random() - 0.5) * 120,
      vy: -40 - Math.random() * 90, grav: 600, life: 0.5, size: 2, color: i % 2 ? '#c27b2c' : '#6b4423' }));
  },
  scatter(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.45;
      this.ents.push(new LooseAcorn({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 260, life: 4 }));
    }
  },
  flame(x, y) {
    this.parts.push(new Particle({ kind: 'flame', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 18,
      vx: (Math.random() - 0.5) * 24, vy: -50 - Math.random() * 50, life: 0.55, size: Math.random() < 0.4 ? 3 : 2 }));
  },
  // momento da transformação: clarão, ondas de choque, faúlhas e uma pausa curta
  superBurst(p) {
    this.flash = 0.45; this.freeze = 0.28;
    this.parts.push(new Particle({ kind: 'ring', x: p.cx, y: p.cy, life: 0.6, color: '#ffd23f' }));
    this.parts.push(new Particle({ kind: 'ring', x: p.cx, y: p.cy, life: 0.85, color: '#ff3b1f' }));
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, v = 90 + Math.random() * 80;
      this.parts.push(new Particle({ kind: 'flame', x: p.cx, y: p.cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, size: 3 })); }
    Leaves.kick(p.x, p.y, 60, 220, 0);
  },
  heart(x, y) { this.parts.push(new Particle({ kind: 'heart', x, y, vy: -22, life: 1.1 })); },
  popText(x, y, text) { this.parts.push(new Particle({ kind: 'text', x, y, vy: -30, life: 0.9, text })); },

  // ---------------- desenho ----------------
  render() {
    const ctx = this.ctx, L = this.level;
    const cx = Math.round(this.camX), cy = Math.round(this.camY);
    Gfx.background(ctx, cx, cy, L, this.clock);
    ctx.save(); ctx.translate(-cx, -cy);
    for (const lp of L.loops) if (!lp.inside && Math.abs(lp.cx - cx - VIEW_W / 2) < VIEW_W) Gfx.loopRing(ctx, lp, this.clock);
    ctx.drawImage(Gfx.tileCanvas, cx, cy, VIEW_W, VIEW_H, cx, cy, VIEW_W, VIEW_H);
    for (const lp of L.loops) if (lp.inside && Math.abs(lp.cx - cx - VIEW_W / 2) < VIEW_W) {   // loopings em cavernas: por cima da parede do fundo
      ctx.save(); ctx.beginPath(); ctx.rect(lp.cx - lp.r - 20, lp.cy - lp.r - 20, lp.r * 2 + 40, lp.r * 2 + 21); ctx.clip();
      Gfx.loopRing(ctx, lp, this.clock); ctx.restore();
    }
    if (L.lavaTiles.length) Gfx.lava(ctx, L, cx, cy, this.clock);
    if (L.fragile.length) Gfx.fragile(ctx, L, cx, cy);
    for (const w of L.waterfalls || []) Gfx.waterfall(ctx, w, cx, cy, this.clock);
    Gfx.bridges(ctx, L); Gfx.crumbles(ctx, L);
    Leaves.draw(ctx, cx, cy);
    for (const e of this.ents) {
      if (Math.max(e.x, e.x1 ?? e.x) < cx - 48 || Math.min(e.x, e.x1 ?? e.x) > cx + VIEW_W + 48) continue;   // (as tirolesas são compridas)
      if (e.dead && !(e instanceof Boss)) {                         // animal libertado: desvanece-se
        ctx.globalAlpha = Math.max(0, 1 - e.deadT / 1.2); e.draw(ctx, this); ctx.globalAlpha = 1;
      } else e.draw(ctx, this);
    }
    if (this.state !== 'title' && this.state !== 'soundtest') this.drawPlayer(ctx);
    for (const d of L.decosFront) if (d.x > cx - 20 && d.x < cx + VIEW_W + 20) Gfx.decoFront(ctx, d, this.clock);
    if (L.waterTiles.length) Gfx.water(ctx, L, cx, cy, this.clock);
    if (L.currents) Gfx.currents(ctx, L, cx, this.clock);
    if (L.quickTiles.length) Gfx.quicksand(ctx, L, cx, cy, this.clock);
    Gfx.particles(ctx, this.parts);
    ctx.restore();
    if (L.seaY && this.state !== 'title' && this.state !== 'soundtest') Gfx.seaDepth(ctx, cx, cy, L);
    if (L.dark && this.state !== 'title' && this.state !== 'soundtest') this.drawDarkness(ctx, cx, cy);
    if (L.sandstorm && this.state !== 'title' && this.state !== 'soundtest') this.drawStorm(ctx);
    if (L.night && this.state !== 'title' && this.state !== 'soundtest') this.drawNight(ctx, cx, cy);
    if (L.rain && this.state !== 'title' && this.state !== 'soundtest') Gfx.rain(ctx, this.clock);
    if (L.sunbeams && !(L.darkX && this.darkDepth(cy, cx) > 0.4)) Gfx.sunbeams(ctx, cx, this.clock);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,245,220,${Math.min(0.85, this.flash * 2)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.state === 'title') return this.drawTitle(ctx);
    if (this.state === 'soundtest') return this.drawSoundTest(ctx);
    this.drawHud(ctx);
    if (this.state === 'pause') this.drawPause(ctx);
    if (this.state === 'clear') this.drawClear(ctx);
    if (this.state === 'gameover') this.drawGameOver(ctx);
    if (this.state === 'story') this.drawStory(ctx);
    if (this.state === 'continua') this.drawContinua(ctx);
  },
  // Escuridão da mina: uma camada negra com "buracos" de luz em degraus (como nas consolas
  // de 16 bits): a Avelã leva uma luz à volta dela, os lampiões e os cristais iluminam,
  // e as bolas de fogo das salamandras também.
  // 0 à superfície, 1 debaixo de terra (níveis com parte subterrânea: L.darkBelow)
  darkDepth(cy, cx) {
    const L = this.level;
    if (L.darkX) { const c = (cx ?? this.camX) + VIEW_W / 2; return Math.max(0, ...L.darkX.map(([a, b]) => clamp(Math.min(c - a, b - c) / 140, 0, 1))); }   // escuro só dentro do templo
    return L.darkBelow === undefined ? 1 : clamp((cy + VIEW_H / 2 - L.darkBelow) / 120, 0, 1);
  },
  drawDarkness(ctx, cx, cy) {
    if (!this.darkC) { this.darkC = document.createElement('canvas'); this.darkC.width = VIEW_W; this.darkC.height = VIEW_H; }
    const g = this.darkC.getContext('2d'), L = this.level, p = this.player;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    const rp = this.rideProgress(), depth = this.darkDepth(cy, cx);
    if (depth <= 0.01) return;
    g.fillStyle = `rgba(6,3,10,${((L.darkAlpha ?? 0.83) * depth * (1 - clamp(rp * 1.25 - 0.15, 0, 1))).toFixed(3)})`; g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.globalCompositeOperation = 'destination-out';
    const flick = Math.floor(this.clock * 9);
    const hole = (x, y, r) => {
      x = Math.round(x - cx); y = Math.round(y - cy);
      if (x < -r || x > VIEW_W + r || y < -r || y > VIEW_H + r) return;
      for (const [k, a] of [[1, 0.35], [0.8, 0.45], [0.6, 0.6], [0.42, 1]]) {
        g.globalAlpha = a; g.beginPath(); g.arc(x, y, Math.round(r * k), 0, Math.PI * 2); g.fill();
      }
    };
    g.fillStyle = '#000';
    const glow = [];
    if (p.state !== 'dead' || this.deadTimer < 1) hole(p.cx, p.cy, p.super ? 150 : 92);
    for (const l of L.lights) {
      const r = l.r + (l.warm || l.lava ? (hash2(flick, l.x) - 0.5) * 6 : 0);
      hole(l.x, l.y, r); glow.push([l.x, l.y, r, l.warm ? '255,170,70' : l.col || '60,255,150']);
    }
    for (const e of this.ents) {
      if (e instanceof Burr && e.kind === 'fire') { hole(e.x, e.y, 34); glow.push([e.x, e.y, 26, '255,120,30']); }
      else if (e instanceof Salamander && !e.dead) { hole(e.x, e.y - 4, e.spitT > 0 ? 34 : 22); glow.push([e.x, e.y - 4, 20, '255,120,30']); }
      else if (e instanceof Golden) hole(e.x, e.y, 22);
      else if (e instanceof Goal) { hole(e.x, e.y - 20, 60); glow.push([e.x, e.y - 20, 50, '255,230,120']); }
      else if (e instanceof Checkpoint && e.active) hole(e.x, e.y - 18, 40);
      else if (e instanceof BatBoss && e.state !== 'wait') { hole(e.x, e.y, 44); glow.push([e.x, e.y, 30, '255,60,60']); }
      else if (e instanceof CobraBoss && e.state !== 'wait') { hole(e.x, e.y, 46); hole(e.bx, e.floor - 10, 36); }
      else if (e instanceof Burr && e.kind === 'venom') { hole(e.x, e.y, 22); glow.push([e.x, e.y, 16, '120,255,60']); }
      else if (e instanceof Elevator) hole(e.x, e.y - 22, e.ready ? 46 : 30);
      else if (e instanceof DartTrap && e.glow > 0) { hole(e.x, e.y, 20); glow.push([e.x, e.y, 14, '255,80,40']); }
      else if (e instanceof Plate) hole(e.x, e.y - 4, e.pressed ? 30 : 18);
    }
    for (const q of this.parts) if (q.kind === 'flame' || q.kind === 'spark') hole(q.x, q.y, 10);
    g.globalAlpha = 1;
    ctx.drawImage(this.darkC, 0, 0);
    if (rp > 0.55) { ctx.fillStyle = `rgba(255,232,180,${((rp - 0.55) * 0.55).toFixed(3)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }   // luz do dia
    // brilho colorido por cima (aditivo, muito suave)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, col] of glow) {
      const sx = Math.round(x - cx), sy = Math.round(y - cy);
      if (sx < -r || sx > VIEW_W + r || sy < -r || sy > VIEW_H + r) continue;
      ctx.fillStyle = `rgba(${col},0.07)`; ctx.beginPath(); ctx.arc(sx, sy, Math.round(r * 0.8), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${col},0.06)`; ctx.beginPath(); ctx.arc(sx, sy, Math.round(r * 0.45), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  // tempestade de areia: névoa que engrossa com as rajadas e grãos a voar com o vento
  drawStorm(ctx) {
    const w = this.wind || 0, k = clamp(Math.abs(w) / 200, 0, 1), up = 1 - (this.level.darkBelow !== undefined ? this.darkDepth(Math.round(this.camY)) : 0);
    if (up <= 0.01) return;
    ctx.globalAlpha = up;
    ctx.fillStyle = `rgba(214,158,92,${(0.12 + 0.16 * k).toFixed(3)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!this.grains) this.grains = Array.from({ length: 90 }, (_, i) => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 0.6 + Math.random() * 0.8, l: 1 + (i % 3) }));
    const dt = 1 / 60, vx = (Math.abs(w) < 40 ? 40 * (Math.sign(w) || 1) : w) * 2.2;
    for (const g of this.grains) {
      if (this.state === 'play') { g.x += vx * g.s * dt; g.y += Math.sin(this.clock * 3 + g.x * 0.05) * 0.4 + 0.2; }
      if (g.x > VIEW_W + 4) g.x -= VIEW_W + 8; if (g.x < -4) g.x += VIEW_W + 8; if (g.y > VIEW_H) g.y -= VIEW_H; if (g.y < 0) g.y += VIEW_H;
      ctx.fillStyle = g.l === 1 ? 'rgba(255,230,170,0.8)' : g.l === 2 ? 'rgba(220,170,100,0.7)' : 'rgba(180,120,60,0.6)';
      ctx.fillRect(Math.round(g.x), Math.round(g.y), 1 + Math.round(k * 3 * g.s), 1);
    }
    ctx.globalAlpha = 1;
  },
  // noite (3-3): véu azul por cima do deserto e brilho quente dos archotes (só à superfície)
  // força do relâmpago (0..1): dois clarões e depois apaga-se devagar
  boltK() {
    if (!(this.bolt > 0)) return 0;
    const t = 0.5 - this.bolt;
    return t < 0.06 ? 1 : t < 0.12 ? 0.15 : t < 0.2 ? 0.85 : Math.max(0, 1 - (t - 0.2) / 0.3) * 0.5;
  },
  drawNight(ctx, cx, cy) {
    const L = this.level, up = 1 - (L.darkBelow !== undefined ? this.darkDepth(cy) : 0), k = this.boltK();
    if (up <= 0.01) return;
    ctx.fillStyle = `rgba(20,26,86,${((L.nightAlpha ?? 0.44) * up * (1 - k * 0.8)).toFixed(3)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (k > 0) { ctx.fillStyle = `rgba(215,225,255,${(0.22 * k).toFixed(3)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (L.fireflies) Gfx.fireflies(ctx, cx, cy, this.clock, L);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const l of L.lights) {
      if (!l.warm) continue;
      const sx = Math.round(l.x - cx), sy = Math.round(l.y - cy), r = l.r * 0.8;
      if (sx < -r || sx > VIEW_W + r || sy < -r || sy > VIEW_H + r) continue;
      ctx.fillStyle = `rgba(255,150,60,${(0.08 * up).toFixed(3)})`; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,170,80,${(0.08 * up).toFixed(3)})`; ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, 7); ctx.fill();
    }
    ctx.restore();
  },
  drawStory(ctx) {
    const s = this.storyQ; if (!s) return;
    const pg = s.pages[Math.min(s.i, s.pages.length - 1)];
    const low = this.boss && this.boss.y - this.camY > VIEW_H * 0.55;          // não tapar o Barão
    const x = 8, y = low ? 48 : 144, w = VIEW_W - 16, h = 64;
    ctx.fillStyle = 'rgba(16,20,42,0.95)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    let tx = x + 8;
    if (pg.gem !== undefined) {                                   // a pedra aparece à direita da caixa
      const g = Math.sin(this.clock * 4) * 0.2;
      ctx.save(); ctx.globalAlpha = 0.35 + g; ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(x + w - 28, y + 32, 20, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      Gfx.gem(ctx, x + w - 28, y + 32, pg.gem, 3);
    }
    if (pg.item === 'tank') {                                     // a botija de oxigénio
      const g = Math.sin(this.clock * 4) * 0.2;
      ctx.save(); ctx.globalAlpha = 0.3 + g; ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(x + w - 28, y + 32, 20, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      Gfx.tank(ctx, x + w - 28, y + 32, 2.2);
    }
    if (pg.who) {
      const bx = x + 6, by = y + 7;
      ctx.fillStyle = '#24316e'; ctx.fillRect(bx, by, 48, 50);
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, 48, 50); ctx.clip();
      if (pg.who === 'avela') { ctx.translate(bx + 21, by + 32); ctx.scale(3, 3); Gfx.sqHead(ctx, 0, 0); }
      else if (pg.who === 'cobra') {
        ctx.translate(bx + 22, by + 20);
        Gfx.cobra(ctx, { x: 0, y: 0, bx: 6, floor: 34, rise: 1, face: 1, state: 'sway', sub: '', t: this.clock, inv: 0, controlled: !!pg.ctl, timer: 0 });
      } else if (pg.who === 'leao') {
        ctx.translate(bx + 10, by + 60); ctx.scale(-1, 1);
        Gfx.lion(ctx, { x: 0, y: 0, face: -1, t: this.clock, state: 'intro', inv: 0, roarT: 0, controlled: !!pg.ctl, timer: 0 });
      } else if (pg.who === 'morcego') {
        ctx.translate(bx + 22, by + 34);
        Gfx.batboss(ctx, { x: 0, y: 0, dir: 1, t: this.clock, state: 'hover', inv: 0, controlled: !!pg.ctl, timer: 0 });
      } else {
        ctx.translate(bx + 8, by + 44); ctx.scale(1.25, 1.25);
        Gfx.baron(ctx, { x: 0, y: 0, dir: 1, t: this.clock, state: 'hover', inv: 0, controlled: !!pg.ctl, timer: 0 });
      }
      ctx.restore();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx, by, 48, 1); ctx.fillRect(bx, by + 49, 48, 1);
      tx = x + 62;
    }
    const NAMES = { avela: ['AVELÃ', '#ffb36b'], barao: ['BARÃO GRALHA', '#ff8a8a'], morcego: ['MORCEGO', '#c8a0ff'], cobra: ['COBRA REAL', '#9ae07a'], leao: ['LEÃO', '#ffc860'] };
    if (pg.who) Font.draw(ctx, NAMES[pg.who][0], tx, y + 8, { color: NAMES[pg.who][1] });
    const lines = this.wrap(pg.text, Math.floor((x + w - 8 - tx - (pg.gem !== undefined || pg.item ? 50 : 0)) / 6));
    let left = Math.floor(s.t * 45);
    lines.forEach((ln, i) => {
      if (left <= 0) return;
      Font.draw(ctx, ln.slice(0, left), tx, y + (pg.who ? 22 : 13) + i * 11);
      left -= ln.length + 1;
    });
    if (s.t * 45 >= pg.text.length && Math.floor(this.clock * 3) % 2) Font.draw(ctx, '↓', x + w - 12, y + h - 12, { color: '#ffd23f' });
    Font.draw(ctx, 'Z: CONTINUAR · ESC: SALTAR', x + w, low ? y + h + 3 : y - 10, { align: 'right', color: '#d7dcff' });
  },
  drawContinua(ctx) {
    ctx.fillStyle = 'rgba(10,14,36,0.88)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const boss = this.level.hasBoss, next = this.hasNextLevel();
    if (DEMO && !next) {                                          // fim da demo (depois do Barão Gralha)
      this.bigTitle(ctx, 'FIM DA DEMO', 44, 3);
      Font.draw(ctx, 'OBRIGADO POR JOGARES!', VIEW_W / 2, 90, { align: 'center', color: '#d7dcff' });
      Font.draw(ctx, 'A AVENTURA CONTINUA NA MINA ABANDONADA...', VIEW_W / 2, 104, { align: 'center', color: '#7df9ff' });
      Font.draw(ctx, 'PEDRAS PRECIOSAS', VIEW_W / 2, 128, { align: 'center', color: '#ffd23f' });
      for (let i = 0; i < 3; i++) Gfx.gem(ctx, VIEW_W / 2 - 30 + i * 30, 152, i, 2.2, i >= this.stones);
      if (this.clearT > 1.5 && Math.floor(this.clock * 2) % 2) Font.draw(ctx, 'ENTER PARA O MENU', VIEW_W / 2, 184, { align: 'center' });
      return;
    }
    this.bigTitle(ctx, 'CONTINUA...', 44, 3);
    Font.draw(ctx, boss ? 'O DRILLER CONTROLA OUTROS REINOS ANIMAIS.' : 'AS GALERIAS DESCEM CADA VEZ MAIS FUNDO...', VIEW_W / 2, 90, { align: 'center', color: '#d7dcff' });
    Font.draw(ctx, boss ? this.level.nextRealm || 'PRÓXIMO REINO: A MINA ABANDONADA' : 'EM BREVE: ' + (this.level.teaser || '...'), VIEW_W / 2, 104, { align: 'center', color: '#7df9ff' });
    Font.draw(ctx, 'PEDRAS PRECIOSAS', VIEW_W / 2, 128, { align: 'center', color: '#ffd23f' });
    for (let i = 0; i < 3; i++) Gfx.gem(ctx, VIEW_W / 2 - 30 + i * 30, 152, i, 2.2, i >= this.stones);
    if (this.clearT > 1.5 && Math.floor(this.clock * 2) % 2) Font.draw(ctx, next ? 'ENTER PARA CONTINUAR' : 'ENTER PARA O MENU', VIEW_W / 2, 184, { align: 'center' });
  },
  drawPlayer(ctx) {
    const p = this.player;
    for (let i = p.trail.length - 1; i >= 2; i -= 3) {
      const t = p.trail[i];
      ctx.globalAlpha = 0.28 * (1 - i / p.trail.length);
      Gfx.squirrel(ctx, Object.assign(Object.create(p), { x: t.x, y: t.y, angle: t.a, spinT: 0 }));
    }
    ctx.globalAlpha = 1;
    if (p.inv > 0 && p.state !== 'dead' && Math.floor(p.inv * 14) % 2) return;
    Gfx.squirrel(ctx, p);
  },
  panel(ctx, x, y, w, h, a = 0.9) {
    ctx.fillStyle = `rgba(16,20,42,${a})`; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
  },
  drawHud(ctx) {
    const p = this.player;
    const blink = Math.floor(this.clock * 4) % 2;
    Gfx.acorn(ctx, 12, 14, this.clock);
    Font.draw(ctx, '× ' + String(p.acorns).padStart(3, '0'), 20, 11, { color: p.super ? (blink ? '#ff8a2a' : '#ffd23f') : p.acorns === 0 && blink ? '#ff5050' : '#ffffff' });
    if (p.super) Font.draw(ctx, 'SUPER AVELÃ!', 58, 11, { color: blink ? '#ff8a2a' : '#ffd23f' });
    for (let i = 0; i < this.stones; i++) if (!(this.gemFx && i === this.gemFx.kind)) Gfx.gem(ctx, VIEW_W - 44 + i * 14, 43, i, 1);
    if (this.gemFx) {                                   // a pedra nova sobe da Avelã até ao seu lugar no canto
      const f = this.gemFx, u = clamp((f.t - 0.9) / 0.6, 0, 1), p0 = this.player;
      const sx = p0.cx - this.camX, sy = p0.cy - this.camY - 30 - Math.min(f.t, 0.9) * 12, tx = VIEW_W - 44 + f.kind * 14, ty = 43;
      const gx = lerp(sx, tx, u * u), gy = lerp(sy, ty, u * u), sc = lerp(2.5, 1, u);
      ctx.save(); ctx.globalAlpha = 0.35 * (1 - u) + 0.1; ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(gx, gy, 14 * sc / 2.5 + 4, 0, 7); ctx.fill(); ctx.restore();
      Gfx.gem(ctx, gx, gy, f.kind, sc);
    }
    const m = Math.floor(this.time / 60), s = Math.floor(this.time % 60);
    Font.draw(ctx, 'TEMPO ' + m + ':' + String(s).padStart(2, '0'), 7, 24, { color: '#ffe066' });
    Font.draw(ctx, 'PONTOS ' + p.score, 7, 35, { color: '#ffe066' });
    // turbo
    const bx = VIEW_W - 60, by = 10;
    Font.draw(ctx, 'TURBO', bx - 4, by, { align: 'right', color: p.turbo ? '#7df9ff' : '#ffffff' });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1, by - 1, 52, 9);
    ctx.fillStyle = '#10142a'; ctx.fillRect(bx, by, 50, 7);
    ctx.fillStyle = p.exhausted ? (blink ? '#ff5050' : '#992222') : p.turbo ? '#7df9ff' : '#ffd23f';
    ctx.fillRect(bx, by, Math.round(p.energy / 2), 7);
    // avelãs douradas
    for (let i = 0; i < 3; i++) {
      const x = VIEW_W - 44 + i * 14, y = 28;
      if (p.golden[i]) Gfx.golden(ctx, x, y, this.clock + i);
      else { ctx.fillStyle = 'rgba(16,20,42,0.6)'; ctx.beginPath(); ctx.arc(x, y + 1, 5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#8a8fb0'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    // vidas
    Gfx.headIcon(ctx, 13, VIEW_H - 11);
    Font.draw(ctx, '× ' + Math.max(0, p.lives), 21, VIEW_H - 15);
    if (Sound.muted) Font.draw(ctx, 'SEM SOM (M)', VIEW_W - 6, VIEW_H - 14, { align: 'right', color: '#8a8fb0' });
    // chefe: barra de vida e faixa de entrada
    const b = this.boss;
    if (b && b.alive && b.state !== 'wait' && b.state !== 'freed' && b.state !== 'leaving') {
      const x0 = Math.floor((VIEW_W - (78 + b.maxHp * 12)) / 2);
      Font.draw(ctx, b.title || 'BARÃO GRALHA', x0, VIEW_H - 15, { color: '#ff8a8a' });
      for (let i = 0; i < b.maxHp; i++) {
        ctx.fillStyle = '#10142a'; ctx.fillRect(x0 + 78 + i * 12, VIEW_H - 16, 10, 8);
        ctx.fillStyle = i < b.hp ? '#e8203a' : '#3a2030'; ctx.fillRect(x0 + 79 + i * 12, VIEW_H - 15, 8, 6);
      }
    }
    if (this.bossBanner > 0 && Math.floor(this.bossBanner * 6) % 2 === 0) this.bigTitle(ctx, ((b && b.title) || 'BARÃO GRALHA') + '!', 70, 2);
    if (this.card && this.state === 'play') {                     // cartão de título do nível
      ctx.globalAlpha = Math.max(0, Math.min(1, this.card.t / 0.4, (3.2 - this.card.t) / 0.3));
      ctx.fillStyle = 'rgba(10,14,36,0.82)'; ctx.fillRect(0, 72, VIEW_W, 44);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, 72, VIEW_W, 1); ctx.fillRect(0, 115, VIEW_W, 1);
      Font.draw(ctx, this.level.realm, VIEW_W / 2, 78, { align: 'center', color: '#7df9ff' });
      this.bigTitle(ctx, this.level.code + ' ' + this.level.name, 93, 2);
      ctx.globalAlpha = 1;
    }
  },
  bigTitle(ctx, text, y, scale) {
    Font.draw(ctx, text, VIEW_W / 2 + 2, y + 2, { align: 'center', scale, color: '#5a1a06', shadow: false });
    Font.draw(ctx, text, VIEW_W / 2, y, { align: 'center', scale, color: '#ff7a1a', shadow: false });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VIEW_W, y + scale * 3); ctx.clip();
    Font.draw(ctx, text, VIEW_W / 2, y, { align: 'center', scale, color: '#ffd23f', shadow: false });
    ctx.restore();
  },
  drawTitle(ctx) {
    ctx.fillStyle = 'rgba(10,14,36,0.45)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.bigTitle(ctx, 'AVELÃ', 30, 6);
    Font.draw(ctx, 'A ESQUILO TURBO', VIEW_W / 2, 82, { align: 'center', scale: 2, color: '#7df9ff' });
    // a Avelã a correr no ecrã de título
    const fake = Object.assign(Object.create(Player.prototype), {
      x: 0, y: 0, vx: 380, vy: 0, angle: 0, facing: 1, onGround: true, state: 'normal', glide: false,
      jumping: false, hurtT: 0, spinT: 0, skid: false, idleT: 0, anim: this.clock, runPhase: this.clock * 26,
    });
    ctx.save(); ctx.translate(VIEW_W - 62, 138); ctx.scale(2, 2);
    for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.15 * (4 - i); ctx.save(); ctx.translate(-i * 6, 0); Gfx.squirrel(ctx, fake); ctx.restore(); }
    ctx.globalAlpha = 1; Gfx.squirrel(ctx, fake); ctx.restore();
    const items = this.menuItems();
    ctx.fillStyle = 'rgba(10,14,36,0.6)'; ctx.fillRect(VIEW_W / 2 - 100, 140, 200, items.length * 9 + 4);
    items.map(it => it.label).forEach((t, i) => {
      const sel = i === this.menu, blink = Math.floor(this.clock * 3) % 2;
      const col = sel ? (blink ? '#ffd23f' : '#ffffff') : '#8a8fb0';
      Font.draw(ctx, t, VIEW_W / 2, 143 + i * 9, { align: 'center', color: col });
      if (sel) Font.draw(ctx, '→', VIEW_W / 2 - Font.width(t) / 2 - 10, 143 + i * 9, { color: col });
    });
    const cur = items[this.menu] || {};
    if (DEV) Font.draw(ctx, 'MODO DE TESTE', VIEW_W - 5, 5, { align: 'right', color: '#ff8a8a' });
    if (DEMO) Font.draw(ctx, 'DEMO', VIEW_W - 5, 5, { align: 'right', color: '#ffd23f' });
    if (DEV && cur.level !== undefined) Font.draw(ctx, '← → MUDAR · ENTER JOGAR', VIEW_W / 2, 192, { align: 'center', color: '#7df9ff' });
    else if (DEV && cur.stones) Font.draw(ctx, '← → PEDRAS (SUPER AVELÃ) E SPIN (↓ + Z)', VIEW_W / 2, 192, { align: 'center', color: '#7df9ff' });
    else if (!this.touchUI()) Font.draw(ctx, '← → MOVER · Z SALTAR · Z+Z PLANAR · ↑ TREPAR · ↓ REBOLAR', VIEW_W / 2, 191, { align: 'center', color: '#d7dcff' });
    if (!this.touchUI()) Font.draw(ctx, 'X TURBO · C PIÃO · V BOLOTA · Q SUPER · M SOM · ESC PAUSA', VIEW_W / 2, 201, { align: 'center', color: '#d7dcff' });
    Font.draw(ctx, '(C) 1994 ESTÚDIO BOLOTA', VIEW_W / 2, 209, { align: 'center', color: '#8a8fb0' });
  },
  // ---------------- teste de som ----------------
  updateSoundTest(I) {
    const n = TRACKLIST.length;
    if (I.upPressed) { this.stSel = (this.stSel + n - 1) % n; Sound.sfx('select'); }
    if (I.downPressed) { this.stSel = (this.stSel + 1) % n; Sound.sfx('select'); }
    if (I.jumpPressed || I.startPressed || this.tapStart) Music.play(TRACKLIST[this.stSel]);
    if (I.spinPressed) Music.stop();
    if (I.pausePressed || I.turboPressed) { this.state = 'title'; Music.stop(); }
  },
  drawSoundTest(ctx) {
    ctx.fillStyle = 'rgba(10,14,36,0.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.bigTitle(ctx, 'TESTE DE SOM', 14, 2);
    const playing = Music.current();
    this.panel(ctx, 12, 38, 192, 140);
    const ROWS = 17, first = clamp(this.stSel - 8, 0, Math.max(0, TRACKLIST.length - ROWS));   // a lista desliza com a escolha
    if (first > 0) Font.draw(ctx, '↑', 199, 31, { align: 'right', color: '#8a8fb0' });
    if (first + ROWS < TRACKLIST.length) Font.draw(ctx, '↓', 199, 171, { align: 'right', color: '#8a8fb0' });
    TRACKLIST.forEach((id, i) => {
      if (i < first || i >= first + ROWS) return;
      const y = Math.round(42 + (i - first) * 7.75), sel = i === this.stSel, song = SONGS[id];
      const col = sel ? '#ffd23f' : '#d7dcff';
      if (playing === id) for (let k = 0; k < 3; k++) {             // a tocar: barrinhas a mexer
        const h = 2 + Math.round(Math.abs(Math.sin(this.clock * 9 + k * 1.7)) * 5);
        ctx.fillStyle = sel ? '#ffd23f' : '#7df9ff'; ctx.fillRect(15 + k * 4, y + 7 - h, 3, h);
      } else if (sel) Font.draw(ctx, '→', 17, y, { color: col });
      Font.draw(ctx, String(i).padStart(2, '0') + ' ' + song.name, 30, y, { color: col });
      Font.draw(ctx, String(song.bpm), 199, y, { align: 'right', color: '#8a8fb0' });
    });
    this.panel(ctx, 210, 38, 162, 140);
    Font.draw(ctx, playing ? 'A TOCAR' : 'PARADO', 218, 46, { color: '#7df9ff' });
    if (playing) Font.draw(ctx, SONGS[playing].name, 218, 57);
    const labels = { bass: 'FM1 BAIXO', lead: 'FM2 MELODIA', stab: 'FM3 ACORDES', pad: 'FM4 CORDAS', arp: 'PSG ARPEJO', drum: 'DAC BATERIA' };
    Music.CHANNELS.forEach((ch, i) => {
      const y = 72 + i * 12, lv = playing ? Music.level(ch) : 0;
      Font.draw(ctx, labels[ch], 218, y, { color: '#d7dcff' });
      ctx.fillStyle = '#10142a'; ctx.fillRect(288, y, 46, 7);
      ctx.fillStyle = lv > 0.75 ? '#ffd23f' : '#4cc94c'; ctx.fillRect(288, y, Math.round(46 * lv), 7);
    });
    // a Avelã a dançar ao ritmo
    const beat = Music.beat(), on = !!playing;
    const fake = Object.assign(Object.create(Player.prototype), {
      x: 0, y: 0, vx: 0, vy: 0, angle: on ? Math.sin(beat * Math.PI) * 0.15 : 0,
      facing: on && Math.floor(beat / 2) % 2 ? -1 : 1, onGround: true, state: 'normal', glide: false,
      jumping: false, hurtT: 0, spinT: 0, skid: false, idleT: 1, anim: this.clock, runPhase: 0,
    });
    ctx.save(); ctx.translate(354, 166 - (on ? Math.abs(Math.sin(beat * Math.PI)) * 4 : 0));
    Gfx.squirrel(ctx, fake); ctx.restore();
    Font.draw(ctx, '↑↓ ESCOLHER · Z TOCAR · C PARAR · ESC VOLTAR', VIEW_W / 2, 182, { align: 'center', color: '#d7dcff' });
    Font.draw(ctx, 'SÍNTESE FM AO ESTILO DOS 16 BITS', VIEW_W / 2, 197, { align: 'center', color: '#8a8fb0' });
  },
  drawPause(ctx) {
    ctx.fillStyle = 'rgba(10,14,36,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.bigTitle(ctx, 'PAUSA', 68, 4);
    ['CONTINUAR', 'VOLTAR AO MENU'].forEach((t, i) => {
      const sel = i === this.pauseSel, col = sel ? '#ffd23f' : '#8a8fb0';
      Font.draw(ctx, t, VIEW_W / 2, 112 + i * 13, { align: 'center', color: col });
      if (sel) Font.draw(ctx, '→', VIEW_W / 2 - Font.width(t) / 2 - 10, 112 + i * 13, { color: col });
    });
    Font.draw(ctx, '↑↓ ESCOLHER · Z OU ENTER CONFIRMAR · ESC CONTINUAR', VIEW_W / 2, 150, { align: 'center', color: '#d7dcff' });
    Font.draw(ctx, 'PEDRAS PRECIOSAS', VIEW_W / 2, 172, { align: 'center', color: '#ffd23f' });
    for (let i = 0; i < 3; i++) Gfx.gem(ctx, VIEW_W / 2 - 20 + i * 20, 188, i, 1.4, i >= this.stones);
    if (this.hasTank) Gfx.tank(ctx, VIEW_W / 2 + 46, 189, 1.2);
    // avelãs douradas para a próxima pedra (cada 9 juntam-se numa)
    const label = 'AVELÃS DOURADAS ' + this.goldenBag + '/9', w = Font.width(label);
    Gfx.golden(ctx, VIEW_W / 2 - w / 2 - 6, 204, this.clock);
    Font.draw(ctx, label, VIEW_W / 2 + 6, 201, { align: 'center', color: '#ffe066' });
  },
  drawClear(ctx) {
    const t = this.clearT, b = this.bonus, p = this.player;
    if (t < 0.6) return;
    this.panel(ctx, 56, 44, VIEW_W - 112, 128);
    Font.draw(ctx, this.level.hasBoss ? this.level.savedText || 'O BOSQUE ESTÁ SALVO!' : this.level.name, VIEW_W / 2, 54, { align: 'center', color: '#7df9ff' });
    this.bigTitle(ctx, this.level.hasBoss ? 'VITÓRIA!' : 'CONCLUÍDO!', 72, 2);
    const lines = [
      ['BOLOTAS', p.acorns + ' × 20 = ' + b.acornBonus],
      ['BÓNUS DE TEMPO', String(b.timeBonus)],
      ['AVELÃS DOURADAS', b.golden + ' / 3'],
      ['TOTAL', String(p.score)],
    ];
    lines.forEach(([k, v], i) => {
      if (t < 1 + i * 0.5) return;
      Font.draw(ctx, k, 76, 100 + i * 14, { color: i === 3 ? '#ffd23f' : '#ffffff' });
      Font.draw(ctx, v, VIEW_W - 76, 100 + i * 14, { align: 'right', color: i === 3 ? '#ffd23f' : '#ffffff' });
    });
    const nx = this.hasNextLevel() && !this.level.hasBoss ? this.meta[this.levelIndex + 1] : null;
    if (t > 3 && Math.floor(this.clock * 2) % 2) Font.draw(ctx, nx ? 'ENTER PARA O ' + nx.code : 'ENTER PARA CONTINUAR', VIEW_W / 2, 180, { align: 'center' });
  },
  drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(10,14,36,0.7)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.bigTitle(ctx, 'FIM DO JOGO', 80, 3);
    Font.draw(ctx, 'PONTOS ' + this.player.score, VIEW_W / 2, 118, { align: 'center', color: '#ffe066' });
    if (this.clearT > 1.5) Font.draw(ctx, 'ENTER PARA TENTAR DE NOVO', VIEW_W / 2, 140, { align: 'center' });
  },
};

window.addEventListener('load', () => Game.init());

// ---------------- ligação com a APK (Android) e com o browser ----------------
// App em segundo plano (ou separador escondido): pausa o jogo e cala o som; ao voltar, fica em pausa à espera.
window.avelaPause = () => { if (Game.state === 'play') { Game.state = 'pause'; Game.pauseSel = 0; Music.pause(); } Sound.suspend(); };
window.avelaResume = () => Sound.resume();
// Botão "voltar" do telemóvel: pausa/continua; no menu inicial sai da app ('exit').
window.avelaBack = () => {
  const s = Game.state;
  if (s === 'play') { Game.state = 'pause'; Game.pauseSel = 0; Music.pause(); return 'ok'; }
  if (s === 'pause') { Game.state = 'play'; Music.resume(); return 'ok'; }
  if (s === 'soundtest') { Game.toTitle(); return 'ok'; }
  return s === 'title' ? 'exit' : 'ok';
};
document.addEventListener('visibilitychange', () => (document.hidden ? window.avelaPause() : window.avelaResume()));
