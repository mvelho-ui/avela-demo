'use strict';
// =====================================================================
//  Mapa de tiles + construtor de níveis.
//  '.' vazio   '#' terra   'H' casca (escalável)   '/' rampa a subir
//  '\\' rampa a descer   '=' ponte de corda (atravessável por baixo)
//  '-' tábua podre (desaba)   'T' tronco de árvore (fundo, trepa-se com ↑)
//  'L' copa de folhas (plataforma atravessável por baixo)   'B' interior de túnel (fundo escuro)
//  'R' pedregulho (sólido)   'E' escada da mina   'P' alçapão/andaime   'V' lava (2-3)
//  'W' água (oásis)   'Y' tronco de árvore seca (trepa-se)   'K' ramo seco (plataforma atravessável)
//  'Q' areia movediça (prende, afunda e morde como um inimigo)
//  'U' parede de fundo das ruínas (não sólida)   'Z' bloco de pedra antiga (sólido)
//  'F' parede rachada (sólida; parte-se com o spin)
// =====================================================================
const SOLID = { '#': true, 'H': true, 'R': true, 'Z': true, 'F': true, 'G': true, 'D': true };   // 'G' plataforma de madeira (4-2), 'D' portão fechado (4-3)   // 'R' = pedregulho, 'Z' = pedra das ruínas
const SLOPE = { '/': true, '\\': true };
const ONEWAY = { '=': true, '-': true, 'L': true, 'P': true, 'K': true };   // atravessáveis por baixo ('P' = alçapão/andaime de madeira)

class Level {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.width = cols * T; this.height = rows * T;
    this.tiles = new Array(cols * rows).fill('.');
    this.defs = [];       // entidades a criar
    this.loops = [];      // { cx, cy, r, armed }
    this.bridges = [];    // { tx0, tx1, ty, amount, px }
    this.bridgeAt = new Map();
    this.crumbles = [];   // { tx, ty, state, t }
    this.crumbleAt = new Map();
    this.decos = [];      // decoração de fundo (pedras, arbustos...): pré-desenhada com os tiles
    this.decosFront = []; // decoração à frente da personagem (fetos, erva alta)
    this.leaves = false;  // folhas a cair
    this.forest = false;  // floresta de árvores altas no fundo
    this.start = { x: 3 * T, y: 0 };
    this.name = '';
    this.music = 'zone1';
    this.sky = ['#2456c9', '#5aa8ff', '#c9f0ff'];
    this.code = ''; this.realm = 'REINO DO BOSQUE';
    this.lava = new Set(); this.lavaTiles = [];   // tiles de lava (o chão do tile fica 4 px abaixo do topo)
    this.water = new Set(); this.waterTiles = []; // tiles de água dos oásis
    this.quick = new Set(); this.quickTiles = []; // areias movediças
    this.fragile = [];                            // paredes rachadas: { tx, ty, bg }
  }
  addFragile(tx, ty, bg = 'U') { this.set(tx, ty, 'F'); this.fragile.push({ tx, ty, bg }); }
  addQuick(tx, ty) { const i = this.idx(tx, ty); if (!this.quick.has(i)) { this.quick.add(i); this.quickTiles.push([tx, ty]); this.set(tx, ty, 'Q'); } }
  isQuick(x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    return this.quick.has(this.idx(tx, ty)) && (this.quick.has(this.idx(tx, ty - 1)) || y > ty * T + 3);
  }
  addWater(tx, ty) { const i = this.idx(tx, ty); if (!this.water.has(i)) { this.water.add(i); this.waterTiles.push([tx, ty]); this.set(tx, ty, 'W'); } }
  isWater(x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    return this.water.has(this.idx(tx, ty)) && (this.water.has(this.idx(tx, ty - 1)) || y > ty * T + 4);
  }
  addLava(tx, ty) { const i = this.idx(tx, ty); if (!this.lava.has(i)) { this.lava.add(i); this.lavaTiles.push([tx, ty]); } }
  isLava(x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    return this.lava.has(this.idx(tx, ty)) && (this.lava.has(this.idx(tx, ty - 1)) || y > ty * T + 4);   // a folga de 4 px é só à superfície
  }
  idx(tx, ty) { return ty * this.cols + tx; }
  get(tx, ty) {
    if (tx < 0 || tx >= this.cols) return '#';   // limites laterais
    if (ty < 0 || ty >= this.rows) return '.';
    return this.tiles[ty * this.cols + tx];
  }
  set(tx, ty, ch) {
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return;
    this.tiles[ty * this.cols + tx] = ch;
  }

  // ---------- superfície do chão --------------------------------------
  bridgeSag(tx, ty, x) {
    const b = this.bridgeAt.get(this.idx(tx, ty));
    if (!b || b.amount < 0.02) return 0;
    const x0 = b.tx0 * T, x1 = (b.tx1 + 1) * T;
    const p = clamp(b.px, x0 + 1, x1 - 1);
    const depth = 10 * b.amount * Math.sin(Math.PI * (p - x0) / (x1 - x0));
    return x < p ? depth * (x - x0) / (p - x0) : depth * (x1 - x) / (x1 - p);
  }
  surface(ch, tx, ty, x) {
    const lx = x - tx * T;
    switch (ch) {
      case '#': case 'H': case 'R': case 'Z': case 'F': case 'G': case '-': case 'L': case 'P': case 'K': return ty * T;
      case '/': return ty * T + (T - lx);
      case '\\': return ty * T + lx;
      case '=': return ty * T + this.bridgeSag(tx, ty, x);
    }
    return null;
  }
  // Primeira superfície (de cima para baixo) na coluna de x, entre yMin e yMax.
  floorAt(x, yMin, yMax) {
    const tx = Math.floor(x / T);
    const r0 = Math.max(0, Math.floor(yMin / T) - 1);
    const r1 = Math.min(this.rows - 1, Math.floor(yMax / T));
    for (let ty = r0; ty <= r1; ty++) {
      const ch = this.get(tx, ty);
      if (ch === '.') continue;
      if (SOLID[ch]) { const up = this.get(tx, ty - 1); if (SOLID[up] || SLOPE[up]) continue; }
      const s = this.surface(ch, tx, ty, x);
      if (s !== null && s >= yMin && s <= yMax) return { y: s, ch, tx, ty };
    }
    return null;
  }

  // ---------- actualização de elementos dinâmicos ------------------------
  update(dt, player, game) {
    for (const b of this.bridges) {
      const on = player.onGround && player.groundCh === '=' && player.groundTy === b.ty &&
        player.groundTx >= b.tx0 && player.groundTx <= b.tx1;
      if (on) b.px = player.x;
      b.amount += ((on ? 1 : 0) - b.amount) * Math.min(1, dt * 8);
    }
    for (const c of this.crumbles) {
      if (c.state === 'idle') {
        if (player.onGround && player.groundCh === '-' && player.groundTx === c.tx && player.groundTy === c.ty) {
          c.state = 'shake'; c.t = 0.4;
        }
      } else if (c.state === 'shake') {
        c.t -= dt;
        if (c.t <= 0) {
          c.state = 'gone'; c.t = 5; this.set(c.tx, c.ty, '.');
          game.debris(c.tx * T + T / 2, c.ty * T + 4);
          Sound.sfx('crumble');
        }
      } else if (c.state === 'gone') {
        c.t -= dt;
        const near = Math.abs(player.x - (c.tx * T + T / 2)) < 24 && Math.abs(player.y - c.ty * T) < 32;
        if (c.t <= 0 && !near) { c.state = 'idle'; this.set(c.tx, c.ty, '-'); }
      }
    }
    for (const lp of this.loops) {
      if (!lp.armed && Math.abs(player.x - lp.cx) > lp.r + 24) lp.armed = true;
    }
  }

  // ---------- construtor -----------------------------------------------
  column(tx, top, ch = '#') { for (let ty = top; ty < this.rows; ty++) this.set(tx, ty, ch); }
  ground(x0, x1, R) { for (let tx = x0; tx <= x1; tx++) this.column(tx, R); }
  slopeUp(x0, n, R) {
    for (let i = 0; i < n; i++) { this.column(x0 + i, R - i); this.set(x0 + i, R - 1 - i, '/'); }
    return R - n;
  }
  slopeDown(x0, n, R) {
    for (let i = 0; i < n; i++) { this.column(x0 + i, R + i + 1); this.set(x0 + i, R + i, '\\'); }
    return R + n;
  }
  bridge(x0, x1, ty) {
    const b = { tx0: x0, tx1: x1, ty, amount: 0, px: 0 };
    this.bridges.push(b);
    for (let tx = x0; tx <= x1; tx++) { this.set(tx, ty, '='); this.bridgeAt.set(this.idx(tx, ty), b); }
  }
  crumble(x0, x1, ty) {
    for (let tx = x0; tx <= x1; tx++) {
      this.set(tx, ty, '-');
      const c = { tx, ty, state: 'idle', t: 0 };
      this.crumbles.push(c); this.crumbleAt.set(this.idx(tx, ty), c);
    }
  }
  // Árvore: tronco 'T' (trepa-se) e copa 'L' (plataforma). Devolve a linha da copa.
  //  pequena: copa 3 tiles acima do chão (chega-se a saltar) · média: 6 · grande: 14+ (zona de cima)
  tree(tx, R, size, h) {
    const c = { small: { h: 3, w: 5, tw: 1 }, medium: { h: 6, w: 7, tw: 1 }, large: { h: 14, w: 11, tw: 2 } }[size];
    h = h || c.h;
    for (let i = 0; i < c.tw; i++) for (let ty = R - h + 1; ty <= R - 1; ty++) this.set(tx + i, ty, 'T');
    const row = R - h, c0 = tx + Math.floor(c.tw / 2) - Math.floor(c.w / 2);
    for (let x = c0; x < c0 + c.w; x++) if (this.get(x, row) === '.') this.set(x, row, 'L');
    return row;
  }
  // Poço com paredes lado a lado: parede esquerda suspensa (com túnel de 3 tiles por baixo),
  // poço de 'w' colunas e chão. Devolve a primeira coluna do bloco da direita.
  shaft(x, top, w, R) {
    for (let tx = x; tx < x + 3; tx++) for (let ty = top; ty <= R - 4; ty++) this.set(tx, ty, '#');
    for (let tx = x; tx < x + 3 + w; tx++) this.column(tx, R);
    return x + 3 + w;
  }
  loop(tx, R, r = 56) { this.loops.push({ cx: tx * T + T / 2, cy: R * T - r, r, armed: true }); }
  add(type, x, y, props = {}) { this.defs.push(Object.assign({ type, x, y }, props)); }
  // Túnel: cobre o chão já construído com uma colina (topo na linha 'top') e escava por baixo
  // um corredor de 'h' tiles de altura que acompanha o chão (incluindo rampas).
  tunnel(x0, x1, top, h) {
    for (let tx = x0; tx <= x1; tx++) {
      let f = top; while (f < this.rows && !(SOLID[this.get(tx, f)] || SLOPE[this.get(tx, f)])) f++;
      for (let ty = top; ty < f; ty++) this.set(tx, ty, ty >= f - h ? 'B' : '#');
    }
  }
  // Pedregulho sólido de 'w' colunas e 'h' linhas pousado no chão R
  rock(x0, w, R, h) { for (let tx = x0; tx < x0 + w; tx++) for (let ty = R - h; ty < R; ty++) this.set(tx, ty, 'R'); }
}

// =====================================================================
//  NÍVEL 1 — BOSQUE DAS AVELÃS
// =====================================================================
function buildLevel1() {
  const L = new Level(340, 34);
  L.name = 'BOSQUE DAS AVELÃS';
  L.music = 'zone1';
  L.code = '1-1';
  const X = tx => tx * T + T / 2;
  const Y = ty => ty * T;
  const acornRow = (a, b, y) => { for (let tx = a; tx <= b; tx++) L.add('acorn', X(tx), y); };

  // A — início
  let R = 22;
  L.ground(0, 23, R);
  L.start = { x: X(4), y: Y(R) };
  acornRow(10, 14, Y(R) - 12);
  L.add('beetle', X(20), Y(R));

  // B — descida para o primeiro looping
  R = L.slopeDown(24, 5, R);                      // R = 27
  for (let i = 0; i < 5; i++) L.add('acorn', X(24 + i), Y(22 + i) - 6);

  // C — looping 1
  L.ground(29, 58, R);
  L.loop(44, R);
  {
    const cx = X(44), cy = Y(R) - 56;
    for (let k = 1; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      L.add('acorn', cx + Math.sin(a) * 44, cy + Math.cos(a) * 44);
    }
    L.add('golden', cx, cy - 44, { idx: 0 });
  }
  L.add('beetle', X(53), Y(R));
  L.add('beetle', X(57), Y(R));

  // D — subida
  R = L.slopeUp(59, 3, R);                        // R = 24
  L.ground(62, 70, R);

  // E — ponte de corda sobre o abismo
  L.bridge(71, 84, R);
  for (let i = 0; i < 7; i++) L.add('acorn', X(73 + i * 2), Y(R) - 14 - Math.sin(i / 6 * Math.PI) * 20);
  L.add('wasp', X(78), Y(R) - 44);

  // F — antes da falésia
  L.ground(85, 99, R);
  L.add('check', X(87), Y(R));
  L.add('spring', X(96), Y(R));

  // G — falésia de casca
  for (let tx = 100; tx <= 115; tx++) L.column(tx, 12, tx === 100 ? 'H' : '#');
  for (let ty = 14; ty <= 22; ty += 2) L.add('acorn', X(99), Y(ty));
  R = 12;

  // H — tábuas podres + vale para planar
  L.crumble(116, 122, R);
  for (let i = 0; i < 8; i++) L.add('acorn', X(124 + i * 2), Y(11) + i * 3);

  // I — plataforma + descida longa + looping 2
  L.ground(139, 150, 14);
  L.add('wasp', X(146), Y(14) - 34);
  R = L.slopeDown(151, 10, 14);                   // R = 24
  for (let i = 0; i < 10; i += 2) L.add('acorn', X(151 + i), Y(14 + i) - 6);
  L.ground(161, 186, R);
  L.loop(170, R);
  {
    const cx = X(170), cy = Y(R) - 56;
    for (let k = 2; k < 11; k++) {
      const a = (k / 12) * Math.PI * 2;
      L.add('acorn', cx + Math.sin(a) * 44, cy + Math.cos(a) * 44);
    }
  }
  L.add('beetle', X(179), Y(R));
  L.add('beetle', X(184), Y(R));

  // J — rampa + salto com turbo
  R = L.slopeUp(187, 4, R);                       // R = 20
  L.ground(191, 194, R);
  for (let i = 0; i < 7; i++) L.add('acorn', X(196 + i * 2), Y(R) - 30 - Math.sin(i / 6 * Math.PI) * 26);
  L.ground(209, 226, R);

  // K — silvas e vespas
  L.add('check', X(211), Y(R));
  L.add('bramble', X(218), Y(R));
  L.add('bramble', X(219), Y(R));
  L.add('wasp', X(222), Y(R) - 30);

  // L — tronco gigante (casca dos dois lados) + ramos
  for (let tx = 227; tx <= 229; tx++) L.column(tx, 6, tx === 228 ? '#' : 'H');
  for (let ty = 8; ty <= 18; ty += 2) L.add('acorn', X(226), Y(ty));
  L.bridge(232, 238, 9);
  L.bridge(241, 247, 7);
  L.bridge(250, 256, 9);
  acornRow(233, 237, Y(9) - 12);
  acornRow(251, 255, Y(9) - 12);
  L.add('golden', X(244), Y(4), { idx: 1 });
  L.add('wasp', X(244), Y(7) - 26);
  L.ground(230, 270, R);
  L.add('beetle', X(236), Y(R));
  L.add('beetle', X(248), Y(R));
  L.add('beetle', X(258), Y(R));
  L.add('bramble', X(264), Y(R));

  // M — recta final + looping 3 + meta
  R = L.slopeDown(271, 4, R);                     // R = 24
  L.ground(275, 339, R);
  L.add('check', X(277), Y(R));
  L.loop(290, R);
  {
    const cx = X(290), cy = Y(R) - 56;
    for (let k = 1; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      L.add('acorn', cx + Math.sin(a) * 44, cy + Math.cos(a) * 44);
    }
  }
  L.add('beetle', X(298), Y(R));
  L.add('spring', X(302), Y(R));
  L.add('golden', X(305), Y(R) - 176, { idx: 2 });
  acornRow(308, 314, Y(R) - 12);
  L.add('goal', X(320), Y(R));
  decorate(L, 1994);
  return L;
}

