// A paleta do card e a conta que a guarda — AC-COR-03.
//
// Desde a v0.1.0 a cor do card sai de `hsl(${Math.random() * 360}, 70%, 80%)`.
// O matiz é sorteado e a legibilidade vai junto no sorteio: o mesmo texto que
// se lê bem sobre o azul claro some sobre o amarelo. Ninguém escolheu aquilo e
// ninguém conseguia consertar — não há o que corrigir num número aleatório.
//
// Este módulo troca o sorteio por uma lista curta e **verificada**. O valor não
// está em a lista existir: está em `razaoContraste` ser executada sobre ela no
// teste, cor por cor. Acrescentar uma cor ilegível aqui reprova o CI.
//
// Nada de interface mora neste arquivo. É de propósito: a conta de contraste é
// a mesma para o card, para o chat da task 06 e para a revisão de cores da
// task 08 (AC-ANIM-10), e nenhuma delas precisa de React para valer.

/** O piso do WCAG AA para texto normal. Abaixo disto, o texto não se lê. */
export const CONTRASTE_MINIMO = 4.5;

/**
 * O quase-preto que acompanha toda a paleta.
 *
 * Preto puro sobre fundo claro cansa a vista em sala com projetor ligado; este
 * tom baixa o brilho sem chegar perto do limite de contraste — o par mais
 * apertado da paleta passa com folga de várias vezes o mínimo.
 */
const TEXTO_ESCURO = '#1a1a1a';

const PADRAO_HEXADECIMAL = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Componentes 0–255 de uma cor hexadecimal.
 *
 * Aceita `#rgb` e `#rrggbb`. Qualquer outra coisa **lança**: devolver um valor
 * padrão faria a conta de contraste responder um número plausível sobre uma
 * cor que ninguém pediu, e o teste que protege a paleta passaria à toa.
 *
 * @param {string} cor por exemplo `#d8e5ff`.
 * @returns {[number, number, number]}
 */
function componentes(cor) {
  const texto = typeof cor === 'string' ? cor.trim() : '';

  if (!PADRAO_HEXADECIMAL.test(texto)) {
    throw new TypeError(`Cor hexadecimal inválida: ${cor}`);
  }

  const digitos = texto.slice(1);
  const expandido =
    digitos.length === 3
      ? digitos
          .split('')
          .map((digito) => digito + digito)
          .join('')
      : digitos;

  return [0, 2, 4].map((inicio) => parseInt(expandido.slice(inicio, inicio + 2), 16));
}

/** O degama de um canal, como a WCAG o define. */
function canalLinear(valor) {
  const fracao = valor / 255;
  return fracao <= 0.03928 ? fracao / 12.92 : ((fracao + 0.055) / 1.055) ** 2.4;
}

/**
 * Luminância relativa da cor, de 0 (preto) a 1 (branco).
 *
 * Os três pesos não são iguais porque o olho não responde igual às três cores:
 * o verde carrega quase três quartos da luminância percebida.
 *
 * @param {string} cor hexadecimal.
 * @returns {number}
 */
export function luminanciaRelativa(cor) {
  const [vermelho, verde, azul] = componentes(cor).map(canalLinear);
  return 0.2126 * vermelho + 0.7152 * verde + 0.0722 * azul;
}

/**
 * Razão de contraste entre duas cores, de 1 a 21 (fórmula WCAG 2.1).
 *
 * A ordem dos argumentos não importa: a conta sempre põe a mais clara em cima.
 *
 * @param {string} a hexadecimal.
 * @param {string} b hexadecimal.
 * @returns {number} 21 para preto sobre branco, 1 para a cor contra ela mesma.
 */
export function razaoContraste(a, b) {
  const primeira = luminanciaRelativa(a);
  const segunda = luminanciaRelativa(b);

  const clara = Math.max(primeira, segunda);
  const escura = Math.min(primeira, segunda);

  return (clara + 0.05) / (escura + 0.05);
}

/**
 * As cores que o aluno pode escolher para o card.
 *
 * Nove, porque cabem em uma linha de três por três no modal sem virar
 * catálogo — quem abre o painel quer escolher uma cor, não navegar um seletor.
 * Todas claras, todas com o mesmo texto escuro: a cor diferencia o card na
 * fila, e quem diferencia o texto é o contraste, que não pode variar.
 *
 * `id` é o que a interface usa como chave e o que o teste nomeia; o que vai
 * para o banco é `fundo`, uma string CSS que qualquer versão do app entende.
 */
export const PALETA = [
  { id: 'cinza', nome: 'Cinza', fundo: '#e6e8eb', texto: TEXTO_ESCURO },
  { id: 'vermelho', nome: 'Vermelho', fundo: '#ffd6d6', texto: TEXTO_ESCURO },
  { id: 'laranja', nome: 'Laranja', fundo: '#ffe0c2', texto: TEXTO_ESCURO },
  { id: 'amarelo', nome: 'Amarelo', fundo: '#fdf0b4', texto: TEXTO_ESCURO },
  { id: 'verde', nome: 'Verde', fundo: '#d4f0d4', texto: TEXTO_ESCURO },
  { id: 'ciano', nome: 'Ciano', fundo: '#cdeef2', texto: TEXTO_ESCURO },
  { id: 'azul', nome: 'Azul', fundo: '#d8e5ff', texto: TEXTO_ESCURO },
  { id: 'roxo', nome: 'Roxo', fundo: '#e6dcfa', texto: TEXTO_ESCURO },
  { id: 'rosa', nome: 'Rosa', fundo: '#fbd9ec', texto: TEXTO_ESCURO },
];

/**
 * A entrada da paleta que corresponde à cor gravada no chamado.
 *
 * Devolve `null` para a cor sorteada dos chamados antigos — é assim que o card
 * continua pintando `hsl(210, 70%, 80%)` exatamente como pintava, sem herdar
 * cor de texto nenhuma da paleta (AC-COR-05).
 *
 * @param {string|null|undefined} cor o campo `cor` do chamado.
 * @returns {{id: string, nome: string, fundo: string, texto: string}|null}
 */
export function corDaPaleta(cor) {
  if (typeof cor !== 'string') return null;

  const procurada = cor.trim().toLowerCase();
  return PALETA.find((entrada) => entrada.fundo === procurada) || null;
}
