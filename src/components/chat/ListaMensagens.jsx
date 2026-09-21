// A lista de mensagens.
//
// PASSO 1: o `mensagens.map` da v0.7.0, sem agrupamento, sem paginação e sem
// estado vazio. É o incumbente contra o qual o teste está vermelho.
import React from 'react';
import Mensagem from './Mensagem';

export default function ListaMensagens({ mensagens = [], uid = null }) {
  return (
    <ul className="mensagens-lista">
      {mensagens.map((mensagem) => (
        <Mensagem key={mensagem.id} mensagem={mensagem} ehMinha={mensagem.autorUid === uid} />
      ))}
    </ul>
  );
}