// =====================================================================
//  NÍVEL 2 — COPAS DO CARVALHAL
//  Árvores pequenas, médias e grandes (as grandes levam à zona das copas)
//  e dois poços de paredes lado a lado com inimigos (salto de parede).
// =====================================================================
function buildLevel2() {
  const L = new Level(330, 40);
  L.name = 'COPAS DO CARVALHAL';
  L.music = 'zone2';
  L.code = '1-2';
  L.sky = ['#2d5fc4', '#86c2ff', '#fff0c8'];
  L.leaves = true; L.forest = true;
  const X = tx => tx * T + T / 2;
  const Y = ty => ty * T;
  const acornRow = (a, b, y) => { for (let tx = a; tx <= b; tx++) L.add('acorn', X(tx), y); };

  // A — clareira com árvores pequenas e uma média
  let R = 30;
  L.ground(0, 34, R);
  L.start = { x: X(3), y: Y(R) };
  let c = L.tree(10, R, 'small'); acornRow(8, 12, Y(c) - 12);
  c = L.tree(17, R, 'small'); acornRow(16, 18, Y(c) - 12);
  c = L.tree(24, R, 'medium'); acornRow(21, 27, Y(c) - 12);
  L.add('golden', X(24), Y(c) - 52, { idx: 0 });
  L.add('beetle', X(31), Y(R));
  L.rock(28, 2, R, 1);
  L.add('crow', X(30), Y(22));

  // B — descida e looping
  R = L.slopeDown(35, 4, R);                                   // R = 34
  L.ground(39, 62, R);
  L.add('check', X(41), Y(R));
  L.loop(50, R);
  { const cx = X(50), cy = Y(R) - 56; for (let k = 1; k < 12; k++) { const a = k / 12 * Math.PI * 2; L.add('acorn', cx + Math.sin(a) * 44, cy + Math.cos(a) * 44); } }
  c = L.tree(59, R, 'small'); acornRow(58, 60, Y(c) - 12);
  L.add('mole', X(56), Y(R));
  R = L.slopeUp(63, 4, R);                                     // R = 30

  // C — árvores grandes e a zona das copas (em cima) / caminho do chão (em baixo)
  L.ground(67, 150, R);
  L.tree(74, R, 'large');                                      // copa linha 16, colunas 70-80
  L.bridge(81, 87, 16);
  L.tree(92, R, 'large');                                      // copa linha 16, colunas 88-98
  L.tree(109, R, 'large', 16);                                 // copa linha 14, colunas 105-115
  L.bridge(116, 121, 14);
  L.tree(126, R, 'large', 16);                                 // copa linha 14, colunas 122-132
  L.crumble(133, 138, 14);
  acornRow(71, 79, Y(16) - 12); acornRow(82, 86, Y(16) - 20); acornRow(89, 97, Y(16) - 12);
  for (let i = 0; i < 5; i++) L.add('acorn', X(99 + i), Y(15) - 20 - Math.sin(i / 4 * Math.PI) * 24);
  acornRow(106, 114, Y(14) - 12); acornRow(117, 120, Y(14) - 20); acornRow(123, 131, Y(14) - 12);
  for (let i = 0; i < 6; i++) L.add('acorn', X(140 + i * 2), Y(13) + i * 4);
  L.add('beetle', X(95), Y(16));
  L.add('wasp', X(102), Y(12));
  L.add('beetle', X(129), Y(14));
  L.add('golden', X(127), Y(10), { idx: 1 });
  // chão: árvores pequena e média como degraus, inimigos e silvas
  c = L.tree(103, R, 'small'); acornRow(102, 104, Y(c) - 12);
  L.add('check', X(97), Y(R));
  L.add('mole', X(82), Y(R)); L.add('mole', X(106), Y(R)); L.add('mole', X(136), Y(R));
  L.rock(116, 2, R, 2); L.rock(131, 3, R, 3);
  L.add('acorn', X(132), Y(R - 3) - 12); L.add('acorn', X(133), Y(R - 3) - 12);
  L.add('crow', X(84), Y(11)); L.add('crow', X(118), Y(9));
  L.add('beetle', X(86), Y(R)); L.add('beetle', X(119), Y(R));
  L.add('bramble', X(113), Y(R)); L.add('bramble', X(114), Y(R));
  c = L.tree(140, R, 'medium'); acornRow(138, 142, Y(c) - 12);

  // D — poço 1: paredes lado a lado (salto de parede) com vespa e lagartas
  L.add('check', X(146), Y(R));
  let rx = L.shaft(151, 14, 5, R);                             // parede 151-153, poço 154-158, bloco 159+
  for (let tx = rx; tx <= 185; tx++) L.column(tx, 14);
  L.set(159, 19, '.'); L.set(160, 19, '.'); L.set(159, 20, '.'); L.set(160, 20, '.');   // nicho secreto
  L.add('golden', X(160) - 4, Y(20) + 2, { idx: 2 });
  L.add('wasp', X(156), Y(21), { axis: 'y', range: 56 });
  L.add('crawler', 154 * T + 6, Y(18), { side: 1 });
  L.add('crawler', 159 * T - 6, Y(25), { side: -1 });
  [[155, 27], [157, 24], [155, 21], [157, 18], [156, 15]].forEach(([tx, ty]) => L.add('acorn', X(tx), Y(ty)));
  acornRow(162, 170, Y(14) - 12);
  L.add('beetle', X(176), Y(14));
  L.rock(178, 2, 14, 1); L.rock(182, 2, 14, 2);
  L.add('crow', X(172), Y(8));

  // E — descida longa, looping e poço 2 (mais estreito e mais alto)
  R = L.slopeDown(186, 16, 14);                                // R = 30
  L.ground(202, 240, R);
  L.loop(214, R);
  { const cx = X(214), cy = Y(R) - 56; for (let k = 2; k < 11; k++) { const a = k / 12 * Math.PI * 2; L.add('acorn', cx + Math.sin(a) * 44, cy + Math.cos(a) * 44); } }
  L.add('beetle', X(225), Y(R)); L.add('beetle', X(231), Y(R));
  L.rock(222, 2, R, 2);
  L.add('mole', X(207), Y(R)); L.add('mole', X(228), Y(R));
  L.add('check', X(234), Y(R));
  rx = L.shaft(237, 12, 4, R);                                 // parede 237-239, poço 240-243, bloco 244+
  for (let tx = rx; tx <= 275; tx++) L.column(tx, 12);
  const sx = 242 * T;                                          // centro do poço
  L.add('wasp', sx, Y(16), { axis: 'y', range: 30 });
  L.add('wasp', sx, Y(24), { axis: 'y', range: 30 });
  L.add('crawler', 240 * T + 6, Y(20), { side: 1 });
  L.add('crawler', 244 * T - 6, Y(15), { side: -1 });
  L.add('crawler', 244 * T - 6, Y(25), { side: -1 });
  [[241, 27], [242, 23], [241, 19], [242, 15]].forEach(([tx, ty]) => L.add('acorn', X(tx), Y(ty)));
  acornRow(248, 256, Y(12) - 12);
  L.rock(258, 3, 12, 2); L.rock(268, 1, 12, 1);
  L.add('crow', X(262), Y(6));

  // F — descida final, árvore grande junto à meta
  R = L.slopeDown(276, 16, 12);                                // R = 28
  L.ground(292, 329, R);
  L.add('check', X(294), Y(R));
  L.add('mole', X(306), Y(R));
  L.add('crow', X(312), Y(20));
  L.tree(300, R, 'large');                                     // copa linha 14
  acornRow(297, 305, Y(14) - 12);
  L.add('wasp', X(309), Y(18));
  acornRow(308, 314, Y(R) - 12);
  L.add('goal', X(320), Y(R));
  decorate(L, 2024);
  return L;
}

// =====================================================================
//  NÍVEL 3 — OUTONO NO CARVALHAL
//  Floresta do nível 2 no outono: folhas no chão (levantam-se a correr),
//  túneis nas colinas (com morcegos) e o Barão Gralha no fim.
// =====================================================================
function buildLevel3() {
  const L = new Level(324, 40);
  L.name = 'OUTONO NO CARVALHAL';
  L.music = 'zone3';
  L.code = '1-3';
  L.season = 'autumn'; L.autumn = true; L.forest = true;
  L.sky = ['#4a5fb8', '#f0a878', '#ffe6b8'];
  const X = tx => tx * T + T / 2;
  const Y = ty => ty * T;
  const acornRow = (a, b, y, step = 1) => { for (let tx = a; tx <= b; tx += step) L.add('acorn', X(tx), y); };
  let R = 30, c;

  // chão base (as colinas e rampas são construídas por cima)
  L.ground(0, 124, R);
  R = L.slopeDown(125, 6, R);                                  // 36: túnel em U
  L.ground(131, 150, R);
  R = L.slopeUp(151, 6, R);                                    // 30
  L.ground(157, 323, R);

  // A — clareira de outono
  L.start = { x: X(3), y: Y(R) };
  c = L.tree(12, R, 'small'); acornRow(10, 14, Y(c) - 12);
  c = L.tree(20, R, 'medium'); acornRow(18, 22, Y(c) - 12);
  L.add('beetle', X(27), Y(R));
  L.add('mole', X(33), Y(R));
  L.rock(37, 2, R, 1);

  // B — colina com o túnel 1; por cima, caminho pela árvore grande
  L.tree(44, R, 'large', 12);                                  // copa linha 18, colunas 40-50
  acornRow(41, 49, Y(18) - 12);
  L.tunnel(48, 80, 20, 4);
  L.add('bat', X(58), Y(26)); L.add('bat', X(71), Y(26));
  L.add('beetle', X(64), Y(R));
  acornRow(52, 76, Y(R) - 12, 3);
  acornRow(52, 60, Y(20) - 12);
  L.rock(68, 2, 20, 1);
  L.add('crow', X(64), Y(12));
  L.add('golden', X(78), Y(20) - 36, { idx: 0 });

  // C — looping, árvore pequena e mola para a colina 2
  L.add('check', X(85), Y(R));
  L.loop(96, R);
  { const cx = X(96), cy = Y(R) - 56; for (let k = 1; k < 12; k++) { const a = k / 12 * Math.PI * 2; L.add('acorn', cx + Math.sin(a) * 44, cy + Math.cos(a) * 44); } }
  L.add('mole', X(103), Y(R));
  c = L.tree(108, R, 'small'); acornRow(107, 109, Y(c) - 12);
  L.add('crow', X(104), Y(20));
  L.add('spring', X(117), Y(R));

  // D — túnel 2 em U (desce e sobe: ganha-se velocidade) e colina por cima
  L.tunnel(121, 160, 22, 4);
  L.add('bat', X(134), Y(32)); L.add('bat', X(147), Y(32));
  L.add('beetle', X(140), Y(36));
  acornRow(132, 149, Y(36) - 12, 2);
  c = L.tree(135, 22, 'small'); acornRow(134, 136, Y(c) - 12);
  L.add('mole', X(127), Y(22));
  L.add('crow', X(145), Y(13));
  L.add('golden', X(152), Y(22) - 36, { idx: 1 });

  // E — copas de outono e colina 3: túnel sem saída que sobe por uma chaminé
  L.add('check', X(162), Y(R));
  L.tree(170, R, 'large');                                     // copa linha 16, colunas 166-176
  L.bridge(177, 183, 16);
  L.tree(188, R, 'large');                                     // copa linha 16, colunas 184-194
  acornRow(167, 175, Y(16) - 12); acornRow(185, 193, Y(16) - 12);
  L.add('crow', X(180), Y(9));
  L.add('mole', X(176), Y(R)); L.add('beetle', X(183), Y(R));
  L.rock(196, 2, R, 2);
  L.tunnel(200, 222, 16, 3);
  for (let tx = 223; tx <= 236; tx++) for (let ty = 16; ty < R; ty++) L.set(tx, ty, '#');
  for (let tx = 219; tx <= 222; tx++) for (let ty = 16; ty <= 26; ty++) L.set(tx, ty, 'B');      // chaminé
  for (let tx = 217; tx <= 218; tx++) for (let ty = 21; ty <= 22; ty++) L.set(tx, ty, 'B');      // nicho secreto
  L.add('golden', 218 * T, Y(22) + 2, { idx: 2 });
  L.add('bat', X(206), Y(27)); L.add('beetle', X(212), Y(R));
  acornRow(202, 216, Y(R) - 12, 2);
  L.add('crawler', 219 * T + 6, Y(23), { side: 1 });
  L.add('crawler', 223 * T - 6, Y(19), { side: -1 });
  [[220, 27], [221, 24], [220, 21], [221, 18]].forEach(([tx, ty]) => L.add('acorn', X(tx), Y(ty)));
  L.rock(228, 2, 16, 1);
  acornRow(224, 226, Y(16) - 12, 2); L.add('acorn', X(228), Y(15) - 12); acornRow(230, 234, Y(16) - 12, 2);   // a do meio fica em cima da pedra
  L.add('crow', X(230), Y(8));

  // F — descida e caminho para a arena
  L.slopeDown(237, 14, 16);                                    // chega a R = 30 na coluna 251
  L.add('mole', X(262), Y(R)); L.add('beetle', X(270), Y(R));
  L.add('crow', X(276), Y(20));
  acornRow(280, 286, Y(R) - 12);
  L.add('check', X(288), Y(R));

  // G — arena do Barão Gralha (colunas 300-323; a parede da direita é o fim do nível)
  L.tree(304, R, 'medium', 4);                                 // copa linha 26, colunas 301-307
  L.tree(319, R, 'medium', 4);                                 // copa linha 26, colunas 316-322
  acornRow(309, 314, Y(R) - 12);
  L.add('boss', X(316), Y(21), { ax0: 300 * T, ax1: 324 * T, floor: Y(R) });
  L.hasBoss = true;
  decorate(L, 7777);
  return L;
}

