// As abas da sala: a fila de um lado, o resto em abas separadas.
//
// Até a v1.0.0 a tela do aluno empilhava tudo numa coluna só — a fila, a
// vitrine de conquistas, as preferências de premiação —, e a do professor
// empilhava o painel da turma e o de perks em cima da fila. O resultado era a
// fila empurrada para baixo, e uma tela que mudava de forma conforme a conta:
// o aluno com conquistas via uma página, o aluno sem nenhuma via outra.
//
// Com as abas, a primeira coisa na tela é sempre a fila, do mesmo tamanho para
// todo mundo. O resto está a um clique, no lugar dele.
//
// O padrão de teclado é o do WAI-ARIA para abas: setas trocam de aba, Home e
// End vão às pontas. Só a aba ativa entra na ordem de tabulação.
import React, { useRef, useState } from 'react';
import '../styles/AbasDaSala.css';

/**
 * @typedef {object} Aba
 * @property {string} id
 * @property {string} titulo
 * @property {React.ReactNode} conteudo
 */

/**
 * @param {object} props
 * @param {Array<Aba|null|false>} props.abas as abas, na ordem. Itens falsos
 *   são ignorados — é o que deixa a tela escrever `ehDono && {...}`.
 * @param {string} props.rotulo o nome acessível da lista de abas.
 */
export default function AbasDaSala({ abas, rotulo }) {
  const validas = abas.filter(Boolean);
  const [ativa, setAtiva] = useState(validas[0]?.id);
  const botoes = useRef({});

  // A aba ativa pode sumir (a sala foi arquivada, por exemplo): volta-se à
  // primeira em vez de desenhar um painel vazio.
  const atual = validas.find((aba) => aba.id === ativa) || validas[0];

  if (!atual) return null;

  const irPara = (indice) => {
    const destino = validas[(indice + validas.length) % validas.length];
    setAtiva(destino.id);
    botoes.current[destino.id]?.focus();
  };

  const aoTeclar = (evento, indice) => {
    const teclas = {
      ArrowRight: () => irPara(indice + 1),
      ArrowLeft: () => irPara(indice - 1),
      Home: () => irPara(0),
      End: () => irPara(validas.length - 1),
    };

    const acao = teclas[evento.key];
    if (!acao) return;

    evento.preventDefault();
    acao();
  };

  return (
    <div className="abas-da-sala">
      <div className="abas-lista" role="tablist" aria-label={rotulo}>
        {validas.map((aba, indice) => {
          const selecionada = aba.id === atual.id;

          return (
            <button
              key={aba.id}
              ref={(elemento) => {
                botoes.current[aba.id] = elemento;
              }}
              type="button"
              role="tab"
              id={`aba-${aba.id}`}
              className="abas-botao"
              aria-selected={selecionada}
              aria-controls={`painel-${aba.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => setAtiva(aba.id)}
              onKeyDown={(evento) => aoTeclar(evento, indice)}
            >
              {aba.titulo}
            </button>
          );
        })}
      </div>

      <div
        className="abas-painel"
        role="tabpanel"
        id={`painel-${atual.id}`}
        aria-labelledby={`aba-${atual.id}`}
      >
        {atual.conteudo}
      </div>
    </div>
  );
}
