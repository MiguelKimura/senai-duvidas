// O balão de fala — AC-CHAT-01, AC-CHAT-02, AC-CHAT-03, AC-CHAT-04,
// AC-CHAT-07, AC-CHAT-12.
//
// O componente é pequeno de propósito: ele recebe uma mensagem já lida do banco
// e decide **só** como ela aparece. Nada de consulta, nada de papel resolvido
// aqui dentro, nada de relógio lido para gravar.
//
// Os casos cobrem as quatro coisas que a v0.7.0 não fazia — horário, cor
// estável, agrupamento e selo de professor — e a quinta que ela fazia errado:
// concatenar o texto do usuário direto no JSX, sem nenhum caminho por onde um
// link pudesse existir.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import Mensagem from '../Mensagem';
import { corDaMensagem } from '../../../utils/corUsuario';
import { PAPEL_DE_ALUNO, PAPEL_DE_PROFESSOR } from '../../../services/salas';

/** 10/03/2026 às 12:30 em Brasília — 15:30 em UTC. */
const MEIO_DIA_E_MEIA = Timestamp.fromDate(new Date('2026-03-10T15:30:00.000Z'));

function mensagemDe(sobrescritas = {}) {
  return {
    id: 'm1',
    autorUid: 'uid-ana',
    autorNome: 'Ana Souza',
    autorPapel: PAPEL_DE_ALUNO,
    nome: 'Ana Souza',
    email: 'ana@senai.br',
    texto: 'Alguém conseguiu rodar o projeto?',
    horario: MEIO_DIA_E_MEIA,
    editadaEm: null,
    ...sobrescritas,
  };
}

/** O balão pintado, que é quem carrega a cor do autor. */
function balao() {
  return document.querySelector('.mensagem-balao');
}

