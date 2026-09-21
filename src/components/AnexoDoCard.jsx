// O anexo dentro do card — AC-IMG-10, AC-IMG-12, AC-IMG-13.
//
// Um componente só, usado pela tela do aluno e pela do professor. Os dois
// cards mostram a mesma coisa, e até a v0.5.0 mostravam por dois trechos de
// JSX copiados — que já tinham divergido: o do aluno chamava
// `visualizarImagem`, o do professor `visualizarAnexo`, e os dois faziam
// `window.open`. Com uma cópia só, a correção do AC-IMG-10 acontece uma vez.
//
// O que ele resolve, em ordem de importância para quem está em aula:
//
//   1. **o clique que não fazia nada.** `window.open` vem bloqueado por
//      política de imagem do Windows em parte dos laboratórios. O aluno
//      clicava no olho e nada acontecia — sem aviso, sem erro, sem janela;
//   2. **a fila ilegível.** O olho não dizia nada sobre o conteúdo. Com a
//      miniatura, o professor vê de relance quais chamados trazem print;
//   3. **o ícone quebrado.** URL externa fora do ar virava aquele quadradinho
//      do navegador, que não explica nada a ninguém (AC-IMG-12).
import React, { useState } from 'react';
import Lightbox from './Lightbox';
import { normalizarAnexo } from '../services/anexos';
import '../styles/AnexoDoCard.css';

/** O que o card diz quando a imagem do anexo não carrega (AC-IMG-12). */
export const AVISO_INDISPONIVEL = 'Imagem indisponível';

/**
 * Lê o campo de anexo de um chamado, nos dois formatos (AC-IMG-13).
 *
 * `anexo` primeiro: quando os dois existem — e a escrita dupla desta versão
 * faz com que existam —, o objeto é o formato completo. Só ele sabe o caminho
 * no Storage, que a exclusão precisa, e as dimensões, que a miniatura usa.
 *
 * @param {{imagem?: string|null, anexo?: object|null}} chamado
 * @returns {{url: string, origem: string}|null}
 */
export function anexoDoChamado(chamado) {
  if (!chamado) return null;

  return normalizarAnexo(chamado.anexo) || normalizarAnexo(chamado.imagem);
}

/**
 * A miniatura do anexo, que abre o visualizador ao ser clicada.
 *
 * @param {{chamado: object}} props
 */
export default function AnexoDoCard({ chamado }) {
  const [aberto, setAberto] = useState(false);
  const [quebrada, setQuebrada] = useState(false);

  const anexo = anexoDoChamado(chamado);

  if (!anexo) return null;

  const descricao = chamado.descricao || 'anexo do chamado';

  if (quebrada) {
    return <p className="anexo-indisponivel">{AVISO_INDISPONIVEL}</p>;
  }

  return (
    <>
      {/* `title` continua sendo "Ver imagem": é como esta ação é conhecida
          desde a v0.1.0, e é por ele que os testes de caracterização a
          alcançam. O que mudou é que agora é um <button>, e não uma <div>
          com onClick — quem navega por teclado alcança o anexo. */}
      <button
        type="button"
        className="view-image-icon"
        title="Ver imagem"
        onClick={() => setAberto(true)}
      >
        <img
          className="anexo-miniatura"
          src={anexo.url}
          alt={`Anexo do chamado: ${descricao}`}
          onError={() => setQuebrada(true)}
        />
      </button>

      {aberto && (
        <Lightbox url={anexo.url} descricao={descricao} onFechar={() => setAberto(false)} />
      )}
    </>
  );
}
