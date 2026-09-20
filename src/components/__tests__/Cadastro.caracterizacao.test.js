// Caracterização do cadastro — AC-AUTH-01 [REG].
//
// Este arquivo nasceu na task 00 registrando uma lacuna: o AC-AUTH-01 exige
// `criadoEm` no documento de `usuarios/{uid}`, e a v0.2.0 não gravava o campo.
// A task 01 fecha a lacuna, então as duas asserções que a descreviam foram
// invertidas de propósito — de "ainda NÃO grava" para "grava, e com o relógio
// do servidor". Nenhum caso foi removido: o que era aviso virou garantia.
//
// `criadoEm` e `provedor` são campos aditivos. Os testes de compatibilidade
// futura em `src/__tests__/compatibilidadeFutura.test.js` provam que um leitor
// que os ignore continua enxergando `nome`, `email`, `tipo` e `uid`.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as firebaseAuth from 'firebase/auth';
import { __registrarCredencial, __resetarAuth } from 'firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  query,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
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
  // Um instante que nenhuma máquina rodando este teste produziria: é assim
  // que a asserção distingue o relógio do servidor do relógio local.
  __definirRelogioDoServidor('2020-01-01T00:00:00.000Z');
  mockNavegar.mockClear();
  avisos = jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
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
  it('cria o documento em usuarios/{uid} com nome, email, tipo, uid e criadoEm', async () => {
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Ana Souza', email: 'ana@senai.br', senha: 'senha123' });
    enviar();

    await waitFor(async () => expect(await usuariosGravados()).toHaveLength(1));
    __confirmarCarimbos();

    expect(await usuariosGravados()).toEqual([
      {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'aluno',
        uid: expect.any(String),
        criadoEm: expect.anything(),
        provedor: 'password',
      },
    ]);
  });

  it('grava criadoEm com o relógio do servidor, não com o da máquina do laboratório', async () => {
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Ana Souza', email: 'ana@senai.br', senha: 'senha123' });
    enviar();

    await waitFor(async () => expect(await usuariosGravados()).toHaveLength(1));

    // Fase 1 da escrita otimista: o campo chega vazio, como no SDK real.
    expect((await usuariosGravados())[0].criadoEm).toBeNull();

    // Fase 2: o servidor responde com o instante dele.
    __confirmarCarimbos();

    const [usuario] = await usuariosGravados();
    // As máquinas do laboratório têm o relógio frequentemente errado; gravar
    // `new Date()` daqui produziria uma data de cadastro inventada. A data
    // abaixo é a do relógio do servidor — nenhuma máquina a produziria hoje.
    expect(usuario.criadoEm.toDate()).toEqual(new Date('2020-01-01T00:00:00.000Z'));
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

describe('Cadastro — erros do Firebase traduzidos (AC-AUTH-05)', () => {
  /** Força o Firebase a recusar o cadastro com o código pedido. */
  function recusarCadastroCom(code, message) {
    const erro = new Error(message);
    erro.code = code;
    jest.spyOn(firebaseAuth, 'createUserWithEmailAndPassword').mockRejectedValue(erro);
  }

  it('avisa quando o e-mail já está em uso', async () => {
    __registrarCredencial('ana@senai.br', 'senha123');
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Outra Ana', email: 'ana@senai.br', senha: 'senha456' });
    enviar();

    expect(
      await screen.findByText('Este e-mail já está em uso. Entre com ele ou cadastre-se com outro.')
    ).toBeInTheDocument();
    expect(mockNavegar).not.toHaveBeenCalled();
  });

  it('reabilita o botão depois do erro, sem perder o que já foi digitado', async () => {
    __registrarCredencial('ana@senai.br', 'senha123');
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Outra Ana', email: 'ana@senai.br', senha: 'senha456' });
    enviar();

    await screen.findByText(
      'Este e-mail já está em uso. Entre com ele ou cadastre-se com outro.'
    );
    expect(screen.getByRole('button', { name: 'Cadastrar' })).toBeEnabled();
    expect(screen.getByLabelText('Nome')).toHaveValue('Outra Ana');
  });

  it('explica em português como vincular a conta já criada por outro método', async () => {
    recusarCadastroCom(
      'auth/account-exists-with-different-credential',
      'Firebase: Error (auth/account-exists-with-different-credential).'
    );
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Ana Souza', email: 'ana@senai.br', senha: 'senha123' });
    enviar();

    const aviso = await screen.findByText(/já está cadastrado por outro método de login/);
    expect(aviso).toBeInTheDocument();
  });

  it('nunca mostra o código nem a mensagem crua do Firebase', async () => {
    // Código que o tradutor não conhece: é justamente aqui que a v0.2.0
    // despejava `error.message` na tela do aluno.
    recusarCadastroCom(
      'auth/tenant-id-mismatch',
      'Firebase: Error (auth/tenant-id-mismatch).'
    );
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Ana Souza', email: 'ana@senai.br', senha: 'senha123' });
    enviar();

    const aviso = await screen.findByText(
      'Não foi possível concluir a operação. Tente novamente em instantes.'
    );
    expect(aviso).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/auth\//);
    expect(document.body.textContent).not.toMatch(/Firebase/);
  });
});

describe('Cadastro — sem alert bloqueando a aba (AC-AUTH-05)', () => {
  it('confirma o cadastro levando para a tela, e não com um alert', async () => {
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Ana Souza', email: 'ana@senai.br', senha: 'senha123' });
    enviar();

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/aluno'));
    expect(avisos).not.toHaveBeenCalled();
  });

  it('não usa alert nem para anunciar o erro', async () => {
    __registrarCredencial('ana@senai.br', 'senha123');
    renderComProvedores(<Cadastro />);

    preencher({ nome: 'Outra Ana', email: 'ana@senai.br', senha: 'senha456' });
    enviar();

    await screen.findByText(
      'Este e-mail já está em uso. Entre com ele ou cadastre-se com outro.'
    );
    expect(avisos).not.toHaveBeenCalled();
  });
});
