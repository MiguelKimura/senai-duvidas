// O que faz de um <div role="dialog"> um diálogo de verdade — AC-ANIM-10.
//
// A task 04 escreveu esta lógica dentro de `Lightbox.jsx`, com o comentário
// certo: `<dialog>` nativo com `showModal()` ainda não está nas duas últimas
// versões de todos os navegadores da lista de compatibilidade do projeto, e a
// tela do laboratório é justamente a desatualizada.
//
// Ela sai de lá para cá porque a v0.10.0 tem três diálogos — o visualizador de
// anexo, o modal de novo chamado e a confirmação de exclusão — e a segunda
// cópia de uma prisão de foco é onde o comportamento começa a divergir: basta
// alguém corrigir o Shift+Tab num arquivo e esquecer do outro para que metade
// da interface fique inavegável por teclado sem ninguém perceber.
//
// Três coisas, e só elas:
//
//   1. **foco inicial** no elemento que o chamador escolher — e o chamador
//      escolhe o SEGURO, nunca o destrutivo;
//   2. **prisão do foco**, com o Tab dando a volta nas duas bordas;
//   3. **Esc fecha**, e o foco volta a quem abriu o diálogo.
import { useCallback, useEffect, useRef } from 'react';

/**
 * Os elementos que recebem foco dentro de um diálogo.
 *
 * `[tabindex]:not([tabindex="-1"])` exclui quem está no DOM só para receber
 * foco por programa — é o caso do próprio contêiner do diálogo, que leva
 * `tabIndex={-1}` para poder ser focado sem entrar na ordem de tabulação.
 */
export const FOCALIZAVEIS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Os focáveis de dentro do diálogo, na ordem do documento. */
function focalizaveisDe(raiz) {
  if (!raiz) return [];

  return [...raiz.querySelectorAll(FOCALIZAVEIS)].filter(
    (elemento) => !elemento.disabled && elemento.getAttribute('aria-hidden') !== 'true'
  );
}

/**
 * Transforma uma `ref` de contêiner num diálogo modal navegável por teclado.
 *
 * @param {object} opcoes
 * @param {React.RefObject<HTMLElement>} opcoes.referencia contêiner do diálogo.
 * @param {() => void} opcoes.aoFechar chamado no `Esc`.
 * @param {(raiz: HTMLElement) => HTMLElement|null} [opcoes.focoInicial] quem
 *   recebe o foco na abertura. O padrão é o primeiro focável; quem tem ação
 *   destrutiva passa aqui o botão seguro.
 * @returns {{aoTeclar: (evento: React.KeyboardEvent) => void}} o manipulador
 *   a pendurar no contêiner.
 */
export function useDialogoModal({ referencia, aoFechar, focoInicial }) {
  // Guardado num `ref` para não recriar o efeito de abertura quando o chamador
  // passar uma função nova a cada render — recriá-lo roubaria o foco de volta
  // para o botão inicial a cada tecla digitada dentro do diálogo.
  const escolherFoco = useRef(focoInicial);
  escolherFoco.current = focoInicial;

  // Quem tinha o foco **antes** do primeiro render. Sem devolvê-lo na saída, o
  // foco cai no <body> e quem navega por teclado recomeça a tabulação do topo
  // da página a cada diálogo que fecha.
  const gatilho = useRef(null);

  useEffect(() => {
    gatilho.current = document.activeElement;

    const raiz = referencia.current;
    const escolhido = escolherFoco.current && raiz ? escolherFoco.current(raiz) : null;
    const alvo = escolhido || focalizaveisDe(raiz)[0];

    if (alvo) alvo.focus();

    return () => {
      if (gatilho.current && gatilho.current.focus) gatilho.current.focus();
    };
    // `referencia` é estável por vir de `useRef`; o efeito é de montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aoTeclar = useCallback(
    (evento) => {
      if (evento.key === 'Escape') {
        // `stopPropagation` porque um diálogo pode estar dentro de outro — a
        // premiação em tela cheia sobre a fila, por exemplo. O Esc fecha um de
        // cada vez, do mais de cima para o mais de baixo.
        evento.stopPropagation();
        aoFechar();
        return;
      }

      if (evento.key !== 'Tab') return;

      const alvos = focalizaveisDe(referencia.current);
      if (alvos.length === 0) return;

      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];

      // O foco pode estar fora do diálogo quando ele acabou de abrir e algo
      // roubou o foco. Tratar esse caso como "está no primeiro" traz a
      // tabulação de volta para dentro em vez de deixá-la vazar.
      const atual = document.activeElement;
      const dentro = alvos.includes(atual);

      if (evento.shiftKey && (!dentro || atual === primeiro)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (!dentro || atual === ultimo)) {
        evento.preventDefault();
        primeiro.focus();
      }
    },
    [aoFechar, referencia]
  );

  return { aoTeclar };
}
