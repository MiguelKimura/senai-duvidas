// O PIN de entrada na sala — AC-SALA-02, AC-SALA-04, AC-SALA-12, AC-SEC-05.
//
// Seis dígitos são um milhão de combinações: pouco para quem escreve um
// script, muito para quem digita à mão na frente da turma. O número só é
// suficiente se as duas pontas forem cuidadas, e este módulo cuida de uma
// delas — a geração. A outra, o limite de tentativas, é imposta pelas
// Security Rules, porque um limite que mora no cliente é um limite que o
// cliente desliga.
//
// Nada aqui fala com o Firestore: quem grava é `services/salas.js`. Manter a
// separação é o que deixa o PIN ser testado sem banco nenhum.

/** Dígitos do PIN. Seis é o que cabe no quadro branco e no bolso da memória. */
export const TAMANHO_DO_PIN = 6;

/** Erros de PIN tolerados numa janela, por usuário (AC-SALA-12). */
export const LIMITE_DE_TENTATIVAS = 5;

/** O tamanho da janela do limite de tentativas, em minutos. */
export const JANELA_DE_TENTATIVAS_MINUTOS = 5;

/**
 * Por quantos segundos uma tentativa registrada continua valendo como prova
 * de que o PIN foi digitado agora.
 *
 * É o que amarra cada consulta ao índice de PINs a uma tentativa contada: sem
 * a amarra, o contador seria decoração e a rule deixaria varrer o índice à
 * vontade. Trinta segundos cobrem uma rede ruim de laboratório sem abrir uma
 * janela de varredura útil.
 */
export const FRESCOR_DA_TENTATIVA_SEGUNDOS = 30;

/** Caracteres hexadecimais do sal de cada sala (16 bytes). */
export const TAMANHO_DO_SAL = 32;

/**
 * A única mensagem de PIN recusado (AC-SALA-04).
 *
 * É deliberadamente igual para "não existe", "existe em outra sala",
 * "foi regerado" e "a sala está arquivada". Distinguir os casos entregaria de
 * graça o mapa das salas a quem está tentando adivinhar.
 */
export const ERRO_DE_PIN = 'PIN inválido. Confira o PIN com o professor da turma.';

/** O que a tela diz quando o limite de tentativas fecha a porta (AC-SALA-12). */
export const ERRO_DE_LIMITE =
  'Muitas tentativas de PIN. Espere 5 minutos e tente de novo, ' +
  'ou peça o PIN ao professor da turma.';

const PADRAO_DE_PIN = /^[0-9]{6}$/;

/**
 * O maior múltiplo de 10 que cabe num byte.
 *
 * Sortear `byte % 10` sem descartar nada daria aos dígitos de 0 a 5 uma chance
 * a mais que aos de 6 a 9 — 26 bytes contra 25 —, e um PIN enviesado é um PIN
 * com menos de um milhão de combinações reais. Descartar de 250 para cima
 * custa 2% dos sorteios e devolve a distribuição uniforme.
 */
const MAIOR_MULTIPLO_DE_DEZ = 250;

/**
 * O gerador criptográfico do navegador.
 *
 * `Math.random` não serve: a sequência dele é previsível a partir de algumas
 * saídas, e o PIN é credencial de entrada. Falhar aqui é melhor do que cair
 * para um sorteio fraco em silêncio.
 *
 * @returns {Crypto}
 */
function cripto() {
  const disponivel = globalThis.crypto;

  if (!disponivel || typeof disponivel.getRandomValues !== 'function') {
    throw new Error(
      'Este navegador não expõe Web Crypto. O PIN da sala precisa de sorteio ' +
        'criptográfico — abra o sistema por HTTPS num navegador atualizado.'
    );
  }

  return disponivel;
}

/** Bytes em hexadecimal minúsculo, o formato usado no banco e nas rules. */
function paraHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Sorteia um PIN de seis dígitos (AC-SALA-02).
 *
 * Quem garante que ele é único entre as salas ativas é `services/salas.js`,
 * por colisão no índice: aqui o sorteio é independente, como tem de ser.
 *
 * @returns {string} seis dígitos, com zeros à esquerda preservados.
 */
export function gerarPin() {
  const digitos = [];

  while (digitos.length < TAMANHO_DO_PIN) {
    const bytes = new Uint8Array(TAMANHO_DO_PIN);
    cripto().getRandomValues(bytes);

    bytes.forEach((byte) => {
      if (byte < MAIOR_MULTIPLO_DE_DEZ && digitos.length < TAMANHO_DO_PIN) {
        digitos.push(byte % 10);
      }
    });
  }

  return digitos.join('');
}

/**
 * Sorteia o sal de uma sala.
 *
 * O sal é por sala, e não global, para que duas salas com o mesmo PIN não
 * tenham o mesmo resumo: sem ele, comparar dois `pinHash` diria que os PINs
 * são iguais sem precisar descobrir nenhum dos dois.
 *
 * @returns {string} 32 caracteres hexadecimais (16 bytes).
 */
export function gerarSal() {
  const bytes = new Uint8Array(TAMANHO_DO_SAL / 2);
  cripto().getRandomValues(bytes);

  return paraHex(bytes);
}

/**
 * Limpa o que o aluno digitou ou colou.
 *
 * Não corta o excesso de propósito: "1234567" continua com sete dígitos e é
 * recusado por `ehPinValido`. Cortar transformaria o erro de digitação numa
 * tentativa silenciosa contra outra sala.
 *
 * @param {unknown} valor o conteúdo do campo.
 * @returns {string} só os dígitos.
 */
export function normalizarPin(valor) {
  return typeof valor === 'string' ? valor.replace(/[^0-9]/g, '') : '';
}

/**
 * O valor tem a forma de um PIN.
 * @param {unknown} valor
 * @returns {boolean}
 */
export function ehPinValido(valor) {
  return typeof valor === 'string' && PADRAO_DE_PIN.test(valor);
}

/**
 * O resumo que vai para o banco no lugar do PIN (AC-SEC-05).
 *
 * `SHA-256(sal + pin)`, em hexadecimal minúsculo — exatamente o que
 * `hashing.sha256(sal + pin).toHexString().lower()` devolve nas Security
 * Rules. É esse acordo de formato que permite ao **servidor** conferir o PIN
 * digitado sem que o segredo da sala precise chegar ao cliente do aluno.
 *
 * @param {string} pin PIN em claro, que só existe em memória.
 * @param {string} sal sal da sala.
 * @returns {Promise<string>} 64 caracteres hexadecimais.
 */
export async function hashDePin(pin, sal) {
  const bytes = new TextEncoder().encode(`${sal}${pin}`);
  const resumo = await cripto().subtle.digest('SHA-256', bytes);

  return paraHex(new Uint8Array(resumo));
}
