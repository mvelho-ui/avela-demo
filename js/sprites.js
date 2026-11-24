'use strict';
// =====================================================================
//  Sprites procedurais (desenhados por código, sem imagens externas).
// =====================================================================
const C = {
  FUR: '#d9541e', FUR_D: '#a83a12', FUR_L: '#f07a3a', BELLY: '#f6d7a7',
  TAIL: '#e0662a', TAIL_L: '#f59a4a', TIP: '#f7d9a0', EYE: '#1a1020',
  GOG: '#23c6c6', GOG_D: '#178f8f', LENS: '#aef6ff', SCARF: '#ffd23f', SCARF_D: '#d9a520',
  SHOE: '#1fb5a8', SOLE: '#ffffff', MEMB: '#f0a060',
};
function ell(ctx, x, y, rx, ry, col, rot = 0) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); ctx.fill();
}
function poly(ctx, pts, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
}
// cauda: lista de pontos + raios, desenhada como cadeia de círculos (efeito "fofo")
function tail(ctx, pts, radii) {
  const N = 14, sm = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(u)), f = u - k;
    sm.push([lerp(pts[k][0], pts[k + 1][0], f), lerp(pts[k][1], pts[k + 1][1], f), lerp(radii[k], radii[k + 1], f)]);
  }
  for (const [x, y, r] of sm) ell(ctx, x, y, r + 1, r + 1, C.FUR_D);
  for (const [x, y, r] of sm) ell(ctx, x, y, r, r, C.TAIL);
  for (const [x, y, r] of sm) ell(ctx, x - 0.6, y - 0.6, r * 0.5, r * 0.5, C.TAIL_L);
  const e = sm[sm.length - 1]; ell(ctx, e[0], e[1], e[2] * 0.8, e[2] * 0.8, C.TIP);
}
function mixPts(a, b, k) { return a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]); }

