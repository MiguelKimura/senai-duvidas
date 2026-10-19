// As imagens do computador guardadas no próprio Firestore (v1.1.0).
//
// Até a v1.1.0 o print subia para o Cloud Storage. O Storage deixou de estar
// disponível no plano gratuito do projeto, e o envio ficava parado com a barra
// de progresso em zero. A imagem passa a morar num documento do banco:
//
//   salas/{salaId}/imagens/{chamadoId}  →  { dados: 'data:image/...', ... }
//
// **Fora do documento do chamado, de propósito.** A fila da turma é um
// `onSnapshot` que reemite a cada chamado novo; com a imagem dentro do
// chamado, cada reemissão baixaria todos os prints de todo mundo. Separada,
// ela só é lida quando alguém clica no olho do card.
//
// **O teto.** Um documento do Firestore tem no máximo 1 MiB. A imagem é
// comprimida em degraus até a data URL caber em `TETO_DA_IMAGEM`, com folga
// para os outros campos. Um print de tela de laboratório cabe no primeiro ou
// no segundo degrau.
//
// **O ciclo de vida.** A imagem é gravada quando o aluno a escolhe, antes de
// o chamado existir — como era no Storage —, e sai quando o formulário é
// fechado sem concluir, quando o chamado é excluído ou quando ele é marcado
// como atendido (`services/chamados.js`).
import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import {
  ERRO_CANCELADO,
  ErroDeAnexo,
  ORIGEM_DO_BANCO,
  comprimirImagem,
  referenciaDaImagem,
  removerImagemDoBanco,
  validarArquivo,
} from './anexos';

export { ORIGEM_DO_BANCO };

/** O tamanho máximo da data URL, em caracteres. O documento aceita 1 MiB. */
export const TETO_DA_IMAGEM = 700 * 1024;

/**
 * Os degraus de compressão, do mais fiel para o mais leve.
 *
 * O primeiro mantém o formato original: um print em PNG virando JPEG ganha os
 * artefatos que borram a linha do erro, e muitos prints cabem sem isso. Os
 * seguintes trocam para JPEG e reduzem o lado maior até caber.
 */
const DEGRAUS = [
  { ladoMaximo: 1600, qualidade: 0.85, manterFormato: true },
  { ladoMaximo: 1600, qualidade: 0.8 },
  { ladoMaximo: 1280, qualidade: 0.75 },
  { ladoMaximo: 1024, qualidade: 0.7 },
  { ladoMaximo: 800, qualidade: 0.6 },
];

export const ERRO_GRANDE_DEMAIS =
  'A imagem continua grande demais mesmo reduzida. Recorte só a parte do erro e tente de novo.';

const ERRO_RECUSADO =
  'O envio foi recusado: confira se você ainda faz parte desta sala e entre de novo.';

const ERRO_AO_GRAVAR =
  'Não foi possível salvar a imagem. Confira a conexão e tente de novo — o que você escreveu continua aqui.';

/** Lê um Blob como data URL. */
export function paraDataUrl(blob) {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

/**
 * Comprime a imagem em degraus até a data URL caber no teto.
 *
 * @param {File|Blob} arquivo
 * @param {string} tipo o formato detectado pela assinatura do arquivo.
 * @param {{teto?: number}} [opcoes] `teto` existe para os testes.
 * @returns {Promise<{dados: string, largura: number, altura: number,
 *   tipo: string, bytes: number}>}
 * @throws {ErroDeAnexo} quando nem o menor degrau cabe.
 */
export async function comprimirParaOBanco(arquivo, tipo, { teto = TETO_DA_IMAGEM } = {}) {
  for (const degrau of DEGRAUS) {
    const formato = degrau.manterFormato ? tipo : 'image/jpeg';

    // eslint-disable-next-line no-await-in-loop
    const { blob, largura, altura } = await comprimirImagem(arquivo, {
      tipo: formato,
      ladoMaximo: degrau.ladoMaximo,
      qualidade: degrau.qualidade,
      forcar: !degrau.manterFormato,
    });

    // eslint-disable-next-line no-await-in-loop
    const dados = await paraDataUrl(blob);

    if (dados.length <= teto) {
      return { dados, largura, altura, tipo: blob.type || formato, bytes: blob.size };
    }
  }

  throw new ErroDeAnexo(ERRO_GRANDE_DEMAIS);
}

function cancelado() {
  return new ErroDeAnexo(ERRO_CANCELADO, { cancelado: true });
}

/**
 * Valida, comprime e grava a imagem de um chamado no banco.
 *
 * Mesma assinatura do envio para o Storage que ela substitui, para que o
 * campo de anexo não precise saber para onde a imagem vai.
 *
 * @param {File|Blob} arquivo
 * @param {{salaId: string, chamadoId: string,
 *   onProgresso?: (fracao: number) => void, sinal?: AbortSignal}} opcoes
 * @returns {Promise<{origem: 'banco', id: string, url: string, largura: number,
 *   altura: number, bytes: number, tipo: string}>} `url` é a própria imagem,
 *   para a prévia do formulário; ela não é gravada no chamado.
 * @throws {ErroDeAnexo} sempre com mensagem pronta para a tela.
 */
export async function enviarImagemParaOBanco(
  arquivo,
  { salaId, chamadoId, onProgresso, sinal } = {}
) {
  const avisar = (fracao) => onProgresso && onProgresso(fracao);

  if (sinal && sinal.aborted) throw cancelado();

  const validacao = await validarArquivo(arquivo);
  if (!validacao.ok) throw new ErroDeAnexo(validacao.erro);

  avisar(0.2);

  const imagem = await comprimirParaOBanco(arquivo, validacao.tipo);

  if (sinal && sinal.aborted) throw cancelado();

  avisar(0.6);

  try {
    await setDoc(referenciaDaImagem(salaId, chamadoId), {
      dados: imagem.dados,
      tipo: imagem.tipo,
      largura: imagem.largura,
      altura: imagem.altura,
      bytes: imagem.bytes,
      autorUid: (auth.currentUser && auth.currentUser.uid) || null,
      criadaEm: serverTimestamp(),
    });
  } catch (erro) {
    const recusado = erro && /permission|insufficient/i.test(`${erro.code} ${erro.message}`);
    throw new ErroDeAnexo(recusado ? ERRO_RECUSADO : ERRO_AO_GRAVAR, { causa: erro });
  }

  // Cancelado enquanto gravava: a imagem já está no banco, e ninguém mais
  // saberia que ela existe.
  if (sinal && sinal.aborted) {
    await removerImagemDoBanco(salaId, chamadoId);
    throw cancelado();
  }

  avisar(1);

  return {
    origem: ORIGEM_DO_BANCO,
    id: chamadoId,
    url: imagem.dados,
    largura: imagem.largura,
    altura: imagem.altura,
    bytes: imagem.bytes,
    tipo: imagem.tipo,
  };
}

/**
 * Lê a imagem de um chamado.
 *
 * Só devolve data URL de imagem: o valor vai direto para um `src`, e um
 * documento adulterado pelo DevTools não pode virar outra coisa ali.
 *
 * @param {string} salaId
 * @param {string} chamadoId
 * @returns {Promise<string|null>}
 */
export async function lerImagemDoBanco(salaId, chamadoId) {
  if (!salaId || !chamadoId) return null;

  const documento = await getDoc(referenciaDaImagem(salaId, chamadoId));
  if (!documento.exists()) return null;

  const { dados } = documento.data();

  return typeof dados === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(dados)
    ? dados
    : null;
}
