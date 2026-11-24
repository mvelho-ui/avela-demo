'use strict';
// =====================================================================
//  BANDA SONORA DE "AVELÃ" — composições originais
//
//  Notação (1 compasso = 16 passos de semicolcheia, separados por espaços):
//   melodia:  nota+oitava (E5, Ab5, C#6), '-' prolonga a nota, '.' pausa
//   acordes:  "| Cmaj7 | Em7 A7 |" — dois acordes num compasso = meio compasso cada
//   baixo:    R fundamental, 8 oitava, 3/5/7 do acorde, a = aproximação cromática
//             à fundamental do compasso seguinte
//   bateria:  k bombo, s tarola, h/o prato de choques fechado/aberto, c crash,
//             t/m/f timbalões (agudo/médio/grave); '+' junta peças
//   listas por compasso: "main*3 mainA" = main, main, main, mainA
//   transpose: meios-tons (escrevo em Dó e transponho; +3 = Mi bemol maior)
// =====================================================================
const SONG_PATTERNS = {
  bass: {
    main:   'R - 8 . . R 8 . R - 8 . R 8 5 8',
    mainA:  'R - 8 . . R 8 . R - 8 . R 8 5 a',
    walk:   'R - - - 8 - R - . R 5 - 8 - R -',
    walkA:  'R - - - 8 - R - . R 5 - 8 - 5 a',
    intro:  'R - - - - - R - R - - - 8 - R -',
    introA: 'R - - - - - R - R - - - 8 - 5 a',
    title:  'R - - R - - R - 8 - R - 5 - 8 -',
    drive:  'R R 8 R R R 8 R R R 8 R R 8 5 8',
    driveA: 'R R 8 R R R 8 R R R 8 R 8 5 3 a',
    jing:   'R . . . R . . . R . 8 . R . 8 .',
    slow:   'R - - - - - - - 5 - - - - - - -',
    end:    'R - - - - - - - - - - - - - - .',
    ostin:  'R - . R 8 - R . 5 - . R 8 - 7 .',
    ostinA: 'R - . R 8 - R . 5 - . R 8 - 5 a',
  },
  drum: {
    main:  'k+h . h . s+h . h k k+h . h . s+h . h .',
    main2: 'k+h . h . s+h . h k k+h . h k s+h . h s',
    crash: 'c+k . h . s+h . h k k+h . h . s+h . h .',
    intro: 'k . h . s . h . k . h . s . s s',
    fillT: 'k+h . h . s+h . h k s s t t m m f f',
    fillS: 'k+h . h . s+h . h k s s s s s s s s',
    boss:  'k+h . k+h . s+h . k+h k k+h . k+h . s+h k h s',
    jingle: 'c+k . . . s . . . k . k . s . s s',
    half:  'k . . . . . . . s . . . . . . .',
    end:   'c+k . . . . . . . . . . . . . . .',
    cave:  'k . . h . . s . k . h . . . s .',
    caveC: 'c+k . . h . . s . k . h . . . s .',
    caveF: 'k . . h . . s . k . h . s s t m',
  },
  stab: {
    skank: '. . X . . . X . . . X . . . X .',
    push:  'X . . X . . X . . . X . X . . .',
    hit:   'X - - - - - - - . . . . . . . .',
  },
  arp: {
    up:      '0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3',
    updown:  '0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 3',
    sparkle: '3 . 2 . 1 . 0 . 3 . 2 . 1 . 0 .',
  },
};

