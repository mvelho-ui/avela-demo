'use strict';
// Efeitos sonoros sintetizados em tempo real (WebAudio). A música está em music.js.
const Sound = (() => {
  let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  let muted = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* iPhone: tocar mesmo em silêncio */ }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.6; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(f, f2, dur, type = 'square', vol = 0.2, delay = 0, bus = sfxBus) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 && f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.2, freq = 1200, type = 'bandpass', delay = 0, bus = sfxBus, at = null) {
    if (!ac) return;
    const t = at !== null ? at : ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  function sfx(name) {
    if (!ac || muted) return;
    switch (name) {
      case 'jump': tone(300, 680, 0.13, 'square', 0.12); break;
      case 'acorn': tone(988, 988, 0.05, 'square', 0.1); tone(1480, 1480, 0.09, 'square', 0.1, 0.05); break;
      case 'golden': [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.18, i * 0.06)); break;
      case 'spring': tone(180, 1100, 0.28, 'square', 0.14); break;
      case 'spin': tone(520, 1040, 0.14, 'triangle', 0.16); noise(0.12, 0.06, 3000); break;
      case 'kill': noise(0.18, 0.22, 900); tone(700, 160, 0.18, 'square', 0.1); break;
      case 'hurt': tone(500, 110, 0.35, 'sawtooth', 0.14); noise(0.25, 0.1, 600); break;
      case 'scatter': for (let i = 0; i < 4; i++) tone(1300 - i * 120, 900 - i * 100, 0.08, 'square', 0.07, i * 0.04); break;
      case 'die': tone(660, 80, 0.9, 'square', 0.14); break;
      case 'land': noise(0.06, 0.08, 400, 'lowpass'); break;
      case 'skid': noise(0.15, 0.07, 2500, 'highpass'); break;
      case 'turbo': noise(0.25, 0.1, 1800); tone(200, 500, 0.25, 'sawtooth', 0.05); break;
      case 'crumble': noise(0.3, 0.14, 350, 'lowpass'); break;
      case 'check': [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.1, 'square', 0.1, i * 0.07)); break;
      case 'life': [659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.1, 'square', 0.12, i * 0.08)); break;
      case 'loop': tone(400, 900, 0.3, 'triangle', 0.1); break;
      case 'climb': noise(0.03, 0.04, 2000); break;
      case 'roll': tone(160, 520, 0.18, 'sawtooth', 0.06); noise(0.2, 0.08, 1500); break;
      case 'throw': tone(760, 330, 0.09, 'triangle', 0.14); noise(0.06, 0.05, 4000, 'highpass'); break;
      case 'tock': tone(320, 140, 0.06, 'square', 0.08); noise(0.05, 0.08, 900); break;
      case 'empty': tone(200, 150, 0.08, 'square', 0.06); break;
      case 'toss': tone(380, 220, 0.1, 'square', 0.07); noise(0.05, 0.05, 2500); break;
      case 'bat': tone(1800, 2600, 0.06, 'square', 0.05); tone(2200, 3000, 0.05, 'square', 0.04, 0.07); break;
      case 'rattle': for (let i = 0; i < 9; i++) noise(0.03, 0.07, 5200, 'highpass', i * 0.045); break;
      case 'screech': tone(1500, 900, 0.32, 'sawtooth', 0.045); tone(1700, 1100, 0.25, 'square', 0.025, 0.05); break;
      case 'splash': noise(0.28, 0.12, 1800, 'bandpass'); noise(0.18, 0.06, 4200, 'highpass', 0.04); break;
      case 'sink': noise(0.4, 0.12, 260, 'lowpass'); tone(140, 70, 0.3, 'triangle', 0.06); break;
      case 'rev': tone(260, 820, 0.14, 'sawtooth', 0.06); noise(0.12, 0.06, 3200); break;
      case 'grab': tone(500, 700, 0.06, 'triangle', 0.1); noise(0.05, 0.05, 2000); break;
      case 'ring': tone(880, 1320, 0.08, 'triangle', 0.07); tone(1320, 1760, 0.08, 'triangle', 0.05, 0.05); break;
      case 'boing': tone(260, 620, 0.12, 'triangle', 0.12); tone(520, 900, 0.08, 'sine', 0.05, 0.03); break;
      case 'dart': tone(900, 1800, 0.05, 'square', 0.05); noise(0.08, 0.08, 3000); break;
      case 'rumble': noise(0.3, 0.16, 90, 'lowpass'); tone(55, 40, 0.25, 'triangle', 0.1); break;
      case 'tick': tone(1400, 1400, 0.025, 'square', 0.05); break;
      case 'growl': tone(110, 80, 0.35, 'sawtooth', 0.07); noise(0.3, 0.08, 300, 'lowpass'); break;
      case 'roar': tone(180, 70, 0.9, 'sawtooth', 0.12); tone(240, 90, 0.8, 'square', 0.05); noise(0.9, 0.18, 500, 'lowpass'); break;
      case 'thunder': noise(1.4, 0.28, 110, 'lowpass', 0.25); noise(0.5, 0.16, 500, 'bandpass', 0.2); break;
      case 'chomp': tone(220, 120, 0.08, 'square', 0.08); noise(0.06, 0.08, 1200); break;
      case 'gulp': tone(400, 900, 0.12, 'sine', 0.14); tone(600, 1200, 0.1, 'sine', 0.1, 0.08); break;
      case 'warn': tone(880, 880, 0.08, 'square', 0.08); break;
      case 'stroke': noise(0.15, 0.06, 900, 'lowpass'); break;
      case 'dash': tone(900, 300, 0.25, 'sawtooth', 0.07); noise(0.3, 0.12, 1800); break;
      case 'smash': noise(0.35, 0.22, 500, 'lowpass'); noise(0.2, 0.1, 2400); tone(220, 70, 0.25, 'square', 0.08); break;
      case 'caw': tone(700, 420, 0.16, 'sawtooth', 0.12); tone(650, 380, 0.18, 'sawtooth', 0.12, 0.2); break;
      case 'bosshit': noise(0.25, 0.25, 700); tone(300, 90, 0.3, 'square', 0.14); break;
      case 'wind': noise(1.6, 0.12, 900, 'bandpass'); break;
      case 'super': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, f * 1.01, 0.12, 'square', 0.12, i * 0.05)); noise(0.5, 0.08, 3000); break;
      case 'unsuper': tone(900, 300, 0.25, 'triangle', 0.1); break;
      case 'talk': tone(620 + Math.random() * 120, 620, 0.04, 'square', 0.05); break;
      case 'gem': [1047, 1319, 1568, 2093, 1568, 2093, 2637].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.14, i * 0.09)); break;
      case 'free': tone(1200, 1800, 0.08, 'triangle', 0.08); tone(1500, 2100, 0.08, 'triangle', 0.07, 0.09); break;
      case 'select': tone(880, 1320, 0.1, 'square', 0.12); break;
      case 'goal': [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) =>
        tone(f, f, 0.16, 'square', 0.14, [0, .12, .24, .36, .6, .84, .96, 1.2][i])); break;
    }
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.55;
    return muted;
  }
  // A música (music.js) usa o mesmo contexto e passa pelo mesmo volume geral (tecla M).
  return { init, sfx, toggleMute, get muted() { return muted; }, get ready() { return !!ac; },
    ctx: () => ac, musicOut: () => musBus,
    suspend: () => { if (ac && ac.state === 'running') ac.suspend(); }, resume: () => { if (ac && ac.state === 'suspended') ac.resume(); } };
})();
