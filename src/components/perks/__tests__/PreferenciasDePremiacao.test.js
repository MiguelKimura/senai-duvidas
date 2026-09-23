// As preferências de premiação — AC-PERK-08.
//
// O AC pede que a animação "possa ser desativada nas preferências". Isso é
// metade do critério; a outra metade é o som, que a task manda nascer
// **desligado** e só ligar por escolha explícita.
//
// A razão é de sala de aula, não de gosto: são 40 pessoas e um projetor, e um
// áudio que toca sozinho no primeiro carregamento é uma aula interrompida. O
// padrão seguro já está provado em `services/perfilUsuario`; o que falta é o
// lugar onde o aluno muda de ideia.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  __documentosDe,
  __recusarEscritaEm,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import PreferenciasDePremiacao from '../PreferenciasDePremiacao';
import { useAuth } from '../../../contexts/AuthContext';
import { renderComProvedores } from '../../../test-utils';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

/** O documento `usuarios/{uid}` como a v0.8.0 o gravou: sem `preferencias`. */
function semearPerfil(preferencias) {
  __semearColecao('usuarios', [
    {
      id: ANA.uid,
      uid: ANA.uid,
      nome: 'Ana Souza',
      email: ANA.email,
      tipo: 'aluno',
      ...(preferencias ? { preferencias } : {}),
    },
  ]);
}

const daAnimacao = () => screen.getByRole('checkbox', { name: /animação/i });
const doSom = () => screen.getByRole('checkbox', { name: /som/i });

/** As preferências que ficaram gravadas em `usuarios/{uid}`. */
function preferenciasGravadas() {
  const [documento] = __documentosDe('usuarios');
  return documento.preferencias;
}

/**
 * Diz quando a sessão terminou de resolver.
 *
 * Entre o `onAuthStateChanged` e o fim de `garantirPerfil` existe uma ida ao
 * Firestore, e até ela voltar o componente mostra o padrão seguro. Sem esta
 * espera, "respeita o que já estava gravado" leria a tela antes de o perfil
 * chegar — e passaria ou falharia conforme a máquina que roda a suíte.
 */
function Sonda() {
  const { carregando } = useAuth();

  return <span data-testid="sessao">{carregando ? 'carregando' : 'pronta'}</span>;
}

async function renderizar() {
  renderComProvedores(
    <>
      <Sonda />
      <PreferenciasDePremiacao />
    </>
  );

  await waitFor(() => expect(screen.getByTestId('sessao')).toHaveTextContent('pronta'));
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirUsuarioAtual(ANA);
});

describe('PreferenciasDePremiacao — o padrão seguro (AC-PERK-08)', () => {
  it('nasce com a animação ligada: ela é o requisito do cliente, não um enfeite', async () => {
    semearPerfil();
    await renderizar();

    expect(daAnimacao()).toBeChecked();
  });

  it('nasce com o som desligado, mesmo num perfil da v0.8.0 sem preferências', async () => {
    semearPerfil();
    await renderizar();

    expect(doSom()).not.toBeChecked();
  });

  it('respeita o que já estava gravado no perfil', async () => {
    semearPerfil({ animacoes: false, som: true });
    await renderizar();

    expect(daAnimacao()).not.toBeChecked();
    expect(doSom()).toBeChecked();
  });
});

describe('PreferenciasDePremiacao — a mudança de ideia (AC-PERK-08)', () => {
  it('desliga a animação e grava a escolha no perfil', async () => {
    semearPerfil();
    await renderizar();

    await userEvent.click(daAnimacao());

    await waitFor(() => expect(preferenciasGravadas()).toEqual({ animacoes: false, som: false }));
    expect(daAnimacao()).not.toBeChecked();
  });

  it('liga o som só quando o aluno pede, e grava a escolha', async () => {
    semearPerfil();
    await renderizar();

    await userEvent.click(doSom());

    await waitFor(() => expect(preferenciasGravadas()).toEqual({ animacoes: true, som: true }));
  });

  it('não toca no resto do documento do usuário ao gravar (AC-SEC-03)', async () => {
    semearPerfil();
    await renderizar();

    await userEvent.click(doSom());

    await waitFor(() => expect(preferenciasGravadas().som).toBe(true));

    const [documento] = __documentosDe('usuarios');
    expect(documento.tipo).toBe('aluno');
    expect(documento.nome).toBe('Ana Souza');
  });

  it('a recusa do servidor não trava a tela: a caixa volta ao valor gravado', async () => {
    semearPerfil();
    await renderizar();

    __recusarEscritaEm(`usuarios/${ANA.uid}`);

    await userEvent.click(doSom());

    await waitFor(() => expect(doSom()).not.toBeChecked());
    expect(screen.getByRole('status')).toHaveTextContent(/não foi possível/i);
  });
});
