'use strict';
// =====================================================================
//  Gráficos do cenário: céu, paralaxe, tiles pré-desenhados, loopings,
//  pontes, tábuas e partículas. (Sprites em sprites.js)
// =====================================================================
// Paletas por estação (o nível escolhe com L.season)
const PALETTES = {
  summer: {
    grass: ['#4cc94c', '#8ef07a', '#2f8f3a'], flower: '#ffd84a',
    canopies: [['#1f5a2c', '#2f7d3a', '#3fa34d', '#5cc25a', '#9be37a']],
    mountains: ['#6a78d6', '#8f9cf0'], hills: ['#2e9a5e', '#3fb36d'], treeline: '#257f4c', pines: ['#1b5e3b', '#14472c'],
    forest: ['#4d6f72', '#5b8f80', '#6fa391'],
    bush: ['#2f7d3a', '#3fa34d', '#5cc25a', '#6fd36a', '#24602d'], fern: ['#2f8f3a', '#5cc25a'], vine: ['#2f7d3a', '#3fa34d', '#6fd36a'],
  },
  autumn: {
    grass: ['#b3a53a', '#e2d36a', '#7a7024'], flower: '#ff9a3a',
    canopies: [['#6e1f12', '#a8321a', '#d9542a', '#f0803a', '#ffc07a'], ['#7a3a10', '#b55a1a', '#e07f2a', '#f5a53a', '#ffd27a'],
      ['#6e5210', '#a8801a', '#d9a92a', '#f2cc45', '#fff09a']],
    mountains: ['#8a74b8', '#a993d0'], hills: ['#a8863a', '#c9a54a'], treeline: '#8a5a2a', pines: ['#7a3a1a', '#5a2a14'],
    forest: ['#6b5048', '#b5784a', '#d39b62'],
    bush: ['#8a3a1a', '#b5571f', '#d9842a', '#f0a840', '#6e2c12'], fern: ['#9a5a1a', '#c98a3a'], vine: ['#7a5a1a', '#a8701f', '#d9a02a'],
  },
};

PALETTES.desert = Object.assign({}, PALETTES.summer, {
  grass: ['#f7d27e', '#ffe9a8', '#d9a650'], flower: '#ff7aa8',
  canopies: [['#1f6a3a', '#2f8a44', '#46a84e', '#6cc45a', '#a8e07a']],
  bush: ['#8a6a3a', '#a8844a', '#c9a060', '#d9b878', '#6e5230'], fern: ['#a8844a', '#c9a060'], vine: ['#8a6a3a', '#a8844a', '#c9a060'],
});
PALETTES.jungle = Object.assign({}, PALETTES.summer, {
  grass: ['#2f9a3a', '#6fd35a', '#1d5a26'], flower: '#ff4fa0',
  canopies: [['#0f3a1e', '#1a5a2a', '#2a7a34', '#3f9a3a', '#7ad65a'], ['#123e22', '#1f6430', '#2f8a3a', '#4aa844', '#8ae06a']],
  bush: ['#1f6a2a', '#2f8a3a', '#4aa844', '#6fd35a', '#155a22'], fern: ['#1f7a2a', '#4aa844'], vine: ['#1f6a2a', '#2f8a3a', '#6fd35a'],
});
PALETTES.beach = Object.assign({}, PALETTES.desert, {
  grass: ['#f8e4a8', '#fff4d0', '#e8c880'], flower: '#ff7aa8',
  bush: ['#6a9a4a', '#8ab85a', '#a8d070', '#c0e088', '#4a7a3a'], fern: ['#6a9a4a', '#a8d070'], vine: ['#6a9a4a', '#8ab85a', '#a8d070'],
});
PALETTES.mine = Object.assign({}, PALETTES.summer, {
  bush: ['#3a3430', '#4b4540', '#5f574f', '#6b625a', '#2a2420'], fern: ['#4b4540', '#6b625a'], vine: ['#3a3430', '#4b4540', '#6b625a'],
});

