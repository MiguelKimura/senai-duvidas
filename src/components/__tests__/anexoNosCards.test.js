// O anexo dentro do card — AC-IMG-10, AC-IMG-12, AC-IMG-13, AC-CHAMADO-08.
//
// Três coisas mudam no card, e as três têm a mesma origem: o olho 👁️ que
// chamava `window.open`.
//
//   1. **Miniatura.** O professor olha a fila e vê de relance quais chamados
//      têm print. Antes, o olho não dizia nada sobre o que havia dentro.
//   2. **Lightbox.** `window.open` é bloqueado por padrão em parte dos
//      laboratórios: o aluno clicava e nada acontecia, sem aviso nenhum.
//   3. **Placeholder.** URL externa fora do ar virava o ícone quebrado do
//      navegador, que não explica nada a ninguém.
//
// E o card lê os **dois** formatos do campo de anexo, permanentemente nesta
// versão: `imagem` em string (v0.1.0) e `anexo` em objeto (v0.6.0).
import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import { __resetarFirestore, __semearColecao, __documentosDe } from 'firebase/firestore';
import { __arquivosEnviados, __resetarStorage, __semearArquivos } from 'firebase/storage';
import TelaAluno from '../TelaAluno';
import TelaProfessor from '../TelaProfessor';
import { renderComProvedores } from '../../test-utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

/** O chamado como a v0.1.0 o gravou: `imagem` é string de URL, e só. */
const CHAMADO_ANTIGO = {
  id: 'antigo',
  nome: 'Bruno',
  email: 'bruno@senai.br',
  descricao: 'print antigo',
  horario: '2025-01-05T10:00:00.000Z',
  cor: 'hsl(210, 70%, 80%)',
  imagem: 'https://exemplo.br/antigo.png',
};

/** O chamado desta versão: os dois campos, com a mesma URL. */
const CHAMADO_NOVO = {
  id: 'novo',
  autorNome: 'Ana Souza',
  autorUid: 'uid-ana',
  email: 'ana@senai.br',
  descricao: 'print novo',
  horario: '2025-03-05T10:00:00.000Z',
  cor: 'hsl(120, 70%, 80%)',
  imagem: 'https://fake.storage/salas/s1/chamados/novo/abc.png',
  anexo: {
    url: 'https://fake.storage/salas/s1/chamados/novo/abc.png',
    caminho: 'salas/s1/chamados/novo/abc.png',
    origem: 'upload',
    largura: 1600,
    altura: 900,
    bytes: 204800,
  },
};

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __resetarStorage();
  __definirUsuarioAtual(ANA);
});

