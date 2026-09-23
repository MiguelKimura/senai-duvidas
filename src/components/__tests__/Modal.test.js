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
import { FOCALIZAVEIS } from '../../hooks/useDialogoModal';
import { ROTULO_DO_PAINEL } from '../PainelAvancado';
import { PALETA } from '../../utils/paleta';
import { CHAVE_DA_COR } from '../../utils/preferenciaDeCor';
import { comDimensoes, instalarCanvasFalso, restaurarCanvas } from '../../test-utils';

// A task 05 acrescentou um quarto argumento ao `onSubmit`: a cor do card. Ele
// e **sempre** uma string — quando o aluno nao escolhe nada, e o sorteio de
// sempre, resolvido pelo modal para que a previa mostre a cor de verdade.
const COR_AUTOMATICA = expect.stringMatching(/^hsl\(\d+(\.\d+)?, 70%, 80%\)$/);

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
  window.localStorage.clear();
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
      expect.any(String),
      COR_AUTOMATICA
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
      expect.any(String),
      COR_AUTOMATICA
    );
  });

  it('sem anexo nenhum, entrega null — como a v0.1.0 fazia', () => {
    const { aoEnviar } = montar();

    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'Sem print');
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith(
      'Sem print',
      null,
      expect.any(String),
      COR_AUTOMATICA
    );
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

    expect(aoEnviar).toHaveBeenCalledWith(
      'Sem o print mesmo',
      null,
      expect.any(String),
      COR_AUTOMATICA
    );
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

// ---------------------------------------------------------------------------
// Task 05 — o painel de opções avançadas dentro do modal.
//
// O cliente pediu que o modal continuasse simples por padrão. Isso tem duas
// consequências verificáveis: o painel entra **abaixo** do que já existia, e
// o campo de link da imagem **não** se muda para dentro dele — colar uma URL
// precisa continuar custando os mesmos cliques de sempre (AC-IMG-01).
// ---------------------------------------------------------------------------

const setinha = () => document.querySelector('.painel-avancado summary');

describe('Modal — onde o painel avançado entra (AC-COR-01)', () => {
  it('fica abaixo da seção de anexo, e não no meio dos campos principais', () => {
    montar();

    const secoes = [...document.querySelectorAll('.modal > *')];
    const posicaoDoAnexo = secoes.indexOf(screen.getByTestId('secao-anexo'));
    const posicaoDoPainel = secoes.indexOf(document.querySelector('.painel-avancado'));

    expect(posicaoDoPainel).toBeGreaterThan(posicaoDoAnexo);
  });

  it('nasce fechado: quem tem pressa não vê opção nenhuma', () => {
    montar();

    expect(setinha()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(ROTULO_DO_PAINEL)).toBeInTheDocument();
  });

  it('não leva o campo de link para dentro dele (AC-IMG-01)', () => {
    montar();

    const campoDeLink = screen.getByPlaceholderText('Cole o link da imagem');
    expect(document.querySelector('.painel-avancado')).not.toContainElement(campoDeLink);
  });
});

describe('Modal — a cor que ele entrega (AC-COR-04, AC-COR-05)', () => {
  it('entrega a cor escolhida pelo aluno', () => {
    const { aoEnviar } = montar();
    const escolhida = PALETA[4];

    userEvent.click(setinha());
    userEvent.click(screen.getByRole('radio', { name: escolhida.nome }));
    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'A rede caiu');
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith(
      'A rede caiu',
      null,
      expect.any(String),
      escolhida.fundo
    );
  });

  it('entrega a cor sorteada de sempre quando o aluno não escolhe (AC-COR-05)', () => {
    const { aoEnviar } = montar();

    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'A rede caiu');
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith(
      'A rede caiu',
      null,
      expect.any(String),
      COR_AUTOMATICA
    );
  });

  it('entrega a MESMA cor que a prévia mostrou, e não outra sorteada na hora', () => {
    const { aoEnviar } = montar();

    userEvent.click(setinha());
    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'A rede caiu');
    const corDaPrevia = screen.getByTestId('previa-do-card').style.backgroundColor;
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith('A rede caiu', null, expect.any(String), corDaPrevia);
  });
});

describe('Modal — prévia ao vivo (AC-COR-09)', () => {
  it('acompanha o que está sendo digitado, com o markdown aplicado', () => {
    montar();

    userEvent.click(setinha());
    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'o **cabo** caiu');

    expect(
      screen.getByTestId('previa-do-card').querySelector('.texto-markdown strong')
    ).toHaveTextContent('cabo');
  });

  it('acompanha a cor escolhida', () => {
    montar();

    userEvent.click(setinha());
    userEvent.click(screen.getByRole('radio', { name: PALETA[7].nome }));

    expect(screen.getByTestId('previa-do-card')).toHaveStyle({
      backgroundColor: PALETA[7].fundo,
    });
  });
});

