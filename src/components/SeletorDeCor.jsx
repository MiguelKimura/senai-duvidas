// A paleta na tela — AC-COR-03, AC-COR-04, AC-COR-05, AC-COR-06.
//
// São nove quadradinhos coloridos e uma opção "Automática". O que não é óbvio
// é por que eles formam um **radiogroup** em vez de nove botões:
//
//   * nove botões soltos fazem o leitor de tela anunciar "botão" nove vezes,
//     sem dizer que são alternativas da mesma pergunta nem qual está valendo;
//   * nove botões soltos são nove paradas de Tab. Quem navega por teclado
//     atravessa o modal inteiro para passar por um controle só.
//
// O radiogroup resolve os dois com o mesmo desenho, que é o do padrão WAI-ARIA:
// **um** Tab entra no grupo, as setas escolhem, **um** Tab sai. É o chamado
// tabindex rotativo — só a opção marcada tem `tabIndex=0`.
//
// A opção "Automática" existe e é a primeira porque ela é o comportamento de
// hoje (AC-COR-05). Sem ela, "não escolher" viraria um estado que a interface
// não sabe representar, e voltar atrás depois de clicar numa cor seria
// impossível sem fechar o modal.
import React, { useRef } from 'react';
import { PALETA } from '../utils/paleta';
import '../styles/SeletorDeCor.css';

/** O rótulo da opção que mantém o sorteio da v0.1.0. */
export const ROTULO_AUTOMATICA = 'Automática';

/** O que o leitor de tela anuncia ao entrar no grupo. */
export const ROTULO_DO_GRUPO = 'Cor do card';

/**
 * A lista de opções, na ordem em que as setas as percorrem.
 *
 * `valor: null` é a automática, e é o mesmo `null` que o modal manda ao
 * chamado — o que faz a tela do aluno cair no sorteio de sempre.
 */
const OPCOES = [
  { id: 'automatica', nome: ROTULO_AUTOMATICA, valor: null, fundo: null },
  ...PALETA.map((cor) => ({ id: cor.id, nome: cor.nome, valor: cor.fundo, fundo: cor.fundo })),
];

/** Quanto a tecla anda na lista, ou `null` se a tecla não é deste componente. */
function passoDaTecla(tecla, indiceAtual, total) {
  switch (tecla) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (indiceAtual + 1) % total;
    case 'ArrowLeft':
    case 'ArrowUp':
      // `+ total` porque o resto de número negativo em JavaScript é negativo.
      return (indiceAtual - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

/**
 * A paleta de cores do card, como radiogroup.
 *
 * @param {{valor: string|null, onEscolher: (cor: string|null) => void}} props
 *   `valor` é o campo `cor` que irá para o chamado, ou `null` para automática.
 */
export default function SeletorDeCor({ valor = null, onEscolher }) {
  const botoes = useRef([]);

  const indiceAtual = Math.max(
    0,
    OPCOES.findIndex((opcao) => opcao.valor === (valor || null))
  );

  const aoTeclar = (evento) => {
    const destino = passoDaTecla(evento.key, indiceAtual, OPCOES.length);

    // Tecla que não é deste componente segue o caminho dela: Tab precisa sair
    // do grupo, e Esc precisa chegar a quem fecha o modal.
    if (destino === null) return;

    evento.preventDefault();
    onEscolher(OPCOES[destino].valor);

    // O foco acompanha a escolha porque no radiogroup as duas coisas são a
    // mesma: quem está com o foco é quem está marcado.
    const botao = botoes.current[destino];
    if (botao) botao.focus();
  };

  return (
    <div className="seletor-de-cor" role="radiogroup" aria-label={ROTULO_DO_GRUPO}>
      {OPCOES.map((opcao, indice) => {
        const marcada = indice === indiceAtual;

        return (
          <button
            key={opcao.id}
            ref={(elemento) => {
              botoes.current[indice] = elemento;
            }}
            type="button"
            role="radio"
            aria-checked={marcada}
            // Tabindex rotativo: o grupo inteiro é uma parada de Tab só.
            tabIndex={marcada ? 0 : -1}
            className={`seletor-de-cor__opcao${marcada ? ' seletor-de-cor__opcao--marcada' : ''}${
              opcao.fundo ? '' : ' seletor-de-cor__opcao--automatica'
            }`}
            style={opcao.fundo ? { backgroundColor: opcao.fundo } : undefined}
            onClick={() => onEscolher(opcao.valor)}
            onKeyDown={aoTeclar}
          >
            {/* O nome existe para o leitor de tela e para o teste; na tela ele
                fica fora do quadrado, que precisa mostrar só a cor. */}
            <span className="seletor-de-cor__nome">{opcao.nome}</span>
          </button>
        );
      })}
    </div>
  );
}
