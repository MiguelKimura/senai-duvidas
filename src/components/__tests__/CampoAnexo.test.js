// O campo de anexo do modal — AC-IMG-01 a AC-IMG-09 e AC-IMG-12.
//
// Até a v0.5.0 havia um campo de texto e uma instrução: "Digite o URL da
// imagem". O aluno que acabou de tirar um print não tem URL nenhuma, e é
// justamente ele quem mais precisa do anexo. As três entradas novas — seletor,
// arrastar e colar — existem porque cada uma cobre um jeito diferente de a
// imagem já estar na máquina dele.
//
// O campo por URL continua onde estava, com o mesmo texto de antes: é
// regressão declarada (AC-IMG-01), e há chamados abertos assim todo dia.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  __arquivosEnviados,
  __avancarUploads,
  __concluirUploads,
  __falharUploads,
  __resetarStorage,
  __segurarUploads,
  __semearArquivos,
} from 'firebase/storage';
import CampoAnexo from '../CampoAnexo';
import { comDimensoes, instalarCanvasFalso, restaurarCanvas } from '../../test-utils';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0, 0x04, 0, 0, 0];

function arquivo(bytes, nome, tipo) {
  return new File([new Uint8Array(bytes)], nome, { type: tipo });
}

/** Um print de 800x600, do tamanho que o laboratório produz. */
function print(nome = 'print.png') {
  return comDimensoes(arquivo(PNG, nome, 'image/png'), 800, 600);
}

function montar(props = {}) {
  const aoMudar = jest.fn();
  const utilidades = render(
    <CampoAnexo
      salaId="sala-3b"
      chamadoId="chamado-1"
      anexo={null}
      onAnexoMudou={aoMudar}
      {...props}
    />
  );

  return { aoMudar, ...utilidades };
}

/** A zona de soltar é o próprio corpo do campo. */
function zonaDeSoltar() {
  return screen.getByTestId('zona-de-anexo');
}

function transferencia(arquivos) {
  return {
    files: arquivos,
    items: arquivos.map((item) => ({ kind: 'file', type: item.type })),
    types: ['Files'],
  };
}

beforeEach(() => {
  __resetarStorage();
  instalarCanvasFalso();
});

afterEach(() => restaurarCanvas());

describe('CampoAnexo — anexo por URL (AC-IMG-01)', () => {
  it('mantém o campo de link com o mesmo texto de antes', () => {
    montar();

    expect(screen.getByPlaceholderText('Cole o link da imagem')).toBeInTheDocument();
  });

  it('avisa o modal assim que a URL colada é um endereço válido', () => {
    const { aoMudar } = montar();

    userEvent.paste(
      screen.getByPlaceholderText('Cole o link da imagem'),
      'https://exemplo.br/erro.png'
    );

    expect(aoMudar).toHaveBeenLastCalledWith({
      url: 'https://exemplo.br/erro.png',
      origem: 'url',
    });
  });

  it('apagar o link tira o anexo, sem virar erro', () => {
    const { aoMudar } = montar();
    const campo = screen.getByPlaceholderText('Cole o link da imagem');

    userEvent.paste(campo, 'https://exemplo.br/erro.png');
    userEvent.clear(campo);

    expect(aoMudar).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('recusa um endereço que não é imagem e explica por quê', () => {
    const { aoMudar } = montar();

    userEvent.paste(screen.getByPlaceholderText('Cole o link da imagem'), 'o erro do vscode');

    expect(screen.getByRole('alert')).toHaveTextContent(/endereço/i);
    expect(aoMudar).toHaveBeenLastCalledWith(null);
  });
});

describe('CampoAnexo — anexo pelo seletor de arquivo (AC-IMG-02)', () => {
  it('sobe a imagem escolhida e devolve o anexo ao modal', async () => {
    const { aoMudar } = montar();

    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print());

    await waitFor(() =>
      expect(aoMudar).toHaveBeenLastCalledWith(
        expect.objectContaining({ origem: 'upload', largura: 800, altura: 600 })
      )
    );
    expect(__arquivosEnviados()).toHaveLength(1);
  });

  it('só aceita os quatro formatos no diálogo do sistema', () => {
    montar();

    expect(screen.getByLabelText(/imagem do computador/i)).toHaveAttribute(
      'accept',
      'image/png,image/jpeg,image/webp,image/gif'
    );
  });

  it('recusa um .exe renomeado sem subir byte nenhum (AC-SEC-08)', async () => {
    const { aoMudar } = montar();

    userEvent.upload(
      screen.getByLabelText(/imagem do computador/i),
      arquivo(EXE, 'print.png', 'image/png')
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/não é uma imagem/i)
    );
    expect(__arquivosEnviados()).toEqual([]);
    expect(aoMudar).not.toHaveBeenCalledWith(expect.objectContaining({ origem: 'upload' }));
  });
});

describe('CampoAnexo — arrastar e soltar (AC-IMG-03)', () => {
  it('sobe a imagem solta sobre o campo', async () => {
    const { aoMudar } = montar();

    fireEvent.drop(zonaDeSoltar(), { dataTransfer: transferencia([print()]) });

    await waitFor(() =>
      expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ origem: 'upload' }))
    );
  });

  it('o arquivo solto passa pela mesma validação do seletor', async () => {
    montar();

    fireEvent.drop(zonaDeSoltar(), {
      dataTransfer: transferencia([arquivo(EXE, 'print.png', 'image/png')]),
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/não é uma imagem/i)
    );
    expect(__arquivosEnviados()).toEqual([]);
  });

  it('avisa visualmente que o campo aceita o arquivo arrastado', () => {
    montar();

    fireEvent.dragOver(zonaDeSoltar(), { dataTransfer: transferencia([print()]) });

    expect(zonaDeSoltar()).toHaveClass('zona-de-anexo--recebendo');
  });

  it('desfaz o aviso quando o arquivo sai de cima do campo', () => {
    montar();

    fireEvent.dragOver(zonaDeSoltar(), { dataTransfer: transferencia([print()]) });
    fireEvent.dragLeave(zonaDeSoltar());

    expect(zonaDeSoltar()).not.toHaveClass('zona-de-anexo--recebendo');
  });
});

