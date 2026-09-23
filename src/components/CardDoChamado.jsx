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
import React, { memo } from 'react';
import AnexoDoCard from './AnexoDoCard';
import TextoMarkdown from './TextoMarkdown';
import InsigniasDoAluno from './perks/InsigniasDoAluno';
import { formatarDataHora } from '../services/tempo';
import { formatoDoTexto } from '../utils/markdown';
import { classesDoCard, estiloDoCard } from '../utils/cardDoChamado';
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
 */
function CardDoChamado({
  chamado,
  indice,
  saindo = false,
  perksPorUid,
  agoraServidor,
  acoes = null,
}) {
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

        {/* A miniatura do anexo, no mesmo canto onde o olho 👁️ ficava. Clicar
            abre o visualizador na própria página — `window.open` vinha
            bloqueado em parte dos laboratórios (AC-IMG-10). */}
        <AnexoDoCard chamado={chamado} />
      </div>

      {/* Chamado sem `formato` é texto puro e continua sendo renderizado como
          texto, sem interpretar markdown (AC-COR-05). */}
      <TextoMarkdown texto={chamado.descricao} formato={formatoDoTexto(chamado)} />

      <p>
        <em>{formatarDataHora(chamado.horario)}</em>
      </p>

      {acoes}
    </div>
  );
}

export default memo(CardDoChamado);
