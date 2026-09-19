// Caracterização do cadastro — AC-AUTH-01 [REG].
//
// Atenção ao que este arquivo NÃO afirma: o AC-AUTH-01 exige que o documento
// criado em `usuarios/{uid}` tenha `criadoEm`, e a v0.1.0 não grava esse campo.
// O teste abaixo fixa a forma realmente gravada hoje (nome, email, tipo, uid) e
// marca a lacuna — quem fechar o AC-AUTH-01 (task 01) vai ver este teste falhar
// ao acrescentar `criadoEm`, que é exatamente o aviso que se quer dar.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __registrarCredencial, __resetarAuth } from 'firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  query,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import Cadastro from '../Cadastro';
import { renderComProvedores } from '../../test-utils';

const mockNavegar = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavegar,
}));

const db = getFirestore();
let avisos;

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  mockNavegar.mockClear();
  avisos = jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  avisos.mockRestore();
});

async function usuariosGravados() {
  const snapshot = await getDocs(query(collection(db, 'usuarios')));
  return snapshot.docs.map((documento) => documento.data());
}

function preencher({ nome, email, senha, tipo }) {
  userEvent.type(screen.getByLabelText('Nome'), nome);
  userEvent.type(screen.getByLabelText('E-mail'), email);
  userEvent.type(screen.getByLabelText('Senha'), senha);

  if (tipo) {
    userEvent.selectOptions(screen.getByLabelText('Tipo'), tipo);
  }
}

function enviar() {
  userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));
}

describe('Cadastro de aluno (AC-AUTH-01)', () => {
  it('cria o documento em usuarios/{uid} com nome, email, tipo e uid', async () => {
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Ana Souza', email: 'ana@senai.br', senha: 'senha123' });
    enviar();

    await waitFor(async () => {
      expect(await usuariosGravados()).toEqual([
        {
          nome: 'Ana Souza',
          email: 'ana@senai.br',
          tipo: 'aluno',
          uid: expect.any(String),
        },
      ]);
    });
  });

  it('ainda NÃO grava criadoEm — lacuna conhecida do AC-AUTH-01, a fechar na task 01', async () => {
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Ana Souza', email: 'ana@senai.br', senha: 'senha123' });
    enviar();

    await waitFor(async () => expect(await usuariosGravados()).toHaveLength(1));
    const [usuario] = await usuariosGravados();
    expect(usuario).not.toHaveProperty('criadoEm');
  });

  it('leva o aluno para /aluno depois de cadastrar', async () => {
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Ana Souza', email: 'ana@senai.br', senha: 'senha123' });
    enviar();

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno'));
  });
});

describe('Cadastro de professor (AC-AUTH-07)', () => {
  it('barra quem não está em autorizados e não cria usuário nenhum', async () => {
    renderComProvedores(<Cadastro />);

    preencher({
      nome: 'Falso Professor',
      email: 'intruso@senai.br',
      senha: 'senha123',
      tipo: 'professor',
    });
    enviar();

    expect(
      await screen.findByText(
        'Apenas usuários autorizados podem se cadastrar como professores.'
      )
    ).toBeInTheDocument();
    expect(await usuariosGravados()).toHaveLength(0);
    expect(mockNavegar).not.toHaveBeenCalled();
  });

  it('deixa passar quem está em autorizados/{email} com Tipo professor', async () => {
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'Professor' }]);
    renderComProvedores(<Cadastro />);

    preencher({
      nome: 'Carlos Lima',
      email: 'carlos@senai.br',
      senha: 'senha123',
      tipo: 'professor',
    });
    enviar();

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/professor'));
    expect(await usuariosGravados()).toEqual([
      expect.objectContaining({ tipo: 'professor', email: 'carlos@senai.br' }),
    ]);
  });

  it('barra quem está em autorizados mas com Tipo diferente de professor', async () => {
    __semearColecao('autorizados', [{ id: 'monitor@senai.br', Tipo: 'monitor' }]);
    renderComProvedores(<Cadastro />);

    preencher({
      nome: 'Monitor',
      email: 'monitor@senai.br',
      senha: 'senha123',
      tipo: 'professor',
    });
    enviar();

    expect(
      await screen.findByText(
        'Apenas usuários autorizados podem se cadastrar como professores.'
      )
    ).toBeInTheDocument();
  });
});

describe('Cadastro — erros do Firebase traduzidos', () => {
  it('avisa quando o e-mail já está em uso', async () => {
    __registrarCredencial('ana@senai.br', 'senha123');
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Outra Ana', email: 'ana@senai.br', senha: 'senha456' });
    enviar();

    expect(
      await screen.findByText('Este e-mail já está em uso. Tente um e-mail diferente.')
    ).toBeInTheDocument();
    expect(mockNavegar).not.toHaveBeenCalled();
  });

  it('reabilita o botão depois do erro, sem perder o que já foi digitado', async () => {
    __registrarCredencial('ana@senai.br', 'senha123');
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Outra Ana', email: 'ana@senai.br', senha: 'senha456' });
    enviar();

    await screen.findByText('Este e-mail já está em uso. Tente um e-mail diferente.');
    expect(screen.getByRole('button', { name: 'Cadastrar' })).toBeEnabled();
    expect(screen.getByLabelText('Nome')).toHaveValue('Outra Ana');
  });
});
