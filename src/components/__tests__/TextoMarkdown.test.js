// O texto do card — AC-COR-07, AC-COR-08, AC-SEC-04.
//
// Um componente só decide como a descrição de um chamado vira pixel, e por
// isso existe um lugar só onde errar. O card do aluno, o do professor, o
// preview do modal e o chat da task 06 passam por aqui.
//
// A parte que merece atenção é a do formato antigo. O banco está cheio de
// descrição escrita em texto puro, e texto puro tem `*`, `_` e `#` dentro:
// nome de arquivo, caminho de pasta, `C:\Users\*`. Interpretar isso como
// markdown mudaria, sem aviso, o que está escrito num card que já está na tela
// de alguém. O campo `formato` existe para que isso não aconteça.
import React from 'react';
import { render, screen } from '@testing-library/react';
import TextoMarkdown from '../TextoMarkdown';
import { FORMATO_MARKDOWN, FORMATO_TEXTO } from '../../utils/markdown';

/** O bloco de texto renderizado, ou `null` quando o componente não rendeu nada. */
const bloco = () => document.querySelector('.texto-markdown');

describe('TextoMarkdown — formato antigo, texto puro (retrocompatibilidade)', () => {
  it('é o padrão quando ninguém diz o formato', () => {
    render(<TextoMarkdown texto="o **cabo** está solto" />);

    expect(bloco().querySelector('strong')).toBeNull();
    expect(screen.getByText('o **cabo** está solto')).toBeInTheDocument();
  });

  it('mostra asterisco como asterisco, e não como itálico', () => {
    render(<TextoMarkdown texto="o arquivo C:\Users\*.log sumiu" formato={FORMATO_TEXTO} />);

    expect(bloco().querySelector('em')).toBeNull();
    expect(screen.getByText('o arquivo C:\\Users\\*.log sumiu')).toBeInTheDocument();
  });

  it('mostra "# 12" como está, e não como título', () => {
    render(<TextoMarkdown texto="# 12 travou" formato={FORMATO_TEXTO} />);

    expect(bloco().querySelector('h1')).toBeNull();
    expect(screen.getByText('# 12 travou')).toBeInTheDocument();
  });

  it('escapa HTML digitado por quem escrevia texto puro (AC-SEC-04)', () => {
    render(<TextoMarkdown texto="<script>alert(1)</script>" formato={FORMATO_TEXTO} />);

    expect(bloco().querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });
});

describe('TextoMarkdown — formato novo, markdown (AC-COR-07)', () => {
  it('rende **negrito** como <strong>', () => {
    render(<TextoMarkdown texto="o **cabo** está solto" formato={FORMATO_MARKDOWN} />);

    expect(bloco().querySelector('strong')).toHaveTextContent('cabo');
  });

  it('rende lista como <ul><li>', () => {
    render(
      <TextoMarkdown texto={'- reiniciei\n- troquei o cabo'} formato={FORMATO_MARKDOWN} />
    );

    expect(bloco().querySelectorAll('ul li')).toHaveLength(2);
  });

  it('rende `código` como <code>', () => {
    render(<TextoMarkdown texto="rode `npm start`" formato={FORMATO_MARKDOWN} />);

    expect(bloco().querySelector('code')).toHaveTextContent('npm start');
  });

  it('não deixa script chegar ao DOM (AC-COR-08)', () => {
    render(<TextoMarkdown texto="<script>alert(1)</script>" formato={FORMATO_MARKDOWN} />);

    expect(document.querySelector('script')).toBeNull();
  });

  it('não deixa handler on* chegar ao DOM (AC-COR-08)', () => {
    render(<TextoMarkdown texto="<img src=x onerror=alert(1)>" formato={FORMATO_MARKDOWN} />);

    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('[onerror]')).toBeNull();
  });
});

describe('TextoMarkdown — bordas', () => {
  it('não rende nada para descrição vazia', () => {
    render(<TextoMarkdown texto="" formato={FORMATO_MARKDOWN} />);

    expect(bloco()).toBeNull();
  });

  it('não rende nada para descrição ausente', () => {
    render(<TextoMarkdown />);

    expect(bloco()).toBeNull();
  });

  it('trata formato desconhecido como texto puro, e não como markdown', () => {
    render(<TextoMarkdown texto="**forte**" formato="html" />);

    expect(bloco().querySelector('strong')).toBeNull();
  });
});
