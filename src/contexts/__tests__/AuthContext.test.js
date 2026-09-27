// O provider único de autenticação.
//
// Substitui as três implementações concorrentes da v0.2.0 (`App.js`,
// `AuthContext.js` órfão e o listener solto de `firebase.js`). O contrato que
// os componentes passam a enxergar é só este.
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  __definirUsuarioAtual,
  __definirUsuarioDoPopup,
  __registrarCredencial,
  __resetarAuth,
} from 'firebase/auth';
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import { AuthProvider, useAuth } from '../AuthContext';
import { __esquecerPersistencia } from '../../services/auth';

const ANA = {
  uid: 'uid-ana',
  email: 'ana@senai.br',
  displayName: 'Ana Souza',
  providerData: [{ providerId: 'google.com' }],
};

const CARLOS = {
  uid: 'uid-carlos',
  email: 'carlos@senai.br',
  displayName: 'Carlos Lima',
  providerData: [{ providerId: 'password' }],
};

/** Sonda: expõe o contexto inteiro como texto, e os logins como botões. */
function Sonda() {
  const {
    usuario,
    papel,
    carregando,
    erro,
    entrarComEmail,
    entrarComGoogle,
    entrarComGithub,
    sair,
  } = useAuth();

  return (
    <div>
      <p data-testid="carregando">{String(carregando)}</p>
      <p data-testid="papel">{papel === null || papel === undefined ? 'sem papel' : papel}</p>
      <p data-testid="email">{usuario ? usuario.email : 'sem sessão'}</p>
      <p data-testid="erro">{erro || 'sem erro'}</p>
      <button onClick={() => entrarComEmail('ana@senai.br', 'senha123')}>Entrar</button>
      <button onClick={entrarComGoogle}>Google</button>
      <button onClick={entrarComGithub}>GitHub</button>
      <button onClick={sair}>Sair</button>
    </div>
  );
}

function montar() {
  return render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>
  );
}

/** Espera o provider terminar de resolver o papel. */
async function aguardarResolucao() {
  await waitFor(() => expect(screen.getByTestId('carregando')).toHaveTextContent('false'));
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __esquecerPersistencia();
  localStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

describe('carregando enquanto o papel não está resolvido (AC-AUTH-09)', () => {
  it('começa carregando, antes de qualquer resposta do Firestore', () => {
    __definirUsuarioAtual(ANA);

    montar();

    // Síncrono, logo após o render: o papel ainda depende de uma ida ao
    // Firestore. Enquanto isso, ninguém pode ser tratado como aluno.
    expect(screen.getByTestId('carregando')).toHaveTextContent('true');
    expect(screen.getByTestId('papel')).toHaveTextContent('sem papel');
  });

  it('sai do carregamento só depois de ter papel', async () => {
    __definirUsuarioAtual(ANA);

    montar();
    await aguardarResolucao();

    expect(screen.getByTestId('papel')).toHaveTextContent('aluno');
  });

  it('sem sessão, termina o carregamento sem papel nenhum', async () => {
    montar();
    await aguardarResolucao();

    expect(screen.getByTestId('email')).toHaveTextContent('sem sessão');
    expect(screen.getByTestId('papel')).toHaveTextContent('sem papel');
  });
});

describe('papel vindo do Firestore (AC-AUTH-06)', () => {
  it('entrega professor quando usuarios e autorizados concordam', async () => {
    __semearColecao('usuarios', [
      { id: 'uid-carlos', uid: 'uid-carlos', email: 'carlos@senai.br', tipo: 'professor' },
    ]);
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);
    __definirUsuarioAtual(CARLOS);

    montar();
    await aguardarResolucao();

    expect(screen.getByTestId('papel')).toHaveTextContent('professor');
  });

  it('localStorage com tipoUsuario=professor não muda o papel', async () => {
    localStorage.setItem('tipoUsuario', 'professor');
    localStorage.setItem('usuarioLogado', JSON.stringify({ tipo: 'professor' }));
    __definirUsuarioAtual(ANA);

    montar();
    await aguardarResolucao();

    expect(screen.getByTestId('papel')).toHaveTextContent('aluno');
  });

  it('nunca grava o papel no localStorage', async () => {
    __definirUsuarioAtual(ANA);

    montar();
    await aguardarResolucao();

    expect(localStorage.getItem('tipoUsuario')).toBeNull();
    expect(localStorage.getItem('usuarioLogado')).toBeNull();
  });
});

