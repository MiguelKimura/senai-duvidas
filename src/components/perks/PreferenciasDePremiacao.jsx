// Onde o aluno decide como a premiação chega até ele — AC-PERK-08.
//
// Duas caixas, e a assimetria entre elas é deliberada:
//
//   * **animação ligada por padrão** — ela é o requisito que o cliente
//     descreveu ("perks tipo o do Call of Duty"), e não um enfeite opcional.
//     Quem não a quiser desliga;
//   * **som desligado por padrão** — 40 pessoas, uma sala, um projetor. Um
//     áudio que toca sozinho no primeiro carregamento interrompe a aula de
//     todo mundo por causa da premiação de uma pessoa.
//
// Vale notar que desligar a animação aqui **não** é a única forma de suprimi-la:
// `prefers-reduced-motion` do sistema operacional já a transforma em card
// estático, sem que ninguém precise achar esta tela (AC-ANIM-05).
import React from 'react';
import { usePreferencias } from '../../hooks/usePreferencias';
import '../../styles/Perks.css';

/**
 * As preferências de premiação de quem está lendo.
 *
 * Sem props: o estado vem do perfil e volta para ele. Um componente de
 * preferência que precisasse ser alimentado de fora obrigaria cada tela que o
 * monta a saber gravar em `usuarios/{uid}` — e já houve uma versão deste
 * projeto em que cada tela decidia isso por conta própria (ver ADR 0003).
 */
export default function PreferenciasDePremiacao() {
  const { preferencias, alterar, erro } = usePreferencias();

  return (
    <fieldset className="perk-preferencias">
      <legend>Premiações</legend>

      {erro && (
        <p className="perk-preferencias-erro" role="status">
          {erro}
        </p>
      )}

      <label className="perk-preferencias-opcao">
        <input
          type="checkbox"
          checked={preferencias.animacoes}
          onChange={(evento) => alterar('animacoes', evento.target.checked)}
        />
        Mostrar a animação de premiação em tela cheia
      </label>

      <label className="perk-preferencias-opcao">
        <input
          type="checkbox"
          checked={preferencias.som}
          onChange={(evento) => alterar('som', evento.target.checked)}
        />
        Tocar o som da premiação
      </label>
    </fieldset>
  );
}