// =====================================================================
//  NÍVEL 2-1 — GALERIAS DE JADE (Reino da Mina)
//  Labirinto gerado a partir de uma semente (sempre igual): câmaras de
//  10×6 tiles ligadas por portas e por escadas com alçapões. Escuro:
//  só se vê à volta da Avelã, dos lampiões (caminho principal) e dos jades.
// =====================================================================
// Gerador das minas. Opções:
//  corridors: n.º de galerias longas (sequências de 4-6 câmaras sem paredes pelo meio)
//  shafts: probabilidade de uma ligação vertical ser um poço de saltos de parede em vez de escada
//  stalactites: estalactites que caem quando a Avelã passa (nas galerias longas)
//  gem: pedras cravadas nas paredes (0 jade, 1 rubi, 2 diamante)
function buildMine(o) {
  const GW = o.GW || 14, GH = o.GH || 5, CW = 12, CH = 8;
  const AX0 = GW * CW;                                         // arena do chefe à direita do labirinto (só no 2-3)
  const L = new Level(GW * CW + (o.boss ? 27 : 0), GH * CH + 2);
  L.name = o.name; L.code = o.code; L.realm = 'REINO DA MINA'; L.teaser = o.teaser;
  L.music = o.music; L.season = 'mine'; L.underground = true; L.dark = true;
  L.lights = [];
  const GEMCOL = ['60,255,150', '255,60,90', '170,230,255'][o.gem || 0];
  let s = o.seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const X0 = cx => cx * CW, Y0 = cy => cy * CH;               // canto da câmara
  const floorY = cy => (Y0(cy) + 7) * T;
  for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.cols; tx++) L.set(tx, ty, '#');
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++)
    for (let tx = X0(cx) + 1; tx <= X0(cx) + 10; tx++) for (let ty = Y0(cy) + 1; ty <= Y0(cy) + 6; ty++) L.set(tx, ty, 'B');

  // ---- labirinto (backtracker; prefere caminhos horizontais, que se jogam melhor) ----
  const id = (cx, cy) => cy * GW + cx, links = new Set(), key = (a, b) => a < b ? a + ':' + b : b + ':' + a;
  const seen = new Set([id(0, 0)]), stack = [[0, 0]];
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts = [[1, 0, 3], [-1, 0, 3], [0, 1, 1], [0, -1, 1]].map(([dx, dy, w]) => [cx + dx, cy + dy, w])
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < GW && ny < GH && !seen.has(id(nx, ny)));
    if (!opts.length) { stack.pop(); continue; }
    let tot = opts.reduce((a, o) => a + o[2], 0), r = rnd() * tot, pick = opts[0];
    for (const o of opts) { r -= o[2]; if (r <= 0) { pick = o; break; } }
    links.add(key(id(cx, cy), id(pick[0], pick[1]))); seen.add(id(pick[0], pick[1])); stack.push([pick[0], pick[1]]);
  }
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW - 1; cx++)      // alguns atalhos: mais de um caminho
    if (rnd() < 0.16) links.add(key(id(cx, cy), id(cx + 1, cy)));
  // galerias longas: várias câmaras seguidas sem paredes pelo meio (para correr a fundo)
  const open = new Set(), corridorCell = new Set();
  const rows = [...Array(GH).keys()];
  for (let n = 0; n < (o.corridors || 0) && rows.length; n++) {
    const cy = rows.splice(Math.floor(rnd() * rows.length), 1)[0];
    const len = 4 + Math.floor(rnd() * 3), c0 = Math.floor(rnd() * (GW - len + 1));
    for (let cx = c0; cx < c0 + len; cx++) {
      corridorCell.add(id(cx, cy));
      if (cx < c0 + len - 1) { const k = key(id(cx, cy), id(cx + 1, cy)); links.add(k); open.add(k); }
    }
  }
  const hlink = (cx, cy, side) => { const nx = cx + side; return nx >= 0 && nx < GW && links.has(key(id(cx, cy), id(nx, cy))); };

  // ---- ligações verticais: escada com alçapão ou poço de saltos de parede ----
  const ladders = new Map();          // id da câmara de baixo -> coluna da escada; id + 'h' -> coluna do alçapão em cima
  const upShaft = new Map(), holeIn = new Map();    // id -> lado (-1 esquerda, 1 direita) do poço / do buraco no chão
  const vlinks = [...links].map(k => k.split(':').map(Number)).filter(([a, b]) => Math.floor(a / GW) !== Math.floor(b / GW));
  const vtype = new Map();
  if (o.shafts) for (const [a, b] of vlinks) {
    if (rnd() >= o.shafts) continue;
    const cx = a % GW, up = Math.min(Math.floor(a / GW), Math.floor(b / GW)), lo = id(cx, up + 1), hi = id(cx, up);
    const sides = [-1, 1].filter(sd => !hlink(cx, up + 1, sd) && holeIn.get(lo) !== sd && upShaft.get(hi) !== sd &&
      !(o.boss && sd > 0 && lo === id(GW - 1, GH - 1)));          // a câmara da saída tem a porta da arena à direita
    if (!sides.length) continue;
    const sd = sides[Math.floor(rnd() * sides.length)];
    upShaft.set(lo, sd); holeIn.set(hi, sd); vtype.set(key(a, b), sd);
  }
  const holeCols = sd => sd < 0 ? [1, 2, 3, 4] : [7, 8, 9, 10];         // colunas locais do poço
  const shaftRoom = sd => sd < 0 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10];  // inclui a parede interior

  // ---- escavar as ligações ----
  for (const k of links) {
    const [a, b] = k.split(':').map(Number), ax = a % GW, ay = Math.floor(a / GW), bx = b % GW, by = Math.floor(b / GW);
    if (ay === by) {                                           // porta (ou galeria aberta) entre câmaras vizinhas
      const cx = Math.min(ax, bx);
      for (const tx of [X0(cx) + 11, X0(cx + 1)]) for (let ty = Y0(ay) + (open.has(k) ? 1 : 3); ty <= Y0(ay) + 6; ty++) L.set(tx, ty, 'B');
    } else if (vtype.has(k)) {                                 // poço: buraco no chão de cima, parede interior em baixo
      const cx = ax, up = Math.min(ay, by), sd = vtype.get(k), x0 = X0(cx);
      for (const c of holeCols(sd)) { L.set(x0 + c, Y0(up) + 7, 'B'); L.set(x0 + c, Y0(up) + 8, 'B'); }
      const wx = x0 + (sd < 0 ? 5 : 6);
      for (let ty = Y0(up + 1) + 1; ty <= Y0(up + 1) + 4; ty++) L.set(wx, ty, '#');
    } else {                                                   // escada da câmara de baixo até à de cima
      const cx = ax, up = Math.min(ay, by), lo = id(cx, up + 1), hi = id(cx, up);
      let lx = X0(cx) + 3 + Math.floor(rnd() * 5);
      const bad = c => (holeIn.has(lo) && holeCols(holeIn.get(lo)).includes(c)) ||
        (upShaft.has(hi) && shaftRoom(upShaft.get(hi)).some(q => Math.abs(q - c) <= 1));
      if (bad(lx - X0(cx))) { const ok = [3, 4, 5, 6, 7].filter(c => !bad(c)); lx = X0(cx) + (ok.length ? ok[Math.floor(rnd() * ok.length)] : 5); }
      for (let tx = lx - 1; tx <= lx + 1; tx++) { L.set(tx, Y0(up) + 7, 'P'); L.set(tx, Y0(up) + 8, 'B'); }
      for (let ty = Y0(up) + 8; ty <= Y0(up + 1) + 6; ty++) L.set(lx, ty, 'E');
      ladders.set(lo, lx); ladders.set(hi + 'h', lx);
    }
  }
  // ---- caminho principal: da entrada à câmara mais distante ----
  const adj = new Map();
  for (const k of links) { const [a, b] = k.split(':').map(Number); (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
  const dist = new Map([[0, 0]]), prev = new Map(), q = [0];
  while (q.length) { const c = q.shift(); for (const n of adj.get(c) || []) if (!dist.has(n)) { dist.set(n, dist.get(c) + 1); prev.set(n, c); q.push(n); } }
  let exit = 0; for (const [c, d] of dist) if (d > dist.get(exit)) exit = c;
  if (o.boss) exit = id(GW - 1, GH - 1);                       // com chefe: a saída é a câmara mais funda, junto à arena
  const path = []; for (let c = exit; c !== undefined; c = prev.get(c)) path.unshift(c);
  const onPath = new Set(path);
  const cellOf = c => [c % GW, Math.floor(c / GW)];
  L.maze = { GW, GH, CW, CH, path, exit, ladders, upShaft, holeIn, corridors: corridorCell };   // (para os testes e um futuro mapa)

  L.start = { x: X0(0) * T + 3 * T, y: floorY(0) };
  const reserved = new Set();                                  // colunas da meta e dos faróis: sem pedras nem inimigos
  if (!o.boss) { const [ex, ey] = cellOf(exit); L.add('goal', (X0(ex) + 8) * T, floorY(ey)); [6, 7, 8, 9].forEach(k => reserved.add(X0(ex) + k)); }
  path.forEach((c, i) => {
    if (i > 0 && i % 7 === 0 && c !== exit) {
      const [cx, cy] = cellOf(c), sh = upShaft.get(c) ?? holeIn.get(c), k = sh < 0 ? 7 : 2;
      L.add('check', (X0(cx) + k) * T + 8, floorY(cy)); [k - 1, k, k + 1].forEach(q => reserved.add(X0(cx) + q));
    }
  });
  if (o.boss) buildMineArena(L, o, { AX0, X0, Y0, GW, GH, floorY, reserved });

  // ---- recheio das câmaras ----
  const deadEnds = [...dist.keys()].filter(c => c !== 0 && c !== exit && (adj.get(c) || []).length === 1)
    .sort((a, b) => dist.get(b) - dist.get(a));
  const golden = new Set(deadEnds.slice(0, 3));
  let gIdx = 0;
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    const c = id(cx, cy), x0 = X0(cx), fy = floorY(cy), top = (Y0(cy) + 1) * T;
    const lad = ladders.get(c), hatch = ladders.get(c + 'h'), shaft = upShaft.get(c), hole = holeIn.get(c);
    const busy = tx => (lad !== undefined && Math.abs(tx - lad) <= 2) || (hatch !== undefined && Math.abs(tx - hatch) <= 2) ||
      (shaft !== undefined && shaftRoom(shaft).includes(tx - x0)) ||
      (hole !== undefined && holeCols(hole).some(q => Math.abs(q - (tx - x0)) <= 1)) || reserved.has(tx);
    const corr = corridorCell.has(c);
    // lava: poços no chão das câmaras e, nas galerias, um rio com uma ponte de tábuas que desabam
    let lavaCols = [];
    if (o.lava && c !== 0 && c !== exit) {
      if (corr) {
        lavaCols = [2, 3, 4, 5, 6, 7, 8, 9].map(k => x0 + k).filter(tx => !busy(tx));
        if (lavaCols.length < 8) lavaCols = [];                  // só rios inteiros
        else L.crumble(x0 + 4, x0 + 7, Y0(cy) + 7);
      } else if (rnd() < o.lava) {
        const a = x0 + 4 + Math.floor(rnd() * 3), cols = [a, a + 1, a + 2];
        if (!cols.some(busy)) lavaCols = cols;
      }
      for (const tx of lavaCols) { if (L.get(tx, Y0(cy) + 7) === '#') L.set(tx, Y0(cy) + 7, 'V'); L.addLava(tx, Y0(cy) + 7); }
      if (lavaCols.length) L.lights.push({ x: (lavaCols[0] + lavaCols.length / 2) * T, y: fy + 4, r: 34 + lavaCols.length * 5, col: '255,110,30', lava: true });
    }
    const planks = tx => lavaCols.length === 8 && tx >= x0 + 4 && tx <= x0 + 7;
    const inLava = tx => lavaCols.includes(tx) && !planks(tx);
    // escoras de madeira (sem postes no meio das galerias abertas) e, no caminho principal, um lampião
    const oL = open.has(key(c, c - 1)) && cx > 0, oR = open.has(key(c, c + 1)) && cx < GW - 1;
    const bx0 = shaft < 0 ? x0 + 6 : x0 + 1, bx1 = shaft > 0 ? x0 + 6 : x0 + 11;
    L.decos.push({ type: 'beam', x0: bx0 * T, x1: bx1 * T, top, floor: fy, noL: oL || shaft < 0, noR: oR || shaft > 0, seed: c });
    if (onPath.has(c)) {
      const lx = (x0 + (shaft < 0 ? 8 : shaft > 0 ? 3 : 5)) * T + 8;
      L.decos.push({ type: 'lantern', x: lx, y: top, seed: c }); L.lights.push({ x: lx, y: top + 22, r: 56, warm: true });
    }
    if (rnd() < 0.55) {                                         // pedra preciosa cravada na parede
      const side = rnd() < 0.5, jx = side ? (x0 + 1) * T + 2 : (x0 + 11) * T - 2, jy = top + 20 + Math.floor(rnd() * 40);
      if (!(side ? oL : oR)) { L.decos.push({ type: 'crystal', x: jx, y: jy, side: side ? 1 : -1, gem: o.gem || 0, seed: c * 7 }); L.lights.push({ x: jx, y: jy, r: 26, col: GEMCOL }); }
    }
    if (corr || rnd() < 0.35) L.decos.push({ type: 'rails', x0: (x0 + (oL ? 0 : 1)) * T, x1: (x0 + (oR ? 12 : 11)) * T, y: fy, seed: c });
    if (!corr && rnd() < 0.12 && !busy(x0 + 7)) L.decos.push({ type: 'cart', x: (x0 + 7) * T, y: fy, seed: c });
    if (shaft !== undefined) {                                  // bolotas a subir pelo poço (recompensa dos saltos de parede)
      const mx = (x0 + (shaft < 0 ? 2.5 : 8.5)) * T + 8;
      for (let k = 1; k <= 5; k++) L.add('acorn', mx, fy - 20 - k * 22);
    }
    if (c === 0) continue;
    // obstáculos primeiro (pedregulho e estalagmites); as bolotas vêm depois, por cima deles
    const rockH = rnd() < 0.5 ? 1 : 2, rockX = rnd() < (corr ? 0.1 : 0.2) ? x0 + 6 + Math.floor(rnd() * 2) : -1;
    const rockAt = rockX > 0 && !busy(rockX) && !busy(rockX + 1) && !lavaCols.includes(rockX) && !lavaCols.includes(rockX + 1) ? rockX : -1;
    if (rockAt > 0) L.rock(rockAt, 2, Y0(cy) + 7, rockH);
    const spikes = rnd() < 0.12 ? [x0 + 3, x0 + 4].filter(tx => !busy(tx) && !lavaCols.includes(tx)) : [];
    spikes.forEach(tx => L.add('bramble', tx * T + 8, fy, { style: 'rock' }));
    const onRock = tx => rockAt > 0 && (tx === rockAt || tx === rockAt + 1);
    // plataforma de andaime a meia altura, com bolotas
    let plat = [];
    if (rnd() < 0.45) {
      const px = x0 + 2 + Math.floor(rnd() * 4);
      if (![0, 1, 2, 3].some(i => busy(px + i))) {
        plat = [0, 1, 2, 3].map(i => px + i);
        for (const tx of plat) { L.set(tx, Y0(cy) + 4, 'P'); L.add('acorn', tx * T + 8, (Y0(cy) + 4) * T - 12); }
      }
    }
    // fila de bolotas no chão: em cima do pedregulho e em arco por cima das estalagmites
    if (rnd() < 0.55) for (let i = 0; i < 5; i++) {
      const tx = x0 + 3 + i;
      if (busy(tx)) continue;
      if (onRock(tx)) { if (rockH === 1 || !plat.includes(tx)) L.add('acorn', tx * T + 8, fy - rockH * T - 12); }
      else L.add('acorn', tx * T + 8, spikes.includes(tx) || inLava(tx) ? fy - 44 : fy - 12);
    }
    if (golden.has(c)) L.add('golden', (x0 + (shaft < 0 ? 8 : shaft > 0 ? 3 : 6)) * T, fy - 40, { idx: gIdx++ });
    // estalactites que caem (nas galerias: quem passa depressa nem as sente)
    if (o.stalactites && corr) for (const sx of [x0 + 3, x0 + 8]) if (rnd() < o.stalactites && !busy(sx) && !plat.includes(sx)) L.add('stalactite', sx * T + 8, top);
    // inimigos (nunca nas duas primeiras câmaras)
    if (cx + cy < 2) continue;
    const r = rnd(), ex = (x0 + 3 + Math.floor(rnd() * 6)) * T + 8, etx = Math.floor(ex / T);
    if (busy(etx) || onRock(etx) || spikes.includes(etx) || lavaCols.some(tx => Math.abs(tx - etx) <= 1)) continue;
    if (r < (corr ? 0.4 : 0.24)) L.add('drillmole', ex, fy);
    else if (r < 0.44) L.add('spider', ex, top, { dropTo: fy - 16 });
    else if (r < 0.62) L.add('salamander', ex, fy);
    else if (r < 0.76) L.add('bat', ex, top);
    else if (r < 0.86) L.add('mole', ex, fy, { kind: 'rock' });
  }
  return L;
}

// 2-1: o primeiro labirinto (só escadas)
function buildLevel4() {
  return buildMine({ seed: 4242, name: 'GALERIAS DE JADE', code: '2-1', music: 'mine1', gem: 0,
    teaser: '2-2 GALERIAS DE RUBI' });
}
// 2-2: galerias longas, poços de saltos de parede, estalactites que caem e rubis nas paredes
function buildLevel5() {
  return buildMine({ seed: 9013, GW: 15, name: 'GALERIAS DE RUBI', code: '2-2', music: 'mine2', gem: 1,
    corridors: 3, shafts: 0.45, stalactites: 0.6, teaser: '2-3 GALERIAS DE DIAMANTE' });
}

// 2-3: o fundo da mina: rios de lava, diamantes, o chefe Morcego e o elevador para a superfície
function buildLevel6() {
  return buildMine({ seed: 31337, GW: 13, name: 'GALERIAS DE DIAMANTE', code: '2-3', music: 'mine3', gem: 2,
    corridors: 2, shafts: 0.3, stalactites: 0.35, lava: 0.4, boss: true });
}
// Arena do Morcego (24 × 11 tiles) à direita da câmara mais funda; à direita da arena, o poço do
// elevador sobe até à estação de cima, onde já entra a luz do deserto.
function buildMineArena(L, o, m) {
  const { AX0, X0, Y0, GW, GH, floorY } = m;
  const FR = Y0(GH - 1) + 7, CR = FR - 12, SX = AX0 + 20;
  for (let tx = AX0 + 1; tx <= AX0 + 24; tx++) for (let ty = CR + 1; ty < FR; ty++) L.set(tx, ty, 'B');
  for (const tx of [X0(GW - 1) + 11, AX0]) for (let ty = Y0(GH - 1) + 3; ty <= Y0(GH - 1) + 6; ty++) L.set(tx, ty, 'B');   // entrada
  for (let tx = SX; tx <= SX + 2; tx++) for (let ty = 4; ty <= CR; ty++) L.set(tx, ty, 'B');                               // poço
  for (let tx = SX - 5; tx <= AX0 + 25; tx++) for (let ty = 1; ty <= 3; ty++) L.set(tx, ty, 'B');                           // estação de cima
  L.add('check', (X0(GW - 1) + 3) * T + 8, floorY(GH - 1));     // farol antes do chefe (o último da lista)
  [2, 3, 4].forEach(k => m.reserved.add(X0(GW - 1) + k));
  const ax0 = (AX0 + 1) * T, ax1 = (AX0 + 25) * T, floor = FR * T, ceil = (CR + 1) * T;
  L.add('batboss', (ax0 + ax1) / 2, ceil + 14, { ax0, ax1, floor, ceil, sx0: SX * T, sx1: (SX + 3) * T });
  L.add('elevator', (SX + 1.5) * T, floor, { top: 4 * T });
  L.hasBoss = true; L.elevator = true;
  L.realmShort = 'DA MINA'; L.savedText = 'A MINA ESTÁ LIVRE!'; L.nextRealm = 'PRÓXIMO REINO: O DESERTO';
  // cascatas de lava ao fundo e brasas: luz para a luta
  for (const k of [4, 12]) {
    L.decos.push({ type: 'lavafall', x: (AX0 + k) * T, top: ceil, floor, seed: k });
    L.lights.push({ x: (AX0 + k) * T + 8, y: floor - 60, r: 84, col: '255,110,30', lava: true });
  }
  L.lights.push({ x: (SX + 1.5) * T, y: 2 * T, r: 120, col: '255,236,190', sun: true });
  L.decos.push({ type: 'daylight', x0: (SX - 5) * T, x1: (AX0 + 26) * T, y0: T, y1: 4 * T });
  for (let k = 0; k < 4; k++) L.decos.push({ type: 'crystal', x: (AX0 + 3 + k * 6) * T, y: ceil + 30 + (k % 2) * 40, side: k % 2 ? -1 : 1, gem: 2, seed: k });
}

