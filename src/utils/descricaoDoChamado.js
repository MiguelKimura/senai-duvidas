// A validação da descrição do chamado — AC-CHAMADO-01.
//
// Os dois números daqui são os mesmos de `firestore.rules`:
//
//     request.resource.data.descricao.size() > 0
//     && request.resource.data.descricao.size() <= 1000
//
// Ter a regra em dois lugares é proposital e não é duplicação acidental: a
// rule é a que **vale**, porque um cliente adulterado não passa por este
// arquivo; esta é a que **explica**, porque a rule só sabe dizer
// `permission-denied`. Quando um dos dois números mudar, o outro precisa mudar
// junto — e é isso que `src/utils/__tests__/descricaoDoChamado.test.js`
// verifica, citando a rule.

/** O piso da rule: `size() > 0`. */
export const DESCRICAO_MINIMA = 1;

/** O teto da rule: `size() <= 1000`. */
export const DESCRICAO_MAXIMA = 1000;

/**
 * A partir de quantos caracteres o contador aparece.
 *
 * 800 de 1000 — os últimos 20%, a mesma proporção que o campo do chat pratica
 * (`CONTADOR_A_PARTIR_DE`, 400 de 500). Antes disso o limite é teórico e o
 * número seria só ruído ao lado de toda frase digitada.
 */
export const CONTADOR_A_PARTIR_DE = 800;

export const MENSAGEM_VAZIA = 'Descreva o problema para abrir a dúvida.';

/**
 * A mensagem do texto longo demais.
 *
 * Diz o tamanho atual **e** o teto: só o teto obrigaria o aluno a contar
 * caracteres na mão para saber quanto precisa cortar.
 */
export const mensagemDeTextoLongo = (tamanho) =>
  `A descrição tem ${tamanho} caracteres e o limite é ${DESCRICAO_MAXIMA}. ` +
  'Tire o que não for essencial — o print do erro costuma valer mais que o log inteiro.';

/**
 * Confere a descrição e devolve o texto que deve ir ao banco.
 *
 * O tamanho é medido pelo `.length` do JavaScript, isto é, em unidades UTF-16,
 * enquanto o `size()` da rule conta caracteres. Os dois só discordam em
 * caracteres fora do plano básico — emoji, principalmente —, e nesse caso o
 * `.length` é o maior dos dois. Contar pelo maior é o lado seguro do
 * desacordo: o cliente recusa aqui o que o servidor recusaria depois, em vez
 * de deixar passar uma escrita que vai morrer na rede.
 *
 * @param {unknown} bruta o conteúdo do campo, como veio da tela.
 * @returns {{valida: boolean, texto: string, tamanho: number, motivo: null|'vazia'|'longa'}}
 *   `texto` é a descrição já sem os espaços das pontas — é ela, e não a
 *   original, que deve ser gravada.
 */
export function validarDescricao(bruta) {
  const texto = typeof bruta === 'string' ? bruta.trim() : '';
  const tamanho = texto.length;

  if (tamanho < DESCRICAO_MINIMA) {
    return { valida: false, texto: '', tamanho: 0, motivo: 'vazia' };
  }

  if (tamanho > DESCRICAO_MAXIMA) {
    return { valida: false, texto, tamanho, motivo: 'longa' };
  }

  return { valida: true, texto, tamanho, motivo: null };
}

/**
 * A frase que o aluno lê quando a descrição é recusada.
 *
 * @param {ReturnType<typeof validarDescricao>} resultado
 * @returns {string|null} `null` quando não há nada a dizer.
 */
export function mensagemDeDescricao(resultado) {
  if (resultado.motivo === 'vazia') return MENSAGEM_VAZIA;
  if (resultado.motivo === 'longa') return mensagemDeTextoLongo(resultado.tamanho);

  return null;
}
