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
// A prisão de foco que a task 04 escreveu aqui saiu para
// `hooks/useDialogoModal.js` na v0.10.0: a versão tem três diálogos, e a
// segunda cópia de um foco preso é onde o comportamento começa a divergir.
// O comportamento não mudou — os testes deste componente são a prova.
import React, { useRef, useState } from 'react';
import { useDialogoModal } from '../hooks/useDialogoModal';
import '../styles/Lightbox.css';

/** O que a tela diz quando o endereço não devolve imagem nenhuma. */
export const AVISO_DE_FALHA =
  'Não foi possível carregar a imagem. O endereço pode ter saído do ar.';

/**
 * Mostra o anexo em tamanho grande, sem sair da página.
 *
 * @param {{url: string, descricao?: string, onFechar: () => void}} props
 */
export default function Lightbox({ url, descricao = '', onFechar }) {
  const dialogo = useRef(null);
  const [falhou, setFalhou] = useState(false);

  const rotulo = descricao ? `Imagem do chamado: ${descricao}` : 'Imagem do chamado';

  // Foco inicial no primeiro focável (o botão "Fechar"), Esc fechando, Tab
  // dando a volta nas duas bordas e o foco devolvido a quem abriu: tudo isso
  // mora no hook. Sem devolver o foco, quem navega por teclado recomeçaria a
  // tabulação do topo da página a cada print que abre.
  const { aoTeclar } = useDialogoModal({ referencia: dialogo, aoFechar: onFechar });

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
