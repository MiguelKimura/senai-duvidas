// O botão "Sair" — AC-SESSAO-05 e AC-AUTH-08.
//
// As máquinas do laboratório são compartilhadas: a turma da manhã sai e a da
// tarde senta na mesma cadeira. Com `browserLocalPersistence`, a sessão
// sobrevive ao logoff do Windows — então sair precisa ser uma ação visível em
// toda tela autenticada, não algo escondido.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import { __resetarFirestore } from 'firebase/firestore';
import BotaoSair from '../BotaoSair';
import { renderComProvedores } from '../../test-utils';

const ANA = {
  uid: 'uid-ana',
  email: 'ana@senai.br',
  displayName: 'Ana Souza',
  providerData: [{ providerId: 'google.com' }],
};

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  localStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

describe('BotaoSair', () => {
  it('é um botão de verdade, alcançável por teclado e por leitor de tela', () => {
    renderComProvedores(<BotaoSair />);

    const botao = screen.getByRole('button', { name: 'Sair' });
    expect(botao).toHaveAttribute('type', 'button');
  });

  it('encerra a sessão do Firebase ao ser clicado', async () => {
    __definirUsuarioAtual(ANA);
    const firebaseAuth = require('firebase/auth');
    const encerrar = jest.spyOn(firebaseAuth, 'signOut');
    renderComProvedores(<BotaoSair />);

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(encerrar).toHaveBeenCalled());
  });

  it('apaga as chaves de sessão que a versão anterior deixava na máquina', async () => {
    __definirUsuarioAtual(ANA);
    localStorage.setItem('usuarioLogado', JSON.stringify({ tipo: 'professor' }));
    localStorage.setItem('tipoUsuario', 'professor');
    renderComProvedores(<BotaoSair />);

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(localStorage.getItem('usuarioLogado')).toBeNull());
    expect(localStorage.getItem('tipoUsuario')).toBeNull();
  });
});