describe('miniatura no card (AC-IMG-10)', () => {
  it('o chamado antigo, com imagem em string, mostra a miniatura (AC-IMG-13)', () => {
    __semearColecao('chamados', [CHAMADO_ANTIGO]);

    renderComProvedores(<TelaAluno />);

    expect(screen.getByRole('img', { name: /print antigo/i })).toHaveAttribute(
      'src',
      'https://exemplo.br/antigo.png'
    );
  });

  it('o chamado novo, com anexo em objeto, mostra a miniatura', () => {
    __semearColecao('chamados', [CHAMADO_NOVO]);

    renderComProvedores(<TelaAluno />);

    expect(screen.getByRole('img', { name: /print novo/i })).toHaveAttribute(
      'src',
      CHAMADO_NOVO.anexo.url
    );
  });

  it('o card sem anexo não mostra miniatura nenhuma', () => {
    __semearColecao('chamados', [{ ...CHAMADO_ANTIGO, imagem: null }]);

    renderComProvedores(<TelaAluno />);

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('a tela do professor mostra as mesmas miniaturas', () => {
    __semearColecao('chamados', [CHAMADO_ANTIGO, CHAMADO_NOVO]);

    renderComProvedores(<TelaProfessor />);

    expect(screen.getAllByRole('img')).toHaveLength(2);
  });
});

describe('lightbox no lugar do window.open (AC-IMG-10)', () => {
  it('clicar na miniatura abre o visualizador, sem window.open', () => {
    const abrirJanela = jest.spyOn(window, 'open').mockImplementation(() => null);
    __semearColecao('chamados', [CHAMADO_ANTIGO]);
    renderComProvedores(<TelaAluno />);

    userEvent.click(screen.getByTitle('Ver imagem'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(abrirJanela).not.toHaveBeenCalled();
    abrirJanela.mockRestore();
  });

  it('o Esc fecha o visualizador e o foco volta para a miniatura', () => {
    __semearColecao('chamados', [CHAMADO_ANTIGO]);
    renderComProvedores(<TelaAluno />);
    const gatilho = screen.getByTitle('Ver imagem');

    userEvent.click(gatilho);
    userEvent.type(screen.getByRole('dialog'), '{esc}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });

  it('a miniatura é um botão de verdade, alcançável pelo teclado', () => {
    __semearColecao('chamados', [CHAMADO_ANTIGO]);

    renderComProvedores(<TelaAluno />);

    expect(screen.getByTitle('Ver imagem').tagName).toBe('BUTTON');
  });

  it('o professor também abre o anexo em visualizador', () => {
    const abrirJanela = jest.spyOn(window, 'open').mockImplementation(() => null);
    __semearColecao('chamados', [CHAMADO_NOVO]);
    renderComProvedores(<TelaProfessor />);

    userEvent.click(screen.getByTitle('Ver imagem'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(abrirJanela).not.toHaveBeenCalled();
    abrirJanela.mockRestore();
  });
});

describe('URL externa que saiu do ar (AC-IMG-12)', () => {
  it('mostra um aviso no lugar do ícone quebrado do navegador', () => {
    __semearColecao('chamados', [{ ...CHAMADO_ANTIGO, imagem: 'https://fora-do-ar.br/x.png' }]);
    renderComProvedores(<TelaAluno />);

    fireEvent.error(screen.getByRole('img', { name: /print antigo/i }));

    expect(screen.getByText(/imagem indisponível/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('o chamado continua legível mesmo com o anexo fora do ar', () => {
    __semearColecao('chamados', [{ ...CHAMADO_ANTIGO, imagem: 'https://fora-do-ar.br/x.png' }]);
    renderComProvedores(<TelaAluno />);

    fireEvent.error(screen.getByRole('img', { name: /print antigo/i }));

    expect(screen.getByText('print antigo')).toBeInTheDocument();
  });
});

describe('excluir o chamado apaga o anexo (AC-CHAMADO-08)', () => {
  it('o aluno que exclui o próprio chamado leva o anexo junto', async () => {
    // O caminho é o que está gravado em `anexo.caminho` do próprio chamado —
    // é por ele que se sabe o que apagar, e não por adivinhação.
    __semearArquivos([CHAMADO_NOVO.anexo.caminho, 'imagens/de-outra-pessoa.png']);
    __semearColecao('chamados', [
      { ...CHAMADO_NOVO, id: 'meu', email: 'ana@senai.br', autorUid: 'uid-ana' },
    ]);
    renderComProvedores(<TelaAluno />);

    userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(__documentosDe('chamados')).toHaveLength(0));
    await waitFor(() => expect(__arquivosEnviados()).toEqual(['imagens/de-outra-pessoa.png']));
  });

  it('o professor que exclui o chamado de um aluno também limpa o Storage', async () => {
    __semearArquivos([CHAMADO_NOVO.anexo.caminho]);
    __semearColecao('chamados', [{ ...CHAMADO_NOVO, id: 'c1' }]);
    renderComProvedores(<TelaProfessor />);

    userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(__arquivosEnviados()).toEqual([]));
  });

  it('excluir chamado sem anexo não falha nem apaga nada de ninguém', async () => {
    __semearArquivos(['salas/s1/chamados/outro/abc.png']);
    __semearColecao('chamados', [
      { ...CHAMADO_ANTIGO, id: 'meu', email: 'ana@senai.br', imagem: null },
    ]);
    renderComProvedores(<TelaAluno />);

    userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(__documentosDe('chamados')).toHaveLength(0));
    expect(__arquivosEnviados()).toEqual(['salas/s1/chamados/outro/abc.png']);
  });
});

describe('a escrita dupla do campo de anexo', () => {
  /** Abre o modal, escreve e cola um link de imagem. */
  async function abrirECriarComLink(url) {
    userEvent.click(screen.getByRole('button', { name: '+' }));
    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'Olha o erro');
    userEvent.paste(screen.getByPlaceholderText('Cole o link da imagem'), url);
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
  }

  it('grava imagem em string E anexo em objeto, com a mesma URL', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirECriarComLink('https://exemplo.br/erro.png');

    await waitFor(() => expect(__documentosDe('chamados')).toHaveLength(1));
    const [chamado] = __documentosDe('chamados');

    expect(chamado.imagem).toBe('https://exemplo.br/erro.png');
    expect(chamado.anexo).toEqual({ url: 'https://exemplo.br/erro.png', origem: 'url' });
  });

  it('sem anexo, os dois campos ficam nulos', async () => {
    renderComProvedores(<TelaAluno />);

    userEvent.click(screen.getByRole('button', { name: '+' }));
    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'Sem print');
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    await waitFor(() => expect(__documentosDe('chamados')).toHaveLength(1));
    const [chamado] = __documentosDe('chamados');

    expect(chamado.imagem).toBeNull();
    expect(chamado.anexo).toBeNull();
  });

  it('o chamado é gravado no id que o modal reservou', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirECriarComLink('https://exemplo.br/erro.png');

    await waitFor(() => expect(__documentosDe('chamados')).toHaveLength(1));
    // Id sorteado pelo cliente, e não pelo `addDoc`: é ele que já nomeia a
    // pasta do anexo no Storage antes de o documento existir.
    expect(__documentosDe('chamados')[0].id).toEqual(expect.any(String));
  });

  it('um leitor que só conhece imagem continua achando a URL (compat. futura)', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirECriarComLink('https://exemplo.br/erro.png');

    await waitFor(() => expect(__documentosDe('chamados')).toHaveLength(1));
    const leitorDaV050 = (chamado) => chamado.imagem;

    expect(leitorDaV050(__documentosDe('chamados')[0])).toBe('https://exemplo.br/erro.png');
  });
});

describe('o card mistura os dois formatos na mesma fila', () => {
  it('exibe miniatura para o antigo e para o novo, lado a lado', () => {
    __semearColecao('chamados', [CHAMADO_ANTIGO, CHAMADO_NOVO]);

    renderComProvedores(<TelaAluno />);

    const cartoes = document.querySelectorAll('.problema-card');
    expect(within(cartoes[0]).getByRole('img')).toBeInTheDocument();
    expect(within(cartoes[1]).getByRole('img')).toBeInTheDocument();
  });

  it('quando os dois campos existem, manda o objeto — ele tem o caminho', () => {
    // A escrita dupla mantém os dois em dia. Se um dia divergirem, o objeto é
    // o formato completo: só ele sabe o caminho no Storage, que a exclusão usa.
    __semearColecao('chamados', [
      { ...CHAMADO_NOVO, imagem: 'https://desatualizada.br/velha.png' },
    ]);

    renderComProvedores(<TelaAluno />);

    expect(screen.getByRole('img', { name: /print novo/i })).toHaveAttribute(
      'src',
      CHAMADO_NOVO.anexo.url
    );
  });
});
