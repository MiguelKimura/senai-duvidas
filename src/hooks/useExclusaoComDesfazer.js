// A exclusão de chamado, com confirmação e arrependimento — AC-CHAMADO-04,
// AC-ANIM-02, AC-ANIM-07.
//
// O cliente pediu a revisão deste fluxo, e o que existia era um botão vermelho
// que apagava a dúvida e o print no primeiro clique. As duas travas que este
// hook acrescenta protegem contra erros diferentes:
//
//   * **a confirmação** protege contra o clique errado. O botão fica logo
//     abaixo do texto do card, numa lista que rola, e o dedo erra;
//   * **o desfazer** protege contra a decisão errada — "já resolvi" que vira
//     "não era isso" no segundo seguinte, com o print já perdido.
//
// A exclusão é **otimista com gravação adiada**, e não "apagar e recriar":
//
//   * recriar teria de reescrever o documento com um id novo, porque o antigo
//     já foi para o lixo, e o anexo já teria saído do Storage — o "desfazer"
//     devolveria um card sem o print, que é a metade que importa;
//   * a fila é escutada por `onSnapshot`: entre apagar e recriar, o chamado
//     sumiria e voltaria na tela de toda a turma, em ordem diferente.
//
// Enquanto a janela corre, quem some é só o card — na tela de quem excluiu. O
// documento continua no banco, e é o vencimento do toast que o apaga.
//
// **Ao desmontar, o que estava pendente é gravado.** A pessoa pediu para
// excluir e não desfez; fechar a aba não é desfazer. O contrário deixaria o
// chamado vivo no banco depois de ter sumido da tela de quem o abriu.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToasts, TIPO_ERRO, TIPO_SUCESSO } from '../components/Toast';
import { useMovimentoReduzido } from './useMovimentoReduzido';

/** A janela de arrependimento. O mesmo número vive em `--dur-desfazer`. */
export const PRAZO_DE_DESFAZER_MS = 5000;

/** Quanto tempo o card leva para sair da fila. O mesmo de `--dur-media`. */
export const DURACAO_DA_SAIDA_MS = 220;

export const TITULO_DA_CONFIRMACAO = 'Excluir esta dúvida?';
export const DESCRICAO_DA_CONFIRMACAO =
  'A dúvida sai da fila da turma, e o print anexado a ela é apagado junto.';
export const AVISO_DE_SUCESSO = 'Chamado excluído.';
export const AVISO_DE_FALHA = 'Não foi possível excluir o chamado. Ele continua na fila.';

/**
 * Orquestra confirmação, animação de saída, desfazer e gravação adiada.
 *
 * @param {object} opcoes
 * @param {(chamado: object) => Promise<void>} opcoes.excluir o que gravar
 *   quando a janela vencer.
 * @returns {{
 *   emConfirmacao: object|null,
 *   pedirExclusao: (chamado: object) => void,
 *   confirmar: () => void,
 *   cancelar: () => void,
 *   estaSaindo: (id: string) => boolean,
 *   estaOculto: (id: string) => boolean,
 * }}
 */
export function useExclusaoComDesfazer({ excluir }) {
  const { mostrar } = useToasts();
  const movimentoReduzido = useMovimentoReduzido();

  const [emConfirmacao, setEmConfirmacao] = useState(null);
  const [saindo, setSaindo] = useState(() => new Set());
  const [ocultos, setOcultos] = useState(() => new Set());

  // Os chamados cuja gravação ainda não aconteceu, por id. É daqui que o
  // desmonte tira o que precisa gravar antes de a tela sumir.
  const pendentes = useRef(new Map());

  // `excluir` costuma ser uma seta recriada a cada render da tela. Guardá-la
  // num ref é o que impede o efeito de desmonte de rodar a cada render — e
  // gravar a exclusão no meio da janela de desfazer.
  const gravar = useRef(excluir);
  gravar.current = excluir;

  const revelar = useCallback((id) => {
    setSaindo((atuais) => {
      const proximos = new Set(atuais);
      proximos.delete(id);
      return proximos;
    });
    setOcultos((atuais) => {
      const proximos = new Set(atuais);
      proximos.delete(id);
      return proximos;
    });
  }, []);

  /** Grava de verdade. Chamado pelo vencimento do toast e pelo desmonte. */
  const confirmarNoBanco = useCallback(
    async (id) => {
      const chamado = pendentes.current.get(id);
      if (!chamado) return;

      pendentes.current.delete(id);

      try {
        await gravar.current(chamado);
      } catch {
        // O card volta para a fila: sumir em silêncio deixaria o aluno certo
        // de que a dúvida saiu, enquanto o professor continua a vendo.
        revelar(id);
        mostrar({ tipo: TIPO_ERRO, texto: AVISO_DE_FALHA });
      }
    },
    [mostrar, revelar]
  );

  const desfazer = useCallback(
    (id) => {
      pendentes.current.delete(id);
      revelar(id);
    },
    [revelar]
  );

  const pedirExclusao = useCallback((chamado) => setEmConfirmacao(chamado), []);
  const cancelar = useCallback(() => setEmConfirmacao(null), []);

  const confirmar = useCallback(() => {
    const chamado = emConfirmacao;
    if (!chamado) return;

    setEmConfirmacao(null);
    pendentes.current.set(chamado.id, chamado);

    const esconder = () => setOcultos((atuais) => new Set(atuais).add(chamado.id));

    if (movimentoReduzido) {
      // Sem animação não há o que esperar, e esperar mesmo assim faria o card
      // ficar parado por um quinto de segundo sem explicação nenhuma.
      esconder();
    } else {
      setSaindo((atuais) => new Set(atuais).add(chamado.id));
      setTimeout(esconder, DURACAO_DA_SAIDA_MS);
    }

    mostrar({
      tipo: TIPO_SUCESSO,
      texto: AVISO_DE_SUCESSO,
      duracaoMs: PRAZO_DE_DESFAZER_MS,
      acao: { rotulo: 'Desfazer', aoAcionar: () => desfazer(chamado.id) },
      aoExpirar: () => confirmarNoBanco(chamado.id),
    });
  }, [emConfirmacao, movimentoReduzido, mostrar, desfazer, confirmarNoBanco]);

  useEffect(
    () => () => {
      // Fechar a aba não é desfazer. O que estava pendente vai para o banco.
      [...pendentes.current.keys()].forEach((id) => {
        const chamado = pendentes.current.get(id);
        pendentes.current.delete(id);
        // Sem `await` e sem `catch` visível: a tela está indo embora, e não há
        // mais onde mostrar o erro. A fila da turma é a verdade que sobra.
        Promise.resolve(gravar.current(chamado)).catch(() => {});
      });
    },
    []
  );

  const estaSaindo = useCallback((id) => saindo.has(id), [saindo]);
  const estaOculto = useCallback((id) => ocultos.has(id), [ocultos]);

  return { emConfirmacao, pedirExclusao, confirmar, cancelar, estaSaindo, estaOculto };
}