describe('Modal — a cor lembrada (AC-COR-10)', () => {
  it('guarda a escolha do aluno ao concluir', () => {
    montar();

    userEvent.click(setinha());
    userEvent.click(screen.getByRole('radio', { name: PALETA[2].nome }));
    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'A rede caiu');
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(window.localStorage.getItem(CHAVE_DA_COR)).toBe(PALETA[2].fundo);
  });

  it('abre o próximo chamado já com a cor lembrada marcada', () => {
    window.localStorage.setItem(CHAVE_DA_COR, PALETA[2].fundo);
    montar();

    expect(screen.getByRole('radio', { name: PALETA[2].nome })).toBeChecked();
  });

  it('entrega a cor lembrada mesmo sem o aluno abrir o painel', () => {
    window.localStorage.setItem(CHAVE_DA_COR, PALETA[2].fundo);
    const { aoEnviar } = montar();

    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'A rede caiu');
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(aoEnviar).toHaveBeenCalledWith(
      'A rede caiu',
      null,
      expect.any(String),
      PALETA[2].fundo
    );
  });

  it('esquece a cor quando o aluno volta para a automática', () => {
    window.localStorage.setItem(CHAVE_DA_COR, PALETA[2].fundo);
    montar();

    userEvent.click(setinha());
    userEvent.click(screen.getByRole('radio', { name: 'Automática' }));
    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'A rede caiu');
    userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(window.localStorage.getItem(CHAVE_DA_COR)).toBeNull();
  });
});

// O modal de novo chamado como diálogo de teclado — AC-ANIM-10, AC-ANIM-01.
//
// Até a v0.9.0 este era o único diálogo do app que não era um diálogo: uma
// `<div>` sobre a tela, sem papel, sem nome acessível, sem `Esc` e sem prisão
// de foco. O visualizador de anexo (task 04) e a confirmação de exclusão
// (esta task) já faziam as três coisas, e a lógica saiu para
// `hooks/useDialogoModal.js` justamente para que este terceiro caso não
// precisasse reimplementá-la.
//
// Por que isso importa mais aqui do que nos outros dois: este é o único que o
// aluno abre para **digitar**. Sem a prisão, o Tab depois do campo de link
// leva para os botões da tela de trás — que continuam clicáveis, porque o
// fundo não bloqueia nada —, e quem navega por teclado escreve a dúvida sem
// nunca alcançar o "Concluir".
describe('Modal — teclado e foco (AC-ANIM-10)', () => {
  it('é um diálogo modal anunciado pelo próprio título', () => {
    montar();

    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName('Descreva o seu problema');
  });

  it('o foco começa dentro do diálogo, no campo que o aluno veio preencher', () => {
    montar();

    expect(screen.getByPlaceholderText('Descreva o problema')).toHaveFocus();
  });

  it('Esc fecha, e fecha pelo mesmo caminho do botão Fechar', async () => {
    const { aoFechar } = montar();

    await userEvent.keyboard('{Escape}');

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('devolve o foco ao botão que o abriu', async () => {
    function Tela() {
      const [aberto, setAberto] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setAberto(true)}>
            Abrir novo chamado
          </button>
          {aberto && (
            <Modal salaId="sala-3b" onClose={() => setAberto(false)} onSubmit={jest.fn()} />
          )}
        </>
      );
    }

    render(<Tela />);

    const gatilho = screen.getByRole('button', { name: 'Abrir novo chamado' });
    await userEvent.click(gatilho);
    await userEvent.keyboard('{Escape}');

    expect(gatilho).toHaveFocus();
  });

  it('prende o foco: do último focável o Tab volta ao primeiro', async () => {
    montar();

    const focalizaveis = [...screen.getByRole('dialog').querySelectorAll(FOCALIZAVEIS)];
    focalizaveis[focalizaveis.length - 1].focus();

    await userEvent.tab();

    expect(focalizaveis[0]).toHaveFocus();
  });

  it('prende o foco: do primeiro, Shift+Tab vai para o último', async () => {
    montar();

    const focalizaveis = [...screen.getByRole('dialog').querySelectorAll(FOCALIZAVEIS)];
    focalizaveis[0].focus();

    await userEvent.tab({ shift: true });

    expect(focalizaveis[focalizaveis.length - 1]).toHaveFocus();
  });

  it('entra com a transição da camada de animação, e não com uma própria', () => {
    montar();

    // As classes vêm de `styles/animacoes.css`, onde o
    // `prefers-reduced-motion` global as desliga de uma vez (AC-ANIM-05). Um
    // `@keyframes` declarado aqui dentro escaparia daquele bloco.
    expect(document.querySelector('.modal-overlay')).toHaveClass('entra-sobreposicao');
    expect(screen.getByRole('dialog')).toHaveClass('entra-caixa');
  });
});