// =====================================================================
//  NÍVEL 3-1 — DUNAS DOURADAS (Reino do Deserto)
//  A Avelã sai do elevador da mina no meio do deserto: dunas, cactos, oásis com palmeiras,
//  árvores secas, mesas de arenito (trepa-se) e um looping de pedra.
// =====================================================================
function buildLevel7() {
  const L = new Level(330, 34);
  L.name = 'DUNAS DOURADAS'; L.code = '3-1'; L.realm = 'REINO DO DESERTO'; L.teaser = '3-2 MAR DE AREIA';
  L.music = 'desert1'; L.season = 'desert'; L.sky = ['#1d5fd0', '#7fbff0', '#ffe6a8'];
  const X = tx => tx * T + T / 2, Y = ty => ty * T;
  const acornRow = (a, b, y, step = 1) => { for (let tx = a; tx <= b; tx += step) L.add('acorn', X(tx), y); };
  const arc = (a, b, R, h) => { for (let tx = a; tx <= b; tx++) { const u = (tx - a) / Math.max(1, b - a); L.add('acorn', X(tx), Y(R) - 14 - Math.sin(u * Math.PI) * h); } };
  // duna: sobe h, topo plano, desce h (rampas de 45º)
  const dune = (x0, h, flat, R) => { L.slopeUp(x0, h, R); L.ground(x0 + h, x0 + h + flat - 1, R - h); L.slopeDown(x0 + h + flat, h, R - h); return x0 + 2 * h + flat; };
  // oásis: chão mais fundo com água até à linha do chão
  const pool = (x0, w, R, d) => { for (let tx = x0; tx < x0 + w; tx++) { L.column(tx, R + d); for (let ty = R; ty < R + d; ty++) L.addWater(tx, ty); } };
  // palmeira: tronco 'T' e copa 'L' de 5
  const palm = (tx, R, h) => { for (let ty = R - h + 1; ty <= R - 1; ty++) L.set(tx, ty, 'T'); for (let x = tx - 2; x <= tx + 2; x++) L.set(x, R - h, 'L'); return R - h; };
  // árvore seca: tronco 'Y', ramos 'K' no topo e a meio
  const deadTree = (tx, R, h, side = 1) => {
    for (let ty = R - h + 1; ty <= R - 1; ty++) L.set(tx, ty, 'Y');
    for (let x = tx - 2; x <= tx + 2; x++) L.set(x, R - h, 'K');
    for (let k = 1; k <= 3; k++) L.set(tx + side * k, R - Math.ceil(h / 2), 'K');
    return R - h;
  };
  let R = 26;

  // A — a boca da mina: torre do elevador; a Avelã chega dentro da jaula
  L.ground(0, 45, R);
  for (let tx = 4; tx <= 6; tx++) for (let ty = R; ty <= R + 5; ty++) L.set(tx, ty, 'B');
  L.start = { x: X(5), y: Y(R) };
  L.add('elevator', X(5), Y(R), { top: Y(R), arrive: true, shaftCols: [4, 5, 6], shaftRow: R });
  L.decos.push({ type: 'headframe', x: X(5), y: Y(R), seed: 1 });
  arc(10, 16, R, 18);
  // B — primeiras dunas e cactos nos vales
  let x = dune(18, 2, 3, R);                      // 18..24
  L.add('cactus', X(26), Y(R), { h: 1 });
  arc(18, 24, R - 2, 14);
  x = dune(28, 3, 4, R);                          // 28..37
  acornRow(31, 34, Y(R - 3) - 12);
  L.add('scorpion', X(40), Y(R));
  L.add('cactus', X(43), Y(R), { h: 2 });
  // C — oásis 1, com palmeiras nas margens
  pool(46, 8, R, 2);
  let c = palm(44, R, 5); acornRow(42, 46, Y(c) - 12);
  L.ground(54, 74, R);
  c = palm(56, R, 7); acornRow(54, 58, Y(c) - 12);
  arc(46, 53, R, 30);
  for (let tx = 47; tx <= 52; tx += 2) L.add('acorn', X(tx), Y(R) + 10);    // bolotas dentro de água
  L.add('check', X(60), Y(R));
  // D — árvore seca com um abutre; a avelã dourada 1 no ramo mais alto
  c = deadTree(67, R, 8, -1);
  L.add('vulture', X(67), Y(c), {});
  L.add('golden', X(69), Y(c) - 14, { idx: 0 });
  acornRow(64, 66, Y(R - 4) - 12);
  L.add('rattler', X(72), Y(R));
  // E — mesa de arenito (paredes de casca 'H' para trepar), topo com cacto e escorpião
  for (let tx = 75; tx <= 94; tx++) L.column(tx, R - 6);
  for (let ty = R - 6; ty < R; ty++) L.set(75, ty, 'H');
  L.add('cactus', X(83), Y(R - 6), { h: 1 });
  L.add('scorpion', X(88), Y(R - 6));
  acornRow(77, 81, Y(R - 6) - 12); acornRow(85, 93, Y(R - 6) - 12, 2);
  // F — descida longa da mesa: embalo para o looping de pedra
  L.slopeDown(95, 6, R - 6);                      // 95..100
  L.ground(101, 136, R);
  for (let tx = 95; tx <= 100; tx++) L.add('acorn', X(tx), Y(R - 6 + (tx - 95)) - 4);
  L.loop(116, R);
  L.add('rattler', X(106), Y(R));
  L.add('check', X(128), Y(R));
  L.add('scorpion', X(133), Y(R));
  // G — dunas grandes, cactos e um abutre numa rocha
  x = dune(137, 4, 3, R);                         // 137..147
  L.rock(150, 2, R, 2);
  L.add('vulture', X(150) + 8, Y(R - 2), {});
  L.ground(148, 152, R);
  L.add('cactus', X(154), Y(R), { h: 2 });
  arc(137, 147, R - 4, 16);
  L.ground(153, 157, R);
  // H — oásis grande: a avelã dourada 2 no fundo da água
  pool(158, 12, R, 3);
  c = palm(156, R, 8); acornRow(154, 158, Y(c) - 12);
  L.ground(170, 186, R);
  c = palm(172, R, 6); acornRow(170, 174, Y(c) - 12);
  L.add('golden', X(164), Y(R + 3) - 10, { idx: 1 });
  arc(158, 169, R, 34);
  L.add('rattler', X(180), Y(R));
  L.add('check', X(184), Y(R));
  // I — duas mesas com um vale de cactos e escorpiões; árvore seca no topo da segunda
  for (let tx = 187; tx <= 196; tx++) L.column(tx, R - 4);
  for (let ty = R - 4; ty < R; ty++) L.set(187, ty, 'H');
  L.ground(197, 204, R);
  L.add('cactus', X(199), Y(R), { h: 1 }); L.add('cactus', X(202), Y(R), { h: 2 });
  L.add('scorpion', X(200), Y(R));
  for (let tx = 205; tx <= 222; tx++) L.column(tx, R - 7);
  for (let ty = R - 7; ty < R; ty++) L.set(205, ty, 'H');
  c = deadTree(214, R - 7, 6, 1);
  L.add('vulture', X(214), Y(c), {});
  acornRow(207, 212, Y(R - 7) - 12); acornRow(213, 216, Y(c) - 12);
  L.slopeDown(223, 7, R - 7);                     // 223..229
  for (let tx = 223; tx <= 229; tx++) L.add('acorn', X(tx), Y(R - 7 + (tx - 223)) - 4);
  // J — avelã dourada 3 em cima de uma mesa alta: só se chega pelos ramos de uma árvore seca
  L.ground(230, 262, R);
  c = deadTree(236, R, 11, 1);
  acornRow(234, 238, Y(c) - 12);
  for (let tx = 242; tx <= 249; tx++) { L.column(tx, R - 13); for (let ty = R - 3; ty < R; ty++) L.set(tx, ty, 'B'); }   // túnel na base
  L.add('golden', X(246), Y(R - 13) - 14, { idx: 2 });
  acornRow(243, 245, Y(R - 13) - 12); acornRow(247, 248, Y(R - 13) - 12);
  L.add('rattler', X(254), Y(R)); L.add('scorpion', X(259), Y(R));
  L.add('check', X(262), Y(R));
  // K — últimas dunas e a meta
  x = dune(263, 2, 2, R);                         // 263..268
  L.add('cactus', X(270), Y(R), { h: 1 });
  L.ground(269, 274, R);
  x = dune(275, 3, 5, R);                         // 275..285
  L.add('vulture', X(281), Y(R - 3) - 2, {});
  arc(275, 285, R - 3, 16);
  L.ground(286, 329, R);
  L.add('rattler', X(292), Y(R));
  acornRow(296, 306, Y(R) - 12, 2);
  L.add('goal', X(316), Y(R));
  desertDecorate(L, 777);
  return L;
}

// Decoração do deserto: arbustos secos, pedrinhas, caveiras de vaca, cactos grandes ao fundo e ervas secas.
function desertDecorate(L, seed) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const busy = L.loops.map(l => [l.cx - l.r - 20, l.cx + l.r + 20])
    .concat(L.defs.filter(d => ['check', 'goal', 'elevator', 'cactus', 'rattler'].includes(d.type)).map(d => [d.x - 20, d.x + 20]))
    .concat([[0, 9 * T]]);
  const free = x => !busy.some(([a, b]) => x > a && x < b);
  let lastBig = -999;
  for (let tx = 1; tx < L.cols - 1; tx++) {
    for (let ty = 1; ty < L.rows; ty++) {
      const ch = L.get(tx, ty), up = L.get(tx, ty - 1);
      if (ch !== '#' || up !== '.') continue;
      const x = tx * T + T / 2, y = ty * T, seedN = Math.floor(rnd() * 1e6), r = rnd();
      if (!free(x)) break;
      if (r < 0.06 && tx - lastBig > 14) { L.decos.push({ type: 'saguaro', x, y, h: 3 + Math.floor(rnd() * 3), seed: seedN }); lastBig = tx; }
      else if (r < 0.2) L.decos.push({ type: 'shrub', x, y, seed: seedN });
      else if (r < 0.32) L.decos.push({ type: 'pebbles', x, y, seed: seedN });
      else if (r < 0.35) L.decos.push({ type: 'skull', x, y, seed: seedN });
      else if (r < 0.5) L.decos.push({ type: 'drygrass', x, y, seed: seedN });
      break;
    }
  }
}

// =====================================================================
//  NÍVEL 3-2 — MAR DE AREIA (tempestade de areia)
//  Vento em rajadas e areia no ar; areias movediças; muitas rampas (as que acabam no ar
//  lançam a Avelã) e quatro loopings; pirâmides ao longe. Um nível para correr.
// =====================================================================
function buildLevel8() {
  const L = new Level(712, 52);
  L.name = 'MAR DE AREIA'; L.code = '3-2'; L.realm = 'REINO DO DESERTO'; L.teaser = '3-3 PIRÂMIDE DA COBRA REAL';
  L.music = 'desert2'; L.season = 'desert'; L.sky = ['#b07a50', '#d9a468', '#f0cf96'];
  L.sandstorm = true; L.rampLaunch = true; L.pyramids = true;
  L.bgRefY = 36 * T - VIEW_H;                                  // o fundo fica como num nível de 36 linhas
  L.lights = []; L.dark = true;                                // a escuridão só aparece debaixo de terra (L.darkBelow)
  const X = tx => tx * T + T / 2, Y = ty => ty * T;
  const acornRow = (a, b, y, step = 1) => { for (let tx = a; tx <= b; tx += step) L.add('acorn', X(tx), y); };
  // bolotas em arco (para os saltos das rampas): de a a b, a partir da altura y0, h px acima
  const arc = (a, b, y0, y1, h) => { for (let tx = a; tx <= b; tx++) { const u = (tx - a) / Math.max(1, b - a); L.add('acorn', X(tx), lerp(y0, y1, u) - Math.sin(u * Math.PI) * h); } };
  const pit = (x0, w, R, d = 2) => { for (let tx = x0; tx < x0 + w; tx++) { L.column(tx, R + d); for (let ty = R; ty < R + d; ty++) L.addQuick(tx, ty); } };
  const R = 26;

  // A — planalto, descida e o primeiro looping
  L.ground(0, 14, R - 6);
  L.start = { x: X(3), y: Y(R - 6) };
  acornRow(6, 13, Y(R - 6) - 12);
  L.slopeDown(15, 6, R - 6);
  for (let tx = 15; tx <= 20; tx++) L.add('acorn', X(tx), Y(R - 6 + (tx - 15)) - 4);
  L.ground(21, 38, R);
  L.loop(30, R);
  acornRow(22, 26, Y(R) - 12);
  L.add('scorpion', X(37), Y(R));
  // B — primeira rampa de salto por cima de areia movediça
  L.slopeUp(39, 3, R);
  pit(42, 7, R);
  L.ground(49, 62, R);
  arc(41, 50, Y(R - 3) - 14, Y(R) - 14, 40);
  L.add('cactus', X(54), Y(R), { h: 1 });
  L.add('rattler', X(59), Y(R));
  // C — colina, descida longa e looping lá em baixo
  L.slopeUp(63, 5, R); L.ground(68, 74, R - 5);
  L.add('scorpion', X(71), Y(R - 5));
  acornRow(68, 74, Y(R - 5) - 12, 2);
  L.slopeDown(75, 8, R - 5);
  for (let tx = 75; tx <= 82; tx++) L.add('acorn', X(tx), Y(R - 5 + (tx - 75)) - 4);
  L.ground(83, 100, R + 3);
  L.loop(92, R + 3);
  L.slopeUp(101, 3, R + 3); L.ground(104, 110, R);
  // D — campo de areias movediças com ilhas; um abutre numa rocha
  pit(111, 5, R); L.ground(116, 118, R); pit(119, 5, R); L.ground(124, 126, R); pit(127, 5, R);
  L.rock(125, 1, R, 2);
  L.add('vulture', X(125), Y(R - 2), {});
  arc(110, 117, Y(R) - 14, Y(R) - 14, 34); arc(118, 124, Y(R) - 14, Y(R) - 14, 40); arc(126, 133, Y(R) - 14, Y(R) - 14, 34);
  L.ground(132, 140, R);
  L.add('check', X(135), Y(R));
  // E — rampa grande: a avelã dourada 1 no alto do salto (turbo ou saltar no topo da rampa)
  L.slopeUp(141, 4, R);
  pit(145, 10, R);
  L.ground(155, 163, R);
  arc(144, 156, Y(R - 4) - 14, Y(R) - 14, 60);
  L.add('golden', X(152), Y(R) - 120, { idx: 0 });          // alcança-se com turbo ou a saltar no topo da rampa
  // F — colina e dois loopings seguidos; a avelã dourada 2 no topo do segundo
  L.slopeUp(164, 6, R); L.ground(170, 176, R - 6);
  L.add('scorpion', X(173), Y(R - 6));
  L.slopeDown(177, 6, R - 6);
  for (let tx = 177; tx <= 182; tx++) L.add('acorn', X(tx), Y(R - 6 + (tx - 177)) - 4);
  L.ground(183, 228, R);
  L.loop(192, R); L.loop(206, R);
  L.add('golden', X(206), Y(R) - 104, { idx: 1 });
  L.add('check', X(218), Y(R));
  // G — a rampa mais alta: areia movediça larga (é preciso embalo ou planar)
  L.slopeUp(229, 5, R);
  pit(234, 14, R);
  L.ground(248, 262, R);
  arc(233, 249, Y(R - 5) - 14, Y(R) - 14, 64);
  L.rock(256, 1, R, 2);
  L.add('vulture', X(256), Y(R - 2), {});
  L.add('check', X(260), Y(R));
  // H — descida, looping no fundo e subida
  L.slopeDown(263, 4, R);
  L.ground(267, 290, R + 4);
  L.loop(278, R + 4);
  L.add('rattler', X(288), Y(R + 4));
  L.slopeUp(291, 4, R + 4); L.ground(295, 305, R);
  L.add('scorpion', X(301), Y(R));
  // I — o planalto e o MAR DE AREIA: parece que a planar se chega ao outro lado... mas é só areia movediça
  L.slopeUp(306, 6, R); L.ground(312, 322, R - 6);
  L.add('check', X(315), Y(R - 6));
  acornRow(313, 321, Y(R - 6) - 12, 2);
  const C = R + 6, F = R + 20;                                  // tecto e chão da caverna das ruínas
  for (let tx = 323; tx <= 400; tx++) { L.column(tx, R); for (let ty = R; ty < C; ty++) L.addQuick(tx, ty); }
  L.sinkZone = [323 * T, 401 * T];                              // aqui a areia não morde: engole a Avelã
  for (let k = 0; k < 26; k++) L.add('acorn', X(324 + k * 2), Y(R - 7) + k * 3);   // o "caminho" de bolotas a planar
  for (let tx = 401; tx <= 405; tx++) L.column(tx, R - 10);    // o "outro lado": uma falésia que não se alcança
  L.ground(406, 711, R);
  // a caverna das ruínas, por baixo do mar de areia
  for (let tx = 323; tx <= 706; tx++) for (let ty = C; ty < F; ty++) L.set(tx, ty, 'U');
  L.darkBelow = (R + 5) * T; L.darkAlpha = 0.6; L.musicBelow = 'ruins';
  // chão de areia onde se cai (montes de areia), areia a escorrer do tecto
  L.slopeUp(330, 2, F); L.ground(332, 336, F - 2); L.slopeDown(337, 2, F - 2);
  L.slopeUp(352, 3, F); L.ground(355, 360, F - 3); L.slopeDown(361, 3, F - 3);
  L.slopeUp(378, 2, F); L.ground(380, 384, F - 2); L.slopeDown(385, 2, F - 2);
  for (const x of [334, 357, 382, 396]) { L.decos.push({ type: 'sandfall', x: x * T + 8, top: C * T, bottom: F * T, seed: x }); L.lights.push({ x: x * T + 8, y: C * T + 40, r: 48, col: '255,220,150' }); }
  L.sandfalls = [334, 357, 382, 396].map(x => ({ x: x * T + 8, top: C * T, bottom: F * T }));
  acornRow(340, 350, Y(F) - 12, 2); acornRow(365, 375, Y(F) - 12, 2); acornRow(388, 398, Y(F) - 12, 2);
  L.add('bat', X(368), Y(C)); L.add('bat', X(390), Y(C));
  L.add('check', X(404), Y(F));
  // Ruínas A: colunas partidas, arcos, escaravelhos e a estátua de um esquilo antigo
  const torch = (tx, ty) => { L.decos.push({ type: 'torch', x: X(tx), y: Y(ty), seed: tx }); L.lights.push({ x: X(tx), y: Y(ty) - 4, r: 64, warm: true }); (L.torches = L.torches || []).push({ x: X(tx), y: Y(ty) - 6 }); };
  for (const [tx, h] of [[410, 2], [418, 3], [426, 2]]) for (let ty = F - h; ty < F; ty++) L.set(tx, ty, 'Z');   // colunas partidas
  L.decos.push({ type: 'arch', x0: X(407), x1: X(421), top: Y(F - 9), floor: Y(F), seed: 1 });
  L.decos.push({ type: 'statue', x: X(433), y: Y(F), seed: 2 });
  torch(406, F - 5); torch(422, F - 6); torch(438, F - 5);
  L.add('beetle', X(414), Y(F), { style: 'scarab' }); L.add('beetle', X(430), Y(F), { style: 'scarab' });
  acornRow(411, 417, Y(F) - 40, 2); acornRow(419, 425, Y(F) - 52, 2);
  // Ruínas B: templo com passadiços de pedra, areia movediça e espinhos por baixo; a parede gravada para trepar
  for (let tx = 444; tx <= 452; tx++) L.set(tx, F - 4, 'Z');
  for (let ty = F - 3; ty < F; ty++) { L.set(444, ty, 'Z'); L.set(452, ty, 'Z'); }
  for (let tx = 445; tx <= 451; tx++) { L.column(tx, F + 2); for (let ty = F; ty < F + 2; ty++) L.addQuick(tx, ty); }
  for (let tx = 456; tx <= 464; tx++) L.set(tx, F - 6, 'Z');
  for (let tx = 457; tx <= 463; tx += 2) L.add('bramble', X(tx), Y(F), { style: 'rock' });
  L.add('scorpion', X(460), Y(F - 6));
  L.add('bat', X(449), Y(C)); L.add('bat', X(462), Y(C));
  acornRow(445, 451, Y(F - 4) - 12); acornRow(457, 463, Y(F - 6) - 12, 2);
  for (let ty = F - 10; ty < F; ty++) L.set(470, ty, 'H');                       // parede gravada (trepa-se)
  for (let tx = 471; tx <= 474; tx++) L.set(tx, F - 10, 'Z');                     // e a laje lá em cima
  L.add('golden', X(473), Y(F - 10) - 14, { idx: 2 });
  torch(467, F - 6); torch(477, F - 6);
  L.decos.push({ type: 'arch', x0: X(441), x1: X(455), top: Y(F - 11), floor: Y(F), seed: 3 });
  L.add('check', X(479), Y(F));
  // Ruínas C: o grande salão, com uma rampa de areia e um looping de pedra
  L.slopeUp(482, 6, F); L.ground(488, 496, F - 6); L.slopeDown(497, 6, F - 6);
  L.add('beetle', X(492), Y(F - 6), { style: 'scarab' });
  for (let tx = 497; tx <= 502; tx++) L.add('acorn', X(tx), Y(F - 6 + (tx - 497)) - 4);
  L.loop(514, F);
  L.decos.push({ type: 'statue', x: X(506), y: Y(F), seed: 4 }); L.decos.push({ type: 'statue', x: X(523), y: Y(F), seed: 5 });
  torch(487, F - 9); torch(503, F - 6); torch(526, F - 6);
  L.add('scorpion', X(528), Y(F));
  for (let tx = 532; tx <= 536; tx++) { L.column(tx, F + 2); for (let ty = F; ty < F + 2; ty++) L.addQuick(tx, ty); }
  acornRow(531, 537, Y(F) - 40);
  L.add('check', X(541), Y(F));
  // Ruínas D: ponte de lajes que desabam por cima de um poço largo de areia movediça
  torch(548, F - 6);
  for (let tx = 558; tx <= 575; tx++) { L.column(tx, F + 2); for (let ty = F; ty < F + 2; ty++) L.addQuick(tx, ty); }
  L.crumble(559, 563, F - 3); L.crumble(567, 571, F - 3);
  acornRow(559, 563, Y(F - 3) - 12); acornRow(567, 571, Y(F - 3) - 12);
  L.add('bat', X(565), Y(C)); L.add('bat', X(572), Y(C));
  torch(578, F - 6);
  L.add('beetle', X(585), Y(F), { style: 'scarab' });
  for (let tx = 590; tx <= 592; tx++) L.add('bramble', X(tx), Y(F), { style: 'rock' });
  acornRow(589, 593, Y(F) - 44);
  L.add('check', X(598), Y(F));
  // Ruínas E: escadaria até uma galeria alta, areia a cair, rampa de areia e looping
  for (let k = 0; k < 6; k++) for (let tx = 602 + k * 2; tx <= 603 + k * 2; tx++) L.column(tx, F - 1 - k, 'Z');
  for (let tx = 614; tx <= 630; tx++) L.column(tx, F - 6, 'Z');
  L.add('scorpion', X(622), Y(F - 6));
  acornRow(615, 629, Y(F - 6) - 12, 2);
  L.decos.push({ type: 'sandfall', x: X(626), top: C * T, bottom: (F - 6) * T, seed: 626 }); L.lights.push({ x: X(626), y: C * T + 40, r: 48, col: '255,220,150' });
  L.sandfalls.push({ x: X(626), top: C * T, bottom: (F - 6) * T });
  torch(612, F - 11); torch(628, F - 11);
  L.slopeDown(631, 6, F - 6);
  for (let tx = 631; tx <= 636; tx++) L.add('acorn', X(tx), Y(F - 6 + (tx - 631)) - 4);
  L.loop(646, F);
  L.decos.push({ type: 'statue', x: X(640), y: Y(F), seed: 6 });
  L.add('check', X(655), Y(F));
  // Ruínas F: a câmara do portão, com a meta lá em baixo
  L.decos.push({ type: 'arch', x0: X(662), x1: X(678), top: Y(F - 11), floor: Y(F), seed: 7 });
  L.decos.push({ type: 'arch', x0: X(684), x1: X(700), top: Y(F - 11), floor: Y(F), seed: 8 });
  L.decos.push({ type: 'statue', x: X(681), y: Y(F), seed: 9 }); L.decos.push({ type: 'statue', x: X(703), y: Y(F), seed: 10 });
  torch(660, F - 6); torch(671, F - 8); torch(690, F - 8);
  L.add('beetle', X(668), Y(F), { style: 'scarab' }); L.add('bat', X(676), Y(C));
  for (let tx = 673; tx <= 674; tx++) L.add('bramble', X(tx), Y(F), { style: 'rock' });
  acornRow(684, 696, Y(F) - 12, 2);
  L.add('goal', X(698), Y(F));
  // recheio das ruínas: potes partidos, pedrinhas e ossos pelo chão
  let sd = 4321; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let tx = 323; tx <= 706; tx++) for (let ty = C + 1; ty <= F; ty++) {
    const ch = L.get(tx, ty), up = L.get(tx, ty - 1);
    if (!(ch === '#' || ch === 'Z') || up !== 'U') continue;
    const r = rnd(), x = X(tx), y = Y(ty), seed = Math.floor(rnd() * 1e6);
    if (L.defs.some(d => Math.abs(d.x - x) < 14 && Math.abs(d.y - y) < 20 && d.type !== 'acorn')) break;
    if (r < 0.12) L.decos.push({ type: 'pebbles', x, y, seed }); else if (r < 0.2) L.decos.push({ type: 'pottery', x, y, seed }); else if (r < 0.23) L.decos.push({ type: 'skull', x, y, seed });
    break;
  }
  desertDecorate(L, 888);
  return L;
}

