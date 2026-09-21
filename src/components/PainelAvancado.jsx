// A setinha cinza — AC-COR-01, AC-COR-02, AC-COR-06, AC-COR-09.
//
// O cliente descreveu esta feature pelo que ela **não** faz: "o menu de abrir
// um chamado é bem simples... eu queria uma setinha em cinza que, quando
// aberta, mostrasse opções de cor". Quem tem pressa abre o modal, escreve e
// envia sem reparar que há opções. Quem quer controle clica na setinha.
//
// Por que `<details>`/`<summary>` e não um botão com estado:
//
//   * o foco, o Enter, o Espaço e o triângulo já vêm prontos e corretos;
//   * o estado aberto/fechado é do DOM, não do React — Ctrl+F do navegador
//     encontra texto dentro de um `<details>` fechado e o abre sozinho;
//   * é menos código nosso para errar em acessibilidade, que é exatamente
//     onde este tipo de componente costuma errar.
//
// O `aria-expanded` é declarado por cima do nativo porque o AC-COR-06 o exige
// nominalmente e porque `<summary>` ainda é anunciado de formas diferentes
// pelos leitores de tela em uso. Ele não substitui o estado nativo: acompanha.
import React, { useState } from 'react';
import SeletorDeCor from './SeletorDeCor';
import TextoMarkdown from './TextoMarkdown';
import { FORMATO_MARKDOWN } from '../utils/markdown';
import { corDaPaleta } from '../utils/paleta';
import '../styles/PainelAvancado.css';

/** O que a setinha diz. Curto: ela precisa caber ao lado do triângulo. */
export const ROTULO_DO_PAINEL = 'Opções avançadas';

/** O que a prévia mostra enquanto não há descrição nenhuma. */
export const PREVIA_VAZIA = 'Nada escrito ainda — a prévia aparece conforme você digita.';

/**
 * As opções avançadas do chamado, escondidas atrás de uma setinha.
 *
 * @param {{
 *   cor: string|null,
 *   corAutomatica: string,
 *   onCorMudou: (cor: string|null) => void,
 *   descricao: string,
 *   autor: string,
 * }} props
 *   `cor` é `null` enquanto o aluno não escolhe; `corAutomatica` é a cor
 *   sorteada que o chamado receberá nesse caso, e é ela que a prévia pinta —
 *   mostrar outra seria mentir sobre o resultado.
 */
export default function PainelAvancado({
  cor = null,
  corAutomatica,
  onCorMudou,
  descricao = '',
  autor = '',
}) {
  const [aberto, setAberto] = useState(false);

  const corDaPrevia = cor || corAutomatica;
  const entradaDaPaleta = corDaPaleta(corDaPrevia);

  return (
    <details
      className="painel-avancado"
      open={aberto}
      onToggle={(evento) => setAberto(evento.target.open)}
    >
      <summary
        className="painel-avancado__setinha"
        aria-expanded={aberto}
        // Redundante em navegador moderno, necessário em Firefox antigo, que
        // não põe `<summary>` na ordem de tabulação. Custa um atributo.
        tabIndex={0}
        // O clique é ouvido **além** do comportamento nativo, não no lugar
        // dele: o navegador continua abrindo e fechando o `<details>` sozinho,
        // e isto apenas mantém o `aria-expanded` no mesmo compasso. Sem esta
        // linha, o atributo só acertaria depois do evento `toggle`, que é
        // assíncrono — e o leitor de tela anunciaria o estado anterior.
        onClick={() => setAberto((valor) => !valor)}
      >
        {ROTULO_DO_PAINEL}
      </summary>

      <div className="painel-avancado__conteudo">
        <div className="painel-avancado__grupo">
          <SeletorDeCor valor={cor} onEscolher={onCorMudou} />
        </div>

        <div className="painel-avancado__grupo">
          <p className="painel-avancado__ajuda">
            A descrição aceita <code>**negrito**</code>, <code>*itálico*</code>,{' '}
            <code>- listas</code> e <code>`código`</code>.
          </p>
        </div>

        <div className="painel-avancado__grupo">
          <p className="painel-avancado__ajuda" id="rotulo-da-previa">
            Prévia do card
          </p>
          <div
            className="painel-avancado__previa"
            data-testid="previa-do-card"
            aria-labelledby="rotulo-da-previa"
            style={{
              backgroundColor: corDaPrevia,
              // Só a paleta traz cor de texto verificada. Para a cor sorteada
              // dos chamados antigos, o card fica com a cor de texto de
              // sempre — mudá-la aqui seria mudar a aparência do legado.
              color: entradaDaPaleta ? entradaDaPaleta.texto : undefined,
            }}
          >
            {autor && (
              <p className="painel-avancado__previa-autor">
                <strong>{autor}</strong>
              </p>
            )}
            {descricao.trim() === '' ? (
              <p className="painel-avancado__previa-vazia">{PREVIA_VAZIA}</p>
            ) : (
              <TextoMarkdown texto={descricao} formato={FORMATO_MARKDOWN} />
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
