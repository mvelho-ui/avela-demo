'use strict';
// =====================================================================
//  BANDA SONORA — sintetizador ao estilo da Mega Drive:
//   · FM de 2 operadores (como os canais do YM2612): baixo, melodia,
//     piano eléctrico e cordas, com coro, vibrato e eco na melodia
//   · PSG (ondas quadradas, como o SN76489) para os arpejos
//   · bateria sintetizada ("DAC"): bombo, tarola, pratos e timbalões
//  Sequenciador por passos de 1/16; as músicas estão em songs.js.
// =====================================================================
const Music = (() => {
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
    '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], dim: [0, 3, 6],
    aug: [0, 4, 8], add9: [0, 4, 7, 14], '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
  };
  // Timbres FM: ratio = frequência do modulador / portadora; idx -> idx2 = índice de modulação
  const PATCH = {
    lead:  { ratio: 1, idx: 2.6, idx2: 1.3, idxT: 0.08, a: 0.008, d: 0.3, s: 0.75, r: 0.09, detune: 7, vib: 16, vol: 0.12 },
    brass: { ratio: 1, idx: 0.6, idx2: 2.8, idxT: 0.06, a: 0.03, d: 0.4, s: 0.8, r: 0.1, detune: 9, vib: 12, vol: 0.11 },
    bass:  { ratio: 1, idx: 6, idx2: 1.4, idxT: 0.05, a: 0.002, d: 0.25, s: 0.5, r: 0.04, vol: 0.24 },
    stab:  { ratio: 1, idx: 3.2, idx2: 0.4, idxT: 0.06, a: 0.002, d: 0.22, s: 0, r: 0.05, vol: 0.085 },
    bell:  { ratio: 3.5, idx: 2, idx2: 0.2, idxT: 0.2, a: 0.002, d: 0.6, s: 0, r: 0.2, vol: 0.045 },
    steel: { ratio: 2, idx: 1.9, idx2: 0.35, idxT: 0.1, a: 0.002, d: 0.45, s: 0.25, r: 0.18, detune: 3, vib: 6, vol: 0.11 },   // steel drum (praia)
    mallet:{ ratio: 4, idx: 1.6, idx2: 0.25, idxT: 0.12, a: 0.002, d: 0.7, s: 0.2, r: 0.25, detune: 4, vib: 5, vol: 0.11 },
    pad:   { ratio: 2, idx: 0.7, idx2: 0.5, idxT: 0.3, a: 0.18, d: 0.5, s: 0.8, r: 0.25, detune: 10, vol: 0.032 },
  };
  const CHANNELS = ['bass', 'lead', 'stab', 'pad', 'arp', 'drum'];

  // ------------------------- compilação das músicas -------------------------
  const midiOf = n => {
    const m = /^([A-G](?:#|b)?)(\d)$/.exec(n);
    if (!m || NOTE[m[1]] === undefined) throw new Error('nota inválida: ' + n);
    return NOTE[m[1]] + (+m[2] + 1) * 12;
  };
  function parseChord(sym) {
    const m = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(sym);
    if (!m || QUAL[m[2]] === undefined) throw new Error('acorde inválido: ' + sym);
    const root = NOTE[m[1]];
    return { root, tones: QUAL[m[2]], bass: m[3] ? NOTE[m[3]] : root };
  }
  const expand = s => s.trim().split(/\s+/).flatMap(w => { const [n, k] = w.split('*'); return Array(k ? +k : 1).fill(n); });
  // "E5 - - G5 . ..." -> [{step, tok, len}]   ('-' prolonga, '.' pausa)
  function lineNotes(str, where) {
    const tk = str.trim().split(/\s+/);
    if (tk.length !== 16) throw new Error(`${where}: compasso com ${tk.length} passos (devem ser 16)`);
    const out = [];
    tk.forEach((t, i) => {
      const last = out[out.length - 1];
      if (t === '-') { if (last && last.open) last.len++; return; }
      if (last) last.open = false;
      if (t !== '.') out.push({ step: i, tok: t, len: 1, open: true });
    });
    return out;
  }
  function compile(song, PAT) {
    const bars = song.chords.split('|').map(s => s.trim()).filter(Boolean).map(b => b.split(/\s+/).map(parseChord));
    const n = bars.length, tr = song.transpose || 0;
    const ev = Array.from({ length: n * 16 }, () => []);
    const put = (b, s, e) => ev[b * 16 + s].push(e);
    const chordAt = (b, s) => { const cs = bars[((b % n) + n) % n]; return cs[Math.floor(s * cs.length / 16)]; };
    const low = pc => 33 + ((pc + tr - 9 + 24) % 12);                          // registo do baixo: Lá1..Sol#2
    const voicing = (c, base) => c.tones.slice(1).map(t => base + ((c.root + t + tr) % 12)).sort((a, b) => a - b);
    const list = (key, def) => { const l = expand(song[key] || def + '*' + n); if (l.length !== n) throw new Error(`${song.name}: "${key}" tem ${l.length} compassos, a música tem ${n}`); return l; };

    (song.lead || []).forEach((line, b) => {
      if (line) lineNotes(line, `${song.name} melodia c.${b + 1}`).forEach(x => put(b, x.step, { ch: 'lead', notes: [midiOf(x.tok) + tr], len: x.len }));
    });
    list('bass', 'none').forEach((p, b) => {
      if (p === 'none') return;
      if (!PAT.bass[p]) throw new Error('padrão de baixo desconhecido: ' + p);
      lineNotes(PAT.bass[p], 'baixo ' + p).forEach(x => {
        const c = chordAt(b, x.step), rb = low(c.root), bb = low(c.bass);
        const m = { R: bb, '8': bb + 12, '3': rb + c.tones[1], '5': rb + c.tones[2], '7': rb + (c.tones[3] || 10),
          a: low(chordAt(b + 1, 0).bass) - 1 }[x.tok];
        if (m === undefined) throw new Error('nota de baixo inválida: ' + x.tok);
        put(b, x.step, { ch: 'bass', notes: [m], len: x.len });
      });
    });
    list('stab', 'none').forEach((p, b) => {
      if (p === 'none') return;
      lineNotes(PAT.stab[p], 'acordes ' + p).forEach(x =>
        put(b, x.step, { ch: 'stab', notes: voicing(chordAt(b, x.step), 60), len: x.len, soft: x.tok === 'x' }));
    });
    list('pad', 'none').forEach((p, b) => {
      if (p !== 'auto') return;
      const cs = bars[b], w = 16 / cs.length;
      cs.forEach((c, i) => put(b, i * w, { ch: 'pad', notes: voicing(c, 55), len: w }));
    });
    list('arp', 'none').forEach((p, b) => {
      if (p === 'none') return;
      lineNotes(PAT.arp[p], 'arpejo ' + p).forEach(x => {
        const c = chordAt(b, x.step), k = +x.tok;
        const tones = c.tones.map(t => 72 + ((c.root + t + tr) % 12)).sort((a, b2) => a - b2);
        put(b, x.step, { ch: 'arp', notes: [tones[k % tones.length] + 12 * Math.floor(k / tones.length)], len: x.len });
      });
    });
    list('drum', 'none').forEach((p, b) => {
      if (p === 'none') return;
      const tk = PAT.drum[p].trim().split(/\s+/);
      if (tk.length !== 16) throw new Error('bateria ' + p + ': ' + tk.length + ' passos');
      tk.forEach((t, s) => { if (t !== '.') put(b, s, { ch: 'drum', kit: t.split('+') }); });
    });
    return { name: song.name, bpm: song.bpm, ev, bars: n, loop: song.loop === undefined ? null : song.loop,
      tail: song.tail || 0.6, patches: song.patches || {} };
  }

  // ------------------------- síntese -------------------------
  let ac = null, out = null, noise = null;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function buildBuses(ctx, dest) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.15;
    comp.connect(dest);
    const pan = v => { if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(comp); return p; } return comp; };
    const b = {};
    const gains = { bass: [0, 1], lead: [-0.12, 1], stab: [0.3, 1], pad: [-0.3, 1], arp: [-0.45, 1], drum: [0.05, 1] };
    for (const ch of CHANNELS) { const g = ctx.createGain(); g.gain.value = gains[ch][1]; g.connect(pan(gains[ch][0])); b[ch] = g; }
    // eco da melodia (ping-pong simples para a direita)
    const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    fb.gain.value = 0.28; wet.gain.value = 0.32;
    b.lead.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(pan(0.5));
    b.delay = dl;
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return { b, noise: nb };
  }

  function fm(t, midi, dur, p, dest) {
    const f = mtof(midi), I = f * p.ratio;
    const mod = ac.createOscillator(); mod.type = p.modType || 'sine'; mod.frequency.value = I;
    const mg = ac.createGain();
    mg.gain.setValueAtTime(p.idx * I, t);
    mg.gain.setTargetAtTime(p.idx2 * I, t + 0.004, p.idxT);
    mod.connect(mg);
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(p.vol, t + p.a);
    amp.gain.setTargetAtTime(p.vol * p.s, t + p.a, p.d / 3);
    const end = t + Math.max(dur, p.a + 0.01);
    amp.gain.setTargetAtTime(0, end, p.r / 3);
    const stopAt = end + p.r * 2 + 0.05;
    const cars = (p.detune ? [-p.detune, p.detune] : [0]).map(det => {
      const c = ac.createOscillator(); c.frequency.value = f; c.detune.value = det;
      mg.connect(c.frequency); c.connect(amp); c.start(t); c.stop(stopAt); return c;
    });
    if (p.vib && dur > 0.25) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(p.vib, t + Math.min(dur, 0.6));
      l.connect(lg); cars.forEach(c => lg.connect(c.detune)); l.start(t); l.stop(stopAt);
    }
    amp.connect(dest);
    mod.start(t); mod.stop(stopAt);
  }
  function psg(t, midi, dur, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = mtof(midi);
    g.gain.setValueAtTime(0.065, t); g.gain.exponentialRampToValueAtTime(0.0004, t + dur + 0.04);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.06);
  }
  function hit(t, f1, f2, dur, vol, type, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function nz(t, dur, vol, freq, type, dest) {
    const s = ac.createBufferSource(); s.buffer = noise;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function drum(k, t, o) {
    switch (k) {
      case 'k': hit(t, 150, 42, 0.16, 0.85, 'sine', o); nz(t, 0.015, 0.25, 2500, 'lowpass', o); break;
      case 's': nz(t, 0.17, 0.5, 1900, 'bandpass', o); hit(t, 230, 160, 0.08, 0.32, 'triangle', o); break;
      case 'h': nz(t, 0.035, 0.16, 8000, 'highpass', o); break;
      case 'o': nz(t, 0.22, 0.13, 7000, 'highpass', o); break;
      case 'c': nz(t, 1.3, 0.2, 4500, 'highpass', o); break;
      case 't': hit(t, 260, 180, 0.22, 0.55, 'sine', o); nz(t, 0.04, 0.12, 1200, 'bandpass', o); break;
      case 'm': hit(t, 190, 130, 0.26, 0.55, 'sine', o); nz(t, 0.04, 0.12, 900, 'bandpass', o); break;
      case 'f': hit(t, 130, 82, 0.32, 0.6, 'sine', o); nz(t, 0.05, 0.12, 600, 'bandpass', o); break;
      default: throw new Error('peça de bateria desconhecida: ' + k);
    }
  }
  const meter = {}; CHANNELS.forEach(c => meter[c] = [-9, -9]);
  function play1(e, t, sd, song, b) {
    const dur = e.len * sd;
    switch (e.ch) {
      case 'lead': e.notes.forEach(m => fm(t, m, dur * 0.95, PATCH[song.patches.lead || 'lead'], b.lead)); break;
      case 'bass': fm(t, e.notes[0], dur * 0.9, PATCH[song.patches.bass || 'bass'], b.bass); break;
      case 'stab': e.notes.forEach(m => fm(t, m, dur, PATCH[song.patches.stab || 'stab'], b.stab)); break;
      case 'pad': e.notes.forEach(m => fm(t, m, dur, PATCH.pad, b.pad)); break;
      case 'arp': psg(t, e.notes[0], dur * 0.9, b.arp); break;
      case 'drum': e.kit.forEach(k => drum(k, t, b.drum)); break;
    }
    const mt = meter[e.ch]; mt[0] = mt[1]; mt[1] = t;
  }

  // ------------------------- leitor -------------------------
  const compiled = {};
  let cur = null, step = 0, next = 0, sd = 0.1, timer = null, paused = false, playId = 0, buses = null, t0 = 0;
  const get = name => compiled[name] || (compiled[name] = compile(SONGS[name], SONG_PATTERNS));

  function ensure() {
    if (ac) return true;
    if (!Sound.ready) return false;
    ac = Sound.ctx(); out = Sound.musicOut();
    const r = buildBuses(ac, out); buses = r.b; noise = r.noise;
    return true;
  }
  function tick() {
    if (!cur || paused) return;
    while (next < ac.currentTime + 0.12) {
      for (const e of cur.ev[step]) play1(e, next, sd, cur, buses);
      next += sd; step++;
      if (step >= cur.ev.length) {
        if (cur.loop !== null) step = cur.loop * 16;
        else {
          const id = playId, cb = cur.onEnd, wait = (next - ac.currentTime + cur.tail) * 1000;
          clearInterval(timer); timer = null; cur = null;
          setTimeout(() => { if (id === playId && cb) cb(); }, Math.max(0, wait));
          return;
        }
      }
    }
  }
  function play(name, opts = {}) {
    if (!ensure() || !SONGS[name]) return;
    stop();
    cur = Object.assign(Object.create(get(name)), { id: name, onEnd: opts.onEnd || null });
    step = opts.fromStep || 0; sd = 60 / cur.bpm / 4; next = ac.currentTime + 0.06; t0 = next - step * sd;
    buses.delay.delayTime.setValueAtTime(sd * 3, ac.currentTime);
    timer = setInterval(tick, 25); tick();
  }
  function stop() {
    playId++; paused = false; cur = null;
    if (timer) { clearInterval(timer); timer = null; }
  }
  function pause() { if (cur) paused = true; }
  function resume() { if (cur && paused) { paused = false; next = ac.currentTime + 0.05; } }
  // Jingle curto (ex.: vida extra) e depois retoma a música anterior no início do compasso onde ia.
  function jingle(name) {
    const back = cur && cur.loop !== null ? { id: cur.id, from: Math.floor(step / 16) * 16 } : null;
    play(name, { onEnd: back ? () => play(back.id, { fromStep: back.from }) : null });
  }
  function level(ch) {
    if (!ac) return 0;
    const [a, b] = meter[ch], now = ac.currentTime, t = b <= now ? b : a;
    return Math.max(0, Math.exp(-(now - t) * 7));
  }
  function beat() { return cur && ac ? (ac.currentTime - t0) / (sd * 4) : 0; }   // em tempos

  // Renderização offline (para testes e para exportar as faixas em áudio)
  async function render(name, seconds, only) {
    const song = get(name), sr = 44100;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
    const saved = [ac, noise];
    ac = ctx;
    const r = buildBuses(ctx, ctx.destination); noise = r.noise;
    const s16 = 60 / song.bpm / 4;
    r.b.delay.delayTime.value = s16 * 3;
    let t = 0.05, st = 0;
    while (t < seconds - 0.05) {
      for (const e of song.ev[st]) if (!only || only.includes(e.ch)) play1(e, t, s16, song, r.b);
      t += s16; st++;
      if (st >= song.ev.length) { if (song.loop === null) break; st = song.loop * 16; }
    }
    [ac, noise] = saved;
    return ctx.startRendering();
  }

  return { play, stop, pause, resume, jingle, level, beat, render, compile: n => get(n), CHANNELS,
    current: () => cur ? cur.id : null, get bpm() { return cur ? cur.bpm : 0; } };
})();