// =====================================================================
//  NÍVEL 3-3 — PIRÂMIDE DA COBRA REAL
//  Começa nas ruínas (continuação do 3-2); uma rampa sobe à superfície e lá em cima é de noite:
//  céu estrelado, lua, oásis ao luar, morcegos nas árvores secas e, no fim, a grande pirâmide.
// =====================================================================
function buildLevel9() {
  const O = 79;                                                // a superfície começa depois da zona subterrânea
  const L = new Level(540, 52);
  L.name = 'PIRÂMIDE DA COBRA REAL'; L.code = '3-3'; L.realm = 'REINO DO DESERTO';
  L.music = 'desert3'; L.musicBelow = 'ruins'; L.season = 'desert'; L.night = true; L.pyramids = true;
  L.sky = ['#070b24', '#162257', '#3a3a72'];
  L.bgRefY = 36 * T - VIEW_H; L.lights = []; L.dark = true;
  const X = tx => tx * T + T / 2, Y = ty => ty * T;
  const R = 26, C = R + 6, F = R + 20;
  L.darkBelow = (R + 5) * T; L.darkAlpha = 0.6;
  const acornRow = (a, b, y, step = 1) => { for (let tx = a; tx <= b; tx += step) L.add('acorn', X(tx), y); };
  const arc = (a, b, y0, y1, h) => { for (let tx = a; tx <= b; tx++) { const u = (tx - a) / Math.max(1, b - a); L.add('acorn', X(tx), lerp(y0, y1, u) - Math.sin(u * Math.PI) * h); } };
  const quick = (x0, w, row) => { for (let tx = x0; tx < x0 + w; tx++) { L.column(tx, row + 2); for (let ty = row; ty < row + 2; ty++) L.addQuick(tx, ty); } };
  const pool = (x0, w, d) => { for (let tx = x0; tx < x0 + w; tx++) { L.column(tx, R + d); for (let ty = R; ty < R + d; ty++) L.addWater(tx, ty); } };
  const palm = (tx, h) => { for (let ty = R - h + 1; ty <= R - 1; ty++) L.set(tx, ty, 'T'); for (let x = tx - 2; x <= tx + 2; x++) L.set(x, R - h, 'L'); return R - h; };
  const deadTree = (tx, base, h, side = 1) => {
    for (let ty = base - h + 1; ty <= base - 1; ty++) L.set(tx, ty, 'Y');
    for (let x = tx - 2; x <= tx + 2; x++) L.set(x, base - h, 'K');
    for (let k = 1; k <= 3; k++) L.set(tx + side * k, base - Math.ceil(h / 2), 'K');
    return base - h;
  };
  const torch = (tx, ty) => { L.decos.push({ type: 'torch', x: X(tx), y: Y(ty), seed: tx }); L.lights.push({ x: X(tx), y: Y(ty) - 4, r: 64, warm: true }); (L.torches = L.torches || []).push({ x: X(tx), y: Y(ty) - 6 }); };
  const sandfall = (tx, top, bottom) => { L.decos.push({ type: 'sandfall', x: X(tx), top, bottom, seed: tx }); L.lights.push({ x: X(tx), y: top + 40, r: 48, col: '255,220,150' }); (L.sandfalls = L.sandfalls || []).push({ x: X(tx), top, bottom }); };
  L.ground(0, 539, R);

  // A — ainda nas ruínas (continuação do 3-2)
  for (let tx = 1; tx <= 140; tx++) for (let ty = C; ty < F; ty++) L.set(tx, ty, 'U');
  L.start = { x: X(4), y: Y(F) };
  torch(3, F - 6); torch(14, F - 7); torch(28, F - 6); torch(41, F - 7); torch(55, F - 6);
  L.decos.push({ type: 'statue', x: X(9), y: Y(F), seed: 11 });
  L.decos.push({ type: 'arch', x0: X(16), x1: X(30), top: Y(F - 11), floor: Y(F), seed: 12 });
  sandfall(21, C * T, F * T);
  L.add('beetle', X(24), Y(F), { style: 'scarab' }); L.add('beetle', X(37), Y(F), { style: 'scarab' });
  quick(31, 5, F);
  acornRow(31, 35, Y(F) - 40);
  L.add('bat', X(39), Y(C));
  for (const [tx, h] of [[44, 2], [49, 3]]) for (let ty = F - h; ty < F; ty++) L.set(tx, ty, 'Z');
  acornRow(45, 48, Y(F) - 44);
  for (const tx of [52, 53]) L.add('bramble', X(tx), Y(F), { style: 'rock' });
  L.add('check', X(57), Y(F));
  // B — monte de areia, descida e um looping de pedra
  L.slopeUp(60, 5, F); L.ground(65, 68, F - 5); L.slopeDown(69, 5, F - 5);
  acornRow(65, 68, Y(F - 5) - 12);
  for (let tx = 69; tx <= 73; tx++) L.add('acorn', X(tx), Y(F - 5 + (tx - 69)) - 4);
  L.add('beetle', X(66), Y(F - 5), { style: 'scarab' });
  L.loop(84, F);
  torch(76, F - 9); torch(93, F - 9);
  L.decos.push({ type: 'statue', x: X(78), y: Y(F), seed: 13 });
  // C — o salão dos guardas: mais bichos antes de voltar à superfície
  L.add('scorpion', X(97), Y(F));
  L.add('bat', X(100), Y(C)); L.add('bat', X(115), Y(C)); L.add('bat', X(131), Y(C));
  L.add('beetle', X(104), Y(F), { style: 'scarab' });
  L.decos.push({ type: 'statue', x: X(107), y: Y(F), seed: 14 });
  L.add('rattler', X(110), Y(F));
  quick(113, 5, F); acornRow(113, 117, Y(F) - 40);
  L.decos.push({ type: 'arch', x0: X(119), x1: X(133), top: Y(F - 11), floor: Y(F), seed: 15 });
  L.add('scorpion', X(121), Y(F));
  for (let ty = F - 2; ty < F; ty++) L.set(125, ty, 'Z');
  sandfall(127, C * T, F * T);
  L.add('beetle', X(129), Y(F), { style: 'scarab' });
  for (const tx of [134, 135]) L.add('bramble', X(tx), Y(F), { style: 'rock' });
  acornRow(133, 136, Y(F) - 44);
  torch(101, F - 6); torch(112, F - 7); torch(124, F - 6); torch(137, F - 7);
  L.add('check', X(138), Y(F));
  // D — a rampa de volta à superfície
  for (let i = 0; i < 20; i++) {
    const tx = 141 + i;
    L.column(tx, F - i); L.set(tx, F - 1 - i, '/');
    for (let ty = F - 6 - i; ty <= F - 2 - i; ty++) L.set(tx, ty, ty < R ? '.' : 'U');
    if (i % 4 === 1) L.add('acorn', X(tx), Y(F - 1 - i) - 6);
  }
  torch(144, F - 6); torch(152, F - 14);
  for (let tx = 146; tx <= 155; tx++) for (let ty = R - 12; ty < R; ty++) L.set(tx, ty, 'Z');   // muralha da cidade antiga: não se volta para trás
  // E — de noite: oásis ao luar
  pool(O + 92, 8, 2);
  let c = palm(O + 90, 6); acornRow(O + 88, O + 92, Y(c) - 12);
  c = palm(O + 101, 5); acornRow(O + 99, O + 103, Y(c) - 12);
  arc(O + 92, O + 99, Y(R), Y(R), 28);
  L.add('scorpion', X(O + 108), Y(R));
  // F — dunas e cactos
  L.slopeUp(O + 112, 2, R); L.ground(O + 114, O + 117, R - 2); L.slopeDown(O + 118, 2, R - 2);
  L.add('cactus', X(O + 121), Y(R), { h: 1 });
  arc(O + 112, O + 119, Y(R - 2) - 12, Y(R - 2) - 12, 16);
  // G — árvore seca com morcegos pendurados nos ramos
  c = deadTree(O + 128, R, 8, 1);
  L.add('bat', X(O + 126), Y(c) + 4); L.add('bat', X(O + 130), Y(c) + 4); L.add('bat', X(O + 130), Y(R - 4) + 4);
  acornRow(O + 126, O + 130, Y(c) - 12);
  L.add('rattler', X(O + 136), Y(R));
  L.add('check', X(O + 140), Y(R));
  // H — colina e looping
  L.slopeUp(O + 143, 4, R); L.ground(O + 147, O + 151, R - 4); L.slopeDown(O + 152, 4, R - 4);
  for (let tx = O + 152; tx <= O + 155; tx++) L.add('acorn', X(tx), Y(R - 4 + (tx - O - 152)) - 4);
  L.loop(O + 164, R);
  L.add('scorpion', X(O + 172), Y(R));
  // I — oásis grande e uma palmeira muito alta (avelã dourada 1 lá em cima)
  pool(O + 181, 12, 3);
  c = palm(O + 179, 10); L.add('golden', X(O + 179), Y(c) - 16, { idx: 0 }); acornRow(O + 177, O + 181, Y(c) - 12);
  c = palm(O + 195, 6); acornRow(O + 193, O + 197, Y(c) - 12);
  arc(O + 181, O + 192, Y(R), Y(R), 36);
  L.add('cactus', X(O + 199), Y(R), { h: 2 });
  // J — mesa de arenito; árvore seca lá em cima com a avelã dourada 2
  for (let tx = O + 205; tx <= O + 226; tx++) L.column(tx, R - 6);
  for (let ty = R - 6; ty < R; ty++) L.set(O + 205, ty, 'H');
  c = deadTree(O + 219, R - 6, 7, -1);
  L.add('golden', X(O + 219), Y(c) - 14, { idx: 1 });
  L.add('bat', X(O + 217), Y(c) + 4);
  L.add('rattler', X(O + 211), Y(R - 6));
  acornRow(O + 207, O + 214, Y(R - 6) - 12, 2);
  L.add('check', X(O + 208), Y(R - 6));
  L.slopeDown(O + 227, 6, R - 6);
  for (let tx = O + 227; tx <= O + 232; tx++) L.add('acorn', X(tx), Y(R - 6 + (tx - O - 227)) - 4);
  L.loop(O + 244, R);
  // K — areias movediças com ilhas
  quick(O + 256, 5, R); quick(O + 264, 5, R); quick(O + 272, 5, R);
  arc(O + 255, O + 262, Y(R) - 14, Y(R) - 14, 34); arc(O + 263, O + 270, Y(R) - 14, Y(R) - 14, 34); arc(O + 271, O + 278, Y(R) - 14, Y(R) - 14, 34);
  L.add('scorpion', X(O + 262), Y(R));
  // L — arco de pedra com túnel (avelã dourada 3 lá em cima) e as últimas dunas
  for (let tx = O + 290; tx <= O + 300; tx++) { L.column(tx, R - 7); for (let ty = R - 3; ty < R; ty++) L.set(tx, ty, 'B'); }
  for (let ty = R - 7; ty <= R - 4; ty++) L.set(O + 290, ty, 'H');
  L.add('golden', X(O + 296), Y(R - 7) - 14, { idx: 2 });
  acornRow(O + 292, O + 300, Y(R - 7) - 12, 2);
  acornRow(O + 291, O + 299, Y(R) - 12, 2);
  L.add('rattler', X(O + 306), Y(R));
  L.slopeUp(O + 312, 3, R); L.ground(O + 315, O + 320, R - 3); L.slopeDown(O + 321, 3, R - 3);
  L.add('cactus', X(O + 327), Y(R), { h: 1 });
  L.add('scorpion', X(O + 340), Y(R));
  L.add('check', X(O + 352), Y(R));
  arc(O + 356, O + 380, Y(R) - 14, Y(R) - 14, 20);
  // M — a grande pirâmide: sobe-se os primeiros degraus, entra-se pelo corredor e desce-se à câmara da Cobra Real
  const P = O + 384;
  for (let k = 0; k < 15; k++) for (let tx = P + 2 * k; tx <= P + 62 - 2 * k; tx++) L.set(tx, R - 1 - k, 'Z');
  for (let tx = P + 8; tx <= P + 16; tx++) for (let ty = R - 7; ty <= R - 5; ty++) L.set(tx, ty, 'U');   // corredor da entrada
  L.decos.push({ type: 'doorway', x: X(P + 8) - 8, y: Y(R - 4), h: 3 * T, seed: 1 });
  for (let k = 0; k < 4; k++) L.add('acorn', X(P + 2 * k), Y(R - 1 - k) - 12);
  torch(P + 11, R - 5); torch(P + 15, R - 5);
  for (let i = 0; i < 16; i++) {                                // túnel a descer para debaixo da pirâmide
    const tx = P + 17 + i, fr = R - 4 + i;
    L.set(tx, fr, '\\');
    for (let ty = fr - 5; ty < fr; ty++) L.set(tx, ty, 'U');
    if (i % 5 === 2) L.add('acorn', X(tx), Y(fr) - 4);
  }
  torch(P + 20, R - 3); torch(P + 28, R + 5);
  const A0 = P + 33, FL = R + 12;                               // câmara da Cobra Real: colunas A0..A0+23, chão na linha FL
  for (let tx = A0; tx <= A0 + 23; tx++) for (let ty = R + 1; ty < FL; ty++) L.set(tx, ty, 'U');
  L.decos.push({ type: 'arch', x0: X(A0 + 2), x1: X(A0 + 10), top: Y(FL - 10), floor: Y(FL), seed: 16 });
  L.decos.push({ type: 'arch', x0: X(A0 + 13), x1: X(A0 + 21), top: Y(FL - 10), floor: Y(FL), seed: 17 });
  L.decos.push({ type: 'statue', x: X(A0 + 1), y: Y(FL), seed: 18 }); L.decos.push({ type: 'statue', x: X(A0 + 22), y: Y(FL), seed: 19 });
  L.decos.push({ type: 'gold', x: X(A0 + 6), y: Y(FL), seed: 20 }); L.decos.push({ type: 'gold', x: X(A0 + 17), y: Y(FL), seed: 21 });
  torch(A0 + 4, FL - 6); torch(A0 + 12, FL - 8); torch(A0 + 19, FL - 6);
  for (let tx = A0 + 24; tx <= A0 + 25; tx++) for (let ty = FL - 3; ty < FL; ty++) L.addFragile(tx, ty);   // parede rachada: só o spin a parte
  for (let tx = A0 + 26; tx <= A0 + 36; tx++) for (let ty = FL - 3; ty < FL; ty++) L.set(tx, ty, 'U');      // a saída da câmara
  torch(A0 + 29, FL - 1); torch(A0 + 35, FL - 1);
  L.add('goal', X(A0 + 33), Y(FL));
  L.add('check', X(P + 10), Y(R - 4));                          // farol "antes do chefe" (o último da lista)
  const ax0 = A0 * T, ax1 = (A0 + 24) * T;
  L.add('cobra', (ax0 + ax1) / 2, FL * T, { ax0, ax1, floor: FL * T });
  L.hasBoss = true;
  L.realmShort = 'DO DESERTO'; L.savedText = 'O DESERTO ESTÁ LIVRE!'; L.nextRealm = 'PRÓXIMO REINO: A SELVA';
  desertDecorate(L, 999);
  return L;
}

