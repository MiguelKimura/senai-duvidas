// A cor lembrada entre chamados — AC-COR-10.
//
// O aluno que escolhe azul escolhe azul de novo no chamado seguinte. Sem esta
// memória, ele paga três cliques por chamado para chegar ao mesmo lugar.
//
// **Por que `localStorage` e não o perfil no Firestore:** a preferência é
// sobre o gosto de quem está naquela máquina, não sobre a identidade da
// pessoa. Gravá-la no banco custaria uma escrita a cada chamado, uma leitura a
// cada abertura do modal e uma rule nova para proteger — para guardar uma cor.
// O custo aceito é que trocar de computador recomeça do zero, e recomeçar são
// dois cliques.
//
// **Por que a leitura valida:** `localStorage` é editável por qualquer aluno
// pelo console do navegador, e o que sai daqui vai para `style.backgroundColor`
// de um card que a turma inteira vê. Aceitar a string como veio seria deixar
// alguém injetar valor de CSS pela janela dos fundos. Só o que está na paleta
// passa — e, como a paleta é fechada, a validação é uma busca.
import { corDaPaleta } from './paleta';

/** Onde a cor mora. Prefixada pelo projeto: o domínio pode hospedar outros. */
export const CHAVE_DA_COR = 'senai-duvidas:cor-do-card';

/**
 * A cor que o aluno escolheu da última vez, se ela ainda existir na paleta.
 *
 * Devolve `null` para quem nunca escolheu, para valor adulterado e para
 * navegador sem storage — os três significam a mesma coisa para quem chama:
 * não há preferência, use a cor automática (AC-COR-05).
 *
 * @returns {string|null}
 */
export function lerCorPreferida() {
  let guardada = null;

  try {
    guardada = window.localStorage.getItem(CHAVE_DA_COR);
  } catch (erro) {
    // Modo privado e storage desabilitado por política lançam na leitura. Sem
    // preferência é um estado previsto; a exceção subindo daqui derrubaria o
    // modal e o aluno não conseguiria abrir chamado nenhum.
    return null;
  }

  const entrada = corDaPaleta(guardada);

  return entrada ? entrada.fundo : null;
}

/**
 * Guarda a cor escolhida, ou esquece a anterior quando ela é `null`.
 *
 * Valida na escrita também, e não só na leitura: gravar algo que a leitura vai
 * recusar depois é guardar lixo com aparência de dado.
 *
 * @param {string|null} cor o `fundo` de uma entrada da paleta, ou `null`.
 */
export function guardarCorPreferida(cor) {
  const entrada = corDaPaleta(cor);

  try {
    if (entrada) {
      window.localStorage.setItem(CHAVE_DA_COR, entrada.fundo);
    } else {
      window.localStorage.removeItem(CHAVE_DA_COR);
    }
  } catch (erro) {
    // A cota pode estourar e o modo privado recusa a escrita. Perder a
    // preferência é aceitável; perder o chamado não.
  }
}
