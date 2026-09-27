// A confirmação de ação destrutiva — AC-CHAMADO-04, AC-ANIM-07, AC-ANIM-10.
//
// Até a v0.9.0 a exclusão de um chamado era imediata: o aluno clicava em
// "Excluir" e a dúvida sumia, com o print anexado junto, sem volta. O cliente
// pediu a revisão deste fluxo com todas as letras, e o AC-CHAMADO-04 exige a
// confirmação desde a v0.2.0 — os testes de caracterização de `TelaAluno` e
// `TelaProfessor` registravam a ausência dela apontando para esta task.
//
// Não é `window.confirm()` pela mesma razão que o visualizador de anexo não é
// `window.open()` (task 04): em parte dos laboratórios do SENAI as duas vêm
// suprimidas por política do Windows. `window.confirm()` suprimido devolve
// `false` em silêncio — a ação simplesmente nunca acontece, e ninguém descobre
// por quê.
//
// O foco inicial vai no botão **seguro**. É a diferença entre um diálogo que
// protege e um que só atrasa: quem aperta Enter de reflexo, porque estava
// digitando quando a caixa apareceu, cancela em vez de apagar.
import React, { useRef, useState } from 'react';
import { useDialogoModal } from '../hooks/useDialogoModal';
import '../styles/ConfirmarAcao.css';

/** O rótulo padrão da saída segura. */
export const ROTULO_CANCELAR = 'Cancelar';

/**
 * Pergunta antes de fazer o que não tem volta.
 *
 * @param {object} props
 * @param {string} props.titulo a pergunta, curta. É o nome acessível do diálogo.
 * @param {string} [props.descricao] o que exatamente vai acontecer.
 * @param {string} props.rotuloConfirmar o verbo da ação — "Excluir", e não "OK".
 * @param {string} [props.rotuloCancelar]
 * @param {boolean} [props.destrutiva] marca o botão de confirmar como perigoso.
 * @param {(escolha: {naoPerguntar: boolean}) => void} props.aoConfirmar
 * @param {() => void} props.aoCancelar chamado também pelo `Esc` e pelo fundo.
 * @param {boolean} [props.oferecerNaoPerguntar] mostra a caixa "Não perguntar
 *   mais", e a escolha chega em `aoConfirmar` (v1.1.0).
 */
export default function ConfirmarAcao({
  titulo,
  descricao = '',
  rotuloConfirmar,
  rotuloCancelar = ROTULO_CANCELAR,
  destrutiva = false,
  aoConfirmar,
  aoCancelar,
  oferecerNaoPerguntar = false,
}) {
  const dialogo = useRef(null);
  const [naoPerguntar, setNaoPerguntar] = useState(false);
  const seguro = useRef(null);

  const { aoTeclar } = useDialogoModal({
    referencia: dialogo,
    aoFechar: aoCancelar,
    // O botão seguro, e não o primeiro do DOM: a ordem visual põe "Cancelar"
    // antes de "Excluir", mas depender disso amarraria a proteção ao layout.
    focoInicial: () => seguro.current,
  });

  const idTitulo = 'confirmar-acao-titulo';
  const idDescricao = 'confirmar-acao-descricao';

  /** Só o fundo cancela. Clicar na caixa é ler de novo, não desistir. */
  const aoClicarNoFundo = (evento) => {
    if (evento.target === evento.currentTarget) aoCancelar();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="confirmar-fundo entra-sobreposicao"
      onClick={aoClicarNoFundo}
      onKeyDown={aoTeclar}
      role="presentation"
    >
      <div
        className="confirmar-caixa entra-caixa"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descricao ? idDescricao : undefined}
        ref={dialogo}
      >
        <h2 className="confirmar-titulo" id={idTitulo}>
          {titulo}
        </h2>

        {descricao && (
          <p className="confirmar-descricao" id={idDescricao}>
            {descricao}
          </p>
        )}

        {/* Só vale ao confirmar: marcar e cancelar não muda nada, porque
            quem cancelou ainda não viu a exclusão sem pergunta funcionar. */}
        {oferecerNaoPerguntar && (
          <label className="confirmar-nao-perguntar">
            <input
              type="checkbox"
              checked={naoPerguntar}
              onChange={(evento) => setNaoPerguntar(evento.target.checked)}
            />
            Não perguntar mais
          </label>
        )}

        <div className="confirmar-botoes">
          <button
            type="button"
            className="confirmar-botao confirmar-botao--seguro"
            ref={seguro}
            onClick={aoCancelar}
          >
            {rotuloCancelar}
          </button>

          {/* `data-destrutiva` e não só a cor: quem não distingue vermelho de
              cinza precisa de outra pista, e o teste precisa de algo para
              afirmar que não seja um valor hexadecimal. */}
          <button
            type="button"
            className={
              destrutiva ? 'confirmar-botao confirmar-botao--destrutiva' : 'confirmar-botao'
            }
            data-destrutiva={destrutiva ? 'true' : undefined}
            onClick={() => aoConfirmar({ naoPerguntar })}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
