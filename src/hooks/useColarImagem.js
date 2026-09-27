// Colar a captura de tela direto no modal — AC-IMG-04.
//
// É o caminho mais curto que existe para o problema desta task. O aluno aperta
// PrintScreen (ou Win+Shift+S, que é o recorte do Windows 11) e a imagem vai
// para a área de transferência sem virar arquivo nenhum no disco. Sem colar,
// ele precisaria abrir o Paint, salvar em algum lugar que ele saiba achar de
// novo, e só então procurar o arquivo no seletor — três passos onde a maioria
// desiste e digita "deu erro" no lugar.
import { useEffect } from 'react';

/** A primeira imagem da área de transferência, ou `null`. */
export function imagemDaAreaDeTransferencia(dados) {
  if (!dados) return null;

  const itens = [...(dados.items || [])];

  const item = itens.find(
    (candidato) =>
      candidato &&
      candidato.kind === 'file' &&
      typeof candidato.type === 'string' &&
      candidato.type.startsWith('image/')
  );

  return item ? item.getAsFile() : null;
}

/**
 * Escuta o Ctrl+V enquanto o modal estiver aberto.
 *
 * O ouvinte fica no **documento**, não no `<div>` do modal. O caso real é o
 * aluno digitando a descrição e colando o print sem tirar o foco do campo: o
 * evento `paste` nasce no elemento focado, e um ouvinte preso ao container
 * perderia todo `paste` que nascesse fora dele. Quem delimita o escopo é
 * `ativo` — o hook só escuta enquanto o modal está montado e aberto, e o
 * `useEffect` cancela a inscrição no desmonte (AC-PERF-04).
 *
 * @param {(arquivo: File) => void} aoColar recebe a imagem colada.
 * @param {{ativo?: boolean}} [opcoes]
 */
export default function useColarImagem(aoColar, { ativo = true } = {}) {
  useEffect(() => {
    if (!ativo || !aoColar) return undefined;

    const aoReceberColagem = (evento) => {
      const arquivo = imagemDaAreaDeTransferencia(evento.clipboardData);

      if (!arquivo) return;

      // Sem isto, o navegador ainda cola o nome do arquivo como texto dentro
      // da descrição — o aluno ganha o anexo e um "imagem-colada.png" no meio
      // da frase que ele estava escrevendo.
      evento.preventDefault();
      aoColar(arquivo);
    };

    document.addEventListener('paste', aoReceberColagem);

    return () => document.removeEventListener('paste', aoReceberColagem);
  }, [aoColar, ativo]);
}