Object.assign(Gfx, {
  // Super Avelã: o corpo fica todo vermelho e uma aura de fogo segue a silhueta
  // (brilho desfocado + línguas de fogo + contorno laranja/amarelo a tremer).
  squirrel(ctx, p) {
    if (!p.super) return this.squirrelBody(ctx, p);
    const S = 96, ox = 48, oy = 62;
    const c = this._sc || (this._sc = document.createElement('canvas'));
    const s = this._ss || (this._ss = document.createElement('canvas'));
    c.width = c.height = s.width = s.height = S;
    const g = c.getContext('2d'), h = s.getContext('2d');
    const saved = Object.assign({}, C);
    Object.assign(C, { FUR: '#e3160b', FUR_D: '#7e0804', FUR_L: '#ff6a40', TAIL: '#ea1e0c', TAIL_L: '#ff7a2a',
      TIP: '#ffe066', BELLY: '#ff9478', MEMB: '#ff5030' });
    try { this.squirrelBody(g, Object.assign(Object.create(p), { x: ox, y: oy })); } finally { Object.assign(C, saved); }
    const tint = col => {
      h.globalCompositeOperation = 'copy'; h.drawImage(c, 0, 0);
      h.globalCompositeOperation = 'source-in'; h.fillStyle = col; h.fillRect(0, 0, S, S);
      h.globalCompositeOperation = 'source-over';
    };
    const t = p.anim, A = ctx.globalAlpha, px = Math.round(p.x) - ox, py = Math.round(p.y) - oy;
    const ccx = Math.round(p.cx), ccy = Math.round(p.cy);
    ctx.save();
    tint('#ff2200');                                                  // 1) brilho vermelho que pulsa
    ctx.filter = 'blur(4px)'; ctx.globalAlpha = A * (0.8 + Math.sin(t * 9) * 0.15);
    const k = 1.22 + Math.sin(t * 9) * 0.05;
    ctx.drawImage(s, ccx - (ccx - px) * k, ccy - (ccy - py) * k, S * k, S * k);
    ctx.filter = 'none';
    tint('#ff7a00'); ctx.globalAlpha = A * 0.55;                      // 2) línguas de fogo a subir
    for (let i = 0; i < 3; i++) {
      const up = 3 + i * 2.5 + Math.abs(Math.sin(t * 14 + i * 1.7)) * 4;
      ctx.drawImage(s, px + Math.sin(t * 11 + i * 2) * 1.5, py - up, S, S + up * 0.5);
    }
    ctx.globalAlpha = A * 0.9;                                        // 3) contorno laranja a tremer
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + t * 4, r = 2.2 + Math.sin(t * 20 + i) * 0.7; ctx.drawImage(s, px + Math.cos(a) * r, py + Math.sin(a) * r); }
    tint('#ffd23f');                                                  // 4) filete amarelo por dentro
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 - t * 5; ctx.drawImage(s, px + Math.cos(a) * 1.1, py + Math.sin(a) * 1.1); }
    ctx.restore();
    ctx.drawImage(c, px, py);
  },
  squirrelBody(ctx, p) {
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.rotate(p.angle);
    ctx.scale(p.facing, 1);
    if (p.state === 'dead' || p.hurtT > 0) this.sqHurt(ctx, p);
    else if (p.state === 'surf') { this.surfboard(ctx); this.sqCrouch(ctx, p); }
    else if (p.swimming && p.state === 'normal') this.sqSwim(ctx, p);
    else if (p.state === 'climb' || p.state === 'trunk' || p.state === 'swing' || p.state === 'zip' || (p.wallSlideT > 0 && !p.onGround)) this.sqClimb(ctx, p);
    else if (p.glide) this.sqGlide(ctx, p);
    else if (p.ball || p.rolling || p.state === 'loop' || p.spinCharge > 0) this.sqBall(ctx, p);
    else if (p.crouch) this.sqCrouch(ctx, p);
    else this.sqStand(ctx, p);
    if (p.spinT > 0 && p.state !== 'dead') {
      const a0 = p.anim * 32;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(245,154,74,0.9)';
      ctx.beginPath(); ctx.arc(0, -10, 13, a0, a0 + 4.2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(247,217,160,0.9)';
      ctx.beginPath(); ctx.arc(0, -10, 15, a0 + 0.6, a0 + 3.6); ctx.stroke();
    }
    ctx.restore();
  },
  sqHead(ctx, hx, hy, o = {}) {
    // orelha + tufo (esquilo-vermelho)
    poly(ctx, [[hx - 3, hy - 3], [hx - 1.5, hy - 10], [hx + 1, hy - 4]], C.FUR);
    poly(ctx, [[hx - 2.2, hy - 4], [hx - 1.5, hy - 8], [hx, hy - 4.5]], C.FUR_D);
    ctx.fillStyle = C.FUR_D; ctx.fillRect(hx - 2.5, hy - 12, 2, 3);
    ell(ctx, hx, hy, 5.2, 5, C.FUR);
    ell(ctx, hx + 3.6, hy + 1.6, 3.2, 2.6, C.BELLY);
    ell(ctx, hx + 6.4, hy + 0.6, 1.6, 1.3, C.EYE);
    if (o.xEyes) {
      ctx.fillStyle = C.EYE; ctx.fillRect(hx + 1.5, hy - 2, 1, 1); ctx.fillRect(hx + 3.5, hy - 2, 1, 1);
      ctx.fillRect(hx + 2.5, hy - 1, 1, 1); ctx.fillRect(hx + 1.5, hy, 1, 1); ctx.fillRect(hx + 3.5, hy, 1, 1);
    } else {
      ell(ctx, hx + 2.3, hy - 1.1, 1.7, 2.1, '#ffffff');
      ell(ctx, hx + 3, hy - 0.9, 0.95, 1.4, C.EYE);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 2.6, hy - 2.2, 1, 1);
    }
    // óculos de aviadora na testa
    ctx.fillStyle = C.GOG_D; ctx.fillRect(hx - 5, hy - 4.6, 9, 1.6);
    ell(ctx, hx + 0.2, hy - 4.2, 2, 1.8, C.GOG);
    ell(ctx, hx + 0.2, hy - 4.2, 1.1, 1, C.LENS);
  },
  sqScarf(ctx, x, y, p, speed) {
    const flap = Math.sin(p.anim * 22) * 1.5, len = 4 + Math.min(7, speed * 0.02);
    poly(ctx, [[x, y - 1], [x - len, y - 2 + flap], [x - len + 1, y + 1.5 + flap], [x, y + 1.5]], C.SCARF_D);
    ctx.fillStyle = C.SCARF; ctx.fillRect(x - 1, y - 1.5, 6, 3);
  },
  shoe(ctx, x, y) { ell(ctx, x, y, 2.7, 1.7, C.SHOE); ctx.fillStyle = C.SOLE; ctx.fillRect(Math.round(x - 2.5), Math.round(y + 1), 5, 1); },

  // agachada (↓ parada): cauda enrolada baixa, corpo encolhido, a olhar para baixo
  sqCrouch(ctx, p) {
    tail(ctx, [[-4, -3], [-10, -5], [-13, -10], [-11, -15], [-7, -15]], [3, 4.5, 5, 4.5, 3.2]);
    this.shoe(ctx, -2.5, -1); this.shoe(ctx, 3.5, -1);
    ctx.strokeStyle = C.FUR_D; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-1, -4); ctx.lineTo(3, -2); ctx.stroke();
    this.sqScarf(ctx, 0, -9, p, 0);
    ell(ctx, 0, -5, 6, 4.5, C.FUR); ell(ctx, 2.2, -4.5, 3.4, 3.2, C.BELLY);
    ell(ctx, 4, -5, 1.6, 2.6, C.FUR_D, 0.9);
    ctx.save(); ctx.translate(3, -11); ctx.rotate(0.3); this.sqHead(ctx, 0, 0); ctx.restore();
  },
  sqStand(ctx, p) {
    const sp = Math.abs(p.vx), k = clamp(sp / 400, 0, 1), sway = Math.sin(p.anim * 3) * 0.8;
    const idle = [[-4, -6], [-10, -11], [-12, -19 + sway], [-8, -25 + sway], [-4, -24 + sway]];
    const fast = [[-4, -8], [-11, -10], [-17, -12 + sway], [-22, -13], [-25, -11]];
    tail(ctx, mixPts(idle, fast, k), [3, 4.5, 5, 4.5, 3.2]);
    const air = !p.onGround && p.state !== 'loop';
    let lean = p.skid ? -0.28 : clamp(sp / 1400, 0, 0.3);
    if (air) lean = 0.05;
    const bob = p.idleT > 0 ? Math.sin(p.anim * 4) * 0.4 : 0;
    ctx.save(); ctx.rotate(lean);
    // pernas
    const leg = (i) => {
      let fx, fy;
      if (air) { fx = i ? 3 : -3; fy = i ? -2 : -3; }
      else if (sp < 5) { fx = i ? 2.5 : -2.5; fy = -1; }
      else if (p.skid) { fx = i ? 5 : 2; fy = -1; }
      else { const a = p.runPhase + i * Math.PI; fx = -Math.cos(a) * (5 + k * 2) + 0.5; fy = -Math.max(0, Math.sin(a)) * (4 + k * 2) - 1; }
      ctx.strokeStyle = i ? C.FUR : C.FUR_D; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(fx, fy - 1); ctx.stroke();
      this.shoe(ctx, fx + 1, fy);
    };
    leg(0);
    this.sqScarf(ctx, -1, -14 + bob, p, sp);
    ell(ctx, 0, -9 + bob, 5, 6.5, C.FUR);
    ell(ctx, 1.8, -8.5 + bob, 3, 4.5, C.BELLY);
    leg(1);
    if (p.throwT > 0) ell(ctx, 6, -12 + bob, 1.6, 3.6, C.FUR_D, -1.35);   // braço esticado a atirar
    else {
      const arm = sp > 5 && !air ? Math.cos(p.runPhase) * 0.9 : air ? -1.2 : 0.3;
      ell(ctx, 3, -10 + bob, 1.6, 3.2, C.FUR_D, arm);
    }
    if (p.lookUp && !air && sp < 5) { ctx.save(); ctx.translate(1.5, -18 + bob); ctx.rotate(-0.45); this.sqHead(ctx, 0, 0); ctx.restore(); }   // a olhar para cima
    else this.sqHead(ctx, 2, -17.5 + bob);
    ctx.restore();
  },
  sqBall(ctx, p) {
    ctx.save(); ctx.translate(0, -9); ctx.rotate(p.rollRot || p.anim * 20);
    ell(ctx, 0, 0, 8.6, 8.6, C.FUR_D);
    ell(ctx, 0, 0, 7.6, 7.6, C.FUR);
    ctx.lineWidth = 3; ctx.strokeStyle = C.TAIL_L; ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, 4.3); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = C.TIP; ctx.beginPath(); ctx.arc(0, 0, 5.4, 3.6, 4.3); ctx.stroke();
    ell(ctx, 2.5, -3.5, 2.2, 2, C.BELLY);
    ell(ctx, 3, -4, 0.9, 1.1, C.EYE);
    ctx.fillStyle = C.GOG; ctx.fillRect(-4, -7, 6, 1.5);
    ctx.restore();
  },
  sqGlide(ctx, p) {
    const fl = Math.sin(p.anim * 26) * 0.7;
    ctx.save(); ctx.translate(0, -10);
    tail(ctx, [[-7, -1], [-12, -2], [-17, -3 + fl], [-21, -3]], [3, 4, 4.5, 3.4]);
    this.sqScarf(ctx, 6, -2, p, 300);
    poly(ctx, [[9, -3], [8, 2 + fl], [0, 3.5 + fl], [-8, 2 + fl], [-8, -2]], C.FUR_D);
    poly(ctx, [[8.5, -2.5], [7.5, 1.4 + fl], [0, 2.8 + fl], [-7.5, 1.4 + fl], [-7.5, -1.5]], C.MEMB);
    ell(ctx, 0, -1.5, 7, 3.4, C.FUR);
    ell(ctx, 0.5, 0.4, 5, 1.6, C.BELLY);
    this.shoe(ctx, -8, 2.5 + fl); this.shoe(ctx, 10, 1.5 + fl);
    // cabeça com os óculos postos
    poly(ctx, [[6, -5], [5, -11], [8.5, -6]], C.FUR);
    ctx.fillStyle = C.FUR_D; ctx.fillRect(4.5, -13, 2, 3);
    ell(ctx, 8, -3, 4.4, 4, C.FUR);
    ell(ctx, 11, -2.2, 2.6, 2, C.BELLY);
    ell(ctx, 13.2, -2.8, 1.3, 1.1, C.EYE);
    ctx.fillStyle = C.GOG_D; ctx.fillRect(3.5, -5.2, 8, 1.6);
    ell(ctx, 9.6, -4.4, 2.1, 1.9, C.GOG); ell(ctx, 9.9, -4.6, 1.2, 1, C.LENS);
    ctx.restore();
  },
  // a nadar (água funda): deitada, óculos postos, pernas a bater, cauda a ondular; com a botija do Leão às costas.
  // No dash fica esticada como uma seta, na direcção do impulso.
  sqSwim(ctx, p) {
    const dash = p.dashT > 0, t = p.anim, kick = Math.sin(t * (dash ? 34 : 11)), w = Math.sin(t * (dash ? 16 : 7));
    const str = p.strokeT > 0 ? p.strokeT / 0.35 : 0;
    const tilt = dash ? Math.atan2(p.dashDY, Math.abs(p.dashDX) || 0.0001) : clamp(p.vy / 600, -0.35, 0.35);
    ctx.save(); ctx.translate(0, -10); ctx.rotate(tilt);
    if (dash) {                                                       // riscos de água atrás
      ctx.fillStyle = 'rgba(220,245,255,0.75)';
      for (let k = 0; k < 4; k++) ctx.fillRect(-30 - k * 5 + ((t * 120) % 5), -4 + k * 2.5, 9 - k, 1);
    }
    tail(ctx, dash ? [[-7, -1], [-13, -1.5 + w * 0.4], [-19, -1.5 + w * 0.8], [-25, -1]]
      : [[-7, -1], [-12, -2.5 + w * 0.8], [-17, -3 + w * 1.8], [-22, -1.5 + w * 1.2]], [3, 4, 4.5, 3.4]);
    // pernas a bater, para trás
    ctx.strokeStyle = C.FUR_D; ctx.lineWidth = 3;
    for (const s of [1, -1]) {
      const fy = (dash ? 0.5 : 1) + s * kick * (dash ? 1 : 2.2);
      ctx.beginPath(); ctx.moveTo(-4, 0.5); ctx.lineTo(-9, fy + 0.5); ctx.stroke();
      this.shoe(ctx, -11, fy);
    }
    // botija de oxigénio às costas (depois do Leão)
    if (typeof Game !== 'undefined' && Game.hasTank) {
      ctx.fillStyle = '#b8861a'; ctx.fillRect(-7, -8.5, 11, 5);
      ctx.fillStyle = '#e8b830'; ctx.fillRect(-7, -9, 11, 4); ell(ctx, -7, -7, 1.6, 2.4, '#e8b830'); ell(ctx, 4, -7, 1.6, 2.4, '#e8b830');
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(-6, -8.5, 9, 1);
      ctx.fillStyle = '#4a7acf'; ctx.fillRect(-2.5, -9, 2, 4);
      ctx.fillStyle = '#7a7e89'; ctx.fillRect(5, -8, 2, 2); ctx.fillRect(6, -10, 1, 2);       // válvula
      ctx.strokeStyle = '#3a3e48'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6.5, -10); ctx.quadraticCurveTo(10, -10, 10.5, -5); ctx.stroke();   // tubo até à boca
    }
    // corpo
    ell(ctx, 0, -1.5, 7.5, 3.6, C.FUR);
    ell(ctx, 0.5, 0.7, 5.5, 1.8, C.BELLY);
    if (Game.hasTank) { ctx.fillStyle = '#3a3e48'; ctx.fillRect(-4, -4.5, 1, 6); ctx.fillRect(1, -4.5, 1, 6); }   // alças
    // braços: esticados à frente no dash; a remar na braçada; a ondular devagar
    if (dash) ell(ctx, 10, 0.5, 3.4, 1.2, C.FUR_D);
    else {
      const a = str > 0 ? lerp(-1.3, 1.4, 1 - str) : Math.sin(t * 5) * 0.4 + 0.3;
      ctx.save(); ctx.translate(5, 0.5); ctx.rotate(a); ell(ctx, 2.5, 0, 3, 1.2, C.FUR_D); ctx.restore();
    }
    // cabeça com os óculos postos
    poly(ctx, [[6, -5], [5, -11], [8.5, -6]], C.FUR);
    ctx.fillStyle = C.FUR_D; ctx.fillRect(4.5, -13, 2, 3);
    ell(ctx, 8, -3, 4.4, 4, C.FUR);
    ell(ctx, 11, -2.2, 2.6, 2, C.BELLY);
    ell(ctx, 13.2, -2.8, 1.3, 1.1, C.EYE);
    ctx.fillStyle = C.GOG_D; ctx.fillRect(3.5, -5.2, 8, 1.6);
    ell(ctx, 9.6, -4.4, 2.1, 1.9, C.GOG); ell(ctx, 9.9, -4.6, 1.2, 1, C.LENS);
    ctx.restore();
  },
  sqClimb(ctx, p) {
    const cp = p.y * 0.28, s = Math.sin(cp);
    tail(ctx, [[-3, -6], [-7, -3], [-8, 2], [-5, 6]], [3, 4.2, 4.4, 3.2]);
    ctx.strokeStyle = C.FUR_D; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(1, -4); ctx.lineTo(4, -3 + s * 2); ctx.stroke();
    this.shoe(ctx, 4.5, -2 + s * 2);
    ell(ctx, 0, -10, 4.6, 7, C.FUR);
    ell(ctx, 2.2, -10, 2.2, 5, C.BELLY);
    ctx.strokeStyle = C.FUR; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(2, -12); ctx.lineTo(5, -17 + s * 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(5, -14 - s * 3); ctx.stroke();
    this.sqScarf(ctx, -1, -15, p, 0);
    this.sqHead(ctx, 1, -19);
  },
  sqHurt(ctx, p) {
    ctx.save(); ctx.rotate(-0.45);
    tail(ctx, [[-4, -6], [-10, -9], [-14, -14], [-13, -20]], [3, 4.4, 4.8, 3.4]);
    ell(ctx, 0, -9, 5, 6.5, C.FUR); ell(ctx, 1.8, -8.5, 3, 4.5, C.BELLY);
    ell(ctx, 4, -14, 1.6, 3.2, C.FUR_D, -0.8);
    this.shoe(ctx, -3, -1); this.shoe(ctx, 4, -3);
    this.sqHead(ctx, 2, -17.5, { xEyes: true });
    ctx.restore();
  },

  // ---------------- colecionáveis ----------------
  acorn(ctx, x, y, t) {
    const w = Math.abs(Math.cos(t * 2.2)) * 0.6 + 0.4;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(w, 1);
    ell(ctx, 0, 1.6, 3.4, 3.9, '#c27b2c');
    ell(ctx, -1, 1, 1, 1.8, '#e9a65a');
    ctx.fillStyle = '#8a4f1c'; ctx.fillRect(-0.5, 5, 1, 1);
    ell(ctx, 0, -1.4, 4, 2.4, '#6b4423');
    ctx.fillStyle = '#8a5a32'; ctx.fillRect(-2, -2, 1, 1); ctx.fillRect(1, -2, 1, 1); ctx.fillRect(-0.5, -3, 1, 1);
    ctx.fillStyle = '#4a2a12'; ctx.fillRect(-0.5, -5, 1, 2);
    ctx.restore();
  },
  golden(ctx, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    ctx.globalAlpha = 0.3 + Math.sin(t * 4) * 0.12;
    ell(ctx, x, y, 11, 11, '#fff3a0'); ctx.globalAlpha = 1;
    ell(ctx, x, y + 1, 6, 6, '#c8961c');
    ell(ctx, x, y + 1, 5.2, 5.2, '#e8b923');
    ell(ctx, x - 2, y - 1, 2, 2, '#fff3a0');
    poly(ctx, [[x - 6, y - 2], [x - 3, y - 7], [x, y - 4], [x + 3, y - 7], [x + 6, y - 2], [x, y - 3]], '#7cc242');
    const a = t * 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(y + Math.sin(a) * 9), 1, 1);
    ctx.fillRect(Math.round(x + Math.cos(a + 3) * 8), Math.round(y + Math.sin(a + 3) * 8), 1, 1);
  },

  // ---------------- inimigos ----------------
  beetle(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const st = Math.floor(e.t * 12) % 2;
    const C = e.style === 'scarab' ? ['#1a2a28', '#1f5a52', '#2f8a7a', '#d9b34a', '#14302c'] : ['#1e0f2c', '#3a1858', '#5b2a86', '#9b59d0', '#2c1440'];   // escaravelho das ruínas: verde-azulado e dourado
    ctx.fillStyle = C[0];
    for (let i = 0; i < 3; i++) ctx.fillRect(-5 + i * 5 + (st ? 1 : -1) * (i % 2 ? 1 : -1), -2, 1, 2);
    ell(ctx, 0, -6, 8.4, 5.8, C[1]);
    ell(ctx, 0, -6, 7.6, 5.2, C[2]);
    ell(ctx, -2, -8.5, 4, 1.8, C[3]);
    ctx.fillStyle = C[1]; ctx.fillRect(0, -11, 1, 9);
    ell(ctx, 7, -4, 3, 3, C[4]);
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(8, -5, 1.5, 1.5);
    ctx.fillStyle = '#c9c9a0'; ctx.fillRect(9.5, -3, 2, 1);
    Gfx.ctlLight(ctx, e, 3, -12);
    ctx.restore();
  },
  wasp(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir || 1, 1);
    const fl = Math.abs(Math.sin(e.t * 60));
    ctx.globalAlpha = 0.75;
    ell(ctx, -2, -5, 4, 1 + fl * 1.8, '#e6f4ff'); ell(ctx, 1, -5, 3, 1 + fl * 1.4, '#e6f4ff');
    ctx.globalAlpha = 1;
    poly(ctx, [[-5, -1], [-10, 1.5], [-5, 2.5]], '#222');
    ell(ctx, 0, 0.5, 6, 3.6, '#ffd400');
    ctx.fillStyle = '#222'; ctx.fillRect(-3, -2.8, 2, 6.6); ctx.fillRect(1, -3, 2, 7);
    ell(ctx, 6, -0.5, 2.8, 2.8, '#222');
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(7, -2, 1.5, 1.5);
    ctx.fillStyle = '#222'; ctx.fillRect(6, -5, 1, 2);
    Gfx.ctlLight(ctx, e, 6, -6);
    ctx.restore();
  },
  caterpillar(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.side, e.up ? 1 : -1);
    const wig = Math.sin(e.t * 10);
    for (let i = 4; i >= 0; i--) {
      const y = 8 - i * 4.5, x = Math.sin(i * 1.3 + e.t * 6) * 1.2;
      ctx.fillStyle = '#245c1c'; ctx.fillRect(Math.round(x) - 5, Math.round(y), 2, 2);     // patinhas na parede
      ell(ctx, x, y, 4.2 + (i % 2) * 0.6, 3.2, i % 2 ? '#5fbf3a' : '#7ad44a');
      ctx.fillStyle = '#f2d23a'; ctx.fillRect(Math.round(x) + 1, Math.round(y) - 1, 1, 1);
    }
    ell(ctx, 0.5, -13.5, 4.6, 4.2, '#8a3fb0');                                         // cabeça
    ctx.fillStyle = '#ffffff'; ctx.fillRect(1, -15, 2, 2); ctx.fillStyle = '#1a1020'; ctx.fillRect(2, -15, 1, 1);
    ctx.fillStyle = '#1a1020'; ctx.fillRect(-2 + Math.round(wig), -19, 1, 3); ctx.fillRect(2 - Math.round(wig), -19, 1, 3);
    Gfx.ctlLight(ctx, e, 0, -18);
    ctx.restore();
  },
  mole(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), h = e.h, d = e.dir;
    const rk = e.kind === 'rock', M = rk ? ['#433d38', '#5f574f', '#8a8178'] : ['#5e3518', '#7a4a22', '#9a6a3a'];
    ell(ctx, x, y - 2, 11, 5, M[0]);                                          // monte de terra (atrás)
    if (h > 0.02) {
      ctx.save(); ctx.beginPath(); ctx.rect(x - 14, y - 40, 28, 38); ctx.clip();
      const by = y - 1 - 9 * h;
      ell(ctx, x, by, 7, 7.5, '#5a4a52'); ell(ctx, x + d * 2, by + 2, 4, 4.5, '#8a7a82');
      ell(ctx, x + d * 6, by + 1, 3, 2.2, '#ff9aa8');                           // focinho
      ctx.fillStyle = '#1a1020'; ctx.fillRect(x + d * 3 - (d < 0 ? 1 : 0), Math.round(by - 2), 1, 1);
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(x, by - 4, 7.5, 5, 0, Math.PI, Math.PI * 2); ctx.fill();   // capacete
      ctx.fillRect(x - 8, Math.round(by - 4), 16, 2);
      ell(ctx, x + d * 3, by - 7, 2, 1.6, e.dead ? '#fff6a0' : Math.floor(e.t * 4) % 2 ? '#ff3b3b' : '#a8122a');   // lanterna de controlo
      if (e.throwT > 0) ell(ctx, x + d * 5, by - 9, 2.4, 2.4, '#ff9aa8');
      else { ell(ctx, x - 5, by + 4, 2.2, 1.8, '#ff9aa8'); ell(ctx, x + 5, by + 4, 2.2, 1.8, '#ff9aa8'); }
      ctx.restore();
    }
    ctx.fillStyle = M[1]; ctx.beginPath(); ctx.ellipse(x, y - 1, 11, 4, 0, 0, Math.PI); ctx.fill();   // frente do monte
    ctx.fillStyle = M[2]; ctx.fillRect(x - 6, y - 2, 2, 1); ctx.fillRect(x + 4, y - 1, 2, 1);
  },
  crow(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const f = Math.sin(e.t * 14);
    poly(ctx, [[-8, -1], [-14, -4], [-13, 2]], '#141824');                    // cauda
    poly(ctx, [[-3, -2], [3, -2], [-1, -2 - 9 * f], [-6, -2 - 7 * f]], '#262c40');   // asa de trás
    ell(ctx, 0, 0, 8, 5, '#1d2333');
    ell(ctx, 6, -3, 4.2, 4, '#1d2333');
    poly(ctx, [[9, -4], [14, -2.5], [9, -1]], '#ffb020');                      // bico
    ctx.fillStyle = '#ffffff'; ctx.fillRect(6, -5, 2, 2); ctx.fillStyle = '#e8203a'; ctx.fillRect(7, -5, 1, 1);
    poly(ctx, [[2, -1], [6, 1], [3, 4]], '#e8203a');                           // lenço vermelho do Barão
    poly(ctx, [[-2, -1], [4, -1], [1, -1 - 10 * f], [-5, -1 - 8 * f]], '#323a54');   // asa da frente
    if (e.dropT > 0) { ctx.fillStyle = '#ffb020'; ctx.fillRect(-2, 4, 1, 2); ctx.fillRect(2, 4, 1, 2); }
    Gfx.ctlLight(ctx, e, 5, -8);
    ctx.restore();
  },
  burr(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    if (e.kind === 'rock') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.round(e.rot * 4) / 4);
      poly(ctx, [[-5, -2], [-2, -5], [3, -4], [5, 0], [3, 4], [-3, 4]], '#4b4540');
      poly(ctx, [[-4, -2], [-2, -4], [2, -3], [3, 0], [1, 2], [-3, 2]], '#8a8178');
      ctx.fillStyle = '#b8b0a6'; ctx.fillRect(-2, -3, 2, 1);
      ctx.restore(); return;
    }
    if (e.kind === 'venom') {                       // bola de veneno da Cobra Real
      ctx.save(); ctx.globalAlpha = 0.3; ell(ctx, x, y, 7, 7, '#8aff3a'); ctx.restore();
      ell(ctx, x, y, 4.5, 4, '#3a9a1a'); ell(ctx, x - 1, y - 1, 2.6, 2.2, '#8aff3a'); ctx.fillStyle = '#e8ffc0'; ctx.fillRect(x - 2, y - 2, 1, 1);
      return;
    }
    if (e.kind === 'fire') {
      const fl = Math.floor(e.t * 20) % 2;
      ctx.save(); ctx.globalAlpha = 0.35; ell(ctx, x, y, 8, 8, '#ff5a00'); ctx.restore();
      ell(ctx, x, y, 4.6 + fl * 0.6, 4.6, '#ff3d00'); ell(ctx, x, y, 3.2, 3.2, '#ffb020'); ell(ctx, x - 1, y - 1, 1.6, 1.6, '#fff6c0');
      return;
    }
    ctx.strokeStyle = '#d9e98a'; ctx.lineWidth = 1;
    for (let k = 0; k < 10; k++) {
      const a = e.rot + k / 10 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); ctx.stroke();
    }
    ell(ctx, x, y, 4.6, 4.6, '#3f7a1a'); ell(ctx, x, y, 3.6, 3.6, '#6aa12a'); ctx.fillStyle = '#b8d86a'; ctx.fillRect(x - 2, y - 2, 2, 1);
  },
  // ---------- deserto ----------
  cactus(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), h = (e.h || 1) * 14;
    const G = ['#2f7a34', '#3f9a3a', '#6cc45a'];
    ctx.fillStyle = G[0]; ctx.fillRect(x - 5, y - h + 3, 10, h - 3); ctx.beginPath(); ctx.arc(x, y - h + 4, 5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = G[1]; ctx.fillRect(x - 3, y - h + 2, 6, h - 2);
    ctx.fillStyle = G[2]; ctx.fillRect(x - 2, y - h + 3, 1, h - 4);
    if (e.h >= 2) {                                   // braços
      ctx.fillStyle = G[0]; ctx.fillRect(x - 10, y - h + 10, 5, 4); ctx.fillRect(x - 10, y - h + 4, 4, 8);
      ctx.fillRect(x + 5, y - h + 14, 5, 4); ctx.fillRect(x + 7, y - h + 8, 4, 8);
      ctx.fillStyle = G[1]; ctx.fillRect(x - 9, y - h + 5, 2, 6); ctx.fillRect(x + 8, y - h + 9, 2, 6);
    }
    ctx.fillStyle = '#fff6d0';                         // picos
    for (let k = 0; k < h; k += 4) { ctx.fillRect(x - 6, y - h + 4 + k, 1, 1); ctx.fillRect(x + 5, y - h + 6 + k, 1, 1); ctx.fillRect(x, y - h + 2 + k, 1, 1); }
    if ((e.h || 1) >= 2) { ctx.fillStyle = '#ff7aa8'; ctx.fillRect(x - 1, y - h - 1, 3, 2); }   // flor
  },
  scorpion(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const st = Math.floor(e.t * 10) % 2, B = ['#8a4a1a', '#b8682a', '#e08a3a'];
    ctx.fillStyle = B[0]; for (let i = 0; i < 3; i++) ctx.fillRect(-5 + i * 4, -2 + ((i + st) % 2), 1, 2);   // patas
    ell(ctx, 0, -4, 7, 3.5, B[0]); ell(ctx, 1, -5, 6, 2.6, B[1]);
    ell(ctx, 7, -4, 3.5, 2.6, B[1]);                                                                     // cabeça
    poly(ctx, [[8, -5], [14, -8], [16, -5], [12, -4]], B[0]); poly(ctx, [[8, -3], [14, -2], [16, -4], [12, -2]], B[0]);   // pinças
    ctx.fillStyle = '#1a1020'; ctx.fillRect(8, -6, 1, 1);
    // cauda em segmentos: enrolada por cima; na ferroada estica-se para a frente
    const sting = e.state === 'sting', aim = e.state === 'aim';
    const seg = sting ? [[-6, -6], [-6, -11], [-2, -14], [5, -13], [12, -10]] : aim ? [[-6, -6], [-8, -12], [-6, -17], [-1, -19], [3, -17]] : [[-6, -6], [-9, -10], [-8, -15], [-4, -17], [-1, -15]];
    seg.forEach(([sx, sy], i) => ell(ctx, sx, sy, 2.4 - i * 0.2, 2.2 - i * 0.2, i % 2 ? B[1] : B[0]));
    const [tx, ty] = seg[seg.length - 1];
    poly(ctx, [[tx, ty - 1], [tx + 4, ty + 1], [tx, ty + 2]], '#2a1a10');
    Gfx.ctlLight(ctx, e, 2, -10);
    ctx.restore();
  },
  vulture(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const B = ['#3a2a22', '#5a4434', '#7a5e48'];
    if (e.state === 'perch') {
      ell(ctx, 0, -9, 7, 9, B[0]); ell(ctx, -1, -9, 5, 7, B[1]);                                   // asas fechadas
      ctx.fillStyle = '#f0e8d8'; ctx.fillRect(1, -17, 6, 2);                                         // colar de penas
      ell(ctx, 5, -20, 3, 3, '#e8a0a0');                                                              // cabeça careca
      poly(ctx, [[7, -21], [11, -19], [7, -18]], '#e0c080');
      ctx.fillStyle = '#1a1020'; ctx.fillRect(6, -21, 1, 1);
      ctx.fillStyle = '#e0c080'; ctx.fillRect(-2, -1, 2, 2); ctx.fillRect(2, -1, 2, 2);
      Gfx.ctlLight(ctx, e, 4, -27);
    } else {
      const f = Math.sin(e.t * (e.state === 'swoop' ? 6 : 12));
      poly(ctx, [[-4, -1], [-22, -6 - 8 * f], [-18, 1], [-4, 3]], B[0]);
      ell(ctx, 0, 0, 9, 4, B[1]);
      poly(ctx, [[-9, -1], [-15, -3], [-14, 2]], B[0]);
      ctx.fillStyle = '#f0e8d8'; ctx.fillRect(6, -3, 3, 4);
      ell(ctx, 11, -2, 3, 2.6, '#e8a0a0'); poly(ctx, [[13, -3], [17, -1], [13, 0]], '#e0c080');
      ctx.fillStyle = '#1a1020'; ctx.fillRect(11, -3, 1, 1);
      poly(ctx, [[-2, -1], [14, -6 - 10 * f], [12, 2], [-2, 3]], B[2]);
      Gfx.ctlLight(ctx, e, 10, -8);
    }
    ctx.restore();
  },
  rattler(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), d = e.dir;
    ell(ctx, x, y - 1, 10, 3, '#d9a650');                                                            // monte de areia
    if (e.h < 0.1) {                                                                                  // escondida: só os olhos
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 3, y - 3, 2, 1); ctx.fillRect(x + 1, y - 3, 2, 1);
      ctx.fillStyle = '#1a1020'; ctx.fillRect(x - 2, y - 3, 1, 1); ctx.fillRect(x + 2, y - 3, 1, 1);
      return;
    }
    const h = e.h, S = ['#8a6a3a', '#b8925a', '#5a4024'];
    ell(ctx, x - d * 3, y - 3 * h, 8, 4 * h, S[0]); ell(ctx, x - d * 3, y - 4 * h, 6, 3 * h, S[1]);    // corpo enrolado
    ctx.fillStyle = S[2]; for (let k = -2; k <= 2; k++) ctx.fillRect(x - d * 3 + k * 3, y - 4 * h, 2, 1);
    const rx = x - d * 11, shake = e.state === 'rattle' ? (Math.floor(e.t * 40) % 2) : 0;           // guizo
    ctx.fillStyle = '#e0c890'; for (let k = 0; k < 3; k++) ctx.fillRect(rx - d * k * 2, y - 6 - k * 2 + shake, 2, 2);
    // pescoço e cabeça (no bote vão para a frente)
    const hx = x + d * (4 + e.reach), hy = y - 6 - 7 * h;
    ctx.strokeStyle = S[0]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - 4 * h); ctx.quadraticCurveTo(x + d * (2 + e.reach * 0.3), hy - 6, hx, hy); ctx.stroke();
    ctx.strokeStyle = S[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 4 * h); ctx.quadraticCurveTo(x + d * (2 + e.reach * 0.3), hy - 6, hx, hy); ctx.stroke();
    ell(ctx, hx + d * 2, hy, 4.5, 3, S[0]);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(hx + d * 2, hy - 2, 1, 1);
    if (e.state === 'strike' || e.state === 'hold') { ctx.fillStyle = '#e8203a'; ctx.fillRect(hx + d * 6, hy + 1, d * 3, 1); }   // língua
    Gfx.ctlLight(ctx, e, hx - 1, hy - 7);
  },
  // ---------- inimigos da mina ----------
  spider(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    ctx.fillStyle = '#c8c8d8'; ctx.fillRect(x, Math.round(e.top), 1, Math.max(0, y - Math.round(e.top) - 4));   // fio
    const k = Math.floor(e.t * (e.state === 'top' ? 3 : 10)) % 2;
    ctx.fillStyle = '#1a1020';
    for (let i = 0; i < 4; i++) {
      const ly = y - 2 + i * 1.5, sp = 7 + (i === 1 || i === 2 ? 1 : 0), kk = (i + k) % 2 ? 1 : -1;
      ctx.fillRect(x - sp, Math.round(ly + kk), sp - 2, 1); ctx.fillRect(x - sp, Math.round(ly + kk), 1, 3);
      ctx.fillRect(x + 3, Math.round(ly - kk), sp - 2, 1); ctx.fillRect(x + sp, Math.round(ly - kk), 1, 3);
    }
    ell(ctx, x + 0.5, y + 1, 5, 4.5, '#2c1a3a'); ell(ctx, x + 0.5, y - 3, 3.2, 2.8, '#3e2652');
    ctx.fillStyle = '#e8203a'; ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y, 1, 3);                     // cruz vermelha
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 1, y - 4, 1, 1); ctx.fillRect(x + 2, y - 4, 1, 1);
    Gfx.ctlLight(ctx, e, x, y - 8);
  },
  drillmole(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const rev = e.state === 'rev' || e.state === 'charge', sh = e.state === 'rev' ? (Math.floor(e.t * 30) % 2) : 0;
    ctx.translate(sh, 0);
    const st = Math.floor(e.t * (e.state === 'charge' ? 24 : 8)) % 2;
    ctx.fillStyle = '#2a2026'; ctx.fillRect(-6 + st, -2, 3, 2); ctx.fillRect(2 - st, -2, 3, 2);                 // patas
    ell(ctx, -1, -7, 9, 6.5, '#4a3c44'); ell(ctx, -2, -8, 7.5, 5, '#6a5a64');                                  // corpo
    ell(ctx, 6, -6, 3, 2.4, '#ff9aa8');                                                                       // focinho
    ctx.fillStyle = '#1a1020'; ctx.fillRect(3, -10, 1, 1);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(-1, -11, 7, 4, 0, Math.PI, Math.PI * 2); ctx.fill(); // capacete
    ctx.fillRect(-8, -11, 14, 2);
    // broca
    const spin = Math.floor(e.t * (rev ? 40 : 6)) % 3;
    poly(ctx, [[7, -11], [18, -7], [7, -3]], '#9aa0aa');
    ctx.fillStyle = '#5a5e69'; for (let i = 0; i < 3; i++) ctx.fillRect(8 + i * 3 + spin, -9 + i * 0.6, 1, 4 - i);
    ctx.fillStyle = '#d8dce4'; ctx.fillRect(8, -10, 6, 1);
    ctx.fillStyle = '#7a7e89'; ctx.fillRect(5, -9, 3, 5);
    if (e.state === 'stun') { ctx.fillStyle = '#ffe14a'; for (let k = 0; k < 3; k++) { const a = e.t * 6 + k * 2.1; ctx.fillRect(Math.round(Math.cos(a) * 7) - 1, Math.round(-17 + Math.sin(a) * 2), 3, 1); } }
    Gfx.ctlLight(ctx, e, -2, -17);
    ctx.restore();
  },
  salamander(ctx, e) {
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); ctx.scale(e.dir, 1);
    const wv = Math.sin(e.t * 8), open = e.spitT > 0;
    ctx.fillStyle = '#16121a';
    ctx.fillRect(-6, -2 + (wv > 0 ? 0 : 1), 2, 2); ctx.fillRect(3, -2 + (wv > 0 ? 1 : 0), 2, 2);              // patas
    poly(ctx, [[-7, -5], [-17, -3 + wv * 1.5], [-17, -2 + wv * 1.5], [-7, -2]], '#16121a');                   // cauda
    ell(ctx, -1, -4, 8, 3, '#16121a'); ell(ctx, 8, -5, 4, open ? 3 : 2.6, '#16121a');                          // corpo e cabeça
    if (open) { ctx.fillStyle = '#ff5a3a'; ctx.fillRect(9, -4, 3, 1); }
    ctx.fillStyle = '#ffd400';
    for (const [sx, sy] of [[-12, -4], [-8, -5], [-4, -6], [-1, -4], [2, -6], [5, -5], [8, -7], [-15, -3]]) ctx.fillRect(sx, sy, 2, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(9, -7, 1, 1);
    Gfx.ctlLight(ctx, e, 6, -11);
    ctx.restore();
  },
  stalactite(ctx, e) {
    const x = Math.round(e.x + (e.state === 'shake' ? (Math.floor(e.t * 40) % 2 ? 1 : -1) : 0)), y = Math.round(e.y);
    if (e.rock) {                                        // pedra do tecto do templo (rugido do Leão)
      if (e.state === 'shake') { ctx.fillStyle = 'rgba(200,190,160,0.5)'; for (let k = 0; k < 3; k++) ctx.fillRect(x - 6 + k * 5, y + 4 + Math.floor((e.t * 60 + k * 7) % 10), 1, 2); return; }
      ell(ctx, x, y + 8, 7, 6, '#5e685c'); ell(ctx, x - 2, y + 6, 4, 3, '#8a9488'); ctx.fillStyle = '#3a8a3a'; ctx.fillRect(x - 4, y + 2, 4, 1);
      return;
    }
    poly(ctx, [[x - 5, y], [x + 5, y], [x + 1, y + 16], [x, y + 16]], '#4b4540');
    poly(ctx, [[x - 4, y], [x, y], [x, y + 14]], '#8a8178');
    ctx.fillStyle = '#b8b0a6'; ctx.fillRect(x - 3, y + 1, 1, 4);
    if (e.state === 'hang' && Math.floor(e.t * 1.3) % 3 === 0) { ctx.fillStyle = '#7df9ff'; ctx.fillRect(x, y + 17 + Math.floor((e.t * 1.3 % 1) * 20), 1, 2); }   // pinga
  },
  butterfly(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), w = Math.abs(Math.sin(e.t * 16)) * 3 + 1;
    ctx.fillStyle = e.col; ctx.fillRect(x - w, y - 2, w, 3); ctx.fillRect(x + 1, y - 2, w, 3);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x, y - 2, 1, 4);
  },

  // ---------- decoração (pré-desenhada nos tiles) ----------
  deco(g, d) {
    const x = Math.round(d.x), y = Math.round(d.y), r = k => hash2(d.seed, k);
    switch (d.type) {
      case 'grass':
        for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? Gfx.pal.bush[1] : Gfx.pal.bush[3]; g.fillRect(x - 4 + i * 2 + Math.floor(r(i) * 2), y - 3 - Math.floor(r(i + 5) * 5), 1, 6); }
        break;
      case 'flowers':
        for (let i = 0; i < 3; i++) {
          const fx = x - 5 + i * 5, fh = 4 + Math.floor(r(i) * 4), col = ['#ffffff', '#ffd84a', '#ff8fc8', '#b39cff'][Math.floor(r(i + 9) * 4)];
          g.fillStyle = '#3f8f3a'; g.fillRect(fx, y - fh, 1, fh);
          g.fillStyle = col; g.fillRect(fx - 1, y - fh - 1, 3, 2); g.fillStyle = '#ffb020'; g.fillRect(fx, y - fh - 1, 1, 1);
        }
        break;
      case 'rock': {
        const w = d.size ? 6 : 3, h = d.size ? 5 : 2.5;
        ell(g, x, y - h + 1, w, h, '#5b5f69'); ell(g, x - 0.5, y - h, w - 0.8, h - 0.8, '#8b8f99'); ell(g, x - w * 0.35, y - h * 1.3, w * 0.35, h * 0.3, '#c4c8d0');
        if (d.size && r(1) > 0.5) { g.fillStyle = '#5cae4a'; g.fillRect(x - 2, y - h * 2 + 1, 4, 1); }
        break;
      }
      case 'boulder':
        ell(g, x, y - 7, 15, 11, '#4f535d'); ell(g, x - 1, y - 8, 14, 10, '#8b8f99'); ell(g, x - 5, y - 13, 6, 3, '#b6bac4');
        g.fillStyle = '#5b5f69'; g.fillRect(x + 2, y - 12, 1, 6); g.fillRect(x + 3, y - 7, 3, 1);
        g.fillStyle = '#5cae4a'; for (let i = 0; i < 7; i++) g.fillRect(x - 9 + i * 3, y - 17 + Math.floor(Math.abs(i - 3) * 0.8), 2, 2);
        g.fillStyle = '#2f8f3a'; g.fillRect(x - 15, y - 2, 30, 2);
        break;
      case 'bush':
        const B = Gfx.pal.bush;
        for (const [dx, dy, rr, c] of [[-7, -5, 6, B[0]], [6, -5, 6, B[0]], [0, -8, 7, B[1]], [-4, -9, 4, B[2]], [5, -10, 3, B[3]]]) ell(g, x + dx, y + dy, rr, rr * 0.85, c);
        g.fillStyle = B[4]; g.fillRect(x - 12, y - 2, 24, 2);
        if (d.berries) { g.fillStyle = '#d81b3a'; for (let i = 0; i < 5; i++) g.fillRect(x - 8 + Math.floor(r(i) * 16), y - 11 + Math.floor(r(i + 3) * 7), 2, 2); }
        break;
      case 'mushrooms':
        for (let i = 0; i < 2 + Math.floor(r(0) * 2); i++) {
          const mx = x - 4 + i * 4, mh = 3 + Math.floor(r(i + 1) * 3), red = r(7) > 0.5;
          g.fillStyle = '#f3e6c8'; g.fillRect(mx, y - mh, 1, mh);
          ell(g, mx + 0.5, y - mh, 2.6, 1.8, red ? '#e8343a' : '#a8703f');
          if (red) { g.fillStyle = '#ffffff'; g.fillRect(mx - 1, y - mh - 1, 1, 1); }
        }
        break;
      case 'stump':
        g.fillStyle = '#6b3e1f'; g.fillRect(x - 7, y - 9, 14, 9);
        g.fillStyle = '#4a2a12'; g.fillRect(x - 3, y - 9, 1, 9); g.fillRect(x + 3, y - 8, 1, 8);
        ell(g, x, y - 9, 7, 2.5, '#c9925a'); ell(g, x, y - 9, 4, 1.4, '#a8703f'); ell(g, x, y - 9, 1.5, 0.6, '#c9925a');
        g.fillStyle = '#6b3e1f'; g.fillRect(x - 10, y - 2, 4, 2); g.fillRect(x + 7, y - 2, 4, 2);
        break;
      case 'log':
        g.fillStyle = '#7a4a28'; g.fillRect(x - 15, y - 8, 30, 8);
        g.fillStyle = '#5e3518'; g.fillRect(x - 15, y - 3, 30, 3);
        g.fillStyle = '#9a6a3a'; g.fillRect(x - 13, y - 7, 24, 1);
        ell(g, x + 15, y - 4, 3, 4, '#c9925a'); ell(g, x + 15, y - 4, 1.5, 2, '#a8703f');
        g.fillStyle = '#5cae4a'; g.fillRect(x - 10, y - 9, 6, 1); g.fillRect(x + 1, y - 9, 4, 1);
        break;
      case 'glow':
        g.save(); g.globalAlpha = 0.16; g.fillStyle = '#7df9ff'; g.beginPath(); g.arc(x, y - 3, 6, 0, 7); g.fill(); g.restore();
        for (let i = 0; i < 3; i++) {
          const mx = x - 4 + i * 4, mh = 2 + Math.floor(r(i) * 4);
          g.fillStyle = '#cfe8f0'; g.fillRect(mx, y - mh, 1, mh);
          ell(g, mx + 0.5, y - mh, 2.2, 1.5, i % 2 ? '#7df9ff' : '#b4fffb');
        }
        break;
      case 'beam': {                 // escoramento de madeira da galeria
        const W = ['#5a3a1e', '#7a5230', '#3e2812'];
        for (const bx of [d.noL ? null : d.x0, d.noR ? null : d.x1 - 4]) { if (bx === null) continue; g.fillStyle = W[0]; g.fillRect(bx, d.top, 4, d.floor - d.top); g.fillStyle = W[1]; g.fillRect(bx + 1, d.top, 1, d.floor - d.top); }
        g.fillStyle = W[0]; g.fillRect(d.x0 - 2, d.top, d.x1 - d.x0 + 4, 4); g.fillStyle = W[1]; g.fillRect(d.x0 - 2, d.top + 1, d.x1 - d.x0 + 4, 1);
        g.fillStyle = W[2]; g.fillRect(d.x0 - 2, d.top + 4, d.x1 - d.x0 + 4, 1);
        g.fillStyle = '#9aa0aa'; g.fillRect(d.x0 + 1, d.top + 1, 1, 1); g.fillRect(d.x1 - 2, d.top + 1, 1, 1);
        break;
      }
      case 'lantern': {
        g.fillStyle = '#3a3036'; g.fillRect(x, y - 6, 1, 4);
        g.fillStyle = '#2a2026'; g.fillRect(x - 2, y - 2, 5, 1); g.fillRect(x - 2, y + 5, 5, 1);
        g.fillStyle = '#ffcf5a'; g.fillRect(x - 1, y - 1, 3, 6); g.fillStyle = '#fff6c0'; g.fillRect(x, y, 1, 3);
        g.fillStyle = '#2a2026'; g.fillRect(x - 2, y - 1, 1, 6); g.fillRect(x + 2, y - 1, 1, 6);
        break;
      }
      case 'crystal': {
        const C = d.gem === 1 ? ['#9a0f22', '#e8203a', '#ffb0b8'] : d.gem === 2 ? ['#5fb6d6', '#bff6ff', '#ffffff'] : ['#1e8f4e', '#2ecc71', '#b8ffd8'];
        g.save(); g.globalAlpha = 0.18; g.fillStyle = C[1]; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.restore();
        for (const [dx, dy, h, w] of [[-3, 2, 7, 2], [0, 3, 10, 2.5], [3, 2, 6, 2], [1, 4, 4, 1.5]]) {
          const a = d.side * 0.5;
          poly(g, [[x + dx - w, y + dy], [x + dx + a * h, y + dy - h], [x + dx + w, y + dy]], C[0]);
          poly(g, [[x + dx - w + 0.6, y + dy], [x + dx + a * h, y + dy - h + 1], [x + dx, y + dy]], C[1]);
          g.fillStyle = C[2]; g.fillRect(Math.round(x + dx + a * h), Math.round(y + dy - h + 1), 1, 1);
        }
        break;
      }
      case 'sandfall': {               // areia a escorrer do tecto (o mar de areia por cima)
        for (let yy = d.top; yy < d.bottom; yy += 2) {
          const w = 3 + Math.round(Math.sin(yy * 0.07 + d.seed) * 1);
          g.fillStyle = 'rgba(232,188,120,0.55)'; g.fillRect(d.x - w, yy, w * 2, 2);
          if ((yy >> 1) % 3 === 0) { g.fillStyle = 'rgba(255,230,170,0.6)'; g.fillRect(d.x - 1, yy, 2, 2); }
        }
        ell(g, d.x, d.bottom - 2, 12, 3, '#e0b070');
        break;
      }
      case 'torch': {
        g.fillStyle = '#3a2a1e'; g.fillRect(x - 1, y - 2, 3, 8); g.fillRect(x - 3, y + 4, 7, 2);
        g.fillStyle = '#6b4423'; g.fillRect(x - 2, y - 4, 5, 3);
        g.fillStyle = '#ff7a1a'; g.fillRect(x - 2, y - 9, 5, 5); g.fillStyle = '#ffd23f'; g.fillRect(x - 1, y - 8, 3, 3); g.fillStyle = '#fff6c0'; g.fillRect(x, y - 7, 1, 2);
        break;
      }
      case 'arch': {                   // arco de pedra ao fundo
        const S = d.moss ? ['#4a564a', '#5e6a5c', '#3a443a'] : ['#6a4c34', '#7e5c40', '#54402c'];
        for (const cx of [d.x0, d.x1]) { g.fillStyle = S[0]; g.fillRect(cx - 6, d.top + 18, 12, d.floor - d.top - 18); g.fillStyle = S[1]; g.fillRect(cx - 4, d.top + 18, 3, d.floor - d.top - 18); g.fillStyle = S[2]; g.fillRect(cx - 8, d.floor - 6, 16, 6); }
        const mx = (d.x0 + d.x1) / 2, rx = (d.x1 - d.x0) / 2;
        g.strokeStyle = S[0]; g.lineWidth = 10; g.beginPath(); g.arc(mx, d.top + 18, rx, Math.PI, 0); g.stroke();
        g.strokeStyle = S[1]; g.lineWidth = 2; g.beginPath(); g.arc(mx, d.top + 18, rx - 3, Math.PI, 0); g.stroke();
        g.fillStyle = S[2]; for (let k = 1; k < 8; k++) { const a = Math.PI + k * Math.PI / 8; g.fillRect(Math.round(mx + Math.cos(a) * rx) - 1, Math.round(d.top + 18 + Math.sin(a) * rx) - 4, 2, 8); }
        g.fillStyle = '#d9b34a'; g.fillRect(Math.round(mx) - 2, d.top + 18 - rx - 4, 4, 4);   // bolota dourada no fecho do arco
        break;
      }
      case 'statue': {                 // estátua de um esquilo antigo, sentado, com uma bolota nas patas
        const S = d.moss ? ['#5e6a5c', '#7a8676', '#454f44', '#98a494'] : ['#8a6a4a', '#a8845e', '#6a4e34', '#c9a274'];
        g.fillStyle = S[2]; g.fillRect(x - 14, y - 8, 28, 8); g.fillStyle = S[1]; g.fillRect(x - 14, y - 8, 28, 2);
        ell(g, x + 8, y - 30, 9, 16, S[0]); ell(g, x + 10, y - 40, 6, 7, S[1]);          // cauda
        ell(g, x - 2, y - 20, 8, 11, S[1]);                                                   // corpo
        ell(g, x - 4, y - 35, 6, 6, S[1]); poly(g, [[x - 8, y - 39], [x - 7, y - 46], [x - 4, y - 40]], S[0]); poly(g, [[x - 2, y - 39], [x, y - 46], [x + 1, y - 39]], S[0]);
        ell(g, x - 8, y - 22, 3, 3.5, '#d9b34a');                                            // bolota (dourada)
        g.fillStyle = S[2]; g.fillRect(x - 7, y - 36, 2, 1); g.fillRect(x - 12, y - 33, 3, 1);
        g.fillStyle = S[3]; g.fillRect(x - 6, y - 28, 2, 6);
        if (hash2(d.seed, 3) > 0.5) { g.fillStyle = '#2a1c14'; g.fillRect(x + 3, y - 24, 1, 6); g.fillRect(x + 4, y - 18, 1, 4); }   // racha
        break;
      }
      case 'doorway': {                // moldura de pedra da entrada da pirâmide
        g.fillStyle = '#8a5a34'; g.fillRect(x - 4, y - d.h - 10, 28, 10); g.fillStyle = '#c98a58'; g.fillRect(x - 4, y - d.h - 10, 28, 2);
        g.fillStyle = '#9a6a40'; g.fillRect(x - 4, y - d.h, 5, d.h);
        g.fillStyle = '#d9b34a'; g.fillRect(x + 8, y - d.h - 7, 4, 4);                     // bolota dourada gravada
        break;
      }
      case 'gold': {                   // ouro que o Driller juntou
        for (let k = 0; k < 7; k++) { const gx = x - 10 + (k % 4) * 6 + (k > 3 ? 3 : 0), gy = y - 3 - (k > 3 ? 5 : 0); ell(g, gx, gy, 3, 2, k % 2 ? '#d9b34a' : '#ffd84a'); }
        g.fillStyle = '#fff3a0'; g.fillRect(x - 6, y - 9, 2, 1); g.fillRect(x + 3, y - 4, 2, 1);
        g.fillStyle = '#b8862a'; g.fillRect(x + 8, y - 8, 7, 5); g.fillStyle = '#ffd84a'; g.fillRect(x + 8, y - 8, 7, 1);   // lingote
        break;
      }
      case 'pottery':
        ell(g, x, y - 5, 5, 5, '#a8643a'); g.fillStyle = '#8a4a28'; g.fillRect(x - 3, y - 11, 6, 2); g.fillStyle = '#d98a50'; g.fillRect(x - 3, y - 6, 6, 1);
        if (r(1) > 0.5) { poly(g, [[x + 6, y], [x + 10, y - 3], [x + 12, y]], '#a8643a'); }   // caco ao lado
        break;
      case 'headframe': {              // torre de madeira da mina, por cima do poço do elevador
        const W = ['#6b4423', '#8a5a30', '#4a2e18'];
        g.strokeStyle = W[0]; g.lineWidth = 3; g.beginPath();
        g.moveTo(x - 30, y); g.lineTo(x - 8, y - 70); g.moveTo(x + 30, y); g.lineTo(x + 8, y - 70); g.stroke();
        g.lineWidth = 2; g.strokeStyle = W[1]; g.beginPath();
        for (const k of [0.3, 0.6]) { const yy = y - 70 * k, w = 30 - 22 * k; g.moveTo(x - w, yy); g.lineTo(x + w, yy); }
        g.moveTo(x - 24, y - 18); g.lineTo(x + 18, y - 42); g.moveTo(x + 24, y - 18); g.lineTo(x - 18, y - 42); g.stroke();
        g.fillStyle = W[2]; g.fillRect(x - 12, y - 74, 24, 5);
        g.strokeStyle = '#5a5e69'; g.lineWidth = 2; g.beginPath(); g.arc(x, y - 80, 9, 0, 7); g.stroke();          // roda
        g.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; g.moveTo(x + Math.cos(a) * 9, y - 80 + Math.sin(a) * 9); g.lineTo(x - Math.cos(a) * 9, y - 80 - Math.sin(a) * 9); } g.stroke();
        g.fillStyle = '#8a8f99'; g.fillRect(x - 1, y - 80, 2, 34);
        g.fillStyle = W[1]; g.fillRect(x - 34, y - 2, 68, 3);
        break;
      }
      case 'saguaro': {                // cacto grande, só cenário
        const h = d.h * T, G = ['#2a6a30', '#3a8a3a', '#5caa50'];
        g.fillStyle = G[0]; g.fillRect(x - 6, y - h + 6, 12, h - 6); g.beginPath(); g.arc(x, y - h + 6, 6, Math.PI, 0); g.fill();
        g.fillStyle = G[1]; g.fillRect(x - 4, y - h + 4, 8, h - 4);
        g.fillStyle = G[2]; g.fillRect(x - 2, y - h + 5, 1, h - 6);
        const a1 = y - h * 0.55, a2 = y - h * 0.4;
        g.fillStyle = G[0]; g.fillRect(x - 15, a1, 9, 5); g.fillRect(x - 15, a1 - 14, 5, 18); g.fillRect(x + 6, a2, 9, 5); g.fillRect(x + 11, a2 - 10, 5, 14);
        g.fillStyle = G[1]; g.fillRect(x - 14, a1 - 13, 2, 15); g.fillRect(x + 12, a2 - 9, 2, 11);
        g.fillStyle = '#f6eed0'; for (let k = 6; k < h - 4; k += 5) { g.fillRect(x - 7, y - h + k, 1, 1); g.fillRect(x + 6, y - h + k + 2, 1, 1); }
        break;
      }
      case 'shrub': {
        g.strokeStyle = Gfx.pal.bush[0]; g.lineWidth = 1; g.beginPath();
        for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.35; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (6 + r(k) * 5), y + Math.sin(a) * (5 + r(k + 3) * 5)); }
        g.stroke();
        g.fillStyle = Gfx.pal.bush[2]; for (let k = 0; k < 5; k++) g.fillRect(x - 6 + Math.floor(r(k + 7) * 12), y - 4 - Math.floor(r(k + 9) * 6), 2, 1);
        break;
      }
      case 'pebbles':
        for (let k = 0; k < 3; k++) { const px = x - 5 + Math.floor(r(k) * 10); ell(g, px, y - 1, 2 + r(k + 4), 1.5, k % 2 ? '#b89a7a' : '#8a6a4a'); }
        break;
      case 'skull': {                  // caveira de vaca
        g.fillStyle = '#efe6d0'; g.fillRect(x - 4, y - 6, 8, 5); g.fillRect(x - 2, y - 2, 4, 2);
        g.fillStyle = '#d8ccb0'; g.fillRect(x - 9, y - 7, 5, 2); g.fillRect(x + 4, y - 7, 5, 2); g.fillRect(x - 10, y - 9, 2, 2); g.fillRect(x + 8, y - 9, 2, 2);
        g.fillStyle = '#3a2a20'; g.fillRect(x - 3, y - 5, 2, 2); g.fillRect(x + 1, y - 5, 2, 2);
        break;
      }
      case 'drygrass':
        for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#c9a060' : '#a8844a'; g.fillRect(x - 4 + i * 2 + Math.floor(r(i) * 2), y - 3 - Math.floor(r(i + 5) * 5), 1, 6); }
        break;
      case 'lavafall': {               // cascata de lava a escorrer pela parede do fundo
        for (let yy = d.top; yy < d.floor; yy += 2) {
          const w = 5 + Math.round(Math.sin(yy * 0.08 + d.seed) * 1.5);
          g.fillStyle = '#b8280a'; g.fillRect(d.x + 8 - w, yy, w * 2, 2);
          g.fillStyle = (yy >> 1) % 3 ? '#ff7a1a' : '#ffd23f'; g.fillRect(d.x + 8 - (w >> 1), yy, w, 2);
        }
        g.fillStyle = '#ff9a2a'; g.fillRect(d.x - 4, d.floor - 4, 24, 4);
        break;
      }
      case 'daylight': {               // estação de cima do elevador: a luz do deserto entra pela boca da mina
        const gr = g.createLinearGradient(d.x0, 0, d.x1, 0);
        gr.addColorStop(0, 'rgba(255,214,140,0.05)'); gr.addColorStop(1, 'rgba(255,226,160,0.85)');
        g.fillStyle = gr; g.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
        g.fillStyle = '#ffe9b0'; g.fillRect(d.x1 - 40, d.y0, 40, d.y1 - d.y0);
        g.fillStyle = '#e8b060'; g.fillRect(d.x1 - 40, d.y1 - 6, 40, 6);           // areia lá fora
        break;
      }
      case 'rails': {
        g.fillStyle = '#4a2e18'; for (let rx = d.x0; rx < d.x1; rx += 6) g.fillRect(rx, d.y - 2, 4, 2);
        g.fillStyle = '#7a7e89'; g.fillRect(d.x0, d.y - 3, d.x1 - d.x0, 1);
        g.fillStyle = '#a8acb6'; g.fillRect(d.x0, d.y - 4, d.x1 - d.x0, 1);
        break;
      }
      case 'cart': {
        g.fillStyle = '#3a3036'; g.fillRect(x - 10, y - 13, 20, 9);
        g.fillStyle = '#6a5e58'; g.fillRect(x - 9, y - 12, 18, 7);
        g.fillStyle = '#8a7e78'; g.fillRect(x - 9, y - 12, 18, 1);
        g.fillStyle = '#4a4046'; g.fillRect(x - 3, y - 12, 1, 7); g.fillRect(x + 3, y - 12, 1, 7);
        ell(g, x - 3, y - 14, 4, 2.5, '#5f574f'); ell(g, x + 4, y - 14, 3.5, 2, '#6b625a');
        g.fillStyle = '#2ecc71'; g.fillRect(x + 1, y - 16, 2, 2);
        ell(g, x - 6, y - 3, 2.5, 2.5, '#1a1418'); ell(g, x + 6, y - 3, 2.5, 2.5, '#1a1418');
        g.fillStyle = '#8a8f99'; g.fillRect(x - 7, y - 4, 1, 1); g.fillRect(x + 5, y - 4, 1, 1);
        break;
      }
      case 'vine': {
        const dir = r(2) > 0.5 ? 1 : -1;
        for (let k = 0; k < d.len; k++) {
          const vx = x + Math.round(Math.sin(k / 5 + d.seed) * 1.5);
          const V = Gfx.pal.vine;
          g.fillStyle = V[0]; g.fillRect(vx, y + k, 1, 1);
          if (k % 5 === 2) { g.fillStyle = k % 10 === 2 ? V[1] : V[2]; g.fillRect(vx + (k % 10 === 2 ? 1 : -2) * dir, y + k, 2, 2); }
        }
        break;
      }
    }
  },
  decoFront(ctx, d, t) {
    const x = Math.round(d.x), y = Math.round(d.y), sw = Math.sin(t * 1.6 + d.seed) * 1.2;
    ctx.strokeStyle = Gfx.pal.fern[0]; ctx.lineWidth = 1.5;
    for (const [a, len] of [[-1.1, 11], [-0.5, 13], [0.1, 12], [0.7, 10], [1.2, 8]]) {
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.sin(a) * len * 0.5, y - len * 0.9, x + Math.sin(a) * len + sw, y - len * Math.cos(a) * 0.8); ctx.stroke();
    }
    ctx.strokeStyle = Gfx.pal.fern[1]; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 1, y - 8, x + sw, y - 12); ctx.stroke();
  },
  bat(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    if (e.state === 'hang' && !e.dead) {
      ctx.fillStyle = '#2a1f38'; ctx.fillRect(x, y - 6, 1, 2);
      ell(ctx, x, y, 4, 6, '#3a2a4a'); ell(ctx, x - 1, y - 1, 2, 4, '#4f3a63');
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 2, y + 2, 1, 1); ctx.fillRect(x + 1, y + 2, 1, 1);
      return;
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir || 1, 1);
    const f = Math.sin(e.t * 22);
    poly(ctx, [[-2, -1], [-11, -4 - 5 * f], [-8, 1], [-12, 3 * f], [-2, 2]], '#4f3a63');
    poly(ctx, [[2, -1], [11, -4 - 5 * f], [8, 1], [12, 3 * f], [2, 2]], '#4f3a63');
    ell(ctx, 0, 0, 4, 4, '#3a2a4a');
    poly(ctx, [[-3, -3], [-2, -7], [0, -3]], '#3a2a4a'); poly(ctx, [[3, -3], [2, -7], [0, -3]], '#3a2a4a');
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-2, -1, 1, 1); ctx.fillRect(1, -1, 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, 2, 1, 1); ctx.fillRect(1, 2, 1, 1);
    Gfx.ctlLight(ctx, e, 0, -7);
    ctx.restore();
  },
  // antena de controlo do Driller: pisca a vermelho enquanto o animal está controlado
  ctlLight(ctx, e, x, y) {
    if (e.dead) return;
    ctx.fillStyle = '#8a8f99'; ctx.fillRect(x, y, 1, 2);
    ctx.fillStyle = Math.floor(e.t * 4) % 2 ? '#ff3b3b' : '#a8122a'; ctx.fillRect(x - 0.5, y - 1.5, 2, 2);
  },
  baron(ctx, b) {
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.scale(b.dir, 1);
    if (b.state === 'defeat') ctx.rotate(b.t * 7);
    if (b.inv > 0 && Math.floor(b.inv * 16) % 2) ctx.globalAlpha = 0.4;
    const f = Math.sin(b.t * (b.state === 'gust' ? 24 : 9));
    poly(ctx, [[-6, -8], [-28, 6 + f * 3], [-22, 16], [-2, 8]], '#a8122a');                     // capa
    poly(ctx, [[-16, 0], [-36, -7], [-33, 3], [-38, 10], [-16, 7]], '#141824');                  // cauda
    poly(ctx, [[-6, -6], [8, -6], [-2, -6 - 24 * f], [-18, -6 - 19 * f]], '#262c40');           // asa de trás
    ell(ctx, 0, 0, 18, 12, '#1d2333'); ell(ctx, 4, 4, 10, 6.5, '#2a3148');
    ell(ctx, 14, -9, 9, 8.5, '#1d2333');                                                          // cabeça
    poly(ctx, [[21, -11], [34, -7], [21, -4]], '#ffb020'); poly(ctx, [[21, -7], [31, -6], [21, -4]], '#d98a10');
    if (b.controlled !== false) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(15, -13, 4, 4); ctx.fillStyle = '#fff0a0'; ctx.fillRect(17, -12, 2, 2); }
    else { ctx.fillStyle = '#ffffff'; ctx.fillRect(15, -13, 4, 4); ctx.fillStyle = '#120402'; ctx.fillRect(17, -12, 2, 2); }
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.2;                                             // monóculo
    ctx.beginPath(); ctx.arc(17, -11, 4.6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, -6.5); ctx.quadraticCurveTo(12, 0, 8, 2); ctx.stroke();
    ctx.fillStyle = '#0b0e18'; ctx.fillRect(12, -17, 9, 2);                                       // sobrancelha zangada
    ctx.fillRect(6, -32, 15, 14); ctx.fillRect(2, -19, 23, 3);                                    // cartola
    ctx.fillStyle = '#e8203a'; ctx.fillRect(6, -22, 15, 3);
    ctx.fillStyle = '#3a4258'; ctx.fillRect(8, -31, 2, 8);
    if (b.controlled !== false) {                       // máquina de controlo do Driller
      ctx.fillStyle = '#8a8f99'; ctx.fillRect(5, -23, 17, 4);
      ctx.fillStyle = '#5a5e69'; ctx.fillRect(7, -22, 2, 2); ctx.fillRect(18, -22, 2, 2);
      poly(ctx, [[11, -32], [16, -32], [13.5, -42]], '#b8bcc6');
      ctx.fillStyle = '#5a5e69'; ctx.fillRect(12, -35, 3, 1); ctx.fillRect(12.5, -38, 2, 1);
      ctx.fillStyle = Math.floor(b.t * 5) % 2 ? '#ff3b3b' : '#a8122a'; ctx.fillRect(12.5, -45, 2.5, 2.5);
    } else if (b.state === 'freed' && b.timer > 0) {    // atordoado
      ctx.fillStyle = '#ffe14a';
      for (let k = 0; k < 3; k++) { const a = b.t * 5 + k * 2.1, sx = Math.round(14 + Math.cos(a) * 12), sy = Math.round(-36 + Math.sin(a) * 4); ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
    }
    poly(ctx, [[-4, -4], [10, -4], [2, -4 - 26 * f], [-14, -4 - 21 * f]], '#323a54');           // asa da frente
    ctx.fillStyle = '#ffb020'; ctx.fillRect(-4, 11, 2, 5); ctx.fillRect(4, 11, 2, 5);           // patas
    ctx.restore();
  },
  // Morcego, chefe da mina: orelhas enormes, asas com dedos, broca do Driller na cabeça
  batboss(ctx, b) {
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y));
    const hang = b.state === 'wait';
    if (hang) ctx.scale(1, -1); else ctx.scale(b.dir || 1, 1);
    if (b.state === 'defeat') ctx.rotate(b.t * 7);
    if (b.inv > 0 && Math.floor(b.inv * 16) % 2) ctx.globalAlpha = 0.4;
    const folded = hang || b.state === 'freed';
    const f = folded ? 0.15 : Math.sin(b.t * (b.state === 'dive' ? 9 : b.state === 'screech' ? 22 : 13));
    const wing = sd => {
      const P = [[sd * 7, -6], [sd * (folded ? 16 : 42), -16 - 16 * f], [sd * (folded ? 15 : 36), 2 + 5 * f], [sd * (folded ? 13 : 28), -1 + 3 * f],
        [sd * (folded ? 12 : 22), 10 + 6 * f], [sd * 13, 4], [sd * 8, 9]];
      poly(ctx, P, '#33243f');
      ctx.strokeStyle = '#5a4470'; ctx.lineWidth = 1; ctx.beginPath();
      for (const k of [1, 2, 4]) { ctx.moveTo(sd * 7, -6); ctx.lineTo(P[k][0], P[k][1]); }
      ctx.stroke();
    };
    wing(-1); wing(1);
    ell(ctx, 0, 3, 12, 14, '#45324f'); ell(ctx, 0, 6, 7, 9, '#6a5478');                         // corpo e barriga
    ctx.fillStyle = '#2a1a30'; ctx.fillRect(-6, 15, 3, 3); ctx.fillRect(3, 15, 3, 3);           // patas
    poly(ctx, [[-8, -16], [-13, -33], [-2, -20]], '#45324f'); poly(ctx, [[8, -16], [13, -33], [2, -20]], '#45324f');   // orelhas
    poly(ctx, [[-8, -18], [-11, -29], [-4, -20]], '#c07a90'); poly(ctx, [[8, -18], [11, -29], [4, -20]], '#c07a90');
    ell(ctx, 0, -12, 10, 9, '#45324f'); ell(ctx, 2, -8, 5, 3.5, '#6a5478');                     // cabeça e focinho
    ctx.fillStyle = '#2a1a30'; ctx.fillRect(4, -10, 2, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -6, 1, 2); ctx.fillRect(4, -6, 1, 2);            // dentinhos
    if (b.controlled !== false) {
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-5, -15, 3, 3); ctx.fillRect(2, -15, 3, 3);
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(-4, -14, 1, 1); ctx.fillRect(3, -14, 1, 1);
      ctx.fillStyle = '#8a8f99'; ctx.fillRect(-9, -21, 18, 3);                                 // máquina do Driller
      ctx.fillStyle = '#5a5e69'; ctx.fillRect(-7, -20, 2, 1); ctx.fillRect(5, -20, 2, 1);
      poly(ctx, [[-3, -21], [3, -21], [0, -31]], '#b8bcc6');
      ctx.fillStyle = Math.floor(b.t * 5) % 2 ? '#ff3b3b' : '#a8122a'; ctx.fillRect(-1, -34, 2.5, 2.5);
    } else {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-5, -15, 3, 3); ctx.fillRect(2, -15, 3, 3);
      ctx.fillStyle = '#120402'; ctx.fillRect(-4, -14, 1, 1); ctx.fillRect(3, -14, 1, 1);
      if (b.state === 'freed' && b.timer > 0) {
        ctx.fillStyle = '#ffe14a';
        for (let k = 0; k < 3; k++) { const a = b.t * 5 + k * 2.1, sx = Math.round(Math.cos(a) * 12), sy = Math.round(-30 + Math.sin(a) * 4); ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
      }
    }
    ctx.restore();
  },
  venomPuddle(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), a = Math.min(1, e.life / 0.6);
    ctx.save(); ctx.globalAlpha = a;
    ell(ctx, x, y - 1, 11, 3, '#2a7a14'); ell(ctx, x, y - 2, 9, 2, '#6ae02a');
    const k = Math.floor(e.t * 6) % 3; ctx.fillStyle = '#c8ff90'; ctx.fillRect(x - 5 + k * 4, y - 4, 2, 2);
    ctx.restore();
  },
  // Cobra Real: corpo enrolado na areia, pescoço, capuz aberto com marcas douradas e a máquina do Driller
  cobra(ctx, b) {
    const fl = b.floor, rise = b.rise, fx = b.face || -1;
    const G = ['#1e3a1a', '#3a6a28', '#5e9a3a', '#d9c070', '#f0e0a0'];
    if (b.state === 'wait') {                             // escondida: um monte de areia com dois olhos vermelhos
      ell(ctx, b.bx, fl - 3, 24, 7, '#c8964e'); ell(ctx, b.bx, fl - 5, 18, 4, '#d9a35a');
      ctx.fillStyle = Math.floor(b.t * 2) % 3 ? '#ff3b3b' : '#a8122a'; ctx.fillRect(b.bx - 5, fl - 7, 2, 2); ctx.fillRect(b.bx + 3, fl - 7, 2, 2);
      return;
    }
    const under = b.state === 'burrow' && b.sub === 'under';
    if (under) {                                          // a areia mexe-se por cima dela
      const w = Math.sin(b.t * 30) * 1.5;
      ell(ctx, b.bulgeX, fl - 3, 15 + w, 5, '#b8823e'); ell(ctx, b.bulgeX, fl - 4, 11, 3, '#d9a35a');
      ctx.fillStyle = '#7a4a1e'; ctx.fillRect(b.bulgeX - 6, fl - 5, 3, 1); ctx.fillRect(b.bulgeX + 3, fl - 4, 4, 1);
      return;
    }
    if (rise > 0.02) {
      const by = fl - 4;
      ell(ctx, b.bx, by - 4 * rise, 26, 8 * rise + 2, G[0]); ell(ctx, b.bx, by - 5 * rise, 24, 6 * rise + 1, G[1]);   // voltas do corpo
      ell(ctx, b.bx - 3, by - 12 * rise, 18, 5 * rise + 1, G[0]); ell(ctx, b.bx - 3, by - 13 * rise, 16, 4 * rise + 1, G[2]);
      ctx.fillStyle = G[3]; for (let k = -2; k <= 2; k++) ctx.fillRect(b.bx + k * 8 - 1, Math.round(by - 6 * rise), 2, 2);
      const nx0 = b.bx, ny0 = by - 14 * rise, cx = (nx0 + b.x) / 2 - fx * 10, cy = Math.min(ny0, b.y) + 6;         // pescoço
      ctx.lineCap = 'round';
      for (const [w, c] of [[12, G[0]], [9, G[1]], [3, G[3]]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(nx0, ny0); ctx.quadraticCurveTo(cx, cy, b.x - fx * 2, b.y + 6); ctx.stroke(); }
      ctx.lineCap = 'butt';
    }
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.scale(fx, 1);
    if (b.inv > 0 && Math.floor(b.inv * 16) % 2) ctx.globalAlpha = 0.4;
    const open = ['aim', 'spit', 'strike'].includes(b.state) || (b.state === 'burrow' && b.sub === 'erupt');
    const spread = ['wait', 'intro'].includes(b.state) ? 0.7 : 1;
    ell(ctx, -5, 6, 9 + 6 * spread, 15, G[0]); ell(ctx, -5, 6, 7 + 5 * spread, 13, G[1]);                       // capuz
    ell(ctx, -9, 4, 2.6, 2, G[3]); ell(ctx, -1, 4, 2.6, 2, G[3]); ctx.fillStyle = G[0]; ctx.fillRect(-10, 4, 2, 1); ctx.fillRect(-2, 4, 2, 1);
    ctx.fillStyle = G[4]; for (let k = 0; k < 3; k++) ctx.fillRect(-7, 10 + k * 4, 4, 2);                        // barriga às riscas
    ell(ctx, 4, -2, 9, 6, G[1]); ell(ctx, 6, -2, 7, 4, G[2]);                                                     // cabeça
    if (open) { poly(ctx, [[6, 1], [15, 0], [15, 6], [6, 3]], '#4a0a10'); ctx.fillStyle = '#ffffff'; ctx.fillRect(9, 1, 1, 3); ctx.fillRect(13, 1, 1, 3); }
    else if (Math.floor(b.t * 3) % 4 === 0) { ctx.fillStyle = '#e8203a'; ctx.fillRect(13, 0, 4, 1); ctx.fillRect(16, -1, 1, 1); ctx.fillRect(16, 1, 1, 1); }   // língua
    if (b.controlled !== false) {
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(4, -5, 3, 2); ctx.fillStyle = '#fff0a0'; ctx.fillRect(5, -5, 1, 1);
      ctx.fillStyle = '#8a8f99'; ctx.fillRect(-2, -9, 10, 3);                                                     // máquina do Driller
      poly(ctx, [[1, -9], [5, -9], [3, -17]], '#b8bcc6');
      ctx.fillStyle = Math.floor(b.t * 5) % 2 ? '#ff3b3b' : '#a8122a'; ctx.fillRect(2, -20, 2.5, 2.5);
    } else {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(4, -5, 3, 2); ctx.fillStyle = '#120402'; ctx.fillRect(6, -5, 1, 1);
      if (b.state === 'freed' && b.timer > 0) { ctx.fillStyle = '#ffe14a'; for (let k = 0; k < 3; k++) { const a = b.t * 5 + k * 2.1, sx = Math.round(2 + Math.cos(a) * 11), sy = Math.round(-16 + Math.sin(a) * 3); ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); } }
    }
    ctx.restore();
    if (rise > 0.02) { ell(ctx, b.bx, fl - 1, 30, 4, '#c8964e'); ctx.fillStyle = '#e0b070'; ctx.fillRect(b.bx - 24, fl - 4, 48, 1); }   // areia à frente do corpo
  },
  // elevador velho da mina: jaula de ferro com estrado de madeira, cabo até lá acima
  elevator(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    ctx.fillStyle = '#6a6e79'; ctx.fillRect(x - 1, e.top - 40, 2, y - 46 - e.top + 40);         // cabo
    ctx.fillStyle = '#3a3e48';
    for (const by of [y - 31, y - 17]) ctx.fillRect(x - 22, by, 44, 2);                         // grades de trás
    ctx.fillStyle = '#5a5e69'; ctx.fillRect(x - 23, y - 46, 3, 46); ctx.fillRect(x + 20, y - 46, 3, 46);
    ctx.fillStyle = '#7a7e89'; ctx.fillRect(x - 24, y - 47, 48, 3); ctx.fillStyle = '#9aa0aa'; ctx.fillRect(x - 24, y - 47, 48, 1);
    ctx.fillStyle = '#4a4e58'; ctx.fillRect(x - 6, y - 50, 12, 3);
    ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 24, y - 4, 48, 5);                                // estrado
    ctx.fillStyle = '#a8703f'; ctx.fillRect(x - 24, y - 4, 48, 1);
    ctx.fillStyle = '#4a2e18'; for (let k = -18; k < 24; k += 8) ctx.fillRect(x + k, y - 3, 1, 4);
    const on = e.ready && Math.floor(e.t * 3) % 2 === 0;
    ctx.fillStyle = e.ready ? (on ? '#7dff7a' : '#2f9a3a') : e.arrived ? '#7dff7a' : '#a8122a'; ctx.fillRect(x + 16, y - 44, 3, 3);   // luz: vermelha parada, verde pronta
    if (e.riding) { ctx.fillStyle = 'rgba(122,126,137,0.85)'; for (let k = -20; k <= 20; k += 6) ctx.fillRect(x + k, y - 44, 1, 40); }   // grade fechada
  },
  // pedras preciosas: 0 jade, 1 rubi, 2 diamante
  gem(ctx, x, y, kind, s = 1, empty = false) {
    const P = [['#2ecc71', '#1e8f4e', '#b8ffd8'], ['#e8203a', '#9a0f22', '#ffb0b8'], ['#bff6ff', '#5fb6d6', '#ffffff']][kind];
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(s, s);
    if (empty) { ctx.strokeStyle = '#8a8fb0'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, -1); ctx.lineTo(3, 5); ctx.lineTo(-3, 5); ctx.lineTo(-5, -1); ctx.closePath(); ctx.stroke(); ctx.restore(); return; }
    poly(ctx, [[0, -5], [5, -1], [3, 5], [-3, 5], [-5, -1]], P[1]);
    poly(ctx, [[0, -5], [3, -1], [1.5, 4], [-1.5, 4], [-3, -1]], P[0]);
    poly(ctx, [[0, -4], [2, -1], [-2, -1]], P[2]);
    ctx.restore();
  },
  bramble(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    if (e.style === 'rock') {          // estalagmites afiadas (mina)
      for (const [dx, h, w] of [[-6, 7, 3], [-1, 12, 4], [5, 9, 3]]) {
        poly(ctx, [[x + dx - w, y], [x + dx, y - h], [x + dx + w, y]], '#4b4540');
        poly(ctx, [[x + dx - w + 1, y], [x + dx, y - h + 1], [x + dx, y]], '#8a8178');
        ctx.fillStyle = '#d8d0c6'; ctx.fillRect(x + dx, y - h, 1, 1);
      }
      return;
    }
    ell(ctx, x - 4, y - 4, 4.5, 4, '#2f5e1e'); ell(ctx, x + 2, y - 5, 5, 5, '#3a7326'); ell(ctx, x + 6, y - 3, 3.5, 3, '#2f5e1e');
    ctx.fillStyle = '#e6e0b0';
    [[-8, -5], [-5, -9], [-1, -8], [2, -11], [5, -9], [9, -5], [0, -4], [4, -3]].forEach(([dx, dy]) => {
      ctx.fillRect(x + dx, y + dy, 1, 2); ctx.fillRect(x + dx, y + dy - 1, 1, 1);
    });
    ctx.fillStyle = '#b0122a'; ctx.fillRect(x - 3, y - 6, 2, 2); ctx.fillRect(x + 4, y - 7, 2, 2);
  },

  // ---------------- objectos ----------------
  spring(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y), s = e.squash;
    const sh = 6 * (1 - 0.35 * s);
    ctx.fillStyle = '#d9c9a6'; ctx.fillRect(x - 3, y - sh, 6, sh);
    ctx.fillStyle = '#f3e6c8'; ctx.fillRect(x - 2, y - sh, 3, sh);
    ctx.fillStyle = '#c41f2a'; ctx.beginPath(); ctx.ellipse(x, y - sh, 9 * (1 + 0.2 * s), 2.2, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#e8343a'; ctx.beginPath(); ctx.ellipse(x, y - sh, 9 * (1 + 0.2 * s), 6 * (1 - 0.3 * s), 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 5, y - sh - 3, 2, 2); ctx.fillRect(x + 1, y - sh - 5, 2, 2); ctx.fillRect(x + 5, y - sh - 2, 2, 1);
  },
  checkpoint(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 1, y - 26, 3, 26);
    if (e.active) { ctx.globalAlpha = 0.25 + Math.sin(e.t * 5) * 0.1; ell(ctx, x, y - 30, 10, 10, '#ffe066'); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 4, y - 35, 9, 10); ctx.fillRect(x - 2, y - 37, 5, 2);
    ctx.fillStyle = e.active ? '#ffe066' : '#7a8a9a'; ctx.fillRect(x - 3, y - 34, 7, 8);
    ctx.fillStyle = e.active ? '#fffbe0' : '#a7b5c2'; ctx.fillRect(x - 2, y - 33, 2, 3);
  },
  goal(ctx, e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    ctx.fillStyle = '#9aa0aa'; ctx.fillRect(x, y - 50, 1, 50);
    ctx.fillStyle = '#e8e8ee'; ctx.fillRect(x - 1, y - 50, 1, 50);
    ell(ctx, x, y - 52, 2.5, 2.5, '#ffd23f');
    ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 4, y - 3, 8, 3);
    const col = e.reached ? '#ffd23f' : '#e8343a';
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 1, y - 48);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + 1 + i * 4, y - 48 + Math.sin(e.t * 6 + i) * 1.5);
    for (let i = 6; i >= 0; i--) ctx.lineTo(x + 1 + i * 4, y - 34 + Math.sin(e.t * 6 + i) * 1.5);
    ctx.closePath(); ctx.fill();
    this.acorn(ctx, x + 13, y - 41 + Math.sin(e.t * 6 + 3) * 1.5, 0);
  },
  headIcon(ctx, x, y) {
    poly(ctx, [[x - 3, y - 2], [x - 2, y - 8], [x + 1, y - 3]], C.FUR);
    ell(ctx, x, y, 4.5, 4.2, C.FUR); ell(ctx, x + 3, y + 1.2, 2.6, 2, C.BELLY);
    ell(ctx, x + 2, y - 1, 1.2, 1.6, '#fff'); ell(ctx, x + 2.5, y - 0.8, 0.7, 1, C.EYE);
    ctx.fillStyle = C.GOG; ctx.fillRect(x - 4, y - 4, 7, 1.4);
  },
});
