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

describe('TextoMarkdown — formato antigo, texto puro (retrocompatibilidade)', () => {
  it('é o padrão quando ninguém diz o formato', () => {
    const { container } = render(<TextoMarkdown texto="o **cabo** está solto" />);

    expect(container.querySelector('strong')).toBeNull();
    expect(screen.getByText('o **cabo** está solto')).toBeInTheDocument();
  });

  it('mostra asterisco como asterisco, e não como itálico', () => {
    const { container } = render(
      <TextoMarkdown texto="o arquivo C:\Users\*.log sumiu" formato={FORMATO_TEXTO} />
    );

    expect(container.querySelector('em')).toBeNull();
    expect(screen.getByText('o arquivo C:\\Users\\*.log sumiu')).toBeInTheDocument();
  });

  it('mostra "# 12" como está, e não como título', () => {
    const { container } = render(<TextoMarkdown texto="# 12 travou" formato={FORMATO_TEXTO} />);

    expect(container.querySelector('h1')).toBeNull();
    expect(screen.getByText('# 12 travou')).toBeInTheDocument();
  });

  it('escapa HTML digitado por quem escrevia texto puro (AC-SEC-04)', () => {
    const { container } = render(
      <TextoMarkdown texto="<script>alert(1)</script>" formato={FORMATO_TEXTO} />
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });
});

describe('TextoMarkdown — formato novo, markdown (AC-COR-07)', () => {
  it('rende **negrito** como <strong>', () => {
    const { container } = render(
      <TextoMarkdown texto="o **cabo** está solto" formato={FORMATO_MARKDOWN} />
    );

    expect(container.querySelector('strong')).toHaveTextContent('cabo');
  });

  it('rende lista como <ul><li>', () => {
    const { container } = render(
      <TextoMarkdown texto={'- reiniciei\n- troquei o cabo'} formato={FORMATO_MARKDOWN} />
    );

    expect(container.querySelectorAll('ul li')).toHaveLength(2);
  });

  it('rende `código` como <code>', () => {
    const { container } = render(
      <TextoMarkdown texto="rode `npm start`" formato={FORMATO_MARKDOWN} />
    );

    expect(container.querySelector('code')).toHaveTextContent('npm start');
  });

  it('não deixa script chegar ao DOM (AC-COR-08)', () => {
    const { container } = render(
      <TextoMarkdown texto="<script>alert(1)</script>" formato={FORMATO_MARKDOWN} />
    );

    expect(container.querySelector('script')).toBeNull();
  });

  it('não deixa handler on* chegar ao DOM (AC-COR-08)', () => {
    const { container } = render(
      <TextoMarkdown texto="<img src=x onerror=alert(1)>" formato={FORMATO_MARKDOWN} />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
  });
});

describe('TextoMarkdown — bordas', () => {
  it('não rende nada para descrição vazia', () => {
    const { container } = render(<TextoMarkdown texto="" formato={FORMATO_MARKDOWN} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('não rende nada para descrição ausente', () => {
    const { container } = render(<TextoMarkdown />);

    expect(container).toBeEmptyDOMElement();
  });

  it('trata formato desconhecido como texto puro, e não como markdown', () => {
    const { container } = render(<TextoMarkdown texto="**forte**" formato="html" />);

    expect(container.querySelector('strong')).toBeNull();
  });
});
