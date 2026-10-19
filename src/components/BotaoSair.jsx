// Saída explícita da sessão — AC-SESSAO-05.
//
// As máquinas do laboratório são compartilhadas e, com
// `browserLocalPersistence`, a sessão sobrevive a desligar o computador. Sem
// uma saída visível em toda tela autenticada, a turma seguinte sentaria na
// conta da anterior.
//
// Quem redireciona depois do logout é a `RotaProtegida`: sem usuário, ela
// manda para a raiz com `replace`, e o "voltar" do navegador não reabre a tela
// (AC-AUTH-08). Por isso este componente não navega.
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/BotaoSair.css';

/**
 * Botão de logout.
 * @param {{className?: string}} props `className` extra para posicionamento.
 */
export default function BotaoSair({ className = '' }) {
  const { sair } = useAuth();

  return (
    <button type="button" className={`botao-sair ${className}`.trim()} onClick={sair}>
      Sair
    </button>
  );
}