const SONGS = {
  // ------------------------------------------------------------------
  title: {
    name: 'TÍTULO', bpm: 128, transpose: 3, loop: 0,
    chords: '| C | F/C | Ab Bb | C | Am7 | Dm7 G7 | Fmaj7 Fm6 | Cmaj7 |',
    lead: [
      'G5 - - C6 - - E6 - - - D6 - C6 - D6 -',
      'C6 - - A5 - - F5 - - - . F5 G5 A5 C6 -',
      'Eb6 - - - - - C6 - D6 - - - - - Bb5 -',
      'C6 - - - - - - - . . . . G5 - G5 -',
      'C6 - - E6 - - G6 - - - E6 - D6 - C6 -',
      'D6 - - - C6 - A5 - B5 - - - D6 - F6 -',
      'A5 - - - C6 - - - Ab5 - - - C6 - - -',
      'B5 - - - - - - - G5 - - - E5 - D5 -',
    ],
    bass: 'title*8',
    drum: 'crash main main2 fillS crash main main2 fillT',
    stab: 'push*8',
    pad:  'none*4 auto*4',
    arp:  'none*4 sparkle*4',
  },

  // ------------------------------------------------------------------
  //  Intro (4) · A (8) · B (8) — repete a partir do A
  zone1: {
    name: 'BOSQUE DAS AVELÃS', bpm: 148, transpose: 3, loop: 4,
    chords: `| Fmaj7 | G6 | Am7 | G7sus4 |
             | Cmaj7 | Em7 A7 | Dm7 | G7sus4 G7 | Cmaj7 | Em7 A7 | Fmaj7 Fm6 | Cmaj7 |
             | Fmaj7 | Em7 | Dm7 | Cmaj7 | Bbmaj7 | Am7 | Dm7 | G7sus4 |`,
    lead: [
      // intro
      'C6 . C6 . . A5 - - C6 - - D6 - - . .',
      'D6 . D6 . . B5 - - D6 - - E6 - - . .',
      'E6 - - - D6 - - - C6 - - - B5 - - -',
      'C6 - - - - - - - . . . . . . . .',
      // A
      'E5 - - G5 - - A5 - B5 - - G5 - - E5 -',
      'D5 - - E5 - - G5 - - - C#5 - E5 - - .',
      'F5 - - - E5 - D5 - . C5 - D5 - - - .',
      'C5 - - - - - . G4 A4 B4 - D5 - F5 - .',
      'E5 - - G5 - - A5 - B5 - - D6 - - C6 -',
      'B5 - - G5 - - E5 - - - A5 - G5 - E5 -',
      'F5 - - A5 - - C6 - - - Ab5 - - G5 - F5',
      'E5 - - - - - D5 E5 G5 - - - . . . .',
      // B
      'A5 - - - - - - - G5 - - - A5 - C6 -',
      'B5 - - - - - - - . G5 - - E5 - - .',
      'A5 - - - - - G5 - F5 - - - E5 - F5 -',
      'G5 - - - - - - - - - - - . . . .',
      'D6 - - - - - - - C6 - - - D6 - F6 -',
      'E6 - - - - - - - . C6 - - A5 - - .',
      'F5 - - - E5 - - - D5 - - - C5 - - -',
      'D5 - - - - - - - . . . . . . . .',
    ],
    bass: 'intro*3 introA  main*3 mainA main*3 mainA  walk*3 walkA walk*3 walkA',
    drum: 'crash intro intro fillT  crash main main2 main main2 main main2 fillT  crash main main2 main main2 main main2 fillS',
    stab: 'push*4  skank*8  push*8',
    pad:  'none*12 auto*8',
    arp:  'sparkle*4 none*8 updown*8',
  },

  // ------------------------------------------------------------------
  //  Nível 2. Intro (2) · A (8) · B (8) — repete do A. Escrito em Dó, tocado em Si bemol.
  zone2: {
    name: 'COPAS DO CARVALHAL', bpm: 140, transpose: -2, loop: 2,
    chords: `| Fmaj7 | G6 |
             | Fmaj7 | Em7 | Dm7 | Cmaj7 | Fmaj7 | Em7 A7 | Dm7 G7 | Cmaj7 |
             | Am7 | D7 | Gmaj7 | Cmaj7 | Am7 | D7 | Fmaj7 | G7sus4 G7 |`,
    lead: [
      'A5 . A5 . C6 - - - . . . . . . . .',
      'B5 . B5 . D6 - - - E6 - - - D6 - B5 -',
      // A
      'A5 - - C6 - - E6 - D6 - C6 - A5 - - -',
      'G5 - - B5 - - D6 - C6 - B5 - G5 - - -',
      'F5 - - A5 - - C6 - B5 - A5 - F5 - - -',
      'E5 - - - G5 - - - B5 - - - . . . .',
      'A5 - - C6 - - E6 - G6 - - - E6 - - -',
      'D6 - - B5 - - G5 - C#6 - - - E6 - - -',
      'F6 - - - E6 - D6 - B5 - - - D6 - F6 -',
      'E6 - - - - - - - . . G5 - A5 - B5 -',
      // B
      'C6 - - - - - B5 - A5 - - - G5 - E5 -',
      'F#5 - - - - - A5 - C6 - - - A5 - - -',
      'B5 - - - - - - - D6 - - - F#6 - - -',
      'E6 - - - - - - - - - - - . . . .',
      'C6 - - - - - B5 - A5 - - - G5 - E5 -',
      'F#5 - - - - - A5 - D6 - - - C6 - - -',
      'A5 - - - G5 - - - F5 - - - E5 - - -',
      'D5 - - - - - - - . . . . . . . .',
    ],
    bass: 'intro introA  walk*3 walkA walk*3 walkA  main*3 mainA main*3 mainA',
    drum: 'crash fillT  crash main2 main main2 main main2 main fillT  crash main main2 main main2 main main2 fillS',
    stab: 'push*2  skank*8  push*8',
    pad:  'none*2  auto*8  none*8',
    arp:  'none*2  updown*8  sparkle*8',
  },

  // ------------------------------------------------------------------
  //  Nível 3. Intro (2) · A (8) · B (8) — repete do A. Lá menor.
  zone3: {
    name: 'OUTONO NO CARVALHAL', bpm: 136, transpose: 0, loop: 2,
    chords: `| Am7 | Fmaj7 |
             | Am7 | D7 | Gmaj7 | Cmaj7 | Fmaj7 | Dm7 | E7sus4 E7 | Am7 |
             | Fmaj7 | G6 | Em7 | Am7 | Dm7 | G7 | Cmaj7 | E7 |`,
    lead: [
      'A5 . A5 . C6 - - - E6 - - - . . . .',
      'F6 - - - E6 - - - C6 - - - A5 - - -',
      // A
      'E5 - - A5 - - C6 - B5 - A5 - G5 - E5 -',
      'F#5 - - - A5 - - - C6 - B5 - A5 - - -',
      'B5 - - D6 - - F#6 - - - E6 - D6 - B5 -',
      'G5 - - - - - - - E5 - G5 - B5 - - -',
      'A5 - - C6 - - E6 - - - D6 - C6 - A5 -',
      'F5 - - A5 - - D6 - - - C6 - A5 - F5 -',
      'E5 - - A5 - - B5 - G#5 - - - B5 - D6 -',
      'C6 - - - - - - - B5 - A5 - - - . .',
      // B
      'C6 - - - A5 - - - F5 - - - A5 - C6 -',
      'D6 - - - B5 - - - G5 - - - E6 - D6 -',
      'B5 - - - - - G5 - E5 - - - G5 - B5 -',
      'C6 - - - - - - - - - - - . . . .',
      'A5 - - - F5 - - - D5 - - - F5 - A5 -',
      'B5 - - - G5 - - - D5 - - - F5 - G5 -',
      'E5 - - - G5 - - - B5 - - - C6 - - -',
      'B5 - - - - - - - G#5 - - - E5 - - -',
    ],
    bass: 'intro introA  main*3 mainA main*3 mainA  walk*3 walkA walk*3 walkA',
    drum: 'crash fillT  crash main main2 main main2 main main2 fillT  crash main2 main main2 main main2 main fillS',
    stab: 'push*2  skank*8  push*8',
    pad:  'auto*2  none*8  auto*8',
    arp:  'none*2  sparkle*8  updown*8',
  },

  // ------------------------------------------------------------------
  // Mina abandonada: Ré menor, ostinato de baixo a "picar pedra", marimba FM com eco
  mine1: {
    name: 'GALERIAS DE JADE', bpm: 112, transpose: 0, loop: 2,
    chords: `| Dm | A7 |
             | Dm | Bb | C | Am | Dm | Gm | A7sus4 A7 | Dm |
             | Bb | C | Am | Dm | Gm | C | Fmaj7 | A7 |`,
    lead: [
      'D5 - - - . . . . A4 - - - . . . .',
      'C#5 - - - . . . . E5 - - - . . . .',
      // A
      'D5 - - - - - F5 - A5 - - - G5 - F5 -',
      'F5 - - - - - - - D5 - - - . . . .',
      'E5 - - - - - G5 - C6 - - - Bb5 - G5 -',
      'A5 - - - - - - - - - - - . . . .',
      'D6 - - - C6 - A5 - F5 - - - A5 - - -',
      'Bb5 - - - A5 - G5 - D5 - - - G5 - - -',
      'A5 - - - D6 - - - C#6 - - - E6 - - -',
      'D6 - - - - - - - - - - - . . . .',
      // B
      'D5 - - F5 - - Bb5 - - - A5 - F5 - - -',
      'E5 - - G5 - - C6 - - - Bb5 - G5 - - -',
      'C5 - - E5 - - A5 - - - G5 - E5 - - -',
      'F5 - - - - - - - D5 - - - . . . .',
      'G5 - - Bb5 - - D6 - - - C6 - Bb5 - - -',
      'C6 - - - Bb5 - - - G5 - - - E5 - - -',
      'A5 - - - - - - - G5 - - - F5 - - -',
      'E5 - - - - - - - C#5 - - - A4 - - -',
    ],
    bass: 'ostin ostinA  ostin*7 ostinA  ostin*7 ostinA',
    drum: 'half intro  caveC cave*6 caveF  caveC cave*6 caveF',
    stab: 'none*2  skank*8  push*8',
    pad:  'auto*18',
    arp:  'none*2  sparkle*8  updown*8',
    patches: { lead: 'mallet' },
  },

  // ------------------------------------------------------------------
  // 2-2: Mi menor, mais rápida, para as galerias longas
  mine2: {
    name: 'GALERIAS DE RUBI', bpm: 126, transpose: 0, loop: 2,
    chords: `| Em | B7 |
             | Em | G | Am | B7 | Em | C | Am B7 | Em |
             | Am | D | G | Cmaj7 | Am | B7 | Em | B7 |`,
    lead: [
      'E5 - - - B4 - - - E5 - G5 - B5 - - -',
      'A5 - - - F#5 - - - D#5 - - - B4 - - -',
      // A
      'E5 - - G5 - - B5 - - - A5 - G5 - E5 -',
      'D5 - - - G5 - - - B5 - - - D6 - - -',
      'C6 - - - B5 - A5 - - - E5 - - - A5 -',
      'B5 - - - - - - - D#5 - F#5 - A5 - - -',
      'G5 - - - F#5 - E5 - - - B4 - E5 - G5 -',
      'E5 - - - G5 - - - C6 - - - B5 - G5 -',
      'A5 - - - C6 - - - B5 - - - D#6 - - -',
      'E6 - - - - - - - - - - - . . . .',
      // B
      'A5 - - C6 - - E6 - - - D6 - C6 - A5 -',
      'F#5 - - A5 - - D6 - - - C6 - A5 - F#5 -',
      'G5 - - B5 - - D6 - - - B5 - G5 - D5 -',
      'E5 - - - - - - - G5 - - - B5 - - -',
      'C6 - - - B5 - - - A5 - - - E5 - - -',
      'D#5 - - - F#5 - - - A5 - - - B5 - - -',
      'G5 - - - - - E5 - - - B5 - - - - -',
      'B5 - - - A5 - - - F#5 - - - D#5 - - -',
    ],
    bass: 'intro introA  main*7 mainA  walk*7 walkA',
    drum: 'intro fillT  caveC cave*6 caveF  crash main2 main main2 main main2 main fillS',
    stab: 'none*2  skank*8  push*8',
    pad:  'auto*18',
    arp:  'none*2  updown*8  sparkle*8',
  },

  // ------------------------------------------------------------------
  // 2-3: Dó menor, metais FM, o fundo da mina com rios de lava
  mine3: {
    name: 'GALERIAS DE DIAMANTE', bpm: 132, transpose: 0, loop: 2,
    chords: `| Cm | G7 |
             | Cm | Ab | Bb | Gm | Cm | Fm | G7sus4 G7 | Cm |
             | Fm | G | Ab | Eb | Fm | Ddim | G7 | G7 |`,
    lead: [
      'C5 - - C5 - - Eb5 - G5 - - - . . . .',
      'B4 - - B4 - - D5 - F5 - - - G5 - - -',
      // A
      'C6 - - - G5 - - - Eb5 - - - G5 - C6 -',
      'Ab5 - - - - - - - C6 - - - Eb6 - - -',
      'D6 - - - Bb5 - - - F5 - - - Bb5 - D6 -',
      'D6 - - - - - - - . . . . Bb5 - D6 -',
      'Eb6 - - D6 - - C6 - - - G5 - - - C6 -',
      'Ab5 - - - G5 - F5 - - - C5 - F5 - Ab5 -',
      'G5 - - - C6 - - - B5 - - - D6 - - -',
      'C6 - - - - - - - - - - - . . . .',
      // B
      'F5 - - Ab5 - - C6 - - - Ab5 - F5 - - -',
      'G5 - - B5 - - D6 - - - B5 - G5 - - -',
      'Ab5 - - C6 - - Eb6 - - - C6 - Ab5 - - -',
      'G5 - - - - - - - Bb5 - - - Eb6 - - -',
      'F6 - - - Eb6 - - - C6 - - - Ab5 - - -',
      'Ab5 - - - F5 - - - D5 - - - F5 - - -',
      'G5 - - - B5 - - - D6 - - - F6 - - -',
      'G6 - - - - - - - F6 - - - D6 - B5 -',
    ],
    bass: 'intro introA  main*7 mainA  drive*7 driveA',
    drum: 'intro fillT  crash main main2 main main2 main main2 fillT  crash boss boss fillS boss boss boss fillT',
    stab: 'none*2  push*16',
    pad:  'auto*18',
    arp:  'none*2  up*8  updown*8',
    patches: { lead: 'brass' },
  },

  // ------------------------------------------------------------------
  // chefe do Reino da Mina: Ré menor, sexta napolitana (Mib) antes da dominante
  boss2: {
    name: 'MORCEGO', bpm: 164, transpose: 0, loop: 0,
    chords: '| Dm | Dm | Bb | A7 | Dm | Dm | Eb | A7 |',
    lead: [
      'D5 - - F5 - - A5 - D6 - - - C6 - A5 -',
      'Bb5 - - - A5 - - - F5 - - - D5 - - -',
      'Bb5 - - - D6 - - - F6 - - - D6 - Bb5 -',
      'A5 - - - C#6 - - - E6 - - - G6 - - -',
      'F6 - - - E6 - D6 - - - A5 - - - D6 -',
      'C6 - - - Bb5 - A5 - - - F5 - - - A5 -',
      'Bb5 - - - G5 - - - Eb5 - - - G5 - Bb5 -',
      'C#6 - - - - - - - E6 - - - A5 - - -',
    ],
    bass: 'drive*3 driveA drive*3 driveA',
    drum: 'crash boss boss fillS boss boss boss fillT',
    stab: 'push*8',
    arp:  'up*8',
    patches: { lead: 'brass' },
  },

  // ------------------------------------------------------------------
  // 3-1: Mi frígio dominante (o "sabor" de deserto: Mi-Fá-Sol#), groove a meio tempo
  desert1: {
    name: 'DUNAS DOURADAS', bpm: 140, transpose: 0, loop: 2,
    chords: `| E | F |
             | E | F | E | Dm | E | F | G F | E |
             | Am | G | F | E | Am | G | F | E7 |`,
    lead: [
      'E5 - - - F5 - G#5 - B5 - - - . . . .',
      'C6 - - - B5 - A5 - G#5 - - - F5 - - -',
      // A
      'E5 - - F5 - - G#5 - - - B5 - G#5 - F5 -',
      'A5 - - - - - G#5 - F5 - - - . . . .',
      'G#5 - - A5 - - B5 - - - C6 - B5 - A5 -',
      'A5 - - - - - - - F5 - - - D5 - - -',
      'E6 - - - D6 - C6 - B5 - - - G#5 - B5 -',
      'C6 - - - - - A5 - F5 - - - A5 - C6 -',
      'D6 - - - B5 - - - C6 - - - A5 - - -',
      'B5 - - - G#5 - - - E5 - - - . . . .',
      // B
      'A5 - - C6 - - E6 - - - D6 - C6 - - -',
      'B5 - - - D6 - - - G5 - - - B5 - - -',
      'A5 - - C6 - - F6 - - - E6 - C6 - - -',
      'G#5 - - - - - - - B5 - - - E6 - - -',
      'E6 - - - D6 - C6 - - - A5 - - - C6 -',
      'D6 - - - C6 - B5 - - - G5 - - - B5 -',
      'C6 - - - A5 - - - F5 - - - A5 - - -',
      'G#5 - - - - - - - D6 - - - B5 - G#5 -',
    ],
    bass: 'intro introA  main*7 mainA  walk*7 walkA',
    drum: 'intro fillT  crash main main2 main main2 main main2 fillT  crash main2 main main2 main main2 main fillS',
    stab: 'none*2  skank*16',
    pad:  'auto*18',
    arp:  'none*2  sparkle*8  up*8',
  },

  // ------------------------------------------------------------------
  // 3-2: Lá frígio dominante (transposto para Sol), rápida, metais FM e bateria do chefe na parte B
  desert2: {
    name: 'MAR DE AREIA', bpm: 156, transpose: -2, loop: 2,
    chords: `| A | Bb |
             | A | Bb | A | Gm | A | Bb | C Bb | A |
             | Dm | C | Bb | A | Dm | C | Bb | A7 |`,
    lead: [
      'A4 - - - Bb4 - C#5 - E5 - - - . . . .',
      'F5 - - - E5 - D5 - C#5 - - - Bb4 - - -',
      // A
      'A5 - - Bb5 - - C#6 - - - E6 - C#6 - Bb5 -',
      'D6 - - - - - C#6 - Bb5 - - - . . . .',
      'C#6 - - D6 - - E6 - - - F6 - E6 - D6 -',
      'D6 - - - - - - - Bb5 - - - G5 - - -',
      'A5 - - - G5 - F5 - E5 - - - C#5 - E5 -',
      'F5 - - - - - D5 - Bb4 - - - D5 - F5 -',
      'G5 - - - E5 - - - F5 - - - D5 - - -',
      'E5 - - - C#5 - - - A4 - - - . . . .',
      // B
      'D5 - - F5 - - A5 - - - G5 - F5 - - -',
      'E5 - - - G5 - - - C5 - - - E5 - - -',
      'D5 - - F5 - - Bb5 - - - A5 - F5 - - -',
      'C#5 - - - - - - - E5 - - - A5 - - -',
      'A5 - - - G5 - F5 - - - D5 - - - F5 -',
      'G5 - - - F5 - E5 - - - C5 - - - E5 -',
      'F5 - - - D5 - - - Bb4 - - - D5 - - -',
      'C#5 - - - - - - - G5 - - - E5 - C#5 -',
    ],
    bass: 'intro introA  drive*7 driveA  drive*7 driveA',
    drum: 'intro fillT  crash main main2 main main2 main main2 fillT  crash boss boss fillS boss boss boss fillT',
    stab: 'none*2  push*16',
    pad:  'auto*18',
    arp:  'none*2  up*8  updown*8',
    patches: { lead: 'brass' },
  },

  // ------------------------------------------------------------------
  // ruínas debaixo do mar de areia (3-2): Ré frígio, lenta, marimba FM e baixo em ostinato
  ruins: {
    name: 'A CIDADE ANTIGA', bpm: 100, transpose: 0, loop: 2,
    chords: `| Dm | Eb |
             | Dm | Eb | Dm | C | Bb | A | Bb A | Dm |
             | Gm | Dm | Eb | Dm | Gm | A | Bb | A7 |`,
    lead: [
      'D5 - - - . . A4 - D5 - - - . . . .',
      'Eb5 - - - . . D5 - C5 - - - . . . .',
      // A
      'F5 - - - E5 - D5 - A4 - - - D5 - F5 -',
      'G5 - - - - - F5 - Eb5 - - - . . . .',
      'A5 - - - G5 - F5 - D5 - - - F5 - A5 -',
      'G5 - - - - - E5 - C5 - - - . . . .',
      'F5 - - - D5 - - - Bb4 - - - D5 - F5 -',
      'E5 - - - C#5 - - - A4 - - - C#5 - E5 -',
      'D5 - - - F5 - - - E5 - - - C#5 - - -',
      'D5 - - - - - - - . . . . . . . .',
      // B
      'Bb5 - - - A5 - G5 - D5 - - - G5 - - -',
      'A5 - - - F5 - - - D5 - - - . . . .',
      'G5 - - - Bb5 - - - Eb6 - - - D6 - Bb5 -',
      'A5 - - - - - - - F5 - - - D5 - - -',
      'G5 - - - Bb5 - D6 - - - C6 - Bb5 - - -',
      'A5 - - - C#6 - E6 - - - D6 - C#6 - - -',
      'D6 - - - - - Bb5 - F5 - - - D5 - - -',
      'C#5 - - - E5 - - - G5 - - - A5 - - -',
    ],
    bass: 'intro introA  ostin*7 ostinA  walk*7 walkA',
    drum: 'half intro  cave*7 caveF  caveC cave*6 caveF',
    stab: 'none*2  skank*16',
    pad:  'auto*18',
    arp:  'none*2  sparkle*16',
    patches: { lead: 'mallet' },
  },

  // ------------------------------------------------------------------
  // 3-3: noite no deserto, Si menor com a 2.ª menor (frígio) e marimba FM; mais calma mas com groove
  desert3: {
    name: 'NOITE NO DESERTO', bpm: 126, transpose: 0, loop: 2,
    chords: `| Bm | C |
             | Bm | C | Bm | Am | G | F#7 | G F#7 | Bm |
             | Em | Bm | C | Bm | Em | F#7 | G | F#7 |`,
    lead: [
      'B4 - - - . . F#5 - B5 - - - . . . .',
      'C6 - - - B5 - G5 - E5 - - - . . . .',
      // A
      'D5 - - - C#5 - B4 - F#5 - - - B5 - D6 -',
      'E6 - - - - - D6 - C6 - - - . . . .',
      'D6 - - - B5 - F#5 - D5 - - - F#5 - B5 -',
      'C6 - - - - - A5 - E5 - - - . . . .',
      'B5 - - - G5 - D5 - B4 - - - D5 - G5 -',
      'A#5 - - - F#5 - - - C#5 - - - F#5 - A#5 -',
      'B5 - - - D6 - - - C#6 - - - A#5 - - -',
      'B5 - - - - - - - . . . . . . . .',
      // B
      'E5 - - G5 - - B5 - - - A5 - G5 - - -',
      'F#5 - - - D5 - - - B4 - - - D5 - - -',
      'E5 - - G5 - - C6 - - - B5 - G5 - - -',
      'F#5 - - - - - - - D5 - - - B4 - - -',
      'G5 - - - B5 - E6 - - - D6 - B5 - - -',
      'A#5 - - - C#6 - F#6 - - - E6 - C#6 - - -',
      'D6 - - - - - B5 - G5 - - - D6 - - -',
      'C#6 - - - - - - - A#5 - - - F#5 - - -',
    ],
    bass: 'intro introA  ostin*7 ostinA  walk*7 walkA',
    drum: 'half intro  caveC cave*6 caveF  crash main main2 main main2 main main2 fillT',
    stab: 'none*2  skank*16',
    pad:  'auto*18',
    arp:  'none*2  sparkle*8  updown*8',
    patches: { lead: 'mallet' },
  },

  // ------------------------------------------------------------------
  // chefe do Reino do Deserto: Mi frígio dominante, rápida e com metais
  boss3: {
    name: 'COBRA REAL', bpm: 168, transpose: 0, loop: 0,
    chords: '| E | F | E | Dm | E | F | G F | E7 |',
    lead: [
      'E5 - - F5 - - G#5 - B5 - - - G#5 - F5 -',
      'A5 - - - G#5 - F5 - E5 - - - C5 - - -',
      'E5 - - G#5 - - B5 - E6 - - - D6 - C6 -',
      'D6 - - - C6 - A5 - F5 - - - D5 - - -',
      'B5 - - - C6 - B5 - G#5 - - - E5 - G#5 -',
      'A5 - - - C6 - - - F6 - - - E6 - C6 -',
      'D6 - - - B5 - - - C6 - - - A5 - - -',
      'G#5 - - - - - - - D6 - - - B5 - G#5 -',
    ],
    bass: 'drive*3 driveA drive*3 driveA',
    drum: 'crash boss boss fillS boss boss boss fillT',
    stab: 'push*8',
    arp:  'up*8',
    patches: { lead: 'brass' },
  },

  // ------------------------------------------------------------------
  // 4-1: Fá maior, alegre, marimba FM, baixo saltitão e arpejos
  jungle1: {
    name: 'RIO DAS LIANAS', bpm: 132, transpose: 0, loop: 2,
    chords: `| F | C |
             | F | Dm | Bb | C | F | Am | Bb C | F |
             | Dm | Am | Bb | F | Gm | C | A7 | Dm C |`,
    lead: [
      'F5 . A5 . C6 - A5 - F5 . A5 . C6 - - -',
      'E5 . G5 . C6 - G5 - E5 - G5 - Bb5 - - -',
      // A
      'A5 - - C6 - - A5 - F5 - - - G5 - A5 -',
      'F5 - - - D5 - - - A5 - - - G5 - F5 -',
      'D6 - - - Bb5 - - - F5 - - - Bb5 - D6 -',
      'C6 - - - - - Bb5 - A5 - - - G5 - - -',
      'A5 - C6 - F6 - - - E6 - - - C6 - A5 -',
      'C6 - - - A5 - - - E5 - - - A5 - C6 -',
      'D6 - - - Bb5 - - - E6 - - - C6 - - -',
      'F6 - - - - - - - . . . . C6 - A5 -',
      // B
      'D6 - - - F6 - - - A5 - - - D6 - - -',
      'C6 - - - E6 - - - A5 - - - C6 - - -',
      'Bb5 - - D6 - - F6 - - - D6 - Bb5 - - -',
      'A5 - - - - - - - F5 - - - A5 - C6 -',
      'G5 - - Bb5 - - D6 - - - C6 - Bb5 - - -',
      'C6 - - - E6 - - - G6 - - - E6 - C6 -',
      'C#6 - - - E6 - - - A5 - - - C#6 - - -',
      'D6 - - - - - - - E6 - - - C6 - - -',
    ],
    bass: 'intro introA  main*7 mainA  walk*7 walkA',
    drum: 'intro fillT  crash main main2 main main2 main main2 fillT  crash main2 main main2 main main2 main fillS',
    stab: 'none*2  skank*16',
    pad:  'auto*18',
    arp:  'none*2  sparkle*8  up*8',
    patches: { lead: 'mallet' },
  },

  // ------------------------------------------------------------------
  jungle2: {
    name: 'TEMPESTADE NAS COPAS', bpm: 144, transpose: 0, loop: 2,
    chords: `| Dm | Dm |
             | Dm | Bb | C | Dm | Dm | Bb | Gm | A7 |
             | Bb | C | Am | Dm | Gm | C | F | A7 |`,
    lead: [
      'D5 . D5 . F5 . A5 - D6 - - - C6 - A5 -',
      'Bb5 - A5 - G5 - F5 - E5 - - - A5 - - -',
      // A
      'D6 - - - A5 - - - F5 - A5 - D6 - E6 -',
      'F6 - - - D6 - - - Bb5 - - - D6 - F6 -',
      'E6 - - - C6 - - - G5 - - - C6 - E6 -',
      'D6 - - - - - - - . . A5 - C6 - D6 -',
      'F6 - - - E6 - D6 - A5 - - - D6 - F6 -',
      'G6 - - - F6 - D6 - Bb5 - - - D6 - - -',
      'D6 - - - Bb5 - - - G5 - - - Bb5 - D6 -',
      'C#6 - - - E6 - - - G6 - - - E6 - C#6 -',
      // B
      'D6 - - - - - F6 - - - D6 - Bb5 - - -',
      'C6 - - - - - E6 - - - G6 - E6 - - -',
      'E6 - - - C6 - - - A5 - - - C6 - E6 -',
      'F6 - - - - - - - D6 - - - A5 - - -',
      'Bb5 - - - D6 - - - G6 - - - F6 - D6 -',
      'E6 - - - G6 - - - C6 - - - E6 - G6 -',
      'A6 - - - - - F6 - - - C6 - A5 - - -',
      'A5 - C#6 - E6 - - - G6 - - - E6 - C#6 -',
    ],
    bass: 'intro introA  drive*7 driveA  ostin*7 ostinA',
    drum: 'intro fillT  crash main main2 main main2 main main2 fillT  crash boss main2 boss main2 boss main2 fillS',
    stab: 'none*2  push*16',
    pad:  'auto*18',
    arp:  'none*2  up*8  sparkle*8',
    patches: { lead: 'brass' },
  },

  // ------------------------------------------------------------------
  temple: {
    name: 'O TEMPLO PERDIDO', bpm: 124, transpose: 0, loop: 2,
    chords: `| Am | Am |
             | Am | F | Dm | E7 | Am | F | Bb | E7 |
             | Dm | Am | Bb | F | Dm | E7 | Am | E7 |`,
    lead: [
      'A4 . . E5 . . A5 . G5 . E5 . C5 - - -',
      'B4 . . C5 . . E5 . D5 - C5 - B4 - - -',
      // A
      'A5 - - - E5 - - - C6 - B5 - A5 - - -',
      'A5 - - - F5 - - - C6 - - - A5 - G5 -',
      'F5 - - - A5 - - - D6 - C6 - A5 - - -',
      'G#5 - - - B5 - - - D6 - - - E6 - - -',
      'E6 - - - C6 - - - A5 - B5 - C6 - E6 -',
      'F6 - - - E6 - C6 - A5 - - - F5 - - -',
      'D6 - - - F6 - - - Bb5 - - - D6 - - -',
      'B5 - - - G#5 - - - E5 - - - . . . .',
      // B
      'D5 - F5 - A5 - - - D6 - - - C6 - A5 -',
      'C6 - - - - - B5 - A5 - - - E5 - - -',
      'F5 - Bb5 - D6 - - - F6 - - - D6 - - -',
      'C6 - - - A5 - - - F5 - - - A5 - C6 -',
      'D6 - - - F6 - - - A6 - - - F6 - D6 -',
      'E6 - - - D6 - - - B5 - - - G#5 - - -',
      'A5 - - - C6 - - - E6 - - - A6 - - -',
      'G#6 - - - - - - - E6 - - - B5 - - -',
    ],
    bass: 'intro introA  ostin*7 ostinA  walk*7 walkA',
    drum: 'half intro  caveC cave*6 caveF  crash main main2 main main2 main main2 fillT',
    stab: 'none*10  skank*8',
    pad:  'auto*18',
    arp:  'none*2  sparkle*8  updown*8',
  },

  // ------------------------------------------------------------------
  boss4: {
    name: 'LEÃO', bpm: 172, transpose: 0, loop: 0,
    chords: `| Gm | Gm | Eb | D7 | Gm | Gm | Cm | D7 |
             | Eb | F | Dm | Gm | Cm | Ab | D7 | D7 |`,
    lead: [
      'G5 - - - D6 - - - Bb5 - A5 - G5 - D5 -',
      'G5 - A5 - Bb5 - C6 - D6 - - - Bb5 - - -',
      'Eb6 - - - Bb5 - - - G5 - - - Bb5 - Eb6 -',
      'D6 - - - - - C6 - A5 - - - F#5 - - -',
      'G6 - - - F6 - D6 - Bb5 - - - D6 - G6 -',
      'F6 - - - D6 - Bb5 - G5 - - - A5 - Bb5 -',
      'C6 - - - Eb6 - - - G6 - - - Eb6 - C6 -',
      'D6 - F#6 - A6 - - - F#6 - D6 - A5 - - -',
      'G6 - - - - - F6 - Eb6 - - - Bb5 - - -',
      'A6 - - - - - G6 - F6 - - - C6 - - -',
      'F6 - - - D6 - - - A5 - - - D6 - F6 -',
      'G6 - - - - - - - D6 - - - Bb5 - - -',
      'Eb6 - - - G6 - - - C6 - - - Eb6 - G6 -',
      'Ab6 - - - Eb6 - - - C6 - - - Ab5 - - -',
      'F#6 - - - A6 - - - D6 - - - C6 - - -',
      'A5 - C6 - D6 - F#6 - A6 - - - - - - -',
    ],
    bass: 'drive*3 driveA drive*3 driveA drive*3 driveA drive*3 driveA',
    drum: 'crash boss boss fillS boss boss boss fillT crash boss boss fillS boss boss boss fillT',
    stab: 'push*16',
    arp:  'up*16',
    patches: { lead: 'brass' },
  },

  // ------------------------------------------------------------------
  beach1: {
    name: 'PRAIA DAS CONCHAS', bpm: 138, transpose: 0, loop: 2,
    chords: `| C | G7 |
             | C | F | G7 | C | Am | Dm | G7 | C |
             | F | C | Dm | G7 | Em | Am | D7 | G7 |`,
    lead: [
      'E5 . G5 . C6 . G5 . E5 . G5 . C6 - - -',
      'B5 . D6 . F6 - D6 - B5 - G5 - D6 - - -',
      // A
      'C6 - E6 - G6 - E6 - C6 - - - G5 - - -',
      'A5 - C6 - F6 - - - E6 - D6 - C6 - - -',
      'B5 - - D6 - - F6 - G6 - F6 - D6 - B5 -',
      'C6 - - - G5 - - - E5 - G5 - C6 - - -',
      'A5 - C6 - E6 - - - D6 - C6 - A5 - - -',
      'D6 - F6 - A6 - - - G6 - F6 - D6 - - -',
      'G6 - F6 - D6 - B5 - G5 - B5 - D6 - F6 -',
      'E6 - - - C6 - - - . . G5 - A5 - B5 -',
      // B
      'C6 - - - A5 - C6 - F6 - - - E6 - C6 -',
      'E6 - - - G6 - - - E6 - D6 - C6 - - -',
      'F6 - - - D6 - F6 - A6 - - - G6 - F6 -',
      'G6 - - - D6 - - - B5 - - - G5 - - -',
      'G5 - B5 - E6 - - - D6 - B5 - G5 - - -',
      'A5 - C6 - E6 - - - G6 - - - E6 - C6 -',
      'F#6 - - - D6 - - - A5 - C6 - F#6 - - -',
      'G6 - - - - - - - F6 - D6 - B5 - G5 -',
    ],
    bass: 'intro introA  main*7 mainA  walk*7 walkA',
    drum: 'intro fillT  crash main main2 main main2 main main2 fillT  crash main2 main main2 main main2 main fillS',
    stab: 'none*2  skank*16',
    pad:  'auto*18',
    arp:  'none*2  up*8  sparkle*8',
    patches: { lead: 'steel' },
  },

  // ------------------------------------------------------------------
  sea1: {
    name: 'DEBAIXO DO MAR', bpm: 96, transpose: 0, loop: 2,
    chords: `| Fmaj7 | Em7 |
             | Cmaj7 | Am7 | Dm7 | G7 | Cmaj7 | Am7 | Fmaj7 | G7 |
             | Fmaj7 | Em7 | Dm7 | Cmaj7 | Fmaj7 | Em7 | Dm7 | G7 |`,
    lead: [
      'A5 - - - - - E5 - - - C6 - - - - -',
      'B5 - - - - - G5 - - - E5 - - - - -',
      // A
      'E6 - - - B5 - - - G5 - - - B5 - - -',
      'C6 - - - - - A5 - - - E5 - G5 - - -',
      'F5 - - - A5 - - - C6 - - - D6 - - -',
      'B5 - - - - - - - . . . . D6 - - -',
      'G6 - - - E6 - - - B5 - - - C6 - - -',
      'E6 - - - C6 - - - A5 - - - G5 - - -',
      'A5 - - - C6 - - - E6 - - - F6 - - -',
      'D6 - - - - - - - B5 - - - - - - -',
      // B
      'C6 - - - A5 - - - F5 - - - A5 - C6 -',
      'B5 - - - - - G5 - - - - - E5 - - -',
      'D6 - - - F6 - - - A6 - - - F6 - - -',
      'E6 - - - - - - - G5 - - - B5 - - -',
      'A6 - - - - - G6 - F6 - - - E6 - - -',
      'G6 - - - - - E6 - D6 - - - B5 - - -',
      'A5 - - - D6 - - - F6 - - - A6 - - -',
      'G6 - - - F6 - - - D6 - - - B5 - - -',
    ],
    bass: 'slow*2  intro*7 introA  intro*7 introA',
    drum: 'half*2  half*7 intro  intro*7 fillT',
    stab: 'none*18',
    pad:  'auto*18',
    arp:  'none*2  sparkle*16',
    patches: { lead: 'mallet' },
  },

  // ------------------------------------------------------------------
  boss: {
    name: 'BARÃO GRALHA', bpm: 160, transpose: 0, loop: 0,
    chords: '| Am | Am | F | E7 | Am | Am | Bb | E7 |',
    lead: [
      'A5 - - - - - E5 - - - A5 - B5 - C6 -',
      'B5 - - - - - G#5 - - - E5 - - - - -',
      'A5 - - - - - C6 - - - F6 - E6 - C6 -',
      'B5 - - - - - - - G#5 - - - D6 - - -',
      'E6 - - - - - D6 - C6 - - - B5 - A5 -',
      'C6 - - - B5 - - - A5 - - - E5 - - -',
      'F5 - - - - - D5 - F5 - - - Bb5 - A5 -',
      'G#5 - - - - - - - - - - - . . . .',
    ],
    bass: 'drive*3 driveA drive*3 driveA',
    drum: 'crash boss boss fillS boss boss boss fillT',
    stab: 'push*8',
    arp:  'up*8',
    patches: { lead: 'brass' },
  },

  // ------------------------------------------------------------------
  clear: {
    name: 'NÍVEL CONCLUÍDO', bpm: 132, transpose: 3, tail: 1.4,
    chords: '| C | Am F | G7 | C |',
    lead: [
      'C5 . E5 . G5 . C6 - - - B5 - C6 - D6 -',
      'E6 - - - C6 - - - A5 - - - C6 - - -',
      'B5 - - - - - G5 - A5 - B5 - D6 - F6 -',
      'E6 - - - - - - - - - - - - - - .',
    ],
    bass: 'jing*3 end', drum: 'jingle jingle fillS end', stab: 'push*3 hit', pad: 'none*3 auto', arp: 'up*3 none',
  },
  life: {
    name: 'VIDA EXTRA', bpm: 150, transpose: 3, tail: 0.5,
    chords: '| C | F G C C |',
    lead: [
      'C5 . C5 . E5 - G5 - - - E5 - G5 - - -',
      'A5 - - - B5 - - - C6 - - - - - - .',
    ],
    bass: 'jing jing', drum: 'jingle fillS', stab: 'push hit', pad: 'none auto', arp: 'up none',
  },
  gameover: {
    name: 'FIM DO JOGO', bpm: 96, transpose: 0, tail: 2,
    chords: '| Am | F | Dm6 E7 | Am |',
    lead: [
      'E5 - - - - - - - D5 - - - C5 - - -',
      'C5 - - - - - - - A4 - - - - - - -',
      'B4 - - - A4 - - - G#4 - - - - - - -',
      'A4 - - - - - - - - - - - - - - .',
    ],
    bass: 'slow*3 end', drum: 'half*3 end', pad: 'auto*4', patches: { lead: 'brass' },
  },
};

// Ordem do "Teste de Som"
const TRACKLIST = ['title', 'zone1', 'zone2', 'zone3', 'boss', 'mine1', 'mine2', 'mine3', 'boss2', 'desert1', 'desert2', 'ruins', 'desert3', 'boss3', 'jungle1', 'jungle2', 'temple', 'boss4', 'beach1', 'sea1', 'clear', 'life', 'gameover'];
if (DEMO) TRACKLIST.splice(0, TRACKLIST.length, 'title', 'zone1', 'zone2', 'zone3', 'boss', 'clear', 'life', 'gameover');   // demo: só as músicas do Bosque
