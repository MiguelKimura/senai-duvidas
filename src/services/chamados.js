// As escritas sobre um chamado — AC-CHAMADO-04, AC-CHAMADO-06, AC-CHAMADO-08.
//
// Até a v0.9.0 as duas telas falavam com o Firestore direto, e já tinham
// divergido: `TelaAluno.removerProblema` e `TelaProfessor.handleDelete`
// faziam a mesma coisa em ordens diferentes, e só uma delas avisava o usuário
// quando dava errado. A fila já é ordenada num lugar só
// (`services/filaChamados.js`); as escritas passam a ser também.
//
// A ordem de `excluirChamado` é a que estava certa na tela do aluno, e ela
// tem motivo: **primeiro o documento, depois o arquivo.** Se a remoção do
// arquivo falhar, o chamado já saiu da fila — que é o que a pessoa pediu. O
// contrário deixaria o card na tela sem o anexo.
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { colecaoDeChamados } from './salas';
import { removerAnexoDoChamado } from './anexos';

/**
 * Apaga o chamado e o anexo dele.
 *
 * @param {string|null} salaId
 * @param {{id: string, anexo?: object, imagem?: string}} chamado o documento
 *   inteiro, e não só o id: é dele que sai o caminho do arquivo no Storage.
 * @returns {Promise<void>} rejeita se o documento não sair. A falha em apagar
 *   o **arquivo** não rejeita — ver acima.
 */
export async function excluirChamado(salaId, chamado) {
  if (!chamado || !chamado.id) return;

  await deleteDoc(doc(colecaoDeChamados(salaId), chamado.id));

  try {
    await removerAnexoDoChamado(salaId, chamado);
  } catch {
    // Arquivo órfão é desperdício de cota; card fantasma na fila da turma é
    // um aluno esperando atendimento que ninguém vai dar. O primeiro é o
    // preço aceitável (AC-CHAMADO-08).
  }
}

/**
 * Marca — ou desmarca — o chamado como atendido (AC-CHAMADO-06).
 *
 * É a alternativa a apagar: preserva o histórico da aula e alimenta as
 * métricas pós-1.0.0, enquanto tira o chamado da frente da fila. Quem decide
 * a posição é `ordenarFila`, que já lê este campo desde a v0.9.0.
 *
 * A escrita é **aditiva**: só `atendido` e `atendidoEm` entram, e nenhum campo
 * é removido. Um cliente da v0.9.0 que ignore os dois renderiza o card como
 * sempre renderizou.
 *
 * `atendidoEm` volta a `null` ao desmarcar, e não fica com o carimbo antigo:
 * um chamado reaberto com data de atendimento mentiria para qualquer métrica
 * que viesse a lê-lo.
 *
 * @param {string|null} salaId
 * @param {string} chamadoId
 * @param {boolean} atendido
 * @returns {Promise<void>}
 */
export async function marcarAtendido(salaId, chamadoId, atendido) {
  if (!chamadoId) return;

  await updateDoc(doc(colecaoDeChamados(salaId), chamadoId), {
    atendido: Boolean(atendido),
    // O instante do servidor, pela mesma razão do `horario` (AC-TEMPO-01): o
    // relógio das máquinas de laboratório não é confiável, e uma métrica de
    // tempo de atendimento medida por ele não vale nada.
    atendidoEm: atendido ? serverTimestamp() : null,
  });
}
