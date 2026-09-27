// O card de um chamado — AC-CHAMADO-07, AC-COR-04, AC-COR-07, AC-ANIM-02.
//
// Um componente só, usado pela tela do aluno e pela do professor. É a mesma
// história do `AnexoDoCard` da task 04 e do `estiloDoCard` da task 05: até
// agora eram dois trechos de JSX copiados, que já tinham divergido — o do
// aluno punha o nome solto no cabeçalho, o do professor o envolvia numa `div`,
// e as duas folhas declaravam `.card-header` com `justify-content` diferente,
// globalmente, uma sobrescrevendo a outra conforme a ordem dos imports.
//
// **`React.memo` é o ponto desta extração**, e não a economia de linhas. Com
// 30 cards na tela e um `onSnapshot` que reemite a cada chamado novo da turma,
// sem memo o React reconcilia os 30 a cada mensagem de qualquer colega. Para
// que o memo valha alguma coisa, as funções que chegam aqui precisam ser
// estáveis — daí os `useCallback` das duas telas (AC-CHAMADO-09).
//
// O que varia entre as duas telas é só o rodapé de ações, e ele entra por
// `acoes`. Tudo o mais é idêntico e precisa continuar sendo: a fila é a mesma,
// e o card do professor tem de mostrar o que o do aluno mostra.
import React, { memo, useState } from 'react';
import AnexoDoCard from './AnexoDoCard';
import TextoMarkdown from './TextoMarkdown';
import InsigniasDoAluno from './perks/InsigniasDoAluno';
import { formatarDataHora } from '../services/tempo';
import { formatoDoTexto } from '../utils/markdown';
import { classesDoCard, descricaoEhLonga, estiloDoCard } from '../utils/cardDoChamado';
import '../styles/CardDoChamado.css';

/**
 * Um card da fila.
 *
 * @param {object} props
 * @param {object} props.chamado documento de `salas/{salaId}/chamados`.
 * @param {number} props.indice posição na lista, para o escalonamento da
 *   entrada (AC-ANIM-02).
 * @param {boolean} [props.saindo] o card está sendo excluído.
 * @param {Map<string, Array<object>>|object} [props.perksPorUid]
 * @param {Date|null} [props.agoraServidor]
 * @param {React.ReactNode} [props.acoes] o rodapé de ações da tela.
 * @param {string|null} [props.salaId] de onde o olho lê a imagem guardada no
 *   banco (v1.1.0).
 */
function CardDoChamado({
  chamado,
  indice,
  saindo = false,
  perksPorUid,
  agoraServidor,
  acoes = null,
  salaId = null,
}) {
  // Recolhida por padrão: é o que dá a todo card a mesma altura na fila, e é
  // o que impede um chamado de vinte linhas de empurrar os outros para fora
  // da tela do professor.
  const [expandido, setExpandido] = useState(false);
  const longo = descricaoEhLonga(chamado.descricao);
  const idDaDescricao = `descricao-${chamado.id}`;

  return (
    <div
      className={classesDoCard({ saindo })}
      style={{ ...estiloDoCard(chamado), '--indice-na-lista': indice }}
    >
      <div className="card-header">
        <div className="user-name-wrapper">
          {/* `autorNome` primeiro, `nome` como leitura do formato antigo: é o
              outro lado da escrita dupla, e é o que mantém legível o chamado
              que a migração copiou da coleção global (AC-IMG-13). */}
          <p className="user-name">
            <strong>{chamado.autorNome || chamado.nome}</strong>
            <InsigniasDoAluno
              perks={perksPorUid}
              uid={chamado.autorUid}
              agoraServidor={agoraServidor}
            />
          </p>
        </div>

        {/* O olho 👁️ do anexo, no canto de sempre. Clicar abre o
            visualizador na própria página — `window.open` vinha bloqueado em
            parte dos laboratórios (AC-IMG-10). */}
        <AnexoDoCard chamado={chamado} salaId={salaId} />
      </div>

      {/* Data e hora logo abaixo do nome, antes do texto: é a primeira coisa
          que o professor procura para saber quem está esperando há mais
          tempo. */}
      <p className="card-horario">
        <em>{formatarDataHora(chamado.horario)}</em>
      </p>

      {/* Chamado sem `formato` é texto puro e continua sendo renderizado como
          texto, sem interpretar markdown (AC-COR-05). */}
      <div
        id={idDaDescricao}
        className={`card-descricao${longo && !expandido ? ' card-descricao--recolhida' : ''}`}
      >
        <TextoMarkdown texto={chamado.descricao} formato={formatoDoTexto(chamado)} />
      </div>

      {longo && (
        <button
          type="button"
          className="card-ler-mais"
          aria-expanded={expandido}
          aria-controls={idDaDescricao}
          onClick={() => setExpandido((atual) => !atual)}
        >
          {expandido ? 'Ler menos' : 'Ler mais'}
        </button>
      )}

      {acoes}
    </div>
  );
}

export default memo(CardDoChamado);