// =====================================================================
//  NÍVEL 4-1 — RIO DAS LIANAS (Reino da Selva)
//  Lianas para balançar, troncos a flutuar com a corrente, crocodilos, piranhas, a cascata e o
//  primeiro mergulho (ar limitado e bolhas), uma ravina de lianas e uma sala secreta para o spin.
// =====================================================================
function buildLevel10() {
  const L = new Level(372, 40);
  L.name = 'RIO DAS LIANAS'; L.code = '4-1'; L.realm = 'REINO DA SELVA'; L.teaser = '4-2 TEMPESTADE NAS COPAS';
  L.music = 'jungle1'; L.season = 'jungle'; L.sky = ['#c8e8a0', '#e8f0b8', '#fff4c8'];
  L.sunbeams = true; L.deepWater = true; L.current = 35; L.bgRefY = 34 * T - VIEW_H;
  L.waterfalls = [];
  const X = tx => tx * T + T / 2, Y = ty => ty * T;
  const R = 24;
  const acornRow = (a, b, y, step = 1) => { for (let tx = a; tx <= b; tx += step) L.add('acorn', X(tx), y); };
  const arc = (a, b, y0, y1, h) => { for (let tx = a; tx <= b; tx++) { const u = (tx - a) / Math.max(1, b - a); L.add('acorn', X(tx), lerp(y0, y1, u) - Math.sin(u * Math.PI) * h); } };
  const river = (x0, x1, depth) => { for (let tx = x0; tx <= x1; tx++) { L.column(tx, R + depth); for (let ty = R; ty < R + depth; ty++) L.addWater(tx, ty); } };
  const canopy = (x0, x1, row) => { for (let tx = x0; tx <= x1; tx++) L.set(tx, row, 'L'); };
  const liana = (tx, row, len) => L.add('liana', X(tx), Y(row) + 8, { len });

  // A — clareira: rã, folha-trampolim e uma árvore
  L.ground(0, 31, R);
  L.start = { x: X(3), y: Y(R) };
  L.add('frog', X(13), Y(R), { col: 0 });
  L.add('spring', X(18), Y(R), { style: 'leaf' });
  const c = L.tree(24, R, 'medium'); acornRow(21, 27, Y(c) - 12);
  acornRow(6, 11, Y(R) - 12);
  L.add('plant', X(29), Y(R));
  // B — primeiro rio, com três lianas
  river(32, 52, 6);
  canopy(33, 51, R - 11);
  liana(36, R - 11, 112); liana(42, R - 11, 112); liana(48, R - 11, 112);
  arc(33, 51, Y(R - 3), Y(R - 3), 30);
  L.add('piranha', X(40), Y(R + 3), { x0: X(33), x1: X(51) });
  L.ground(53, 60, R);
  L.add('check', X(57), Y(R));
  // C — rio comprido: troncos a flutuar, crocodilos e piranhas (e duas lianas por cima)
  river(61, 118, 6);
  for (let k = 0; k < 3; k++) L.add('log', X(62) + k * 290, Y(R) + 4, { x0: X(62), x1: X(117), speed: 45 });
  L.add('croc', X(76), Y(R) + 4, { x0: X(70), x1: X(84) });
  L.add('croc', X(104), Y(R) + 4, { x0: X(96), x1: X(110) });
  L.add('piranha', X(66), Y(R + 3), { x0: X(62), x1: X(92) }); L.add('piranha', X(110), Y(R + 3), { x0: X(92), x1: X(117) });
  canopy(84, 102, R - 11); liana(88, R - 11, 112); liana(98, R - 11, 112);
  arc(62, 117, Y(R) - 16, Y(R) - 16, 24);
  L.ground(119, 130, R);
  L.add('check', X(124), Y(R));
  L.add('plant', X(128), Y(R));
  // D — a cascata e o primeiro mergulho: a rocha só se passa por baixo de água
  river(131, 160, 10);
  for (let tx = 146; tx <= 148; tx++) for (let ty = R - 12; ty <= R + 5; ty++) L.set(tx, ty, '#');
  L.waterfalls.push({ x: X(146) - 8 - 16, w: 16, top: Y(R - 12), bottom: Y(R) + 4 });
  L.add('vent', X(139), Y(R + 10)); L.add('vent', X(154), Y(R + 10));
  L.add('golden', X(158), Y(R + 9) - 8, { idx: 0 });
  L.add('piranha', X(154), Y(R + 5), { x0: X(150), x1: X(159) });
  for (let ty = R + 6; ty <= R + 9; ty += 1) L.add('acorn', X(147), Y(ty) + 8);   // bolotas a marcar a passagem
  L.ground(161, 170, R);
  L.add('check', X(165), Y(R));
  // E — a ravina sem fundo: cinco lianas seguidas (avelã dourada 2 em cima da copa)
  canopy(173, 220, R - 12);
  for (const tx of [176, 186, 196, 206, 216]) liana(tx, R - 12, 128);
  arc(171, 223, Y(R - 3), Y(R - 3), 20);
  acornRow(192, 200, Y(R - 12) - 12, 2);
  L.add('golden', X(202), Y(R - 12) - 16, { idx: 1 });
  L.ground(223, 261, R);
  L.add('check', X(228), Y(R));
  // F — selva cerrada: rãs, plantas, folhas-trampolim e uma sala secreta (parede rachada: só o spin a parte)
  L.add('frog', X(234), Y(R), { col: 1 });
  L.add('spring', X(238), Y(R), { style: 'leaf' });
  const c2 = L.tree(245, R, 'medium'); acornRow(242, 248, Y(c2) - 12);
  L.add('plant', X(251), Y(R)); L.add('frog', X(256), Y(R), { col: 2 });
  for (let tx = 262; tx <= 300; tx++) L.column(tx, R - 3);
  for (let tx = 263; tx <= 270; tx++) for (let ty = R - 2; ty < R; ty++) L.set(tx, ty, 'B');
  for (let ty = R - 2; ty < R; ty++) L.addFragile(262, ty, 'B');
  acornRow(264, 269, Y(R) - 12);
  L.add('golden', X(270), Y(R) - 10, { idx: 2 });
  L.add('plant', X(276), Y(R - 3)); L.add('frog', X(286), Y(R - 3), { col: 0 });
  acornRow(279, 284, Y(R - 3) - 12);
  L.add('check', X(296), Y(R - 3));
  L.slopeDown(301, 3, R - 3);
  // G — o último rio: atravessa-se em cima dos crocodilos
  river(304, 344, 6);
  L.add('croc', X(310), Y(R) + 4, { x0: X(306), x1: X(316) });
  L.add('croc', X(324), Y(R) + 4, { x0: X(319), x1: X(330) });
  L.add('croc', X(338), Y(R) + 4, { x0: X(333), x1: X(342) });
  L.add('piranha', X(320), Y(R + 3), { x0: X(305), x1: X(343) });
  arc(304, 344, Y(R) - 16, Y(R) - 16, 20);
  L.ground(345, 371, R);
  acornRow(349, 355, Y(R) - 12);
  L.add('goal', X(362), Y(R));
  decorate(L, 4141);
  return L;
}

// =====================================================================
//  NÍVEL 4-2 — TEMPESTADE NAS COPAS
//  Noite de trovoada. Dois pisos: o chão da selva (R) e, 22 tiles acima, um
//  piso de plataformas de madeira por cima de árvores gigantes (C), com
//  loopings, pontes de corda, tábuas podres e tirolesas. As folhas-mola
//  (algumas atravessam alçapões) levam de baixo para cima; quem cai das
//  copas continua pelo chão.
// =====================================================================
function buildLevel11() {
  const L = new Level(460, 48);
  L.name = 'TEMPESTADE NAS COPAS'; L.code = '4-2'; L.realm = 'REINO DA SELVA'; L.teaser = '4-3 O TEMPLO PERDIDO';
  L.music = 'jungle2'; L.season = 'jungle'; L.sky = ['#0a1024', '#18223e', '#2a3450'];
  L.night = true; L.nightAlpha = 0.34; L.rain = true; L.lightning = true; L.fireflies = true;
  L.lights = []; L.waterfalls = [];
  const X = tx => tx * T + T / 2, Y = ty => ty * T;
  const R = 44, C = 22;
  L.bgRefY = Y(R) - VIEW_H + 40; L.firefliesY = Y(C) + 60;
  const acornRow = (a, b, y, step = 1) => { for (let tx = a; tx <= b; tx += step) L.add('acorn', X(tx), y); };
  const arc = (a, b, y0, y1, h) => { for (let tx = a; tx <= b; tx++) { const u = (tx - a) / Math.max(1, b - a); L.add('acorn', X(tx), lerp(y0, y1, u) - Math.sin(u * Math.PI) * h); } };
  const canopy = (x0, x1, row) => { for (let tx = x0; tx <= x1; tx++) L.set(tx, row, 'L'); };
  const deck = (x0, x1, row) => { for (let tx = x0; tx <= x1; tx++) { L.set(tx, row, 'G'); L.set(tx, row + 1, 'G'); } };
  // árvore gigante a segurar a plataforma: tronco de 3 tiles (trepa-se) e alçapão por cima
  const giant = (tx, row) => { for (let i = 0; i < 3; i++) { for (let ty = row + 1; ty < R; ty++) if (L.get(tx + i, ty) === '.' || ty === row + 1) L.set(tx + i, ty, 'T'); L.set(tx + i, row, 'P'); } };
  const hatch = (tx, row) => { for (let i = -2; i <= 3; i++) { L.set(tx + i, row, 'P'); L.set(tx + i, row + 1, '.'); } };   // alçapão aberto (para as molas)
  const leaf = (tx, row, power) => L.add('spring', X(tx), Y(row), power ? { style: 'leaf', power, vert: true } : { style: 'leaf', vert: true });
  const liana = (tx, row, len) => L.add('liana', X(tx), Y(row) + 8, { len });
  const house = (tx, row) => { L.decos.push({ type: 'treehouse', x: X(tx), y: Y(row) }); L.lights.push({ x: X(tx) + 10, y: Y(row) - 15, r: 54, warm: true }); };
  const zip = (tx0, row0, tx1, row1) => L.add('zipline', X(tx0), Y(row0) - 34, { x1: X(tx1), y1: Y(row1) - 34 });
  const toucan = (tx, row) => L.add('crow', X(tx), Y(row) - 60, { style: 'toucan' });
  const zipAcorns = (tx0, row0, tx1, row1, step = 2) => { for (let tx = tx0 + 3; tx <= tx1 - 2; tx += step) { const u = (tx - tx0) / (tx1 - tx0); L.add('acorn', X(tx), lerp(Y(row0), Y(row1), u) - 34 + 14); } };

  L.ground(0, L.cols - 1, R);
  L.start = { x: X(3), y: Y(R) };

  // ===== CHÃO DA SELVA ===================================================
  // A — clareira: duas folhas-mola em escada levam às copas
  acornRow(5, 9, Y(R) - 12);
  leaf(12, R); canopy(10, 18, R - 11); leaf(16, R - 11);
  acornRow(12, 16, Y(R - 11) - 12);
  L.add('frog', X(26), Y(R), { col: 0 });
  let c = L.tree(34, R, 'medium'); acornRow(31, 37, Y(c) - 12);
  L.add('monkey', X(35), Y(c));
  L.add('plant', X(46), Y(R));
  L.add('check', X(60), Y(R));
  // B — por baixo da ponte: a folha grande atira-nos lá para cima
  leaf(70, R, 830);
  L.add('frog', X(84), Y(R), { col: 1 });
  leaf(96, R); canopy(94, 106, R - 11); leaf(100, R - 11);                // regresso a quem cai das tábuas podres
  L.add('plant', X(108), Y(R));
  acornRow(86, 92, Y(R) - 12);
  // ravina sem fundo: três lianas
  for (let tx = 118; tx <= 139; tx++) for (let ty = R; ty < L.rows; ty++) L.set(tx, ty, '.');
  canopy(117, 140, R - 11);
  liana(123, R - 11, 112); liana(129, R - 11, 112); liana(135, R - 11, 112);
  arc(118, 139, Y(R - 3), Y(R - 3), 22);
  // C — chão debaixo da plataforma baixa
  L.add('check', X(144), Y(R));
  L.add('frog', X(147), Y(R), { col: 2 });
  L.add('plant', X(154), Y(R));
  leaf(160, R, 720);                                                       // atravessa o alçapão da plataforma
  c = L.tree(170, R, 'medium'); L.add('monkey', X(170), Y(c)); acornRow(167, 173, Y(c) - 12);
  // D — colina com uma sala escondida (parede rachada: só o spin a parte)
  leaf(186, R, 880);
  L.add('frog', X(192), Y(R), { col: 0 });
  for (let tx = 196; tx <= 214; tx++) L.column(tx, R - 3);
  for (let tx = 197; tx <= 204; tx++) for (let ty = R - 2; ty < R; ty++) L.set(tx, ty, 'B');
  for (let ty = R - 2; ty < R; ty++) L.addFragile(196, ty, 'B');
  acornRow(198, 203, Y(R) - 12);
  L.add('golden', X(204), Y(R) - 10, { idx: 2 });
  L.add('plant', X(209), Y(R - 3));
  L.slopeDown(215, 3, R - 3);
  L.tree(235, R, 'large', 36);                                             // a árvore mais alta da selva (é dela que pendem as lianas lá de cima)
  L.add('frog', X(228), Y(R), { col: 1 }); L.add('plant', X(242), Y(R));
  // E — aldeia das casas na árvore (em baixo)
  L.add('check', X(250), Y(R));
  leaf(262, R, 830);
  L.add('frog', X(272), Y(R), { col: 2 });
  c = L.tree(282, R, 'medium'); L.add('monkey', X(282), Y(c)); acornRow(279, 285, Y(c) - 12);
  // F — até ao fim: a tirolesa grande traz-nos cá abaixo
  L.add('plant', X(306), Y(R));
  leaf(320, R, 820);
  L.add('frog', X(336), Y(R), { col: 0 });
  acornRow(404, 412, Y(R) - 12);
  L.add('check', X(402), Y(R));
  L.add('frog', X(420), Y(R), { col: 1 });
  acornRow(426, 432, Y(R) - 12);
  L.add('goal', X(444), Y(R));

  // ===== PISO DE CIMA (copas) ============================================
  // U1 — primeira plataforma: casa na árvore, macaco e um looping
  deck(20, 62, C); giant(24, C); giant(40, C); giant(58, C);
  house(30, C);
  L.add('check', X(34), Y(C));
  L.add('monkey', X(44), Y(C));
  acornRow(36, 42, Y(C) - 12, 2);
  L.loop(53, C);
  // ponte de corda
  L.bridge(63, 76, C);
  arc(63, 76, Y(C) - 14, Y(C) - 14, 26);
  // U2 — tábuas podres, tucano e a primeira tirolesa
  deck(77, 89, C); L.crumble(90, 94, C); deck(95, 112, C);
  giant(80, C); giant(106, C); hatch(100, C);
  toucan(98, C);
  L.add('monkey', X(103), Y(C));
  acornRow(78, 88, Y(C) - 12, 2);
  zip(111, C, 142, C + 6); zipAcorns(111, C, 142, C + 6);
  // U3 — plataforma baixa; folha-mola até um ramo lá no alto (avelã dourada)
  deck(136, 177, C + 6); giant(140, C + 6); giant(166, C + 6); hatch(160, C + 6);
  L.add('check', X(147), Y(C + 6));
  L.add('monkey', X(153), Y(C + 6));
  leaf(157, C + 6); canopy(152, 163, C - 7);
  acornRow(153, 162, Y(C - 7) - 12);
  L.add('golden', X(163), Y(C - 7) - 16, { idx: 0 });
  leaf(175, C + 6);                                                      // sobe para a plataforma alta
  // U4 — plataforma alta: looping e tucanos
  deck(179, 222, C - 2); giant(181, C - 2); giant(212, C - 2); hatch(186, C - 2);
  acornRow(190, 196, Y(C - 2) - 12);
  L.loop(202, C - 2);
  toucan(194, C - 2); toucan(216, C - 2);
  L.add('monkey', X(219), Y(C - 2));
  // lianas penduradas da árvore mais alta
  canopy(224, 244, C - 14);
  liana(228, C - 14, 128); liana(238, C - 14, 128);
  arc(223, 244, Y(C - 4), Y(C - 4), 18);
  // U5 — aldeia das casas na árvore
  deck(245, 290, C); giant(252, C); giant(285, C); hatch(262, C);
  L.add('check', X(256), Y(C));
  house(267, C); house(279, C);
  L.add('golden', X(279), Y(C) - 60, { idx: 1 });                       // em cima do telhado
  L.add('monkey', X(273), Y(C));
  toucan(284, C);
  acornRow(258, 264, Y(C) - 12, 2);
  L.bridge(291, 300, C);
  // U6 — dois loopings seguidos e a tirolesa grande até ao chão
  deck(301, 347, C + 2); giant(304, C + 2); giant(338, C + 2); hatch(320, C + 2);
  L.loop(313, C + 2); L.loop(328, C + 2);
  acornRow(306, 309, Y(C + 2) - 12); acornRow(332, 336, Y(C + 2) - 12);
  zip(345, C + 2, 398, R); zipAcorns(345, C + 2, 398, R, 3);

  decorate(L, 4242);
  L.defs = L.defs.filter(d => d.type !== 'butterfly');                    // de noite não há borboletas
  return L;
}

