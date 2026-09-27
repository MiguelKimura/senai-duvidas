// A tela de entrada por PIN — AC-SALA-04, AC-SALA-06, AC-SALA-12.
//
// Toda a inteligência da entrada está em `services/salas.js`, e é de
// propósito: esta tela não decide nada sobre o PIN. Ela mostra o que o serviço
// devolver, e o serviço devolve sempre a mesma frase quando a entrada não
// acontece — não existe aqui um ramo "sala arquivada" nem um ramo "PIN não
// encontrado", porque exibir essa diferença já seria contar ao visitante que o
// número dele é o PIN de alguém (AC-SALA-04).
//
// Depois de entrar uma vez, o aluno não volta aqui: o vínculo fica gravado e a
// lista de salas o leva direto (AC-SALA-06).
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ErroDeSala, entrarComPin } from '../services/salas';
import { TAMANHO_DO_PIN } from '../services/pin';
import BotaoSair from './BotaoSair';
import '../styles/Salas.css';

const ERRO_INESPERADO =
  'Não foi possível entrar na sala agora. Tente de novo em alguns instantes.';

/**
 * O formulário do PIN, sozinho.
 *
 * Separado da tela porque aparece em dois lugares: aqui, para quem já tem
 * sala e quer entrar em outra, e em `MinhasSalas`, para o aluno que acabou de
 * criar a conta e ainda não está em sala nenhuma — que precisa ver o campo do
 * PIN logo de cara, e não um botão que leva até ele.
 */
export function FormularioDePin() {
  const { usuario, perfil } = useAuth();
  const navegar = useNavigate();

  const [pin, setPin] = useState('');
  const [erro, setErro] = useState(null);

  // Mesma trava síncrona da criação: dois cliques rápidos gastariam duas
  // tentativas do limite de cinco (AC-SALA-12) por um clique só do aluno.
  const emVoo = useRef(false);

  const enviar = useCallback(
    async (evento) => {
      evento.preventDefault();

      if (emVoo.current) return;
      emVoo.current = true;
      setErro(null);

      try {
        const pessoa = {
          uid: usuario.uid,
          nome: perfil?.nome || usuario.displayName || usuario.email,
          email: usuario.email,
        };

        const { salaId } = await entrarComPin(pin, pessoa);

        navegar(`/sala/${salaId}`, { replace: true });
      } catch (falha) {
        setErro(falha instanceof ErroDeSala ? falha.message : ERRO_INESPERADO);
      } finally {
        emVoo.current = false;
      }
    },
    [navegar, perfil, pin, usuario]
  );

  return (
    <form className="salas-formulario" onSubmit={enviar} noValidate>
      <label htmlFor="pin-da-sala">PIN da sala</label>
      <input
        id="pin-da-sala"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(evento) => setPin(evento.target.value)}
        placeholder="000000"
      />

      {erro && (
        <p className="salas-erro" role="alert">
          {erro}
        </p>
      )}

      <button type="submit" className="salas-acao">
        Entrar na sala
      </button>
    </form>
  );
}

export default function EntrarComPin() {
  const navegar = useNavigate();

  return (
    <div className="tela-salas">
      <BotaoSair />

      {/* Uma coluna só, no centro: título, instrução, formulário e o voltar
          alinhados entre si, em vez do formulário colado no canto esquerdo. */}
      <div className="salas-centralizada">
        <h1>Entrar na sala</h1>
        <p>Digite o PIN de {TAMANHO_DO_PIN} dígitos que o professor passou para a turma.</p>

        <FormularioDePin />

        <button
          type="button"
          className="salas-acao salas-acao-discreta salas-acao-larga"
          onClick={() => navegar('/salas')}
        >
          Voltar para minhas salas
        </button>
      </div>
    </div>
  );
}