const Gfx = {
  tileCanvas: null,
  skyGrad: null,
  pal: PALETTES.summer,

  // ---------------- tiles estáticos (pré-desenho) ----------------
  buildTiles(L) {
    this.pal = PALETTES[L.season] || PALETTES.summer;
    const c = document.createElement('canvas');
    c.width = L.width; c.height = L.height;
    const g = c.getContext('2d');
    const colTop = [];
    for (let tx = 0; tx < L.cols; tx++) {
      let top = L.rows;
      for (let ty = 0; ty < L.rows; ty++) { const ch = L.get(tx, ty); if ((SOLID[ch] && ch !== 'R' && ch !== 'G' && !(ch === 'Z' && L.season === 'jungle')) || SLOPE[ch]) { top = ty; break; } }
      colTop[tx] = top;
    }
    const SOIL = ['#a0612b', '#93572a', '#844d26', '#734322', '#683d20', '#5e381e'];
    const open = ch => !(SOLID[ch] || SLOPE[ch]);
    this.mine = !!L.underground; this.beach = L.season === 'beach'; this.desert = L.season === 'desert' || this.beach; this.jungle = L.season === 'jungle';
    const SAND = this.beach ? ['#f8dc98', '#f0d088', '#e6c27a', '#d8b06a', '#c49c5c', '#ae8850']   // areia da praia, mais clara
      : ['#f0c870', '#e6b85e', '#d9a650', '#c99245', '#b47e3c', '#9c6a34'];
    if (this.desert) SOIL.splice(0, SOIL.length, ...SAND);
    for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.cols; tx++) {
      const ch = L.get(tx, ty);
      const px = tx * T, py = ty * T;
      const depth = Math.max(0, ty - colTop[tx]);
      const soil = SOIL[Math.min(SOIL.length - 1, depth)];
      if (ch === 'B') this.cave(g, px, py, tx, ty);
      else if (ch === 'E') { this.cave(g, px, py, tx, ty); this.ladder(g, L, px, py, tx, ty); }
      else if (ch === 'P' && L.season === 'jungle') this.hatch(g, L, px, py, tx, ty);
      else if (ch === 'P' && this.beach) this.plank(g, L, px, py, tx, ty);
      else if (ch === 'W' && L.seaFrom !== undefined && tx >= L.seaFrom) { /* mar: transparente, vê-se o fundo do mar */ }
      else if (ch === 'P') { this.cave(g, px, py, tx, ty); this.plank(g, L, px, py, tx, ty); }
      else if (ch === 'V' || L.lava.has(L.idx(tx, ty))) { g.fillStyle = '#2a0e06'; g.fillRect(px, py, T, T); }   // poço da lava (a lava anima-se em cima)
      else if (ch === 'U' || ch === 'D' || ch === 'd') this.ruinWall(g, px, py, tx, ty);
      else if (ch === 'G') this.woodDeck(g, L, px, py, tx, ty);
      else if (ch === 'F') { const fr = L.fragile.find(f => f.tx === tx && f.ty === ty); if (fr && fr.bg === 'B') this.cave(g, px, py, tx, ty); else this.ruinWall(g, px, py, tx, ty); }   // por trás da parede rachada
      else if (ch === 'Z') this.ruinBlock(g, L, px, py, tx, ty);
      else if (ch === 'Q') {                              // areia movediça (desenhada também por cima da Avelã)
        const top = L.get(tx, ty - 1) !== 'Q';
        g.fillStyle = '#c8964e'; g.fillRect(px, py + (top ? 3 : 0), T, T - (top ? 3 : 0));
        for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#b07e3e' : '#dcae66'; g.beginPath(); g.ellipse(px + 4 + k * 4, py + 7 + (k % 2) * 4, 3, 1, 0, 0, 7); g.fill(); }
      }
      else if (ch === 'W' && L.templeWater && tx >= L.templeWater[0] && tx <= L.templeWater[1]) this.ruinWall(g, px, py, tx, ty);   // câmara inundada do templo
      else if (ch === 'W') {                              // fundo do oásis: areia molhada (a água desenha-se por cima)
        const top = L.get(tx, ty - 1) !== 'W';
        g.fillStyle = '#b8925a'; g.fillRect(px, py + (top ? 4 : 0), T, T - (top ? 4 : 0));
        for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#a8824e' : '#c8a26a'; g.fillRect(px + Math.floor(hash2(tx * 3 + k, ty) * 13), py + 5 + k * 4, 3, 1); }
        if (hash2(tx * 7, ty) > 0.7) { g.fillStyle = '#5a9a4a'; g.fillRect(px + 6, py + T - 6, 1, 6); g.fillRect(px + 8, py + T - 4, 1, 4); }   // algas
      }
      else if (ch === '#' && this.mine) {
        this.mineRock(g, px, py, tx, ty);
        if (L.get(tx, ty - 1) === 'B' || L.get(tx, ty - 1) === 'E') this.caveFloor(g, px, py, tx, ty, () => 0);
        if (open(L.get(tx - 1, ty))) { g.fillStyle = '#2a2420'; g.fillRect(px, py, 1, T); }
        if (open(L.get(tx + 1, ty))) { g.fillStyle = '#2a2420'; g.fillRect(px + T - 1, py, 1, T); }
      } else if (ch === '#') {
        g.fillStyle = soil; g.fillRect(px, py, T, T);
        this.soilDetail(g, px, py, tx, ty, depth);
        const edge = this.desert ? '#a8763a' : '#5a3416';
        if (open(L.get(tx - 1, ty))) { g.fillStyle = edge; g.fillRect(px, py, 1, T); }
        if (open(L.get(tx + 1, ty))) { g.fillStyle = edge; g.fillRect(px + T - 1, py, 1, T); }
        if (L.get(tx, ty - 1) === 'B') this.caveFloor(g, px, py, tx, ty, () => 0);
        else if (L.get(tx, ty - 1) === 'W' && !this.desert) {             // fundo do rio: lodo e seixos
          g.fillStyle = '#4a3a24'; g.fillRect(px, py, T, 3); g.fillStyle = '#6a5a3a'; g.fillRect(px, py, T, 1);
          if (hash2(tx, ty * 3) > 0.6) { ell(g, px + 5 + hash2(tx * 3, ty) * 6, py + 2, 2.5, 1.5, '#7a7e78'); }
        }
        else if (open(L.get(tx, ty - 1))) this.grassTop(g, px, py, tx, ty, () => 0);
      } else if (ch === 'H') {
        this.bark(g, px, py, tx, ty);
        if (open(L.get(tx, ty - 1))) this.grassTop(g, px, py, tx, ty, () => 0);
      } else if (ch === '/' || ch === '\\') {
        const sy = lx => ch === '/' ? T - 1 - lx : lx;
        const inCave = L.get(tx, ty - 1) === 'B';
        if (L.get(tx, ty - 1) === 'U') {                   // rampa de pedra dentro do templo (4-3)
          this.ruinWall(g, px, py, tx, ty);
          for (let lx = 0; lx < T; lx++) { g.fillStyle = '#6e786c'; g.fillRect(px + lx, py + sy(lx), 1, T - sy(lx)); g.fillStyle = '#a8b4a4'; g.fillRect(px + lx, py + sy(lx), 1, 1); g.fillStyle = '#3a8a3a'; if (lx % 5 === 1) g.fillRect(px + lx, py + sy(lx), 1, 2); }
          continue;
        }
        if (inCave) this.cave(g, px, py, tx, ty);
        for (let lx = 0; lx < T; lx++) { g.fillStyle = inCave ? SOIL[3] : SOIL[0]; g.fillRect(px + lx, py + sy(lx), 1, T - sy(lx)); }
        this.soilDetail(g, px, py, tx, ty, 0, sy);
        if (inCave) this.caveFloor(g, px, py, tx, ty, sy); else this.grassTop(g, px, py, tx, ty, sy);
      } else if (ch === 'T') this.desert ? this.palmTrunk(g, L, px, py, tx, ty) : this.trunk(g, L, px, py, tx, ty);
      else if (ch === 'Y') this.deadTrunk(g, L, px, py, tx, ty);
      else if (ch === 'R') this.rockTile(g, L, px, py, tx, ty);
    }
    // túneis: tecto com raízes penduradas e pedras à volta das entradas
    for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.cols; tx++) {
      if (SOLID[L.get(tx, ty)] && L.get(tx, ty + 1) === 'B') this.caveCeiling(g, tx * T, ty * T, tx, ty);
      if (this.mine) continue;
      if (L.get(tx, ty) === 'B' && SOLID[L.get(tx, ty - 1)]) {
        for (const side of [-1, 1]) if (L.get(tx + side, ty) === '.') this.caveMouth(g, L, tx, ty, side);
      }
    }
    // copas: cada sequência horizontal de 'L' vira uma mancha de folhas (no deserto, folhas de palmeira)
    for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.cols; tx++) {
      if (L.get(tx, ty) !== 'L' || L.get(tx - 1, ty) === 'L') continue;
      let e = tx; while (L.get(e + 1, ty) === 'L') e++;
      if (this.desert) this.palmFronds(g, tx * T, (e + 1) * T, ty * T, tx * 7 + ty);
      else this.canopy(g, tx * T, (e + 1) * T, ty * T, tx * 7 + ty);
    }
    // ramos secos ('K')
    for (let ty = 0; ty < L.rows; ty++) for (let tx = 0; tx < L.cols; tx++) if (L.get(tx, ty) === 'K') this.branch(g, L, tx * T, ty * T, tx, ty);
    for (const d of L.decos) this.deco(g, d);
    this.tileCanvas = c;
  },
  soilDetail(g, px, py, tx, ty, depth, sy = null) {
    const ok = (lx, ly) => sy === null || ly > sy(lx) + 5;
    if (this.desert) {                                   // areia: ondulações e grãos; mais fundo, arenito
      for (let k = 0; k < 2; k++) {
        const ly = 4 + k * 7 + Math.floor(hash2(tx, ty * 3 + k) * 3);
        for (let lx = 0; lx < T; lx++) if (ok(lx, ly) && Math.sin((tx * T + lx) * 0.4 + ty + k) > 0.2) { g.fillStyle = depth > 2 ? 'rgba(90,50,20,0.18)' : 'rgba(150,100,40,0.18)'; g.fillRect(px + lx, py + ly, 1, 1); }
      }
      for (let k = 0; k < 4; k++) {
        const lx = Math.floor(hash2(tx * 3 + k, ty * 7) * 15), ly = Math.floor(hash2(tx * 5, ty * 3 + k) * 15);
        if (ok(lx, ly)) { g.fillStyle = k % 2 ? '#fff0b8' : '#b8863e'; g.fillRect(px + lx, py + ly, 1, 1); }
      }
      if (depth >= 2 && hash2(tx * 17, ty * 31) > 0.93 && sy === null) { g.fillStyle = '#8a6a4a'; g.beginPath(); g.ellipse(px + 8, py + 9, 3, 2, 0, 0, 7); g.fill(); g.fillStyle = '#b8987a'; g.fillRect(px + 7, py + 8, 2, 1); }
      return;
    }
    g.fillStyle = 'rgba(40,20,8,0.22)';
    const off = Math.floor(hash2(tx, ty) * 5);
    for (let ly = off; ly < T; ly += 5) for (let lx = 0; lx < T; lx++) if (ok(lx, ly) && ((lx + ly) & 3)) g.fillRect(px + lx, py + ly, 1, 1);
    const e = hash2(tx * 17, ty * 31);
    if (depth >= 2 && e > 0.94 && sy === null) {                       // pedra embutida
      const ex = px + 3 + Math.floor(hash2(tx, ty * 3) * 8), ey = py + 3 + Math.floor(hash2(tx * 7, ty) * 8);
      const es = 0.6 + hash2(ty, tx * 5) * 0.9;
      g.fillStyle = '#4f4a48'; g.beginPath(); g.ellipse(ex + 2, ey + 2, 4 * es, 3 * es, hash2(tx, ty) - 0.5, 0, 7); g.fill();
      g.fillStyle = '#8a8580'; g.beginPath(); g.ellipse(ex + 1.5, ey + 1.5, 3.4 * es, 2.4 * es, hash2(tx, ty) - 0.5, 0, 7); g.fill();
      g.fillStyle = '#b5b0aa'; g.fillRect(ex, ey, 2, 1);
    } else if (depth >= 1 && depth <= 3 && e < 0.07 && sy === null) {   // raiz
      g.fillStyle = '#5a3416';
      for (let i = 0; i < 12; i++) g.fillRect(px + 2 + i, py + 5 + Math.round(Math.sin(i * 0.7 + tx) * 2 + i * 0.3), 1, 1);
    }
    for (let k = 0; k < 3; k++) {
      const lx = Math.floor(hash2(tx * 3 + k, ty * 7) * 13), ly = Math.floor(hash2(tx * 5, ty * 3 + k) * 13);
      if (!ok(lx, ly)) continue;
      g.fillStyle = depth > 3 ? '#7d5233' : '#c08050'; g.fillRect(px + lx, py + ly, 2, 1);
      g.fillStyle = '#4a2a12'; g.fillRect(px + lx, py + ly + 1, 2, 1);
    }
  },
  grassTop(g, px, py, tx, ty, sy) {
    if (this.desert) {                                   // crista de areia clara
      for (let lx = 0; lx < T; lx++) {
        const y = py + sy(lx), h = hash2(tx * 16 + lx, ty);
        g.fillStyle = '#ffe9a8'; g.fillRect(px + lx, y, 1, 1);
        g.fillStyle = '#f7d27e'; g.fillRect(px + lx, y + 1, 1, 2);
        if (h > 0.85) { g.fillStyle = '#d9a650'; g.fillRect(px + lx, y + 3, 1, 1); }
      }
      return;
    }
    for (let lx = 0; lx < T; lx++) {
      const y = py + sy(lx), h = hash2(tx * 16 + lx, ty);
      const P = this.pal.grass;
      g.fillStyle = P[0]; g.fillRect(px + lx, y, 1, 4);
      g.fillStyle = P[1]; if (h > 0.4) g.fillRect(px + lx, y, 1, 1);
      g.fillStyle = P[2]; g.fillRect(px + lx, y + 4, 1, h > 0.5 ? 2 : 1);
      if (h > 0.78) { g.fillStyle = P[0]; g.fillRect(px + lx, y - 2, 1, 2); }
      if (h > 0.93) { g.fillStyle = this.pal.flower; g.fillRect(px + lx, y - 3, 1, 1); }
    }
  },
  bark(g, px, py, tx, ty) {
    if (this.desert) {                                   // arenito em camadas, com buracos para as patas
      g.fillStyle = '#c97a44'; g.fillRect(px, py, T, T);
      for (let k = 0; k < 4; k++) { const ly = (k * 4 + ty * 3) % T; g.fillStyle = k % 2 ? '#b5683a' : '#d98d55'; g.fillRect(px, py + ly, T, 1 + (k % 2)); }
      g.fillStyle = '#8a4a28';
      for (let k = 0; k < 2; k++) g.fillRect(px + 3 + Math.floor(hash2(tx, ty * 2 + k) * 9), py + 3 + k * 7, 3, 2);
      g.fillStyle = '#a85a30'; g.fillRect(px + T - 2, py, 2, T);
      return;
    }
    g.fillStyle = '#7a4524'; g.fillRect(px, py, T, T);
    for (const gx of [2, 6, 10, 13]) {
      const j = Math.floor(hash2(tx * 4 + gx, ty) * 3) - 1;
      for (let ly = 0; ly < T; ly++) {
        if (hash2(tx + gx, ty * 16 + ly) < 0.12) continue;
        const x = px + gx + (ly > 8 ? j : 0);
        g.fillStyle = '#4f2a14'; g.fillRect(x, py + ly, 1, 1);
        g.fillStyle = '#9a5c31'; g.fillRect(x + 1, py + ly, 1, 1);
      }
    }
    if (hash2(tx, ty * 9) > 0.8) { g.fillStyle = '#4f2a14'; g.fillRect(px + 5, py + 5, 4, 5); g.fillStyle = '#3a1e0d'; g.fillRect(px + 6, py + 6, 2, 3); }
    // hera: sinal visual de que a casca é escalável
    const vx = px + 3 + Math.floor(hash2(tx, 77) * 9);
    g.fillStyle = '#2f7d3a'; g.fillRect(vx, py, 1, T);
    for (let k = 0; k < 3; k++) {
      const ly = Math.floor(hash2(tx * 5 + k, ty * 11) * 14), side = k % 2 ? 1 : -3;
      g.fillStyle = '#3fa34d'; g.fillRect(vx + side, py + ly, 3, 2);
      g.fillStyle = '#7cd36b'; g.fillRect(vx + side, py + ly, 1, 1);
    }
  },

  rockTile(g, L, px, py, tx, ty) {
    const o = (dx, dy) => !SOLID[L.get(tx + dx, ty + dy)];
    const u = o(0, -1), l = o(-1, 0), r = o(1, 0), d = o(0, 1);
    g.save(); g.beginPath(); g.roundRect(px, py, T, T, [u && l ? 7 : 0, u && r ? 7 : 0, d && r ? 4 : 0, d && l ? 4 : 0]); g.clip();
    const C = this.desert && !this.beach ? ['#c98a5a', '#e0a878', '#f0c090', '#d89a68', '#a86a40', '#8a5030', '#b07848', '#e8b088', '#8a5030']
      : ['#8d919c', '#a9adb7', '#c4c8d0', '#a3a7b1', '#6a6e79', '#5f636e', '#7b7f8a', '#a0a4ae', '#5a5e69'];
    g.fillStyle = C[0]; g.fillRect(px, py, T, T);
    if (u) { g.fillStyle = C[1]; g.fillRect(px, py, T, 5); g.fillStyle = C[2]; g.fillRect(px + (l ? 4 : 0), py + 1, T - (l ? 4 : 0) - (r ? 4 : 0), 1); }
    if (l) { g.fillStyle = C[3]; g.fillRect(px, py, 2, T); }
    if (r) { g.fillStyle = C[4]; g.fillRect(px + T - 3, py, 3, T); }
    if (d) { g.fillStyle = C[5]; g.fillRect(px, py + T - 2, T, 2); }
    for (let i = 0; i < 7; i++) {                                         // grão da pedra
      const sx = Math.floor(hash2(tx * 9 + i, ty * 5) * 15), sy2 = Math.floor(hash2(tx * 3, ty * 11 + i) * 15);
      g.fillStyle = i % 2 ? C[6] : C[7]; g.fillRect(px + sx, py + sy2, 1, 1);
    }
    const k = hash2(tx * 13, ty * 7);
    if (k > 0.55) {                                                       // fissura irregular
      g.fillStyle = C[8];
      let cx = px + 3 + Math.floor(k * 9), cy = py + 2;
      for (let i = 0; i < 6; i++) { g.fillRect(cx, cy, 1, 2); cy += 2; cx += hash2(tx + i, ty * 3) > 0.5 ? 1 : -1; }
    }
    g.restore();
    if (u && !this.mine && !this.desert) { g.fillStyle = '#5cae4a'; for (let i = 0; i < 4; i++) if (hash2(tx * 4 + i, ty) > 0.45) g.fillRect(px + 2 + i * 3, py - 1, 3, 2); }
  },
  trunk(g, L, px, py, tx, ty) {
    const left = L.get(tx - 1, ty) !== 'T', right = L.get(tx + 1, ty) !== 'T';
    g.fillStyle = '#8a5530'; g.fillRect(px, py, T, T);
    for (const gx of [3, 8, 12]) {
      const j = Math.floor(hash2(tx * 5 + gx, Math.floor(ty / 3)) * 3) - 1;
      g.fillStyle = '#5e3518'; g.fillRect(px + gx + j, py, 1, T);
      g.fillStyle = '#a8703f'; g.fillRect(px + gx + j + 1, py, 1, T);
    }
    if (left) { g.fillStyle = '#3f220e'; g.fillRect(px, py, 2, T); }
    if (right) { g.fillStyle = '#5e3518'; g.fillRect(px + T - 3, py, 3, T); }
    if (hash2(tx * 3, ty * 5) > 0.82) { g.fillStyle = '#4a2a12'; g.beginPath(); g.ellipse(px + 8, py + 8, 3, 4, 0, 0, 7); g.fill(); }
    if (SOLID[L.get(tx, ty + 1)]) {                     // raízes a abrir na base
      g.fillStyle = '#7a4a28';
      if (left) { g.beginPath(); g.moveTo(px, py + 6); g.quadraticCurveTo(px - 4, py + 14, px - 10, py + T); g.lineTo(px + 2, py + T); g.fill(); }
      if (right) { g.beginPath(); g.moveTo(px + T, py + 6); g.quadraticCurveTo(px + T + 4, py + 14, px + T + 10, py + T); g.lineTo(px + T - 2, py + T); g.fill(); }
    }
  },
  canopy(g, x0, x1, y, seed) {
    const blob = (col, dy, rs, n) => {
      g.fillStyle = col;
      for (let i = 0; i <= n; i++) {
        const x = x0 - 6 + (x1 - x0 + 12) * i / n, r = rs + hash2(seed + i, n) * 5;
        g.beginPath(); g.arc(x, y + dy + Math.sin(i * 1.7 + seed) * 2, r, 0, Math.PI * 2); g.fill();
      }
    };
    const n = Math.max(3, Math.round((x1 - x0) / 10));
    const cs = this.pal.canopies, C = cs[Math.floor(hash2(seed * 7 + 3, seed % 5) * 997) % cs.length];
    blob(C[0], 18, 11, n);                             // sombra por baixo
    blob(C[1], 10, 11, n);
    blob(C[2], 4, 8, n);
    blob(C[3], 1, 4, n + 2);                           // topo com luz
    g.fillStyle = C[4];
    for (let i = 0; i < n * 2; i++) if (hash2(seed, i) > 0.5) g.fillRect(Math.round(x0 + (x1 - x0) * i / (n * 2)), y - 2, 2, 1);
  },

  // ---------------- fundo com paralaxe ----------------
  // ---------------- túneis ----------------
  // paredes rachadas (partem-se com o spin): desenhadas todos os frames para poderem desaparecer
  fragile(ctx, L, cx, cy) {
    for (const f of L.fragile) {
      const x = f.tx * T, y = f.ty * T;
      if (x < cx - T || x > cx + VIEW_W || y < cy - T || y > cy + VIEW_H) continue;
      const J = L.season === 'jungle';                                    // na selva: pedra cinzenta com musgo
      ctx.fillStyle = J ? '#7a7e78' : '#a8703f'; ctx.fillRect(x, y, T, T);
      ctx.fillStyle = J ? '#9aa098' : '#c98a58'; ctx.fillRect(x + 1, y + 1, T - 2, 2);
      ctx.fillStyle = J ? '#4a5048' : '#6a4024'; ctx.fillRect(x, y + T - 1, T, 1); ctx.fillRect(x + T - 1, y, 1, T);
      if (J && L.get(f.tx, f.ty - 1) !== 'F') { ctx.fillStyle = '#4aa844'; ctx.fillRect(x, y, T, 2); }
      ctx.fillStyle = '#3a2214';                                          // rachas
      const k = (f.tx * 7 + f.ty * 3) % 4;
      for (let i = 0; i < 8; i++) ctx.fillRect(x + 3 + ((i + k) % 3) + Math.floor(i / 2), y + 1 + i * 2, 1, 2);
      ctx.fillRect(x + 9, y + 5, 4, 1); ctx.fillRect(x + 12, y + 6, 1, 4);
    }
  },
  // plataforma de tronco gigante (4-2): tábuas grossas com musgo por cima
  woodDeck(g, L, px, py, tx, ty) {
    g.fillStyle = '#5e3a1e'; g.fillRect(px, py, T, T);
    g.fillStyle = '#7a5230'; g.fillRect(px, py + 3, T, 2); g.fillRect(px, py + 10, T, 1);
    g.fillStyle = '#3e2812'; if (tx % 3 === 0) g.fillRect(px, py, 1, T);
    if (!SOLID[L.get(tx, ty + 1)]) { g.fillStyle = '#2e1a0c'; g.fillRect(px, py + T - 3, T, 3); }
    if (!SOLID[L.get(tx, ty - 1)]) {
      if (this.beach) { g.fillStyle = '#c08a50'; g.fillRect(px, py, T, 2); g.fillStyle = '#9aa0aa'; g.fillRect(px + 3, py + 3, 1, 1); g.fillRect(px + 12, py + 3, 1, 1); }   // passadiço da praia
      else { g.fillStyle = '#2f8a3a'; g.fillRect(px, py, T, 2); g.fillStyle = '#5cbf4a'; for (let k = 0; k < 3; k++) g.fillRect(px + Math.floor(hash2(tx, k) * 14), py - 1, 2, 1); }
    }
  },
  // alçapão da plataforma (4-2): por cima do tronco gigante; atravessa-se por baixo (molas e tronco)
  hatch(g, L, px, py, tx, ty) {
    if (L.get(tx, ty + 1) === 'T') this.trunk(g, L, px, py, tx, ty);
    g.fillStyle = '#3e2812'; g.fillRect(px, py, T, 7);
    g.fillStyle = '#9a6a38'; g.fillRect(px, py, T, 5);
    g.fillStyle = '#c08a48'; g.fillRect(px, py, T, 1);
    g.fillStyle = '#5a3a1e'; g.fillRect(px + (tx % 2 ? 0 : 15), py, 1, 5);
    if (L.get(tx - 1, ty) !== 'P') { g.fillStyle = '#9aa0aa'; g.fillRect(px + 3, py + 2, 3, 1); g.fillRect(px + 3, py + 1, 1, 3); }   // argola
  },
  // ---------------- ruínas da cidade antiga (3-2) ----------------
  ruinWall(g, px, py, tx, ty) {
    const J = this.jungle;                               // no templo da selva: pedra cinzenta-esverdeada com musgo
    g.fillStyle = J ? ((tx + ty) % 2 ? '#323c34' : '#2e3830') : (tx + ty) % 2 ? '#4e3828' : '#4a3424'; g.fillRect(px, py, T, T);
    const off = (ty % 2) * 8;
    g.fillStyle = J ? '#1e2620' : '#33231a'; g.fillRect(px, py + T - 1, T, 1); g.fillRect(px + ((off + 7) % T), py, 1, T);
    g.fillStyle = J ? '#3e4a40' : '#5e4632'; g.fillRect(px, py, T, 1);
    const h = hash2(tx * 7, ty * 13);
    if (J && hash2(tx * 3, ty * 11) > 0.82) { g.fillStyle = '#2e5a2e'; g.fillRect(px + Math.floor(hash2(tx, ty * 2) * 10), py, 5, 2); g.fillRect(px + 2 + Math.floor(hash2(tx * 5, ty) * 8), py + 2, 2, 3); }   // musgo
    if (h > 0.9) {                                      // símbolos gravados: bolota, espiral (cauda), olho, ondas
      g.fillStyle = J ? '#5a6a50' : '#7a5e44'; const k = Math.floor(hash2(tx, ty) * 4), x = px + 4, y = py + 4;
      if (k === 0) { g.fillRect(x + 2, y, 4, 2); g.fillRect(x + 1, y + 2, 6, 4); g.fillRect(x + 3, y + 6, 2, 1); }
      else if (k === 1) { g.fillRect(x, y + 6, 6, 1); g.fillRect(x + 6, y + 1, 1, 6); g.fillRect(x + 2, y + 1, 4, 1); g.fillRect(x + 2, y + 1, 1, 3); g.fillRect(x + 2, y + 3, 2, 1); }
      else if (k === 2) { g.fillRect(x, y + 3, 8, 1); g.fillRect(x + 2, y + 2, 4, 3); g.fillStyle = '#33231a'; g.fillRect(x + 3, y + 3, 2, 1); }
      else for (let i = 0; i < 8; i++) g.fillRect(x + i, y + 3 + Math.round(Math.sin(i * 1.4) * 1.5), 1, 1);
    } else if (h < 0.06) { g.fillStyle = '#2a1c14'; g.fillRect(px + 5, py + 3, 1, 5); g.fillRect(px + 6, py + 7, 1, 4); }   // racha
  },
  ruinBlock(g, L, px, py, tx, ty) {
    const J = this.jungle, C = J ? ['#6e786c', '#8a9488', '#4e5850', '#5e685c', '#a8b4a4'] : ['#b0784a', '#c98a58', '#8a5a34', '#9a6a40', '#e0a878'];
    g.fillStyle = C[0]; g.fillRect(px, py, T, T);
    g.fillStyle = C[1]; g.fillRect(px + 1, py + 1, T - 2, 3);
    g.fillStyle = C[2]; g.fillRect(px, py + T - 2, T, 2); g.fillRect(px + T - 1, py, 1, T);
    g.fillStyle = C[3]; g.fillRect(px + 7, py + 5, 1, 9);
    const open = !SOLID[L.get(tx, ty - 1)];
    if (open) { g.fillStyle = C[4]; g.fillRect(px, py, T, 1); }
    if (hash2(tx * 3, ty * 5) > 0.7) { g.fillStyle = C[2]; g.fillRect(px + 3, py + 7, 2, 2); g.fillRect(px + 10, py + 9, 2, 2); }
    if (J && open) { g.fillStyle = '#3a8a3a'; g.fillRect(px, py, T, 2); g.fillStyle = '#5cbf4a'; g.fillRect(px + Math.floor(hash2(tx, ty) * 12), py - 1, 3, 1); }   // musgo por cima
    else if (J && hash2(tx * 9, ty * 7) > 0.85) { g.fillStyle = '#3a6a34'; g.fillRect(px + 2, py + 3, 4, 2); }
  },
  // ---------------- deserto ----------------
  palmTrunk(g, L, px, py, tx, ty) {
    g.fillStyle = '#a87a48'; g.fillRect(px + 3, py, 10, T);
    g.fillStyle = '#c99a60'; g.fillRect(px + 4, py, 3, T);
    g.fillStyle = '#7a5530'; g.fillRect(px + 11, py, 2, T);
    for (let k = 0; k < 4; k++) { g.fillStyle = '#7a5530'; g.fillRect(px + 3, py + k * 4 + 1, 10, 1); g.fillStyle = '#d9b07a'; g.fillRect(px + 4, py + k * 4 + 2, 6, 1); }
    if (SOLID[L.get(tx, ty + 1)]) { g.fillStyle = '#8a6038'; g.fillRect(px + 1, py + T - 3, 14, 3); }
  },
  deadTrunk(g, L, px, py, tx, ty) {
    g.fillStyle = '#7a6a5a'; g.fillRect(px + 4, py, 8, T);
    g.fillStyle = '#9a8a78'; g.fillRect(px + 5, py, 2, T);
    g.fillStyle = '#5a4c40'; g.fillRect(px + 10, py, 2, T);
    for (let k = 0; k < 2; k++) { const cy = py + 3 + k * 8 + Math.floor(hash2(tx, ty + k) * 3); g.fillStyle = '#4a3e34'; g.fillRect(px + 7, cy, 1, 4); g.fillRect(px + 8, cy + 3, 1, 3); }
    if (SOLID[L.get(tx, ty + 1)]) { g.fillStyle = '#6a5a4a'; g.beginPath(); g.moveTo(px + 4, py + 8); g.lineTo(px - 4, py + T); g.lineTo(px + T + 4, py + T); g.lineTo(px + 12, py + 8); g.fill(); }
  },
  branch(g, L, px, py, tx, ty) {
    const r = hash2(tx * 7, ty * 3);
    g.fillStyle = '#6a5a4a'; g.fillRect(px, py + 1, T, 4);
    g.fillStyle = '#9a8a78'; g.fillRect(px, py + 1, T, 1);
    g.fillStyle = '#4a3e34'; g.fillRect(px, py + 4, T, 1);
    g.strokeStyle = '#6a5a4a'; g.lineWidth = 1; g.beginPath();                 // raminhos
    g.moveTo(px + 5, py + 1); g.lineTo(px + 3 + r * 4, py - 5 - r * 3);
    g.moveTo(px + 11, py + 4); g.lineTo(px + 13, py + 9 + r * 3);
    if (L.get(tx + 1, ty) !== 'K' && L.get(tx + 1, ty) !== 'Y') { g.moveTo(px + T, py + 3); g.lineTo(px + T + 5, py - 2); }
    if (L.get(tx - 1, ty) !== 'K' && L.get(tx - 1, ty) !== 'Y') { g.moveTo(px, py + 3); g.lineTo(px - 5, py - 3); }
    g.stroke();
  },
  palmFronds(g, x0, x1, y, seed) {
    const cx = (x0 + x1) / 2, cy = y + 2;
    const frond = (ang, len, col, w) => {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(cx, cy);
      const ex = cx + Math.cos(ang) * len, ey = cy + Math.sin(ang) * len * 0.55 + len * 0.35;
      g.quadraticCurveTo(cx + Math.cos(ang) * len * 0.5, cy - 8, ex, ey); g.stroke();
      g.lineWidth = 1;
      for (let k = 3; k < 10; k++) {                    // folíolos
        const u = k / 10, qx = cx + (ex - cx) * u, qy = cy + (ey - cy) * u - Math.sin(u * Math.PI) * 6;
        g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + Math.cos(ang + 1.4) * 4, qy + 4); g.stroke();
      }
    };
    const C = this.pal.canopies[0];
    for (const [a, l] of [[Math.PI + 0.2, 36], [-0.2, 36], [Math.PI + 0.7, 28], [0.7 - Math.PI * 0, 28]]) frond(a, l, C[1], 3);
    for (const [a, l] of [[Math.PI - 0.2, 30], [0.2, 30], [-Math.PI / 2 - 0.5, 18], [-Math.PI / 2 + 0.5, 18]]) frond(a, l, C[2], 2);
    g.fillStyle = '#7a5530'; g.beginPath(); g.arc(cx - 3, cy + 3, 3, 0, 7); g.arc(cx + 3, cy + 4, 3, 0, 7); g.fill();   // cocos
    g.fillStyle = C[4]; g.fillRect(cx - 4, cy - 3, 8, 1);
  },
  // água dos oásis: translúcida, por cima da Avelã (fica "dentro" da água)
  water(ctx, L, cx, cy, time) {
    const tx0 = Math.max(0, Math.floor(cx / T) - 1), tx1 = Math.min(L.cols - 1, Math.floor((cx + VIEW_W) / T) + 1);
    const ty0 = Math.max(0, Math.floor(cy / T) - 1), ty1 = Math.min(L.rows - 1, Math.floor((cy + VIEW_H) / T) + 1);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {           // só o que está no ecrã
      if (!L.water.has(L.idx(tx, ty))) continue;
      const x = tx * T, top = !L.water.has(L.idx(tx, ty - 1)) && !SOLID[L.get(tx, ty - 1)], y = ty * T + (top ? 4 : 0);   // debaixo de um tecto não há superfície
      if (L.seaFrom === undefined || tx < L.seaFrom) { ctx.fillStyle = 'rgba(30,150,230,0.5)'; ctx.fillRect(x, y, T, ty * T + T - y); }   // o mar pinta-se todo de uma vez (Gfx.seaDepth)
      if (!top) continue;
      for (let i = 0; i < T; i += 2) {
        const w = Math.sin((x + i) * 0.25 + time * 2.6);
        ctx.fillStyle = w > 0.6 ? '#ffffff' : '#bff0ff'; ctx.fillRect(x + i, y + (w > 0 ? 0 : 1), 2, 1);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y + 3, T, 1);
    }
  },
  // areia movediça: remoinhos a andar, por cima da Avelã (ela afunda-se mesmo)
  quicksand(ctx, L, cx, cy, time) {
    for (const [tx, ty] of L.quickTiles) {
      const x = tx * T, top = !L.quick.has(L.idx(tx, ty - 1)), y = ty * T + (top ? 3 : 0);
      if (x < cx - T || x > cx + VIEW_W || y < cy - T || y > cy + VIEW_H + T) continue;
      ctx.fillStyle = 'rgba(176,118,52,0.92)'; ctx.fillRect(x, y, T, ty * T + T - y);
      ctx.fillStyle = 'rgba(120,76,30,0.5)'; for (let k = 0; k < 3; k++) ctx.fillRect(x + ((k * 5 + tx * 3) % 14), y + 6 + k * 3, 2, 1);
      if (!top) continue;
      // remoinhos a girar: a areia está a puxar para baixo
      const cxw = x + 8, cyw = y + 5, a0 = time * 2.4 * (tx % 2 ? 1 : -1) + tx;
      ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cxw, cyw, 6, 2, 0, a0, a0 + 2.4); ctx.stroke();
      ctx.strokeStyle = '#e8bc78';
      ctx.beginPath(); ctx.ellipse(cxw, cyw, 3, 1, 0, a0 + 3, a0 + 5); ctx.stroke();
      ctx.fillStyle = '#d9a35a'; ctx.fillRect(x, y, T, 1);
      if (hash2(tx, Math.floor(time * 2)) > 0.8) { ctx.fillStyle = '#7a4a1e'; ctx.fillRect(x + 6, y - 1, 3, 2); }
    }
  },
  pyramids(ctx, ox, base, night = false) {             // pirâmides ao longe (repetem-se)
    const span = 760;
    for (const [px, h, gold] of [[120, 74, true], [210, 48, false], [470, 58, false], [560, 34, false]]) {
      let x = ((px - ox) % span + span) % span - 120;
      if (x < -h * 1.2 || x > VIEW_W + h * 1.2) { x += x < 0 ? span : -span; if (x < -h * 1.2 || x > VIEW_W + h * 1.2) continue; }
      const b = Math.round(base), tip = b - h;
      ctx.fillStyle = night ? '#545080' : '#e0b070'; ctx.beginPath(); ctx.moveTo(x - h, b); ctx.lineTo(x, tip); ctx.lineTo(x, b); ctx.fill();   // lado ao sol (ou à lua)
      ctx.fillStyle = night ? '#2c2a4a' : '#b88250'; ctx.beginPath(); ctx.moveTo(x, tip); ctx.lineTo(x + h, b); ctx.lineTo(x, b); ctx.fill();   // lado à sombra
      ctx.fillStyle = 'rgba(120,70,30,0.25)';
      for (let yy = tip + 6; yy < b; yy += 6) { const w = (yy - tip); ctx.fillRect(Math.round(x - w), yy, Math.round(w * 2), 1); }   // degraus
      if (gold) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(x - 6, tip + 6); ctx.lineTo(x, tip); ctx.lineTo(x + 6, tip + 6); ctx.fill(); }
    }
  },
  // fundo do deserto: céu quente, sol, mesas de arenito, dunas e palhas secas a rebolar ao vento
  desertBg(ctx, camX, camY, L, time) {
    const oy = f => Math.round((camY - (L.bgRefY ?? L.height - VIEW_H)) * f);
    const storm = !!L.sandstorm, night = !!L.night;
    const NC = night ? { mesa: ['#2e2a4e', '#3e3a64'], strata: 'rgba(20,16,40,0.35)', dune: ['#3a3860', '#4c4a78'], near: ['#302e52', '#423f6a'], weed: '#5a5070' }
      : { mesa: ['#d9895a', '#f0a874'], strata: 'rgba(170,90,60,0.35)', dune: ['#e9b866', '#f8d48e'], near: ['#dca552', '#efc274'], weed: null };
    if (night) {                                         // estrelas e lua
      for (let i = 0; i < 90; i++) {
        const sx = Math.floor(hash2(i, 3) * VIEW_W), sy = Math.floor(hash2(i, 7) * 130) - oy(0.02), tw = Math.sin(time * (1 + hash2(i, 9) * 3) + i) > 0.6;
        ctx.fillStyle = tw ? '#ffffff' : hash2(i, 11) > 0.5 ? '#c8d0ff' : '#8890c8'; ctx.fillRect(sx, sy, hash2(i, 5) > 0.92 ? 2 : 1, hash2(i, 5) > 0.92 ? 2 : 1);
      }
      ctx.fillStyle = 'rgba(220,230,255,0.12)'; ctx.beginPath(); ctx.arc(300, 44 - oy(0.03), 30, 0, 7); ctx.fill();
      ctx.fillStyle = '#eef0ff'; ctx.beginPath(); ctx.arc(300, 44 - oy(0.03), 15, 0, 7); ctx.fill();
      ctx.fillStyle = L.sky[0]; ctx.beginPath(); ctx.arc(307, 40 - oy(0.03), 13, 0, 7); ctx.fill();   // lua em quarto crescente
    } else {
      ctx.fillStyle = 'rgba(255,240,190,0.25)'; ctx.beginPath(); ctx.arc(300, 46 - oy(0.03), 40, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,190,0.45)'; ctx.beginPath(); ctx.arc(300, 46 - oy(0.03), 28, 0, 7); ctx.fill();
      ctx.fillStyle = storm ? 'rgba(255,236,200,0.55)' : '#fff8dc'; ctx.beginPath(); ctx.arc(300, 46 - oy(0.03), 19, 0, 7); ctx.fill();
    }
    // mesas ao longe (topos planos)
    const mesa = x => { const k = Math.floor(x / 110), f = x / 110 - k, r = hash2(k, 7);
      if (r < 0.45) return 6 + 4 * Math.sin(x * 0.05); const h = 30 + r * 34, e = Math.min(1, f / 0.12, (1 - f) / 0.12); return 6 + (h - 6) * e; };
    this.ridge(ctx, camX * 0.12, 156 - oy(0.08), mesa, NC.mesa[0], NC.mesa[1]);
    ctx.fillStyle = NC.strata;
    for (let sx = 0; sx < VIEW_W; sx += 4) { const h = mesa(sx + camX * 0.12); if (h > 20) ctx.fillRect(sx, Math.round(156 - oy(0.08) - h + 8), 4, 2); }   // estratos
    if (L.pyramids) this.pyramids(ctx, camX * 0.18, 170 - oy(0.12), night);
    // dunas do meio e palhas secas a rebolar por cima delas (com a tempestade são mais e vão mais depressa)
    const dun = x => 26 + 12 * Math.sin(x * 0.012 + 1) + 7 * Math.sin(x * 0.031);
    const base = 182 - oy(0.18);
    this.ridge(ctx, camX * 0.3, base, dun, NC.dune[0], NC.dune[1]);
    for (let i = 0; i < (storm ? 7 : night ? 2 : 4); i++) {
      const span = VIEW_W + 120, sp = (34 + i * 9) * (storm ? 2.4 : 1);
      const sx = ((i * 157 + time * sp) % span) - 60;
      const r = 5 + (i % 2) * 2, bounce = Math.abs(Math.sin(time * 3.2 + i * 1.7)) * 9;
      this.tumbleweed(ctx, sx, base - dun(sx + camX * 0.3) - r - bounce, r, time * sp / r);
    }
    this.ridge(ctx, camX * 0.5, 212 - oy(0.3), x => 22 + 9 * Math.sin(x * 0.02 + 3) + 5 * Math.sin(x * 0.05), NC.near[0], NC.near[1]);
  },
  tumbleweed(ctx, x, y, r, rot) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot);
    ctx.strokeStyle = '#a07a44'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#7a5a30'; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * 1.05; ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a + 2.4) * r * 0.8, Math.sin(a + 2.4) * r * 0.8); }
    ctx.stroke(); ctx.restore();
  },
  // ---------------- mina ----------------
  // rocha: blocos irregulares de pedra com veios e, às vezes, pintas de minério
  mineRock(g, px, py, tx, ty) {
    const R = ['#4b4540', '#433d38', '#544c46', '#3b3632'];
    g.fillStyle = R[Math.floor(hash2(tx, ty) * 4)]; g.fillRect(px, py, T, T);
    const ox = Math.floor(hash2(tx * 3, ty) * 8), oy = (tx & 1) * 8;
    g.fillStyle = '#2a2420';
    g.fillRect(px, py + oy, T, 1); g.fillRect(px + ox, py, 1, T);                       // juntas entre pedras
    g.fillStyle = '#6b625a';
    g.fillRect(px + ox + 1, py + oy + 1, 3, 1); g.fillRect(px + 1, py + ((oy + 8) & 15) + 1, 2, 1);
    for (let k = 0; k < 3; k++) {
      g.fillStyle = k ? '#2f2a26' : '#5f574f';
      g.fillRect(px + Math.floor(hash2(tx * 5 + k, ty * 3) * 14), py + Math.floor(hash2(tx, ty * 7 + k) * 14), 2, 1);
    }
    if (hash2(tx * 13, ty * 17) > 0.95) { g.fillStyle = '#2ecc71'; g.fillRect(px + 6, py + 7, 2, 1); g.fillStyle = '#b8ffd8'; g.fillRect(px + 6, py + 7, 1, 1); }
  },
  ladder(g, L, px, py, tx, ty) {
    g.fillStyle = '#4a2e18'; g.fillRect(px + 2, py, 2, T); g.fillRect(px + 12, py, 2, T);
    g.fillStyle = '#8a5a30'; g.fillRect(px + 2, py, 1, T); g.fillRect(px + 12, py, 1, T);
    for (const ry of [3, 11]) { g.fillStyle = '#6b4423'; g.fillRect(px + 3, py + ry, 10, 2); g.fillStyle = '#a8703f'; g.fillRect(px + 3, py + ry, 10, 1); }
  },
  plank(g, L, px, py, tx, ty) {
    g.fillStyle = '#3e2812'; g.fillRect(px, py, T, 6);
    g.fillStyle = '#8a5a30'; g.fillRect(px, py, T, 4);
    g.fillStyle = '#b07a3e'; g.fillRect(px, py, T, 1);
    g.fillStyle = '#5a3a1e'; g.fillRect(px + (tx % 2 ? 7 : 11), py + 1, 1, 3);
    g.fillStyle = '#9aa0aa'; g.fillRect(px + 2, py + 2, 1, 1); g.fillRect(px + 13, py + 2, 1, 1);
    if (L.get(tx, ty + 1) !== 'B' && L.get(tx, ty + 1) !== 'E') return;
    if (L.get(tx - 1, ty) !== 'P') { g.fillStyle = '#5a3a1e'; g.fillRect(px + 1, py + 6, 2, 10); }   // escoras do andaime
    if (L.get(tx + 1, ty) !== 'P') { g.fillStyle = '#5a3a1e'; g.fillRect(px + 13, py + 6, 2, 10); }
  },
  cave(g, px, py, tx, ty) {
    if (this.mine) {
      g.fillStyle = '#2a221e'; g.fillRect(px, py, T, T);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = hash2(tx * 7 + i, ty * 13) > 0.5 ? '#1f1915' : '#352b25';
        g.fillRect(px + Math.floor(hash2(tx, ty * 5 + i) * 13), py + Math.floor(hash2(tx * 3 + i, ty) * 14), 3, 1);
      }
      if ((tx * 7 + ty * 3) % 11 === 0) { g.fillStyle = '#1f1915'; g.fillRect(px, py + 8, T, 1); }
      return;
    }
    g.fillStyle = '#3a2414'; g.fillRect(px, py, T, T);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = hash2(tx * 7 + i, ty * 13) > 0.5 ? '#2c1a0e' : '#4a2e1a';
      g.fillRect(px + Math.floor(hash2(tx, ty * 5 + i) * 14), py + Math.floor(hash2(tx * 3 + i, ty) * 14), 2, 1);
    }
    if (hash2(tx * 11, ty * 3) > 0.86) { g.fillStyle = '#4f4540'; g.beginPath(); g.ellipse(px + 8, py + 9, 3, 2, 0, 0, 7); g.fill(); }
  },
  caveFloor(g, px, py, tx, ty, sy) {
    if (this.mine) {
      g.fillStyle = '#8a8178'; g.fillRect(px, py, T, 1);
      g.fillStyle = '#6b625a'; g.fillRect(px, py + 1, T, 2);
      g.fillStyle = '#2a2420'; g.fillRect(px, py + 3, T, 1);
      for (let lx = 0; lx < T; lx++) if (hash2(tx * 16 + lx, ty) > 0.86) { g.fillStyle = '#a09890'; g.fillRect(px + lx, py - 1, 1, 1); }
      return;
    }
    for (let lx = 0; lx < T; lx++) {
      const y = py + sy(lx);
      g.fillStyle = '#7a5030'; g.fillRect(px + lx, y, 1, 2);
      g.fillStyle = '#4a2e1a'; g.fillRect(px + lx, y + 2, 1, 1);
      if (hash2(tx * 16 + lx, ty) > 0.9) { g.fillStyle = '#9a7a5a'; g.fillRect(px + lx, y - 1, 1, 1); }
    }
  },
  caveCeiling(g, px, py, tx, ty) {
    if (this.mine) {                                     // estalactites
      g.fillStyle = '#2a2420'; g.fillRect(px, py + T - 2, T, 2);
      if (hash2(tx * 5, ty * 9) > 0.55) {
        const rx = px + 3 + Math.floor(hash2(tx, ty * 2) * 9), len = 3 + Math.floor(hash2(tx * 9, ty) * 6);
        for (let k = 0; k < len; k++) { const w = Math.max(1, Math.round(3 * (1 - k / len))); g.fillStyle = k < 2 ? '#4b4540' : '#5f574f'; g.fillRect(rx - (w >> 1), py + T + k, w, 1); }
      }
      return;
    }
    g.fillStyle = '#2a190d'; g.fillRect(px, py + T - 2, T, 2);
    for (let i = 0; i < 3; i++) {                       // raízes penduradas
      if (hash2(tx * 5 + i, ty * 9) < 0.45) continue;
      const rx = px + 2 + Math.floor(hash2(tx + i, ty * 2) * 12), len = 3 + Math.floor(hash2(tx * 9, ty + i) * 8);
      for (let k = 0; k < len; k++) { g.fillStyle = k % 3 ? '#6b4423' : '#8a5a30'; g.fillRect(rx + Math.round(Math.sin(k * 0.8 + i) * 0.8), py + T + k, 1, 1); }
    }
  },
  caveMouth(g, L, tx, ty, side) {
    const x = side < 0 ? tx * T : (tx + 1) * T;
    let h = 0; while (L.get(tx, ty + h) === 'B') h++;
    const stones = [];
    for (let k = 0; k <= h; k++) stones.push([x, ty * T + k * T - 4]);
    for (let k = 1; k < 3; k++) stones.push([x - side * k * 8, ty * T - 4]);
    for (const [sx, sy] of stones) {
      g.fillStyle = '#4f535d'; g.beginPath(); g.ellipse(sx, sy + 1, 5.5, 4.5, 0, 0, 7); g.fill();
      g.fillStyle = '#8b8f99'; g.beginPath(); g.ellipse(sx - 0.5, sy, 4.6, 3.6, 0, 0, 7); g.fill();
      g.fillStyle = '#b6bac4'; g.fillRect(Math.round(sx - 3), Math.round(sy - 2), 2, 1);
    }
  },

  background(ctx, camX, camY, L, time) {
    if (L.underground) { ctx.fillStyle = '#120c08'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); return; }
    const P = PALETTES[L.season] || PALETTES.summer;
    if (L.season === 'jungle') {
      if (!this.skyGrad || this.skyFor !== L) {
        this.skyFor = L; this.skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        this.skyGrad.addColorStop(0, L.sky[0]); this.skyGrad.addColorStop(0.55, L.sky[1]); this.skyGrad.addColorStop(1, L.sky[2]);
      }
      ctx.fillStyle = this.skyGrad; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return this.jungleBg(ctx, camX, camY, L, time);
    }
    if (L.season === 'beach') {
      if (!this.skyGrad || this.skyFor !== L) {
        this.skyFor = L; this.skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        this.skyGrad.addColorStop(0, L.sky[0]); this.skyGrad.addColorStop(0.55, L.sky[1]); this.skyGrad.addColorStop(1, L.sky[2]);
      }
      ctx.fillStyle = this.skyGrad; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return this.beachBg(ctx, camX, camY, L, time);
    }
    if (L.season === 'desert') {
      if (!this.skyGrad || this.skyFor !== L) {
        this.skyFor = L; this.skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        this.skyGrad.addColorStop(0, L.sky[0]); this.skyGrad.addColorStop(0.55, L.sky[1]); this.skyGrad.addColorStop(1, L.sky[2]);
      }
      ctx.fillStyle = this.skyGrad; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return this.desertBg(ctx, camX, camY, L, time);
    }
    if (!this.skyGrad || this.skyFor !== L) {
      this.skyFor = L;
      this.skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      this.skyGrad.addColorStop(0, L.sky[0]); this.skyGrad.addColorStop(0.55, L.sky[1]); this.skyGrad.addColorStop(1, L.sky[2]);
    }
    ctx.fillStyle = this.skyGrad; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const oy = f => Math.round((camY - (L.height - VIEW_H)) * f);
    // sol
    ctx.fillStyle = 'rgba(255,250,210,0.35)'; ctx.beginPath(); ctx.arc(318, 42 - oy(0.03), 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(318, 42 - oy(0.03), 16, 0, 7); ctx.fill();
    // nuvens
    for (let i = 0; i < 7; i++) {
      const span = 720;
      let x = ((i * 113 + 40) - camX * 0.08 - time * 5) % span; if (x < -60) x += span;
      this.cloud(ctx, Math.round(x - 40), 18 + (i * 37) % 60 - oy(0.05), 1 + (i % 3) * 0.35);
    }
    // montanhas distantes
    this.ridge(ctx, camX * 0.15, 150 - oy(0.08), x => 52 + 22 * Math.sin(x * 0.011) + 14 * Math.sin(x * 0.027 + 1.3) + 6 * Math.sin(x * 0.063), P.mountains[0], P.mountains[1]);
    if (L.forest) this.tallForest(ctx, camX * 0.25, 200 - oy(0.14), P.forest);
    // colinas
    this.ridge(ctx, camX * 0.35, 178 - oy(0.18), x => 30 + 12 * Math.sin(x * 0.018 + 2) + 8 * Math.sin(x * 0.045), P.hills[0], P.hills[1]);
    this.treeline(ctx, camX * 0.35, 178 - oy(0.18), P.treeline, 26, x => 30 + 12 * Math.sin(x * 0.018 + 2) + 8 * Math.sin(x * 0.045));
    // floresta próxima
    this.pines(ctx, camX * 0.6, 214 - oy(0.32), P.pines[0], P.pines[1]);
  },
  tallForest(ctx, ox, base, F) {
    const gap = 70, start = Math.floor(ox / gap) * gap;
    for (let wx = start - gap; wx < ox + VIEW_W + gap; wx += gap) {
      const h1 = hash2(wx, 11), sx = Math.round(wx - ox + h1 * 30), top = base - 120 - Math.floor(hash2(wx, 12) * 60);
      ctx.fillStyle = F[0]; ctx.fillRect(sx - 4, top + 20, 8, base - top);
      ctx.fillRect(sx - 4, top + 50, -10, 3); ctx.fillRect(sx + 4, top + 40, 12, 3);
      for (const [dx, dy, r] of [[-16, 12, 18], [14, 8, 17], [0, -2, 22], [-24, 30, 13], [24, 28, 14]]) {
        ctx.fillStyle = F[1]; ctx.beginPath(); ctx.arc(sx + dx, top + dy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = F[2]; ctx.beginPath(); ctx.arc(sx - 4, top - 6, 12, 0, Math.PI * 2); ctx.fill();
    }
  },
  cloud(ctx, x, y, s) {
    ctx.fillStyle = '#d6ecff';
    ctx.fillRect(x + 4 * s, y + 10 * s, 56 * s, 6 * s);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8 * s, y + 4 * s, 20 * s, 10 * s); ctx.fillRect(x + 22 * s, y, 18 * s, 12 * s);
    ctx.fillRect(x + 36 * s, y + 5 * s, 18 * s, 8 * s); ctx.fillRect(x, y + 8 * s, 62 * s, 4 * s);
  },
  ridge(ctx, ox, base, hf, col, hi) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, VIEW_H);
    for (let sx = 0; sx <= VIEW_W + 4; sx += 4) ctx.lineTo(sx, Math.round(base - hf(sx + ox)));
    ctx.lineTo(VIEW_W, VIEW_H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hi;
    for (let sx = 0; sx <= VIEW_W; sx += 4) ctx.fillRect(sx, Math.round(base - hf(sx + ox)), 4, 2);
    ctx.fillStyle = col; ctx.fillRect(0, Math.max(0, Math.round(base)), VIEW_W, VIEW_H);
  },
  treeline(ctx, ox, base, col, gap, hf) {
    ctx.fillStyle = col;
    const start = Math.floor(ox / gap) * gap;
    for (let wx = start; wx < ox + VIEW_W + gap; wx += gap) {
      const sx = Math.round(wx - ox), y = Math.round(base - hf(wx));
      const r = 6 + Math.floor(hash2(wx, 3) * 5);
      ctx.beginPath(); ctx.arc(sx, y - r + 3, r, 0, 7); ctx.fill();
      ctx.fillRect(sx - 1, y - 2, 2, 6);
    }
  },
  pines(ctx, ox, base, col, dark) {
    const gap = 30, start = Math.floor(ox / gap) * gap;
    for (let wx = start; wx < ox + VIEW_W + gap; wx += gap) {
      const sx = Math.round(wx - ox + hash2(wx, 1) * 12), h = 40 + Math.floor(hash2(wx, 2) * 26);
      ctx.fillStyle = dark; ctx.fillRect(sx - 2, base - 12, 4, 14);
      ctx.fillStyle = col;
      for (let k = 0; k < 3; k++) {
        const y = base - 10 - k * (h / 4), w = 14 - k * 3;
        ctx.beginPath(); ctx.moveTo(sx - w, y); ctx.lineTo(sx, y - h / 2.4); ctx.lineTo(sx + w, y); ctx.fill();
      }
    }
    ctx.fillStyle = col; ctx.fillRect(0, base, VIEW_W, VIEW_H);
  },

  // ---------------- mundo ----------------
  loopRing(ctx, lp, time) {
    const { cx, cy, r } = lp;
    if (this.desert) {                                   // arco de arenito
      ctx.lineWidth = 12; ctx.strokeStyle = '#c97a44'; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#8a4a28';
      for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1)); ctx.lineTo(cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12)); ctx.stroke(); }
      ctx.lineWidth = 3; ctx.strokeStyle = '#f0c870'; ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    ctx.lineWidth = 11; ctx.strokeStyle = '#8b5a2b';
    ctx.beginPath(); ctx.arc(cx, cy, r + 5.5, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#5e3a1a';
    ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1));
      ctx.lineTo(cx + Math.cos(a) * (r + 10), cy + Math.sin(a) * (r + 10)); ctx.stroke();
    }
    ctx.lineWidth = 3; ctx.strokeStyle = '#4cc94c';
    ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#8ef07a';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    // flores na coroa
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.22;
      ctx.fillStyle = k % 2 ? '#ff6fa8' : '#ffd84a';
      ctx.fillRect(Math.round(cx + Math.cos(a) * (r + 12)) - 1, Math.round(cy + Math.sin(a) * (r + 12)) - 1, 3, 3);
    }
  },
  bridges(ctx, L) {
    for (const b of L.bridges) {
      const x0 = b.tx0 * T, x1 = (b.tx1 + 1) * T, y0 = b.ty * T;
      const pts = [];
      for (let x = x0; x <= x1; x += 4) pts.push([x, y0 + L.bridgeSag(Math.min(b.tx1, Math.floor(x / T)), b.ty, x)]);
      // postes
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(x0 - 3, y0 - 14, 3, 20); ctx.fillRect(x1, y0 - 14, 3, 20);
      ctx.fillStyle = '#9a6a3a'; ctx.fillRect(x0 - 3, y0 - 15, 3, 2); ctx.fillRect(x1, y0 - 15, 3, 2);
      // corda de mão
      ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = 1; ctx.beginPath();
      pts.forEach(([x, y], i) => { const yy = y - 9 - (y - y0) * -0.1 + Math.sin((x - x0) / (x1 - x0) * Math.PI) * 3; i ? ctx.lineTo(x, yy) : ctx.moveTo(x0 - 2, y0 - 13); });
      ctx.lineTo(x1 + 1, y0 - 13); ctx.stroke();
      // tábuas
      for (let x = x0; x < x1; x += 8) {
        const y = Math.round(y0 + L.bridgeSag(Math.floor((x + 4) / T), b.ty, x + 4));
        ctx.fillStyle = '#b07a3e'; ctx.fillRect(x, y, 7, 3);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(x, y + 3, 7, 1);
        ctx.fillStyle = '#d9c08a'; ctx.fillRect(x + 3, y - 9 + Math.round((y - y0) * 0.6), 1, 9 - Math.round((y - y0) * 0.6));
      }
    }
  },
  crumbles(ctx, L) {
    for (const c of L.crumbles) {
      if (c.state === 'gone') continue;
      const sh = c.state === 'shake' ? Math.round((Math.random() - 0.5) * 2) : 0;
      const x = c.tx * T + sh, y = c.ty * T;
      ctx.fillStyle = '#8d7b68'; ctx.fillRect(x, y, T, 6);
      ctx.fillStyle = '#b3a089'; ctx.fillRect(x, y, T, 1);
      ctx.fillStyle = '#5d4d3e'; ctx.fillRect(x, y + 6, T, 1);
      ctx.fillRect(x + 5, y + 1, 1, 3); ctx.fillRect(x + 6, y + 3, 1, 2); ctx.fillRect(x + 11, y + 2, 1, 4);
      if (!this.mine && !this.desert) { ctx.fillStyle = '#4cc94c'; ctx.fillRect(x + 1, y - 1, 3, 1); ctx.fillRect(x + 9, y - 1, 2, 1); }
    }
  },
  // lava a ferver (desenhada todos os frames, por baixo das tábuas)
  lava(ctx, L, cx, cy, time) {
    for (const [tx, ty] of L.lavaTiles) {
      const x = tx * T, y = ty * T + 4;
      if (x < cx - T || x > cx + VIEW_W || y < cy - T || y > cy + VIEW_H + T) continue;
      ctx.fillStyle = '#a8200a'; ctx.fillRect(x, y, T, T - 4);
      ctx.fillStyle = '#e04a14'; ctx.fillRect(x, y + 1, T, 5);
      for (let i = 0; i < T; i += 2) {
        const w = Math.sin((x + i) * 0.3 + time * 3.2) + Math.sin((x + i) * 0.11 - time * 1.7);
        ctx.fillStyle = w > 0.9 ? '#ffe36a' : '#ff8a1e'; ctx.fillRect(x + i, y + (w > 0.5 ? -1 : 0), 2, w > 0.9 ? 2 : 1);
      }
      const b = hash2(tx * 7, Math.floor(time * 1.5 + tx * 0.37));
      if (b > 0.72) { const bx = x + 3 + Math.floor(b * 40) % 10, r = (time * 1.5 + tx * 0.37) % 1; ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx, y + 3 - Math.round(r * 3), 2, 2); }
    }
  },
  particles(ctx, list) {
    for (const p of list) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'text') { Font.draw(ctx, p.text, p.x, p.y, { align: 'center', color: '#ffe066' }); continue; }
      if (p.kind === 'flame') {
        const k = p.life / p.max;
        ctx.globalAlpha = Math.min(1, k * 1.6); ctx.fillStyle = k > 0.6 ? '#fff3a0' : k > 0.3 ? '#ffb020' : '#ff3b1f';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); continue;
      }
      if (p.kind === 'ring') {
        const k = 1 - p.life / p.max;
        ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.strokeStyle = p.color; ctx.lineWidth = 3 - k * 2;
        ctx.beginPath(); ctx.arc(Math.round(p.x), Math.round(p.y), 6 + k * 80, 0, Math.PI * 2); ctx.stroke(); continue;
      }
      if (p.kind === 'heart') {
        ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = '#ff6fa8';
        const hx = Math.round(p.x) - 2, hy = Math.round(p.y);
        ctx.fillRect(hx, hy, 2, 1); ctx.fillRect(hx + 3, hy, 2, 1); ctx.fillRect(hx, hy + 1, 5, 1); ctx.fillRect(hx + 1, hy + 2, 3, 1); ctx.fillRect(hx + 2, hy + 3, 1, 1);
        continue;
      }
      if (p.kind === 'bubble') {
        ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = '#e8f8ff';
        const bx = Math.round(p.x + Math.sin(p.life * 9) * 1.5), by = Math.round(p.y);
        ctx.fillRect(bx, by - 1, 1, 1); ctx.fillRect(bx - 1, by, 1, 1); ctx.fillRect(bx + 1, by, 1, 1); ctx.fillRect(bx, by + 1, 1, 1); continue;
      }
      if (p.kind === 'wind') { ctx.globalAlpha = Math.min(0.7, p.life); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 12, 1); continue; }
      if (p.kind === 'feather') {
        ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x + Math.sin(p.life * 8) * 3), Math.round(p.y), 3, 1); continue;
      }
      if (p.kind === 'leaf') {
        const sw = Math.sin(p.life * 2.6) * 5;
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x + sw), Math.round(p.y), Math.cos(p.life * 2.6) > 0 ? 3 : 2, 2);
        continue;
      }
      ctx.globalAlpha = p.kind === 'dust' ? a * 0.7 : Math.min(1, a * 1.5);
      ctx.fillStyle = p.color;
      const s = p.kind === 'dust' ? Math.ceil(p.size * (1.6 - a)) : p.size;
      if (p.kind === 'spark') {
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
      } else ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  },
};
