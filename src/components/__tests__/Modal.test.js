// O modal de novo chamado — AC-IMG-02, AC-IMG-09, AC-IMG-11.
//
// O modal deixa de ser "um textarea e um campo de URL" e passa a ter seções.
// Não é enfeite: a task 05 acrescenta o painel de opções avançadas — cor e
// markdown — dentro deste mesmo modal, e a diferença entre "acrescentar uma
// seção" e "reescrever o modal inteiro" é só esta organização existir antes.
//
// O ponto delicado é o id do chamado. O anexo sobe **antes** de o chamado
// existir: o aluno escolhe a imagem enquanto ainda está escrevendo. Para que o
// arquivo já nasça na pasta definitiva — `salas/{salaId}/chamados/{id}/` — o
// modal reserva o id do documento na abertura, sem escrever nada no banco.
// A alternativa seria subir para um lugar provisório e mover depois, e o
// Storage não move objeto: copia, e paga duas vezes.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __arquivosEnviados, __derrubarUploads, __resetarStorage } from 'firebase/storage';
import { __resetarFirestore } from 'firebase/firestore';
import Modal from '../Modal';
import { comDimensoes, instalarCanvasFalso, restaurarCanvas } from '../../test-utils';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

function print(nome = 'print.png') {
  return comDimensoes(new File([new Uint8Array(PNG)], nome, { type: 'image/png' }), 800, 600);
}

function montar(props = {}) {
  const aoEnviar = jest.fn();
  const aoFechar = jest.fn();

  render(<Modal salaId="sala-3b" onClose={aoFechar} onSubmit={aoEnviar} {...props} />);

  return { aoEnviar, aoFechar };
}

function seletorDeArquivo() {
  return screen.getByLabelText(/imagem do computador/i);
}

beforeEach(() => {
  __resetarFirestore();
  __resetarStorage();
  instalarCanvasFalso();
});

afterEach(() => restaurarCanvas());

describe('Modal — as seções que a task 05 vai encontrar', () => {
  it('separa a descrição do anexo em seções próprias', () => {
    montar();

    expect(screen.getByTestId('secao-descricao')).toContainElement(
      screen.getByPlaceholderText('Descreva o problema')
    );
    expect(screen.getByTestId('secao-anexo')).toContainElement(
      screen.getByPlaceholderText('Cole o link da imagem')
    );
  });

  it('continua oferecendo Concluir e Fechar, com os mesmos nomes', () => {
    montar();

    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });
});

describe('Modal — o que ele entrega ao gravar', () => {
  it('entrega a descrição, o anexo e o id reservado do chamado', async () => {
    const { aoEnviar } = montar();

    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'O VS Code não abre');
    userEvent.upload(seletorDeArquivo(), print());
    await waitFor(() => expect(__arquivosEnviados()).toHaveLength(1));
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith(
      'O VS Code não abre',
      expect.objectContaining({ origem: 'upload' }),
      expect.any(String)
    );
  });

  it('o anexo sobe para a pasta do id que o modal reservou', async () => {
    const { aoEnviar } = montar();

    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'Olha o erro');
    userEvent.upload(seletorDeArquivo(), print());
    await waitFor(() => expect(__arquivosEnviados()).toHaveLength(1));
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    const [, , chamadoId] = aoEnviar.mock.calls[0];
    expect(__arquivosEnviados()[0]).toContain(`salas/sala-3b/chamados/${chamadoId}/`);
  });

  it('o anexo por URL chega como objeto de origem url (AC-IMG-01)', () => {
    const { aoEnviar } = montar();

    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'Olha o erro');
    userEvent.paste(
      screen.getByPlaceholderText('Cole o link da imagem'),
      'https://exemplo.br/erro.png'
    );
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith(
      'Olha o erro',
      { url: 'https://exemplo.br/erro.png', origem: 'url' },
      expect.any(String)
    );
  });

  it('sem anexo nenhum, entrega null — como a v0.1.0 fazia', () => {
    const { aoEnviar } = montar();

    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'Sem print');
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith('Sem print', null, expect.any(String));
  });

  it('reserva um id diferente a cada modal aberto', () => {
    const { aoEnviar: primeiro } = montar();
    userEvent.type(screen.getAllByPlaceholderText('Descreva o problema')[0], 'um');
    userEvent.click(screen.getAllByRole('button', { name: 'Concluir' })[0]);

    const { aoEnviar: segundo } = montar();
    userEvent.type(screen.getAllByPlaceholderText('Descreva o problema')[1], 'dois');
    userEvent.click(screen.getAllByRole('button', { name: 'Concluir' })[1]);

    expect(primeiro.mock.calls[0][2]).not.toBe(segundo.mock.calls[0][2]);
  });
});

describe('Modal — a falha de upload não custa o texto digitado (AC-IMG-09)', () => {
  it('a descrição continua no campo depois do erro de envio', async () => {
    __derrubarUploads('storage/retry-limit-exceeded');
    montar();
    const campo = screen.getByPlaceholderText('Descreva o problema');

    userEvent.type(campo, 'O VS Code não abre no computador 12');
    userEvent.upload(seletorDeArquivo(), print());

    await screen.findByRole('alert');
    expect(campo).toHaveValue('O VS Code não abre no computador 12');
  });

  it('e dá para concluir o chamado sem o anexo, com o texto intacto', async () => {
    __derrubarUploads('storage/retry-limit-exceeded');
    const { aoEnviar } = montar();

    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'Sem o print mesmo');
    userEvent.upload(seletorDeArquivo(), print());
    await screen.findByRole('alert');

    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith('Sem o print mesmo', null, expect.any(String));
  });
});

describe('Modal — fechar sem concluir não deixa órfão no Storage', () => {
  it('apaga o anexo já enviado quando o aluno desiste do chamado', async () => {
    montar();

    userEvent.upload(seletorDeArquivo(), print());
    await waitFor(() => expect(__arquivosEnviados()).toHaveLength(1));

    userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    await waitFor(() => expect(__arquivosEnviados()).toEqual([]));
  });

  it('fechar sem anexo nenhum não é erro', () => {
    const { aoFechar } = montar();

    userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(aoFechar).toHaveBeenCalled();
  });
});