// =====================================================================
//  NÍVEL 4-3 — O TEMPLO PERDIDO (Reino da Selva, com o chefe)
//  Selva ao amanhecer, depois da trovoada: rio com troncos e lianas, ruínas com um looping de
//  pedra e a escadaria do templo. Lá dentro (escuro, archotes): galeria dos dardos, corredor dos
//  esmagadores, a fuga do pedregulho, a câmara inundada, a placa e o portão (spin ou turbo),
//  o salão das panteras e, por fim, a Sala do Sol com o Leão.
// =====================================================================
function buildLevel12() {
  const L = new Level(484, 46);
  L.name = 'O TEMPLO PERDIDO'; L.code = '4-3'; L.realm = 'REINO DA SELVA';
  L.music = 'temple'; L.season = 'jungle'; L.sky = ['#f0a878', '#f8d0a0', '#fff0d0'];
  L.sunbeams = true; L.deepWater = true; L.current = 0; L.lights = []; L.waterfalls = [];
  const X = tx => tx * T + T / 2, Y = ty => ty * T;
  const R = 30, F1 = 22, F2 = 30;
  L.bgRefY = Y(R) - VIEW_H + 30;
  L.dark = true; L.darkAlpha = 0.62; L.darkX = [[X(132), X(451)]]; L.templeWater = [296, 372];
  const acornRow = (a, b, y, step = 1) => { for (let tx = a; tx <= b; tx += step) L.add('acorn', X(tx), y); };
  const arc = (a, b, y0, y1, h) => { for (let tx = a; tx <= b; tx++) { const u = (tx - a) / Math.max(1, b - a); L.add('acorn', X(tx), lerp(y0, y1, u) - Math.sin(u * Math.PI) * h); } };
  const canopy = (x0, x1, row) => { for (let tx = x0; tx <= x1; tx++) L.set(tx, row, 'L'); };
  const liana = (tx, row, len) => L.add('liana', X(tx), Y(row) + 8, { len });
  const fill = (x0, x1, y0, y1, ch) => { for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) L.set(tx, ty, ch); };
  const torch = (tx, ty) => { L.decos.push({ type: 'torch', x: X(tx), y: Y(ty), seed: tx }); L.lights.push({ x: X(tx), y: Y(ty) - 4, r: 64, warm: true }); (L.torches = L.torches || []).push({ x: X(tx), y: Y(ty) - 6 }); };
  const statue = (tx, ty) => L.decos.push({ type: 'statue', x: X(tx), y: Y(ty), seed: tx, moss: true });
  const pool = (x0, x1, y0, y1) => { for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) if (L.get(tx, ty) === 'U' || L.get(tx, ty) === '.') L.addWater(tx, ty); };

  // ===== LÁ FORA: selva ao amanhecer ====================================
  L.ground(0, 125, R);
  L.start = { x: X(3), y: Y(R) };
  // A — clareira: rã, folha-mola até à copa de uma árvore grande, a primeira pantera
  acornRow(5, 10, Y(R) - 12);
  L.add('frog', X(14), Y(R), { col: 1 });
  L.add('spring', X(19), Y(R), { style: 'leaf' });
  let c = L.tree(26, R, 'large'); acornRow(22, 30, Y(c) - 12);
  L.add('monkey', X(30), Y(c));
  L.add('plant', X(33), Y(R));
  L.add('panther', X(40), Y(R), { x0: X(35), x1: X(44) });
  // B — rio com troncos e lianas
  for (let tx = 46; tx <= 75; tx++) { L.column(tx, R + 6); for (let ty = R; ty < R + 6; ty++) L.addWater(tx, ty); }
  for (let k = 0; k < 2; k++) L.add('log', X(47) + k * 240, Y(R) + 4, { x0: X(47), x1: X(74), speed: 40 });
  L.add('croc', X(62), Y(R) + 4, { x0: X(57), x1: X(68) });
  L.add('piranha', X(55), Y(R + 3), { x0: X(47), x1: X(74) });
  canopy(48, 74, R - 11); for (const tx of [52, 58, 64, 70]) liana(tx, R - 11, 112);
  arc(47, 74, Y(R) - 16, Y(R) - 16, 26);
  L.add('check', X(80), Y(R));
  // C — ruínas: colunas partidas, estátuas, um looping de pedra e a escadaria do templo
  fill(84, 84, R - 3, R - 1, 'Z'); fill(87, 87, R - 2, R - 1, 'Z'); fill(90, 90, R - 3, R - 1, 'Z');
  L.add('monkey', X(90), Y(R - 3));
  statue(82, R); statue(93, R);
  L.decos.push({ type: 'arch', x0: X(76), x1: X(81), top: Y(R - 8), floor: Y(R), seed: 7, moss: true });
  acornRow(85, 89, Y(R - 3) - 14, 2);
  L.loop(100, R);
  for (let i = 0; i < 4; i++) fill(108 + i * 4, 125, R - 2 - i * 2, R - 1, 'Z');                      // degraus de 2 tiles
  L.add('monkey', X(113), Y(R - 4)); L.add('frog', X(117), Y(R - 6), { col: 2 });
  acornRow(109, 111, Y(R - 2) - 12); acornRow(113, 115, Y(R - 4) - 12); acornRow(117, 119, Y(R - 6) - 12);
  // terraço (F1) e a fachada com a porta; folha-mola até ao telhado (avelã dourada 1)
  fill(120, 136, F1, L.rows - 1, 'Z');
  L.add('spring', X(122), Y(F1), { style: 'leaf' });
  fill(126, 136, 10, F1 - 5, 'Z'); fill(126, 136, F1 - 4, F1 - 1, 'U');
  acornRow(127, 134, Y(10) - 12);
  L.add('golden', X(135), Y(10) - 14, { idx: 0 });
  fill(125, 125, F1 - 1, F1 - 1, 'Z'); L.add('darttrap', X(125) - 10, Y(F1) - 7, { dir: -1, period: 2.4 });   // altar com uma cara de pedra

  // ===== DENTRO DO TEMPLO ================================================
  fill(137, 483, 0, L.rows - 1, 'Z');
  // D — galeria dos dardos (F1, 8 de altura)
  fill(137, 182, F1 - 8, F1 - 1, 'U');
  L.add('check', X(139), Y(F1));
  torch(141, F1 - 3); torch(152, F1 - 5); torch(163, F1 - 3); torch(176, F1 - 5);
  statue(145, F1); L.decos.push({ type: 'arch', x0: X(148), x1: X(157), top: Y(F1 - 8), floor: Y(F1), seed: 8, moss: true });
  for (const [tx, ph] of [[155, 0], [164, 0.35], [172, 0.7]]) { fill(tx, tx, F1 - 2, F1 - 1, 'Z'); L.add('darttrap', X(tx) - 10, Y(F1) - 7, { dir: -1, period: 2.0, phase: ph }); }
  acornRow(158, 162, Y(F1) - 12); acornRow(166, 170, Y(F1) - 12);
  statue(179, F1);
  // E — corredor dos esmagadores (6 de altura)
  fill(183, 232, F1 - 6, F1 - 1, 'U');
  L.add('check', X(185), Y(F1));
  torch(189, F1 - 3); torch(207, F1 - 3); torch(226, F1 - 3);
  for (const tx of [193, 200, 216, 223]) L.add('crusher', X(tx), Y(F1 - 6), { hw: 16 });
  fill(207, 210, F1 - 16, F1 - 7, 'U');                                                             // poço por cima de um esmagador...
  fill(211, 215, F1 - 16, F1 - 13, 'U');                                                            // ...e um nicho lá em cima (avelã dourada 2)
  L.add('crusher', X(208) + 8, Y(F1 - 12), { hw: 23 });
  acornRow(211, 214, Y(F1 - 12) - 12);
  L.add('golden', X(215), Y(F1 - 12) - 14, { idx: 1 });
  acornRow(196, 197, Y(F1) - 12); acornRow(219, 220, Y(F1) - 12);
  // F — a fuga do pedregulho: corredor sempre a descer (6 de altura)
  for (let tx = 233; tx <= 300; tx++) {
    const f = tx <= 244 ? F1 : tx <= 248 ? F1 + (tx - 245) : tx <= 262 ? F1 + 4 : tx <= 266 ? F1 + 4 + (tx - 263) : F2;
    const slope = (tx >= 245 && tx <= 248) || (tx >= 263 && tx <= 266);
    fill(tx, tx, f - 6, f - 1, 'U');
    if (slope) L.set(tx, f, '\\');
  }
  fill(233, 237, F1 - 13, F1 - 7, 'U');                                                             // buraco no tecto de onde cai o pedregulho
  L.add('check', X(229), Y(F1));
  torch(240, F1 - 4); torch(258, F1); torch(275, F2 - 4); torch(292, F2 - 4);
  fill(255, 256, F1 + 4, F1 + 6, 'U');                                                              // um buraco no chão para saltar
  fill(281, 281, F2 - 1, F2 - 1, 'Z');                                                              // e um degrau
  arc(250, 254, Y(F1 + 4) - 12, Y(F1 + 4) - 12, 8); acornRow(268, 278, Y(F2) - 12, 2); acornRow(284, 296, Y(F2) - 12, 2);
  L.add('boulder', X(235), Y(F1 - 8), { trigX: X(241), endX: X(300) - 6, r: 26 });
  // o fim do corredor: poço para a câmara inundada (o pedregulho desfaz-se na beira)
  fill(301, 304, F2 - 6, F2 + 2, 'U');
  // G — câmara inundada
  fill(297, 371, F2 + 1, 43, 'U');
  fill(319, 324, F2 + 1, F2 + 6, 'Z'); fill(346, 352, F2 + 1, F2 + 7, 'Z');                         // o tecto desce: só se passa a mergulhar
  fill(364, 369, F2, F2, 'U');
  for (let i = 0; i < 4; i++) fill(364 + i * 2, 371, F2 + 3 - i, 43, 'Z');                          // degraus para sair da água
  pool(297, 371, F2 + 3, 43);
  L.add('vent', X(333), Y(44)); L.add('vent', X(358), Y(44)); L.add('vent', X(310), Y(44));
  L.add('piranha', X(330), Y(39), { x0: X(326), x1: X(344) }); L.add('piranha', X(357), Y(40), { x0: X(353), x1: X(363) });
  L.add('golden', X(342), Y(43) + 4, { idx: 2 });
  acornRow(319, 324, Y(F2 + 8) + 4); acornRow(346, 352, Y(F2 + 9) + 4); acornRow(336, 340, Y(42), 2);
  torch(299, F2 + 1); torch(338, F2 + 1); torch(362, F2 + 1);
  // H — a placa e o portão: o portão só fica aberto enquanto se está em cima da placa
  fill(364, 420, F2 - 6, F2 - 1, 'U');
  L.add('check', X(374), Y(F2));
  L.add('plate', X(380), Y(F2), { id: 1 });
  fill(401, 401, F2 - 6, F2 - 4, 'Z'); fill(401, 401, F2 - 3, F2 - 1, 'D');
  L.add('gate', X(401), 0, { id: 1, ty0: F2 - 3, h: 3, closeT: 3.6 });
  torch(378, F2 - 3); torch(390, F2 - 4); torch(410, F2 - 3);
  acornRow(384, 398, Y(F2) - 12, 3);
  statue(417, F2);
  // I — salão das panteras (9 de altura)
  fill(421, 451, F2 - 9, F2 - 1, 'U');
  fill(430, 433, F2 - 5, F2 - 5, 'Z'); L.add('monkey', X(431), Y(F2 - 5));
  L.add('panther', X(428), Y(F2), { x0: X(422), x1: X(437) }); L.add('panther', X(444), Y(F2), { x0: X(438), x1: X(450) });
  torch(424, F2 - 4); torch(437, F2 - 6); torch(448, F2 - 4);
  statue(426, F2); statue(441, F2);
  acornRow(422, 428, Y(F2) - 12, 2); acornRow(431, 432, Y(F2 - 5) - 12);
  L.add('check', X(449), Y(F2));                                                                    // farol "antes do chefe" (o último da lista)
  // Sala do Sol: o tecto abre-se para o céu; varandas dos dois lados
  fill(452, 452, F2 - 3, F2 - 1, 'U');
  fill(453, 480, 0, F2 - 1, '.');
  fill(453, 455, F2 - 5, F2 - 5, 'Z'); fill(478, 480, F2 - 5, F2 - 5, 'Z');
  statue(457, F2); statue(476, F2);
  const ax0 = 453 * T, ax1 = 481 * T;
  L.add('lion', X(474), Y(F2), { ax0, ax1, floor: Y(F2), ceil: Y(F2) - 230 });
  L.hasBoss = true;
  L.realmShort = 'DA SELVA'; L.savedText = 'A SELVA ESTÁ LIVRE!'; L.nextRealm = 'PRÓXIMO REINO: A PRAIA';
  decorate(L, 4343);
  return L;
}

