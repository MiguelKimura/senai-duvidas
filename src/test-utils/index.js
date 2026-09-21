// Porta de entrada única dos helpers de teste: `import { ... } from '../test-utils'`.
export {
  fabricaChamado,
  fabricaMensagem,
  fabricaUsuario,
  reiniciarSequencia,
} from './fabricas';
export { corDeFundo, instalarSuporteAHsl } from './corDeFundo';
export {
  comDimensoes,
  desenhosFeitos,
  instalarCanvasFalso,
  restaurarCanvas,
} from './canvasFalso';
export { fixarRelogio, restaurarRelogio } from './relogio';
export { renderComProvedores } from './renderComProvedores';
