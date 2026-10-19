// O campo de digitação — AC-CHAT-09, AC-CHAT-11.
//
// O campo da v0.7.0 é um `<input type="text">` sem `maxLength`, sem contador e
// sem nenhuma noção de tamanho. A rule do Firestore recusa acima de 500
// caracteres — então hoje, quem cola um texto longo escreve, clica em enviar e
// vê a mensagem sumir sem explicação nenhuma.
//
// O contador não aparece o tempo todo de propósito. Um número piscando ao lado
// de toda frase é ruído: ninguém escreve 500 caracteres num chat de sala por
// acidente. Ele entra quando o limite deixa de ser teórico.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampoMensagem from '../CampoMensagem';
import { TAMANHO_MAXIMO_DA_MENSAGEM } from '../../../services/chat';

function campo() {
  return screen.getByPlaceholderText('Escreva uma mensagem');
}

function botaoEnviar() {
  return screen.getByRole('button', { name: /enviar/i });
}

/** Um texto de `tamanho` caracteres, para exercitar o limite. */
function textoDe(tamanho) {
  return 'a'.repeat(tamanho);
}

describe('CampoMensagem — envio', () => {
  it('entrega o texto a quem sabe enviar', async () => {
    const aoEnviar = jest.fn();
    render(<CampoMensagem aoEnviar={aoEnviar} />);

    await userEvent.type(campo(), 'Bom dia');
    await userEvent.click(botaoEnviar());

    expect(aoEnviar).toHaveBeenCalledWith('Bom dia');
  });

  it('envia com Enter', async () => {
    const aoEnviar = jest.fn();
    render(<CampoMensagem aoEnviar={aoEnviar} />);

    await userEvent.type(campo(), 'Enviado com Enter{Enter}');

    expect(aoEnviar).toHaveBeenCalledWith('Enviado com Enter');
  });

  it('Shift+Enter não envia: é quebra de linha', async () => {
    const aoEnviar = jest.fn();
    render(<CampoMensagem aoEnviar={aoEnviar} />);

    await userEvent.type(campo(), 'primeira linha{Shift>}{Enter}{/Shift}');

    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it('limpa o campo depois de enviar', async () => {
    render(<CampoMensagem aoEnviar={jest.fn()} />);

    await userEvent.type(campo(), 'Bom dia');
    await userEvent.click(botaoEnviar());

    // O envio virou assíncrono nesta versão — e precisava virar: é o `await`
    // que permite manter o texto no campo quando a escrita falha.
    await waitFor(() => expect(campo()).toHaveValue(''));
  });

  it('não envia mensagem vazia nem só com espaços', async () => {
    const aoEnviar = jest.fn();
    render(<CampoMensagem aoEnviar={aoEnviar} />);

    await userEvent.type(campo(), '    ');
    await userEvent.click(botaoEnviar());

    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it('mantém o texto no campo quando o envio falha, para não perder a mensagem', async () => {
    const aoEnviar = jest.fn(() => Promise.reject(new Error('rede caiu')));
    render(<CampoMensagem aoEnviar={aoEnviar} />);

    await userEvent.type(campo(), 'Consegui rodar aqui');
    await userEvent.click(botaoEnviar());

    expect(campo()).toHaveValue('Consegui rodar aqui');
  });
});

describe('CampoMensagem — o limite de 500 caracteres (AC-CHAT-09)', () => {
  it('não mostra contador enquanto o limite é teórico', async () => {
    render(<CampoMensagem aoEnviar={jest.fn()} />);

    await userEvent.type(campo(), 'Bom dia');

    expect(document.querySelector('.campo-mensagem-contador')).toBeNull();
  });

  it('mostra o contador ao se aproximar do limite', () => {
    render(<CampoMensagem aoEnviar={jest.fn()} valorInicial={textoDe(430)} />);

    expect(screen.getByText(`430/${TAMANHO_MAXIMO_DA_MENSAGEM}`)).toBeInTheDocument();
  });

  it('o contador acompanha o que está escrito', async () => {
    render(<CampoMensagem aoEnviar={jest.fn()} valorInicial={textoDe(430)} />);

    await userEvent.type(campo(), 'aaaaa');

    expect(screen.getByText(`435/${TAMANHO_MAXIMO_DA_MENSAGEM}`)).toBeInTheDocument();
  });

  it('o campo não aceita mais que 500 caracteres digitados', async () => {
    render(<CampoMensagem aoEnviar={jest.fn()} valorInicial={textoDe(499)} />);

    await userEvent.type(campo(), 'bbbb');

    expect(campo().value).toHaveLength(TAMANHO_MAXIMO_DA_MENSAGEM);
  });

  it('texto colado acima do limite é cortado, não descartado em silêncio', async () => {
    render(<CampoMensagem aoEnviar={jest.fn()} />);

    await userEvent.paste(campo(), textoDe(600));

    expect(campo().value).toHaveLength(TAMANHO_MAXIMO_DA_MENSAGEM);
    expect(screen.getByText(`500/${TAMANHO_MAXIMO_DA_MENSAGEM}`)).toBeInTheDocument();
  });

  it('avisa que chegou ao limite, em vez de só parar de aceitar letra', async () => {
    render(<CampoMensagem aoEnviar={jest.fn()} valorInicial={textoDe(500)} />);

    expect(document.querySelector('.campo-mensagem-contador')).toHaveClass(
      'campo-mensagem-contador--no-limite'
    );
  });
});

describe('CampoMensagem — somente leitura', () => {
  it('não deixa escrever em sala arquivada', () => {
    render(<CampoMensagem aoEnviar={jest.fn()} somenteLeitura />);

    expect(campo()).toBeDisabled();
    expect(botaoEnviar()).toBeDisabled();
  });

  it('explica por que o campo está fechado', () => {
    render(<CampoMensagem aoEnviar={jest.fn()} somenteLeitura />);

    expect(screen.getByText(/arquivada/i)).toBeInTheDocument();
  });
});

describe('CampoMensagem — erro do envio', () => {
  it('mostra a recusa em português, vinda de quem enviou', async () => {
    const aoEnviar = jest.fn(() =>
      Promise.reject(new Error('O comando !clear é do professor.'))
    );
    render(<CampoMensagem aoEnviar={aoEnviar} />);

    await userEvent.type(campo(), '!clear');
    await userEvent.click(botaoEnviar());

    expect(await screen.findByRole('alert')).toHaveTextContent(/professor/i);
  });

  it('a recusa some assim que a pessoa volta a digitar', async () => {
    const aoEnviar = jest.fn(() => Promise.reject(new Error('deu ruim')));
    render(<CampoMensagem aoEnviar={aoEnviar} />);
    await userEvent.type(campo(), '!clear');
    await userEvent.click(botaoEnviar());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.type(campo(), 'x');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('CampoMensagem — indicador de digitando (AC-CHAT-11)', () => {
  it('avisa que a pessoa está digitando', async () => {
    const aoDigitar = jest.fn();
    render(<CampoMensagem aoEnviar={jest.fn()} aoDigitar={aoDigitar} />);

    await userEvent.type(campo(), 'Bo');

    expect(aoDigitar).toHaveBeenCalled();
  });

  it('avisa que parou ao enviar, para o indicador não ficar aceso', async () => {
    const aoDigitar = jest.fn();
    render(<CampoMensagem aoEnviar={jest.fn()} aoDigitar={aoDigitar} />);

    await userEvent.type(campo(), 'Bom dia{Enter}');

    expect(aoDigitar).toHaveBeenLastCalledWith(false);
  });

  it('funciona sem ninguém ouvindo: o aviso é opcional', async () => {
    render(<CampoMensagem aoEnviar={jest.fn()} />);

    await userEvent.type(campo(), 'Bom dia');

    expect(campo()).toHaveValue('Bom dia');
  });
});