// =====================================================================
//  NÍVEL 5-1 — PRAIA DAS CONCHAS (Reino da Praia)
//  Metade no areal (o mar ao fundo, dunas, ravinas, bolas de praia, castelos de areia, o posto do
//  nadador-salvador, uma poça de maré e um passadiço), uma descida de prancha de surf pelas ondas e a
//  outra metade debaixo de água: alforrecas, baiacus, o barco afundado dos esquilos antigos, um túnel
//  de coral com corrente forte, uma fossa funda e, no fim, um ilhéu com um farol.
// =====================================================================
function buildLevel13() {
  const L = new Level(610, 64);
  L.name = 'PRAIA DAS CONCHAS'; L.code = '5-1'; L.realm = 'REINO DA PRAIA'; L.teaser = '5-2 RECIFE DE CORAL';
  L.music = 'beach1'; L.season = 'beach'; L.sky = ['#3a9ae8', '#86ccff', '#d8f4ff'];
  L.deepWater = true; L.current = 0; L.tank = true; L.lights = []; L.waterfalls = [];
  const X = tx => tx * T + T / 2, Y = ty => ty * T;
  const R = 30, S = 32;
  L.seaY = Y(S); L.seaFrom = 205; L.surfEnd = X(335);
  L.musicAfter = 'sea1'; L.musicAfterX = X(335);                              // a música do mar começa no mergulho e fica
  L.bgRefY = Y(R) - VIEW_H + 40;
  const acornRow = (a, b, y, step = 1) => { for (let tx = a; tx <= b; tx += step) L.add('acorn', X(tx), y); };
  const arc = (a, b, y0, y1, h) => { for (let tx = a; tx <= b; tx++) { const u = (tx - a) / Math.max(1, b - a); L.add('acorn', X(tx), lerp(y0, y1, u) - Math.sin(u * Math.PI) * h); } };
  const fill = (x0, x1, y0, y1, ch) => { for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) L.set(tx, ty, ch); };
  const bed = (x0, x1, row) => { for (let tx = x0; tx <= x1; tx++) { fill(tx, tx, 0, row - 1, '.'); L.column(tx, row); } };
  const ball = (tx, col = 0) => L.add('beachball', X(tx), Y(R), { col });
  const big = (tx, row = R, power) => L.add('bigball', X(tx), Y(row), power ? { power } : {});
  const umbrella = (tx, col) => L.decos.push({ type: 'umbrella', x: X(tx), y: Y(R), col, seed: tx });
  const kelp = (tx, row, h) => L.add('kelp', X(tx), Y(row), { h });

  // ===== O AREAL ===========================================================
  L.ground(0, 204, R);
  L.start = { x: X(3), y: Y(R) };
  // A — chapéus de sol, a primeira bola e um castelo de areia
  umbrella(8, 0); L.decos.push({ type: 'towel', x: X(11), y: Y(R), col: 1 }); L.decos.push({ type: 'bucket', x: X(17), y: Y(R), seed: 3 });
  acornRow(5, 10, Y(R) - 12);
  ball(13, 0);
  L.add('sandcastle', X(22), Y(R)); arc(18, 26, Y(R) - 14, Y(R) - 14, 30);
  L.add('crab', X(32), Y(R), { x0: X(26), x1: X(39) });
  // B — a duna: bola gigante lá em cima, uma bola pequena que rola pela areia abaixo
  let top = L.slopeUp(42, 5, R); L.ground(47, 56, top); L.slopeDown(57, 5, top);
  big(51, top, 660); for (let k = 0; k < 6; k++) L.add('acorn', X(51), Y(top) - 60 - k * 22);
  ball(55, 1);
  umbrella(66, 2); L.add('crab', X(71), Y(R), { x0: X(64), x1: X(79) });
  acornRow(63, 68, Y(R) - 12);
  // C — ravina sem fundo entre rochas (bola gigante antes, para quem quiser voar)
  big(81, R, 620);
  fill(84, 85, R, R + 4, 'R'); fill(93, 94, R, R + 4, 'R');
  fill(86, 92, R, L.rows - 1, '.');
  arc(84, 94, Y(R) - 14, Y(R) - 14, 44);
  // D — o posto do nadador-salvador (com uma gaivota no telhado), bolas e um caranguejo para derrubar
  L.add('check', X(103), Y(R));
  L.decos.push({ type: 'tower', x: X(113), y: Y(R), h: 48 }); L.set(111, R - 3, 'P'); L.set(112, R - 3, 'P'); L.set(113, R - 3, 'P'); L.set(114, R - 3, 'P'); L.set(115, R - 3, 'P');
  L.add('vulture', X(113), Y(R) - 62, { style: 'gull' });
  acornRow(111, 115, Y(R - 3) - 12);
  ball(120, 0); ball(124, 1);
  L.add('crab', X(132), Y(R), { x0: X(127), x1: X(138) });
  L.add('sandcastle', X(139), Y(R));
  // E — poça de maré numa ravina, com um passadiço por cima (partido a meio)
  fill(146, 161, R, 37, '.'); fill(144, 145, R, 37, 'R'); fill(162, 163, R, 37, 'R');
  fill(158, 161, 35, 37, 'R'); fill(160, 161, 33, 34, 'R');                      // degraus para sair da poça
  for (let tx = 146; tx <= 161; tx++) for (let ty = S; ty <= 37; ty++) if (L.get(tx, ty) === '.') L.addWater(tx, ty);
  for (let tx = 141; tx <= 168; tx++) if (tx < 152 || tx > 155) L.set(tx, R - 3, 'G');
  for (const px of [142, 147, 150, 157, 161, 166]) L.decos.push({ type: 'post', x: X(px), y: Y(px >= 146 && px <= 161 ? 38 : R), h: (px >= 146 && px <= 161 ? 38 : R) * T - Y(R - 2) });
  L.add('crab', X(150), Y(38), { x0: X(147), x1: X(156) });
  L.add('golden', X(148), Y(38) - 12, { idx: 0 });
  acornRow(149, 156, Y(36), 2); acornRow(142, 150, Y(R - 3) - 12, 2); acornRow(156, 166, Y(R - 3) - 12, 2);
  // F — três bolas gigantes seguidas e a descida para o mar
  L.add('check', X(172), Y(R));
  big(180); big(189); big(198);
  arc(180, 189, Y(R) - 50, Y(R) - 50, 110); arc(189, 198, Y(R) - 50, Y(R) - 50, 110);
  umbrella(176, 1); L.add('sandcastle', X(185), Y(R)); L.add('sandcastle', X(194), Y(R));
  L.add('check', X(201), Y(R));
  L.slopeDown(205, 4, R);

  // ===== O MAR ===============================================================
  bed(209, 214, 36);
  // a descida de prancha: ondas-rampa, bóias, rochas, uma gaivota num poste e golfinhos
  bed(215, 340, 46);
  L.add('surfboard', X(210), Y(S) + 4);
  acornRow(214, 226, Y(S) - 10);
  // (sem armadilhas ao nível da água: o surf é para aproveitar)
  L.add('waveramp', X(228), Y(S) + 4, { power: 600 }); arc(229, 255, Y(S) - 10, Y(S) - 10, 190);
  L.add('dolphin', X(232), Y(S) + 4, { delay: 0.5 });
  acornRow(257, 264, Y(S) - 10);
  L.add('waveramp', X(266), Y(S) + 4, { power: 560 }); arc(267, 292, Y(S) - 10, Y(S) - 10, 170);
  L.add('dolphin', X(272), Y(S) + 4, { delay: 1.2 });
  L.decos.push({ type: 'post', x: X(296), y: Y(46), h: Y(46) - Y(29) });
  acornRow(294, 300, Y(S) - 10);
  L.add('waveramp', X(302), Y(S) + 4, { power: 640 }); arc(303, 329, Y(S) - 10, Y(S) - 10, 205);
  L.add('golden', X(316), Y(S) - 236, { idx: 1 });
  L.add('dolphin', X(310), Y(S) + 4, { delay: 1.5 });
  L.add('bigwave', X(339), Y(S) + 4);
  // G — o primeiro mergulho: floresta de algas, alforrecas e ouriços
  bed(341, 380, 50);
  L.add('check', X(343), Y(50));
  fill(350, 352, 42, 49, 'R'); fill(368, 370, 44, 49, 'R');
  L.add('urchin', X(351), Y(42)); L.add('urchin', X(369), Y(44));
  for (const [tx, h] of [[341, 70], [345, 90], [357, 80], [362, 60], [375, 95], [379, 70]]) kelp(tx, 50, h);
  L.add('jelly', X(347), Y(42), { range: 28 }); L.add('jelly', X(360), Y(40), { range: 34 }); L.add('jelly', X(376), Y(43), { range: 30 });
  L.add('vent', X(364), Y(50));
  acornRow(353, 366, Y(46), 2);
  // H — o barco afundado dos esquilos antigos (bolsa de ar lá dentro, avelã dourada 3)
  bed(381, 440, 52);
  fill(400, 424, 51, 51, 'G'); fill(398, 426, 50, 50, 'G');
  fill(396, 397, 46, 49, 'G'); fill(427, 428, 46, 49, 'G'); fill(396, 428, 45, 45, 'G');
  fill(418, 420, 45, 45, '.'); fill(396, 397, 47, 48, '.');                      // buraco no convés e rombo na proa
  L.decos.push({ type: 'shipwreck', mx: X(412), my: Y(45), mh: 150, fx: 396 * T - 30, fy: Y(45) - 12,
    hull: { x0: 396 * T, x1: 429 * T, deck: Y(45), keel: Y(52) }, portholes: [] });
  L.add('puffer', X(410), Y(48), { x0: X(401), x1: X(424) });
  L.add('golden', X(423), Y(50) - 10, { idx: 2 });
  acornRow(400, 416, Y(48) + 4, 2);
  L.add('clam', X(436), Y(52));
  L.add('puffer', X(388), Y(44), { x0: X(383), x1: X(394) });
  for (const [tx, h] of [[384, 70], [392, 60], [432, 80], [439, 60]]) kelp(tx, 52, h);
  // I — o túnel de coral: uma corrente fortíssima leva a Avelã a toda a velocidade
  bed(441, 505, 52);
  L.add('check', X(444), Y(52));
  L.add('vent', X(448), Y(52));
  fill(455, 500, 31, 41, 'R'); fill(455, 500, 47, 51, 'R');
  L.currents = [{ x0: X(451), x1: X(503), y0: Y(42), y1: Y(47), vx: 300 }];
  acornRow(456, 499, Y(44) + 8, 2);
  for (const tx of [466, 480, 492]) L.add('urchin', X(tx), Y(47));
  for (const tx of [473, 486]) L.add('urchin', X(tx), Y(42), { down: true });
  L.add('crab', X(476), Y(31), { x0: X(458), x1: X(497) });                     // lá em cima da rocha, para quem fugir ao túnel
  // J — a fossa
  bed(506, 532, 60); bed(533, 537, 56); bed(538, 542, 52); bed(543, 548, 48);
  L.add('check', X(503), Y(52));
  L.add('vent', X(519), Y(60));
  L.add('puffer', X(520), Y(55), { x0: X(509), x1: X(530) });
  L.add('crab', X(512), Y(60), { x0: X(507), x1: X(518) }); L.add('crab', X(527), Y(60), { x0: X(522), x1: X(531) });
  L.add('jelly', X(540), Y(46), { range: 26 }); L.add('jelly', X(546), Y(40), { range: 30 });
  for (const [tx, h] of [[508, 90], [515, 110], [524, 100], [531, 80]]) kelp(tx, 60, h);
  L.add('clam', X(535), Y(56));
  arc(507, 531, Y(54), Y(54), -30);
  // K — o ilhéu do farol: sobe-se a rampa de areia para fora de água
  top = L.slopeUp(549, 18, 48); L.ground(567, L.cols - 1, top);
  L.tree(573, top, 'medium');
  L.decos.push({ type: 'lighthouse', x: X(593), y: Y(top) });
  acornRow(567, 571, Y(top) - 12);
  L.add('goal', X(585), Y(top));

  // a água do mar enche tudo o que está aberto abaixo da superfície (menos a bolsa de ar do barco)
  for (let tx = L.seaFrom; tx < L.cols; tx++) for (let ty = S; ty < L.rows; ty++) {
    if (L.get(tx, ty) !== '.') continue;
    if (ty === 46 && tx >= 400 && tx <= 410) continue;
    L.addWater(tx, ty);
  }
  beachDecorate(L, 5151, S);
  return L;
}

// Decoração da praia: conchas, estrelas-do-mar e baldes no areal; corais e ervas no fundo do mar
function beachDecorate(L, seed, S) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const busy = L.defs.filter(d => ['check', 'goal', 'bigball', 'sandcastle', 'surfboard'].includes(d.type)).map(d => [d.x - 20, d.x + 20]);
  const free = x => !busy.some(([a, b]) => x > a && x < b);
  for (let tx = 1; tx < L.cols - 1; tx++) {
    let ty = 0; while (ty < L.rows && !(L.get(tx, ty) === '#' && (L.get(tx, ty - 1) === '.' || L.get(tx, ty - 1) === 'W'))) ty++;
    if (ty >= L.rows) continue;
    const x = tx * T + T / 2, y = ty * T, seedN = Math.floor(rnd() * 1e6), r = rnd();
    if (!free(x)) continue;
    if (ty < S) { if (r < 0.1) L.decos.push({ type: 'shell', x, y, seed: seedN }); else if (r < 0.16) L.decos.push({ type: 'starfish', x, y, seed: seedN }); else if (r < 0.2) L.decos.push({ type: 'grass', x, y, seed: seedN }); }
    else { if (r < 0.16) L.decos.push({ type: 'coral', x, y, seed: seedN }); else if (r < 0.32) L.decos.push({ type: 'seagrass', x, y, seed: seedN }); else if (r < 0.38) L.decos.push({ type: 'shell', x, y, seed: seedN }); else if (r < 0.42) L.decos.push({ type: 'starfish', x, y, seed: seedN }); }
  }
}

const LEVELS = [buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildLevel5, buildLevel6, buildLevel7, buildLevel8, buildLevel9, buildLevel10, buildLevel11, buildLevel12, buildLevel13];
if (DEMO) LEVELS.length = 3;                                       // demo: só o Reino do Bosque

// =====================================================================
//  Decoração automática: percorre as superfícies de terra e espalha
//  pedras, arbustos, flores, cogumelos, fetos, tocos, troncos caídos,
//  trepadeiras nas falésias e borboletas. Determinística (semente).
// =====================================================================
function decorate(L, seed) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const busy = L.loops.map(l => [l.cx - l.r - 20, l.cx + l.r + 20])
    .concat(L.defs.filter(d => ['check', 'goal', 'spring', 'mole', 'boss'].includes(d.type)).map(d => [d.x - 18, d.x + 18]));
  const free = x => !busy.some(([a, b]) => x > a && x < b);
  let lastBig = -999;
  for (let tx = 1; tx < L.cols - 1; tx++) {
    for (let ty = 1; ty < L.rows; ty++) {
      const ch = L.get(tx, ty), up = L.get(tx, ty - 1);
      if (ch !== '#' || (up !== '.' && up !== 'T')) continue;
      const x = tx * T + T / 2, y = ty * T, seedN = Math.floor(rnd() * 1e6);
      // trepadeira a cair pela face de uma falésia
      for (const side of [-1, 1]) {
        if (L.get(tx + side, ty) === '.' && L.get(tx + side, ty + 1) === '.' && L.get(tx + side, ty + 2) === '.' && rnd() < 0.55)
          L.decos.push({ type: 'vine', x: side < 0 ? tx * T - 1 : (tx + 1) * T, y, len: 20 + Math.floor(rnd() * 40), seed: seedN });
      }
      if (up === 'T') { if (rnd() < 0.5) L.decos.push({ type: 'mushrooms', x: x + (rnd() < 0.5 ? -12 : 12), y, seed: seedN }); break; }
      if (!free(x) || SLOPE[L.get(tx - 1, ty - 1)] || SLOPE[L.get(tx + 1, ty - 1)]) break;
      const r = rnd();
      const big = (type, extra = {}) => { if (x - lastBig > 56) { L.decos.push(Object.assign({ type, x, y, seed: seedN }, extra)); lastBig = x; } };
      if (r < 0.11) L.decos.push({ type: 'grass', x, y, seed: seedN });
      else if (r < 0.18) { L.decos.push({ type: 'flowers', x, y, seed: seedN }); if (rnd() < 0.25) L.add('butterfly', x, y - 30); }
      else if (r < 0.23) L.decos.push({ type: 'rock', x, y, size: 0, seed: seedN });
      else if (r < 0.265) big('rock', { size: 1 });
      else if (r < 0.30) big('bush', { berries: rnd() < 0.4 });
      else if (r < 0.325) L.decos.push({ type: 'mushrooms', x, y, seed: seedN });
      else if (r < 0.38) L.decosFront.push({ type: 'fern', x, y, seed: seedN });
      else if (r < 0.395) big('stump');
      else if (r < 0.405) big('boulder');
      else if (r < 0.413) big('log');
      break;   // só a superfície de cima de cada coluna
    }
  }
  // chão dos túneis: cogumelos que brilham e pedrinhas
  for (let ty = 1; ty < L.rows; ty++) for (let tx = 1; tx < L.cols - 1; tx++) {
    if (L.get(tx, ty) !== '#' || L.get(tx, ty - 1) !== 'B') continue;
    const r = rnd(), x = tx * T + T / 2, y = ty * T, seedN = Math.floor(rnd() * 1e6);
    if (r < 0.16) L.decos.push({ type: 'glow', x, y, seed: seedN });
    else if (r < 0.24) L.decos.push({ type: 'rock', x, y, size: 0, seed: seedN });
  }
}
