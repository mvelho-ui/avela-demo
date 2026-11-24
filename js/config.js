'use strict';
// =====================================================================
//  AVELÃ — A ESQUILO TURBO
//  Configuração global. Unidades: píxeis (px) e segundos (s).
// =====================================================================

const T = 16;          // tamanho de um tile
const VIEW_W = 384;    // resolução interna (16:9, ao estilo das consolas de 16 bits)
const VIEW_H = 216;
const STEP = 1 / 120;  // passo fixo da física

// MODO DE TESTE (desenvolvimento): no menu escolhe-se o nível e o ponto de partida
// (início, cada farol, antes do chefe). Pôr a false na versão final: o menu fica só
// "JOGAR" e "TESTE DE SOM".
// DEMO (APK de demonstração): só o Reino do Bosque (1-1 a 1-3), sem modo de teste, com o ecrã "FIM DA DEMO".
// Liga-se escrevendo window.AVELA_DEMO = true antes deste ficheiro (o projecto Android faz isso sozinho).
const DEMO = typeof window !== 'undefined' && !!window.AVELA_DEMO;
const DEV = !DEMO;
// (no modo de teste também se escolhe no menu quantas pedras preciosas se tem, para testar a Super Avelã)

const PLAYER_HW = 6;   // meia-largura da caixa de colisão
const PLAYER_H = 22;   // altura da caixa de colisão

const PHYS = {
  airMax: 12,       // segundos de ar debaixo de água (Selva; a botija do Leão aumenta isto)
  gravity: 900,
  maxFall: 520,
  burrGravity: 700,  // ouriços de castanha atirados pelos inimigos

  accel: 520,       // aceleração no chão
  decel: 1500,      // travagem ao inverter a direcção
  friction: 520,    // atrito sem input
  maxRun: 240,      // velocidade máxima a correr
  turboMax: 400,    // velocidade máxima com turbo
  absMax: 560,      // limite absoluto (descidas + turbo)
  slopeAcc: 330,    // aceleração da gravidade nas rampas de 45º

  airAccel: 440,
  jumpV: 340,
  jumpCut: 0.45,    // soltar o salto cedo corta a subida

  glideFall: 55,    // queda máxima a planar
  glideMax: 250,
  glideAccel: 260,

  climbSpeed: 115,
  wallSlide: 95,    // queda máxima a deslizar numa parede
  wallJumpVX: 230,
  wallJumpVY: 310,

  loopG: 400,       // gravidade efectiva dentro do looping
  loopEnter: 200,   // velocidade mínima para entrar no looping

  springV: 640,

  turboDrain: 38,   // energia/s
  turboRegen: 22,

  spinTime: 0.32,
  spinCool: 0.45,
  spinLift: 200,    // impulso vertical do pião no ar (1x por salto)

  hurtInv: 2.0,

  swimDashV: 330,     // dash debaixo de água (C): velocidade no arranque (abranda até 3/4)
  swimDashTime: 0.3,
  swimDashCool: 0.65,

  rollStart: 40,    // velocidade mínima para começar a rebolar (↓ a correr)
  rollMin: 45,      // abaixo disto levanta-se
  rollFriction: 170,     // a rebolar sem ↓ (ex.: à saída do looping)
  rollFrictionHeld: 60,  // a rebolar com ↓ premido
  rollPush: 0.6,         // ↓ + direcção: empurra até à velocidade de corrida

  throwV: 380,      // bolota atirada
  throwCool: 0.22,
  throwMax: 3,      // máximo de bolotas no ar ao mesmo tempo
  throwGravity: 420,
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