describe('Mensagem — horário (AC-CHAT-01)', () => {
  it('exibe o horário em HH:mm', () => {
    render(<Mensagem mensagem={mensagemDe()} />);

    expect(screen.getByText('12:30')).toBeInTheDocument();
  });

  it('usa o fuso de BRASÍLIA, e não o da máquina', () => {
    // 03:30 UTC do dia 11 ainda é o dia 10, às 00:30, em Brasília. Numa
    // máquina em UTC — o caso do CI — a hora ingênua daria 03:30.
    const madrugada = Timestamp.fromDate(new Date('2026-03-11T03:30:00.000Z'));

    render(<Mensagem mensagem={mensagemDe({ horario: madrugada })} />);

    expect(screen.getByText('00:30')).toBeInTheDocument();
  });

  it('o horário é um <time> com o instante legível por máquina', () => {
    render(<Mensagem mensagem={mensagemDe()} />);

    const horario = document.querySelector('time.mensagem-horario');
    expect(horario).toHaveAttribute('dateTime', '2026-03-10T15:30:00.000Z');
  });

  it('mensagem antiga com horario em string ISO também mostra a hora', () => {
    render(<Mensagem mensagem={mensagemDe({ horario: '2026-03-10T15:30:00.000Z' })} />);

    expect(screen.getByText('12:30')).toBeInTheDocument();
  });

  it('mensagem sem horário nenhum mostra o travessão, não "Invalid Date"', () => {
    render(<Mensagem mensagem={mensagemDe({ horario: undefined })} />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Mensagem — envio otimista (AC-CHAT-07)', () => {
  it('mostra "enviando…" enquanto o servidor não carimbou', () => {
    // `horario: null` é o documento local que o Firestore entrega ANTES de o
    // `serverTimestamp()` voltar. É esse instante que a tela precisa nomear.
    render(<Mensagem mensagem={mensagemDe({ horario: null })} />);

    expect(screen.getByText('enviando…')).toBeInTheDocument();
  });

  it('marca o balão como pendente, para o CSS poder esmaecê-lo', () => {
    render(<Mensagem mensagem={mensagemDe({ horario: null })} />);

    expect(document.querySelector('.mensagem')).toHaveClass('mensagem--enviando');
  });

  it('some com o estado pendente assim que o horário chega', () => {
    const { rerender } = render(<Mensagem mensagem={mensagemDe({ horario: null })} />);
    expect(document.querySelector('.mensagem')).toHaveClass('mensagem--enviando');

    rerender(<Mensagem mensagem={mensagemDe()} />);

    expect(document.querySelector('.mensagem')).not.toHaveClass('mensagem--enviando');
    expect(screen.getByText('12:30')).toBeInTheDocument();
  });
});

describe('Mensagem — cor estável (AC-CHAT-02)', () => {
  it('pinta o balão com a cor derivada do autor', () => {
    render(<Mensagem mensagem={mensagemDe()} />);

    expect(balao()).toHaveStyle({ backgroundColor: corDaMensagem(mensagemDe()).fundo });
  });

  it('dá a MESMA cor a duas mensagens da mesma pessoa', () => {
    const { container } = render(
      <>
        <Mensagem mensagem={mensagemDe({ id: 'a', texto: 'primeira' })} />
        <Mensagem mensagem={mensagemDe({ id: 'b', texto: 'segunda' })} />
      </>
    );

    const [primeira, segunda] = container.querySelectorAll('.mensagem-balao');
    expect(primeira.style.backgroundColor).toBe(segunda.style.backgroundColor);
  });

  it('dá cores diferentes a pessoas diferentes', () => {
    const { container } = render(
      <>
        <Mensagem mensagem={mensagemDe({ id: 'a', autorUid: 'uid-ana' })} />
        <Mensagem mensagem={mensagemDe({ id: 'b', autorUid: 'uid-bruno' })} />
      </>
    );

    const [daAna, doBruno] = container.querySelectorAll('.mensagem-balao');
    expect(daAna.style.backgroundColor).not.toBe(doBruno.style.backgroundColor);
  });

  it('a cor NÃO muda conforme quem está olhando', () => {
    // O bug da v0.7.0, em forma de teste de componente: mensagem sem autorUid
    // e sem email caía no e-mail do leitor.
    const semIdentidade = mensagemDe({ autorUid: undefined, email: undefined });

    const primeira = render(<Mensagem mensagem={semIdentidade} ehMinha={false} />);
    const corLendoComoOutro = document.querySelector('.mensagem-balao').style.backgroundColor;
    primeira.unmount();

    render(<Mensagem mensagem={semIdentidade} ehMinha />);

    expect(balao().style.backgroundColor).toBe(corLendoComoOutro);
  });

  it('a cor do texto acompanha a do fundo, e vem do mesmo cálculo', () => {
    render(<Mensagem mensagem={mensagemDe()} />);

    expect(balao()).toHaveStyle({ color: corDaMensagem(mensagemDe()).texto });
  });
});

describe('Mensagem — agrupamento (AC-CHAT-03)', () => {
  it('mostra o nome do autor na primeira mensagem do bloco', () => {
    render(<Mensagem mensagem={mensagemDe()} agrupada={false} />);

    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  });

  it('esconde o nome quando a mensagem continua o bloco do mesmo autor', () => {
    render(<Mensagem mensagem={mensagemDe()} agrupada />);

    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
  });

  it('a mensagem agrupada continua mostrando texto e horário', () => {
    render(<Mensagem mensagem={mensagemDe()} agrupada />);

    expect(screen.getByText('Alguém conseguiu rodar o projeto?')).toBeInTheDocument();
    expect(screen.getByText('12:30')).toBeInTheDocument();
  });

  it('marca a continuação com uma classe, para o CSS aproximar os balões', () => {
    render(<Mensagem mensagem={mensagemDe()} agrupada />);

    expect(document.querySelector('.mensagem')).toHaveClass('mensagem--agrupada');
  });

  it('usa o nome gravado, e não o do autor logado (compat. retroativa)', () => {
    render(<Mensagem mensagem={{ id: 'm1', nome: 'Autor Antigo', texto: 'oi' }} />);

    expect(screen.getByText('Autor Antigo')).toBeInTheDocument();
  });
});

describe('Mensagem — selo de professor (AC-CHAT-04)', () => {
  it('põe o selo em quem fala como professor da sala', () => {
    render(<Mensagem mensagem={mensagemDe({ autorPapel: PAPEL_DE_PROFESSOR })} />);

    expect(screen.getByText('Professor')).toBeInTheDocument();
  });

  it('não põe selo em aluno', () => {
    render(<Mensagem mensagem={mensagemDe()} />);

    expect(screen.queryByText('Professor')).not.toBeInTheDocument();
  });

  it('não põe selo em mensagem antiga, que não tem autorPapel', () => {
    render(<Mensagem mensagem={{ id: 'm1', nome: 'Autor Antigo', texto: 'oi' }} />);

    expect(screen.queryByText('Professor')).not.toBeInTheDocument();
  });

  it('o selo some junto com o nome quando a mensagem é continuação', () => {
    render(<Mensagem mensagem={mensagemDe({ autorPapel: PAPEL_DE_PROFESSOR })} agrupada />);

    expect(screen.queryByText('Professor')).not.toBeInTheDocument();
  });
});

describe('Mensagem — ponto de extensão para insígnias (task 07)', () => {
  it('rende as insígnias que recebe, ao lado do nome', () => {
    render(
      <Mensagem mensagem={mensagemDe()} insignias={<span data-testid="perk">🔥</span>} />
    );

    expect(screen.getByTestId('perk')).toBeInTheDocument();
  });

  it('sem insígnias, não deixa um espaço vazio no DOM', () => {
    render(<Mensagem mensagem={mensagemDe()} />);

    expect(document.querySelector('.mensagem-insignias')).toBeNull();
  });
});

describe('Mensagem — o texto do usuário (AC-CHAT-12, AC-SEC-04)', () => {
  it('exibe o texto simples como texto', () => {
    render(<Mensagem mensagem={mensagemDe({ texto: 'Bom dia, turma' })} />);

    expect(screen.getByText('Bom dia, turma')).toBeInTheDocument();
  });

  it('NÃO renderiza <script> como markup', () => {
    render(<Mensagem mensagem={mensagemDe({ texto: '<script>alert(1)</script>oi' })} />);

    expect(document.querySelector('script')).toBeNull();
    expect(document.body.textContent).not.toContain('alert(1)');
  });

  it('NÃO renderiza <img onerror> como markup', () => {
    render(<Mensagem mensagem={mensagemDe({ texto: '<img src=x onerror="alert(1)">' })} />);

    expect(document.querySelector('img')).toBeNull();
  });

  it('transforma URL em link com rel="noopener noreferrer"', () => {
    render(<Mensagem mensagem={mensagemDe({ texto: 'veja https://exemplo.com' })} />);

    const link = document.querySelector('.mensagem-texto a');
    expect(link).toHaveAttribute('href', 'https://exemplo.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('Mensagem — lado do balão', () => {
  it('marca a própria mensagem com uma classe distinta', () => {
    render(<Mensagem mensagem={mensagemDe()} ehMinha />);

    expect(document.querySelector('.mensagem')).toHaveClass('mensagem--minha');
  });

  it('marca a mensagem dos outros com a classe oposta', () => {
    render(<Mensagem mensagem={mensagemDe()} ehMinha={false} />);

    expect(document.querySelector('.mensagem')).toHaveClass('mensagem--de-outro');
  });
});