describe('CampoAnexo — colar (AC-IMG-04)', () => {
  it('sobe a captura de tela colada com Ctrl+V', async () => {
    const { aoMudar } = montar();
    const colado = print('imagem-colada.png');

    fireEvent.paste(document, {
      clipboardData: {
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => colado }],
        files: [colado],
      },
    });

    await waitFor(() =>
      expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ origem: 'upload' }))
    );
  });
});

describe('CampoAnexo — progresso e cancelamento (AC-IMG-08)', () => {
  beforeEach(() => __segurarUploads());

  it('mostra a barra de progresso enquanto sobe', async () => {
    montar();

    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print());

    const barra = await screen.findByRole('progressbar');
    __avancarUploads(0.5);
    await waitFor(() => expect(barra).toHaveAttribute('value', '50'));
  });

  it('oferece cancelar enquanto o envio está em andamento', async () => {
    montar();

    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print());

    expect(await screen.findByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('cancelar interrompe o envio e limpa o campo, sem fechar o modal', async () => {
    const { aoMudar } = montar();
    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print());

    userEvent.click(await screen.findByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(__arquivosEnviados()).toEqual([]);
    expect(aoMudar).not.toHaveBeenCalledWith(expect.objectContaining({ origem: 'upload' }));
    // O campo continua de pé: o aluno tenta de novo sem perder o formulário.
    expect(screen.getByLabelText(/imagem do computador/i)).toBeInTheDocument();
  });

  it('cancelar não deixa mensagem de erro — desistir não é falha', async () => {
    montar();
    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print());

    userEvent.click(await screen.findByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('depois de cancelar, dá para escolher outra imagem', async () => {
    const { aoMudar } = montar();
    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print('primeira.png'));
    userEvent.click(await screen.findByRole('button', { name: /cancelar/i }));
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());

    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print('segunda.png'));
    await screen.findByRole('progressbar');
    __concluirUploads();

    await waitFor(() =>
      expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ origem: 'upload' }))
    );
  });
});

describe('CampoAnexo — a falha de envio (AC-IMG-09)', () => {
  beforeEach(() => __segurarUploads());

  it('mostra um erro que diz o que fazer', async () => {
    montar();
    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print());
    await screen.findByRole('progressbar');

    __falharUploads('storage/retry-limit-exceeded');

    expect(await screen.findByRole('alert')).toHaveTextContent(/tente de novo/i);
  });

  it('a falha some quando o aluno escolhe outra imagem', async () => {
    montar();
    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print('primeira.png'));
    await screen.findByRole('progressbar');
    __falharUploads('storage/retry-limit-exceeded');
    await screen.findByRole('alert');

    userEvent.upload(screen.getByLabelText(/imagem do computador/i), print('segunda.png'));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('CampoAnexo — a pré-visualização', () => {
  it('mostra a miniatura do anexo já enviado', () => {
    montar({
      anexo: { url: 'https://fake.storage/a.png', origem: 'upload', caminho: 'a.png' },
    });

    expect(screen.getByRole('img', { name: /pré-visualização/i })).toHaveAttribute(
      'src',
      'https://fake.storage/a.png'
    );
  });

  it('remover tira o anexo do formulário e o arquivo do Storage', async () => {
    __semearArquivos(['salas/sala-3b/chamados/chamado-1/a.png']);
    const { aoMudar } = montar({
      anexo: {
        url: 'https://fake.storage/salas/sala-3b/chamados/chamado-1/a.png',
        caminho: 'salas/sala-3b/chamados/chamado-1/a.png',
        origem: 'upload',
      },
    });

    userEvent.click(screen.getByRole('button', { name: /remover/i }));

    expect(aoMudar).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(__arquivosEnviados()).toEqual([]));
  });

  it('remover um anexo por URL não tenta apagar nada do Storage', async () => {
    __semearArquivos(['salas/sala-3b/chamados/chamado-1/de-outra-pessoa.png']);
    montar({ anexo: { url: 'https://exemplo.br/erro.png', origem: 'url' } });

    userEvent.click(screen.getByRole('button', { name: /remover/i }));

    await waitFor(() =>
      expect(__arquivosEnviados()).toEqual([
        'salas/sala-3b/chamados/chamado-1/de-outra-pessoa.png',
      ])
    );
  });

  it('a URL externa que não carrega vira aviso, não ícone quebrado (AC-IMG-12)', () => {
    montar({ anexo: { url: 'https://fora-do-ar.br/erro.png', origem: 'url' } });

    fireEvent.error(screen.getByRole('img', { name: /pré-visualização/i }));

    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
  });
});

describe('CampoAnexo — sala arquivada', () => {
  it('desliga as três entradas quando o campo está desabilitado', () => {
    montar({ desabilitado: true });

    expect(screen.getByLabelText(/imagem do computador/i)).toBeDisabled();
    expect(screen.getByPlaceholderText('Cole o link da imagem')).toBeDisabled();
  });

  it('não aceita arquivo solto quando está desabilitado', async () => {
    montar({ desabilitado: true });

    fireEvent.drop(zonaDeSoltar(), { dataTransfer: transferencia([print()]) });

    await waitFor(() => expect(__arquivosEnviados()).toEqual([]));
  });
});