describe('falha ao resolver o papel (regra 4 do desenho)', () => {
  it('não assume papel e expõe erro em português', async () => {
    const firestore = require('firebase/firestore');
    jest.spyOn(firestore, 'getDoc').mockRejectedValue(new Error('rede caiu'));
    __definirUsuarioAtual(ANA);

    montar();
    await aguardarResolucao();

    expect(screen.getByTestId('papel')).toHaveTextContent('sem papel');
    expect(screen.getByTestId('erro')).not.toHaveTextContent('sem erro');
    expect(screen.getByTestId('erro')).not.toHaveTextContent('rede caiu');
  });
});

describe('sessão restaurada ao remontar, sem nova autenticação (AC-SESSAO-01)', () => {
  it('a segunda montagem já encontra a sessão, sem chamar login de novo', async () => {
    const firebaseAuth = require('firebase/auth');
    __definirUsuarioAtual(ANA);

    const { unmount } = montar();
    await aguardarResolucao();
    unmount();

    const popup = jest.spyOn(firebaseAuth, 'signInWithPopup');
    montar();
    await aguardarResolucao();

    expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br');
    expect(popup).not.toHaveBeenCalled();
  });

  it('cancela o listener ao desmontar, sem vazar inscrição (AC-PERF-04)', async () => {
    const firebaseAuth = require('firebase/auth');
    const cancelar = jest.fn();
    jest.spyOn(firebaseAuth, 'onAuthStateChanged').mockReturnValue(cancelar);

    const { unmount } = montar();
    unmount();

    expect(cancelar).toHaveBeenCalled();
  });
});

describe('login pelo contexto', () => {
  it('o Google autentica e resolve o papel', async () => {
    __definirUsuarioDoPopup(ANA);
    montar();
    await aguardarResolucao();

    await userEvent.click(screen.getByRole('button', { name: 'Google' }));

    await waitFor(() => expect(screen.getByTestId('papel')).toHaveTextContent('aluno'));
    expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br');
  });

  it('o GitHub segue o mesmo caminho', async () => {
    __definirUsuarioDoPopup({ ...ANA, providerData: [{ providerId: 'github.com' }] });
    montar();
    await aguardarResolucao();

    await userEvent.click(screen.getByRole('button', { name: 'GitHub' }));

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br'));
  });

  it('o e-mail e senha autentica pelo contexto', async () => {
    __registrarCredencial('ana@senai.br', 'senha123', { uid: 'uid-ana' });
    montar();
    await aguardarResolucao();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('ana@senai.br'));
  });

  it('a falha vira mensagem em português no contexto, sem alert', async () => {
    const alerta = jest.spyOn(window, 'alert').mockImplementation(() => {});
    __definirUsuarioDoPopup(null);
    montar();
    await aguardarResolucao();

    await userEvent.click(screen.getByRole('button', { name: 'Google' }));

    await waitFor(() =>
      expect(screen.getByTestId('erro')).toHaveTextContent('A janela de login foi fechada')
    );
    expect(alerta).not.toHaveBeenCalled();
  });
});

describe('sair limpa Firebase e todo estado local (AC-AUTH-08)', () => {
  it('encerra a sessão e zera usuário e papel', async () => {
    __definirUsuarioAtual(ANA);
    montar();
    await aguardarResolucao();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('sem sessão'));
    expect(screen.getByTestId('papel')).toHaveTextContent('sem papel');
  });

  it('apaga as chaves que a v0.2.0 deixava para trás', async () => {
    __definirUsuarioAtual(ANA);
    montar();
    await aguardarResolucao();

    // Resquício de uma sessão anterior, gravado pela versão antiga.
    localStorage.setItem('usuarioLogado', JSON.stringify({ nome: 'Ana', tipo: 'professor' }));
    localStorage.setItem('tipoUsuario', 'professor');

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(localStorage.getItem('usuarioLogado')).toBeNull());
    expect(localStorage.getItem('tipoUsuario')).toBeNull();
  });
});

describe('useAuth fora do provider', () => {
  it('falha alto, em vez de devolver undefined e quebrar longe daqui', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Sonda />)).toThrow('AuthProvider');
  });
});

describe('resquícios da versão anterior na montagem', () => {
  it('ignora usuarioLogado gravado pela v0.2.0 e não o trata como sessão', async () => {
    localStorage.setItem(
      'usuarioLogado',
      JSON.stringify({ nome: 'Ana', tipo: 'professor', email: 'ana@senai.br' })
    );

    await act(async () => {
      montar();
    });
    await aguardarResolucao();

    expect(screen.getByTestId('email')).toHaveTextContent('sem sessão');
    expect(screen.getByTestId('papel')).toHaveTextContent('sem papel');
  });
});
