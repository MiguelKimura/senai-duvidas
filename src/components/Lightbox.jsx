// O visualizador de anexo — AC-IMG-10, AC-IMG-12.
//
// O que ele substitui é `window.open(url, '_blank')`. Nos laboratórios do
// SENAI o bloqueador de pop-up vem ligado por política de imagem do Windows:
// o aluno clicava no olho e nada acontecia — sem aviso, sem janela, sem erro.
// O professor pedia o print de novo e a aula parava ali.
//
// Um diálogo dentro da própria página não depende de permissão nenhuma, e por
// isso funciona em qualquer máquina. O preço é que ele precisa ser um diálogo
// de verdade: fechar no Esc, prender o foco enquanto está aberto e devolvê-lo
// a quem o abriu. Sem isso, quem navega por teclado fica preso atrás dele — e
// quem usa leitor de tela nem fica sabendo que ele abriu.
//
// A transição definitiva é da task 08 (AC-ANIM-09). O que existe aqui é a
// mínima, escrita com os tokens de `styles/tokens.css`.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/Lightbox.css';

/** O que a tela diz quando o endereço não devolve imagem nenhuma. */
export const AVISO_DE_FALHA =
  'Não foi possível carregar a imagem. O endereço pode ter saído do ar.';

/** Os elementos que recebem foco dentro do diálogo. */
const FOCALIZAVEIS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Mostra o anexo em tamanho grande, sem sair da página.
 *
 * @param {{url: string, descricao?: string, onFechar: () => void}} props
 */
export default function Lightbox({ url, descricao = '', onFechar }) {
  const dialogo = useRef(null);
  const gatilho = useRef(null);
  const [falhou, setFalhou] = useState(false);

  const rotulo = descricao ? `Imagem do chamado: ${descricao}` : 'Imagem do chamado';

  // Guarda quem tinha o foco **antes** do primeiro render e o devolve na
  // saída. Sem isto, fechar o diálogo joga o foco no `<body>`, e quem navega
  // por teclado recomeça a tabulação do topo da página a cada print que abre.
  useEffect(() => {
    gatilho.current = document.activeElement;

    const primeiro = dialogo.current && dialogo.current.querySelector(FOCALIZAVEIS);
    if (primeiro) primeiro.focus();

    return () => {
      if (gatilho.current && gatilho.current.focus) gatilho.current.focus();
    };
  }, []);

  /**
   * Prende o foco e trata o Esc.
   *
   * O Tab é interceptado nas duas bordas: do último elemento volta ao
   * primeiro, e do primeiro com Shift volta ao último. É o comportamento que
   * um `<dialog>` nativo teria — e que este projeto não pode usar ainda,
   * porque `showModal` não está nas duas últimas versões de todos os
   * navegadores da lista de compatibilidade.
   */
  const aoTeclar = useCallback(
    (evento) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        onFechar();
        return;
      }

      if (evento.key !== 'Tab' || !dialogo.current) return;

      const alvos = [...dialogo.current.querySelectorAll(FOCALIZAVEIS)];
      if (alvos.length === 0) return;

      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    },
    [onFechar]
  );

  /** Só o fundo fecha. Clicar na imagem é olhar de perto, não desistir. */
  const aoClicarNoFundo = (evento) => {
    if (evento.target === evento.currentTarget) onFechar();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={rotulo}
      ref={dialogo}
      onClick={aoClicarNoFundo}
      onKeyDown={aoTeclar}
    >
      <div className="lightbox-moldura">
        <button type="button" className="lightbox-fechar" onClick={onFechar}>
          Fechar
        </button>

        {falhou ? (
          <p className="lightbox-falha" role="alert">
            {AVISO_DE_FALHA}
          </p>
        ) : null}

        <img
          className="lightbox-imagem"
          src={url}
          alt={rotulo}
          hidden={falhou}
          onError={() => setFalhou(true)}
        />
      </div>
    </div>
  );
}
