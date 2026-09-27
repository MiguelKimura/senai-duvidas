// O texto do card — AC-COR-07, AC-COR-08, AC-SEC-04.
//
// Este é o único componente do projeto que usa `dangerouslySetInnerHTML`, e é
// de propósito que seja um só: a linha perigosa fica num arquivo pequeno, com
// a sanitização imediatamente acima dela, onde quem revisa a vê inteira.
//
// O `formato` é a chave da compatibilidade retroativa. Chamado sem o campo é
// texto puro — e vai para o JSX como texto, escapado por React, exatamente
// como era antes desta versão. Só quem foi escrito na v0.7.0 em diante entra
// no caminho do markdown.
import React from 'react';
import { FORMATO_MARKDOWN, formatoDoTexto, paraHtmlSeguro } from '../utils/markdown';
import '../styles/TextoMarkdown.css';

/**
 * A descrição de um chamado, do jeito que o formato dela pede.
 *
 * @param {{texto?: string, formato?: string, className?: string}} props
 *   `formato` ausente ou desconhecido significa texto puro (o formato do banco
 *   até a v0.6.0).
 */
export default function TextoMarkdown({ texto, formato, className = '' }) {
  if (typeof texto !== 'string' || texto.trim() === '') return null;

  const classes = `texto-markdown${className ? ` ${className}` : ''}`;

  if (formatoDoTexto({ formato }) !== FORMATO_MARKDOWN) {
    // O caminho de sempre. React escapa, e `<script>alert(1)</script>` escrito
    // em 2025 continua aparecendo como os caracteres que o aluno digitou.
    return <p className={classes}>{texto}</p>;
  }

  const html = paraHtmlSeguro(texto);

  if (html === '') return null;

  // A única linha do projeto que entrega HTML cru ao DOM. O que ela recebe
  // acabou de passar por `paraHtmlSeguro` na linha de cima — e nada mais pode
  // entrar aqui sem passar pelo mesmo lugar.
  return <div className={classes} dangerouslySetInnerHTML={{ __html: html }} />;
}
