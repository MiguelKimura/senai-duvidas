// A fila de chamados — AC-CHAMADO-09, AC-CHAMADO-10, AC-ANIM-04.
//
// A casca da lista, compartilhada pela tela do aluno e pela do professor. Ela
// não sabe desenhar um card: quem desenha é quem a chama, por `renderizarCard`.
// O que ela sabe são os quatro estados que uma lista lida do banco tem, e que
// as duas telas tratavam como um só — "tem cards" ou "não tem":
//
//   * **carregando**, antes do primeiro snapshot. Sem isso, a fila aparecia
//     vazia por um instante e depois se enchia; o aluno lia "nenhuma dúvida",
//     e abria a mesma dúvida duas vezes (AC-ANIM-04);
//   * **vazia**, que é toda sala no começo de cada aula. Uma área em branco é
//     indistinguível de erro de carregamento (AC-CHAMADO-10);
//   * **com erro**, com um caminho de volta — e não uma tela morta;
//   * **cheia**, paginada de 30 em 30 (AC-CHAMADO-09).
//
// Sobre a paginação: o corte é de **renderização**, e não de leitura. A
// consulta já vem com `limit(LIMITE_DE_CHAMADOS)` desde a task 07, e os 200
// chamados do alvo do projeto chegam num snapshot só — o que custava caro era
// desenhar 200 cards a cada reemissão, e o `onSnapshot` reemite a cada chamado
// novo da turma. Paginar a leitura com cursor traria de volta o problema que o
// ADR 0009 descreve no chat: um segundo conjunto de resultados fora do
// `onSnapshot`, que não recebe edição nem deleção em tempo real.
import React, { useCallback, useState } from 'react';
import '../styles/FilaDeChamados.css';

/** Quantos cards entram por página. */
export const CHAMADOS_POR_PAGINA = 30;

export const TEXTO_VAZIO_PADRAO = 'Nenhuma dúvida por aqui ainda. Toque no + para abrir a sua.';

export const TEXTO_CARREGANDO = 'Carregando a fila de dúvidas...';

/** Quantas barras cinzas o esqueleto desenha. */
const LINHAS_DO_ESQUELETO = 3;

/** O esqueleto do carregamento inicial (AC-ANIM-04). */
function Esqueleto() {
  return (
    <div className="esqueleto-lista" aria-hidden="true">
      {Array.from({ length: LINHAS_DO_ESQUELETO }, (_, indice) => (
        <div className="fila-esqueleto-card" key={indice}>
          <div className="esqueleto fila-esqueleto-nome" />
          <div className="esqueleto fila-esqueleto-texto" />
          <div className="esqueleto fila-esqueleto-horario" />
        </div>
      ))}
    </div>
  );
}

/**
 * Desenha a fila, com os quatro estados de uma lista lida do banco.
 *
 * @param {object} props
 * @param {Array<object>} props.chamados a fila já ordenada.
 * @param {boolean} [props.carregando] antes do primeiro snapshot.
 * @param {string|null} [props.erro] mensagem em português, se a leitura falhou.
 * @param {() => void} [props.tentarNovamente] o caminho de volta do erro.
 * @param {string} [props.textoVazio] o que dizer quando não há chamado nenhum.
 * @param {(chamado: object, indice: number) => React.ReactNode} props.renderizarCard
 */
export default function FilaDeChamados({
  chamados = [],
  carregando = false,
  erro = null,
  tentarNovamente,
  textoVazio = TEXTO_VAZIO_PADRAO,
  renderizarCard,
}) {
  const [paginas, setPaginas] = useState(1);

  // `paginas`, e não `visiveis`: guardar a quantidade de itens faria a fila
  // voltar ao topo toda vez que o `onSnapshot` reemitisse — o professor seria
  // jogado de volta ao começo várias vezes por aula.
  const carregarMais = useCallback(() => setPaginas((atual) => atual + 1), []);

  const teto = paginas * CHAMADOS_POR_PAGINA;
  const visiveis = chamados.slice(0, teto);
  const faltam = chamados.length - visiveis.length;

  // O esqueleto só cobre o carregamento **inicial**. Trocar uma fila cheia por
  // barras cinzas a cada reemissão piscaria a tela da turma inteira.
  const mostrandoEsqueleto = carregando && chamados.length === 0;

  return (
    <div className="problemas-list">
      {erro ? (
        <div className="fila-erro" role="alert">
          <p>{erro}</p>
          {tentarNovamente && (
            <button type="button" className="fila-tentar" onClick={tentarNovamente}>
              Tentar novamente
            </button>
          )}
        </div>
      ) : null}

      {!erro && mostrandoEsqueleto ? (
        <>
          {/* O texto é o que o leitor de tela anuncia; as barras cinzas são o
              que o olho vê. As duas metades dizem a mesma coisa. */}
          <p className="fila-aviso" role="status">
            {TEXTO_CARREGANDO}
          </p>
          <Esqueleto />
        </>
      ) : null}

      {!erro && !carregando && chamados.length === 0 ? (
        <p className="fila-vazia" role="status">
          {textoVazio}
        </p>
      ) : null}

      {visiveis.map((chamado, indice) => renderizarCard(chamado, indice))}

      {faltam > 0 ? (
        <button type="button" className="fila-carregar-mais" onClick={carregarMais}>
          Carregar mais ({faltam} restantes)
        </button>
      ) : null}
    </div>
  );
}
