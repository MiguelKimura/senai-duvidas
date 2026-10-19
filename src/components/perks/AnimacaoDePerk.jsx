// A animação de premiação — AC-PERK-04, AC-PERK-08, AC-ANIM-05, AC-ANIM-06.
//
// O cliente pediu "perks tipo o do Call of Duty, pra ter animações legais". A
// animação é o requisito, não o enfeite: uma notificação discreta no canto não
// entrega o que ele descreveu, que é o aluno sentir que ganhou alguma coisa.
//
// O ambiente, porém, é uma sala com 40 pessoas e um projetor — e daí as três
// travas que este componente carrega:
//
//   * **saída sempre disponível**: o botão de pular aparece no primeiro quadro
//     e o Esc fecha. Ninguém fica refém de três segundos de tela cheia;
//   * **`prefers-reduced-motion` vira card estático** com a MESMA informação, e
//     sem cronômetro: quem pediu menos movimento precisa de tempo para ler;
//   * **som mudo por padrão**, e só sai do mudo por escolha explícita nas
//     preferências.
//
// Componente sem banco: recebe o perk já lido e avisa quando terminou. Quem
// grava o recibo de visualização é `PremiacaoDaSala`.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { rotuloDoTipo } from '../../services/perks';
import { PREFERENCIAS_PADRAO } from '../../services/perfilUsuario';
import { useMovimentoReduzido } from '../../hooks/useMovimentoReduzido';
import '../../styles/Perks.css';

/**
 * Quanto tempo a premiação fica na tela antes de sair sozinha.
 *
 * A task pede "2 a 3 segundos". 2,6s é o meio da faixa: tempo de ler o nome,
 * o nível e a justificativa curta sem virar uma pausa na aula. A duração
 * definitiva e a curva vêm dos tokens na task 08 (AC-ANIM-09).
 */
export const DURACAO_DA_ANIMACAO_MS = 2600;

/**
 * O som da premiação — um arpejo de 0,36s, mudo por padrão.
 *
 * WAV de 8 KB, e não MP3: o arquivo é tão curto que a compressão não
 * compensaria, e WAV toca sem codec em todos os navegadores da lista de
 * compatibilidade, inclusive nos desatualizados dos laboratórios.
 */
export const SOM_DA_PREMIACAO = '/sons/premiacao.wav';

/** O que o botão de saída diz, nas duas formas do componente. */
export const ROTULO_DE_PULAR = 'Pular';

/** As estrelinhas do nível, em texto — o leitor de tela lê "nível 2". */
function Nivel({ nivel }) {
  return (
    <p className="perk-premiacao-nivel">
      <span aria-hidden="true">{'★'.repeat(nivel)}</span>
      <span className="perk-premiacao-nivel-texto">Nível {nivel}</span>
    </p>
  );
}

/**
 * A premiação em tela cheia.
 *
 * @param {object} props
 * @param {object|null} props.perk documento de `salas/{salaId}/perks`.
 * @param {{animacoes: boolean, som: boolean}} [props.preferencias] de
 *   `usuarios/{uid}.preferencias`, já com padrão seguro.
 * @param {() => void} props.aoFechar chamado uma única vez, ao pular, ao
 *   apertar Esc ou quando a animação termina.
 */
export default function AnimacaoDePerk({ perk, preferencias, aoFechar }) {
  const { animacoes, som } = { ...PREFERENCIAS_PADRAO, ...(preferencias || {}) };
  const movimentoReduzido = useMovimentoReduzido();

  const estatica = movimentoReduzido || animacoes === false;

  const audio = useRef(null);
  // Um `ref`, e não estado: o aviso de fechamento não redesenha nada, e
  // fechar duas vezes gravaria o recibo duas vezes — ou fecharia a premiação
  // seguinte antes de ela aparecer.
  const jaFechou = useRef(false);
  const [saindo, setSaindo] = useState(false);

  const fechar = useCallback(() => {
    if (jaFechou.current) return;

    jaFechou.current = true;
    setSaindo(true);

    if (aoFechar) aoFechar();
  }, [aoFechar]);

  // O cronômetro só existe na forma animada. No card estático ele seria uma
  // armadilha: quem pediu menos movimento está lendo, não assistindo.
  useEffect(() => {
    if (!perk || estatica) return undefined;

    const temporizador = setTimeout(fechar, DURACAO_DA_ANIMACAO_MS);

    return () => clearTimeout(temporizador);
  }, [perk, estatica, fechar]);

  // O `play()` é disparado aqui, e não por `autoPlay`: com o atributo, o
  // navegador tentaria tocar mesmo com o elemento mudo, e não haveria onde
  // tratar a recusa. A restrição de produção é explícita — se o áudio falhar,
  // a premiação degrada sem lançar.
  useEffect(() => {
    if (!perk || !som || !audio.current) return;

    const tocando = audio.current.play();

    if (tocando && typeof tocando.catch === 'function') {
      tocando.catch(() => {
        // Navegador que bloqueia áudio antes do primeiro gesto do usuário é o
        // caso comum, não a exceção. A premiação continua na tela.
      });
    }
  }, [perk, som]);

  if (!perk) return null;

  const classes = [
    'perk-premiacao',
    estatica ? 'perk-premiacao--estatica' : 'perk-premiacao--animada',
    saindo && !estatica ? 'perk-premiacao--saindo' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const titulo = rotuloDoTipo(perk.tipo);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={classes}
      role="dialog"
      aria-modal="true"
      aria-label={`Premiação recebida: ${titulo}`}
      tabIndex={-1}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') {
          evento.stopPropagation();
          fechar();
        }
      }}
    >
      <div className="perk-premiacao-cartao">
        <p className="perk-premiacao-chamada">Você ganhou uma premiação!</p>

        <h2 className="perk-premiacao-titulo">{titulo}</h2>

        <Nivel nivel={Number(perk.nivel) || 1} />

        {perk.justificativa && (
          <p className="perk-premiacao-justificativa">{perk.justificativa}</p>
        )}

        <p className="perk-premiacao-autor">
          Concedida por {perk.concedidoPorNome || 'seu professor'}
        </p>

        {/* Sempre visível, e sempre o primeiro elemento focável do diálogo. */}
        <button type="button" className="perk-premiacao-pular" onClick={fechar}>
          {ROTULO_DE_PULAR}
        </button>
      </div>

      {/* `muted` por padrão e sem `autoPlay`: quem liga o som é a preferência
          do aluno, nunca o primeiro carregamento (AC-PERK-04). */}
      <audio ref={audio} src={SOM_DA_PREMIACAO} muted={!som} preload="none">
        <track kind="captions" />
      </audio>
    </div>
  );
}
