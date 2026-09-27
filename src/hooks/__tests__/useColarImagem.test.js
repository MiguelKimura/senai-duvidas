// Colar a captura de tela direto no modal — AC-IMG-04.
//
// É o caminho mais curto que existe para o problema real desta task: o aluno
// aperta PrintScreen (ou Win+Shift+S), a imagem vai para a área de
// transferência e **não existe arquivo nenhum no disco**. Sem colar, ele
// precisaria abrir o Paint, salvar em algum lugar que ele saiba achar de
// novo, e só então procurar o arquivo no seletor — três passos onde a maioria
// desiste e digita "deu erro" no lugar.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import useColarImagem from '../useColarImagem';

/** Uma área de transferência com o que o navegador poria dentro dela. */
function areaDeTransferencia(itens) {
  return {
    items: itens.map(({ tipo, arquivo }) => ({
      kind: arquivo ? 'file' : 'string',
      type: tipo,
      getAsFile: () => arquivo || null,
    })),
    files: itens.filter((item) => item.arquivo).map((item) => item.arquivo),
  };
}

function imagem(nome = 'imagem-colada.png') {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], nome, { type: 'image/png' });
}

/** Um modal de mentira, só para o hook ter onde viver. */
function Modalzinho({ aoColar, ativo }) {
  useColarImagem(aoColar, { ativo });

  return <div data-testid="modal">modal</div>;
}

describe('useColarImagem — o que ele aceita', () => {
  it('entrega o arquivo quando o que foi colado é uma imagem', () => {
    const aoColar = jest.fn();
    const print = imagem();
    render(<Modalzinho aoColar={aoColar} />);

    fireEvent.paste(document, {
      clipboardData: areaDeTransferencia([{ tipo: 'image/png', arquivo: print }]),
    });

    expect(aoColar).toHaveBeenCalledWith(print);
  });

  it('ignora o Ctrl+V de texto — colar a descrição não pode virar anexo', () => {
    const aoColar = jest.fn();
    render(<Modalzinho aoColar={aoColar} />);

    fireEvent.paste(document, {
      clipboardData: areaDeTransferencia([{ tipo: 'text/plain' }]),
    });

    expect(aoColar).not.toHaveBeenCalled();
  });

  it('ignora arquivo colado que não é imagem', () => {
    const aoColar = jest.fn();
    const pdf = new File(['%PDF'], 'boleto.pdf', { type: 'application/pdf' });
    render(<Modalzinho aoColar={aoColar} />);

    fireEvent.paste(document, {
      clipboardData: areaDeTransferencia([{ tipo: 'application/pdf', arquivo: pdf }]),
    });

    expect(aoColar).not.toHaveBeenCalled();
  });

  it('pega a primeira imagem quando vem mais de uma', () => {
    const aoColar = jest.fn();
    const primeira = imagem('primeira.png');
    render(<Modalzinho aoColar={aoColar} />);

    fireEvent.paste(document, {
      clipboardData: areaDeTransferencia([
        { tipo: 'image/png', arquivo: primeira },
        { tipo: 'image/png', arquivo: imagem('segunda.png') },
      ]),
    });

    expect(aoColar).toHaveBeenCalledTimes(1);
    expect(aoColar).toHaveBeenCalledWith(primeira);
  });

  it('não quebra quando o evento vem sem área de transferência', () => {
    const aoColar = jest.fn();
    render(<Modalzinho aoColar={aoColar} />);

    expect(() => fireEvent.paste(document, { clipboardData: null })).not.toThrow();
    expect(aoColar).not.toHaveBeenCalled();
  });
});

describe('useColarImagem — quando ele escuta', () => {
  it('para de escutar quando o modal é desmontado (AC-PERF-04)', () => {
    const aoColar = jest.fn();
    const { unmount } = render(<Modalzinho aoColar={aoColar} />);

    unmount();
    fireEvent.paste(document, {
      clipboardData: areaDeTransferencia([{ tipo: 'image/png', arquivo: imagem() }]),
    });

    expect(aoColar).not.toHaveBeenCalled();
  });

  it('não escuta enquanto estiver desligado', () => {
    const aoColar = jest.fn();
    render(<Modalzinho aoColar={aoColar} ativo={false} />);

    fireEvent.paste(document, {
      clipboardData: areaDeTransferencia([{ tipo: 'image/png', arquivo: imagem() }]),
    });

    expect(aoColar).not.toHaveBeenCalled();
  });

  it('continua escutando com o foco dentro do textarea do modal', () => {
    // O caso real: o aluno digita a descrição e cola o print sem tirar o foco
    // do campo. O `paste` nasce no textarea, e é por isso que o hook escuta
    // no documento — um ouvinte preso ao <div> do modal perderia este caso
    // sempre que o foco estivesse em qualquer filho dele.
    const aoColar = jest.fn();
    const print = imagem();

    function ComCampo() {
      useColarImagem(aoColar);
      return <textarea aria-label="Descreva o problema" />;
    }

    render(<ComCampo />);
    fireEvent.paste(screen.getByLabelText('Descreva o problema'), {
      clipboardData: areaDeTransferencia([{ tipo: 'image/png', arquivo: print }]),
    });

    expect(aoColar).toHaveBeenCalledWith(print);
  });
});
