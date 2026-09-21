// A tela de criação de sala — AC-SALA-01, AC-SALA-02, AC-SALA-03.
//
// A tela tem dois momentos, e a diferença entre eles é o ponto da task: antes
// de criar, é um formulário; depois de criar, é um PIN em destaque que **não
// volta**. Nada no sistema guarda o número em claro (AC-SEC-05), então esta é
// literalmente a única vez que ele existe legível. A tela diz isso em voz alta
// e dá um botão de copiar, porque o professor vai repassá-lo para a turma
// inteira e um dígito trocado é uma aula perdida.
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ErroDeSala, anoLetivoCorrente, criarSala } from '../services/salas';
import BotaoSair from './BotaoSair';
import PainelDoPin from './PainelDoPin';
import '../styles/Salas.css';

const ERRO_INESPERADO = 'Não foi possível criar a sala agora. Tente de novo em alguns instantes.';

export default function CriarSala() {
  const { usuario, perfil } = useAuth();
  const navegar = useNavigate();

  const [nome, setNome] = useState('');
  const [curso, setCurso] = useState('');
  const [anoLetivo, setAnoLetivo] = useState(() => String(anoLetivoCorrente()));
  const [erro, setErro] = useState(null);
  const [criada, setCriada] = useState(null);

  // Trava síncrona contra o clique duplo. `useState` não serve aqui: entre o
  // `setEnviando(true)` e a re-renderização cabe um segundo clique, e o
  // segundo clique cria uma segunda sala com um segundo PIN — o professor
  // ficaria com duas turmas iguais e metade dos alunos em cada uma.
  const emVoo = useRef(false);

  const enviar = useCallback(
    async (evento) => {
      evento.preventDefault();

      if (emVoo.current || criada) return;
      emVoo.current = true;
      setErro(null);

      try {
        const professor = {
          uid: usuario.uid,
          nome: perfil?.nome || usuario.displayName || usuario.email,
          email: usuario.email,
        };

        setCriada(await criarSala({ nome, curso, anoLetivo }, professor));
      } catch (falha) {
        setErro(falha instanceof ErroDeSala ? falha.message : ERRO_INESPERADO);
      } finally {
        emVoo.current = false;
      }
    },
    [anoLetivo, criada, curso, nome, perfil, usuario]
  );

  if (criada) {
    return (
      <div className="tela-salas">
        <BotaoSair />
        <h1>Sala criada</h1>
        <p>
          A sala <strong>{nome}</strong> está pronta. Passe o PIN abaixo para a turma.
        </p>

        <PainelDoPin pin={criada.pin} />

        <button
          type="button"
          className="salas-acao"
          onClick={() => navegar(`/sala/${criada.salaId}`, { replace: true })}
        >
          Ir para a sala
        </button>
      </div>
    );
  }

  return (
    <div className="tela-salas">
      <BotaoSair />
      <h1>Nova sala</h1>

      <form className="salas-formulario" onSubmit={enviar} noValidate>
        <label htmlFor="sala-nome">Nome da sala</label>
        <input
          id="sala-nome"
          type="text"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          placeholder="Mecânica 2º ano"
        />

        <label htmlFor="sala-curso">Curso ou turma</label>
        <input
          id="sala-curso"
          type="text"
          value={curso}
          onChange={(evento) => setCurso(evento.target.value)}
          placeholder="Mecânica — Turma B"
        />

        <label htmlFor="sala-ano">Ano letivo</label>
        <input
          id="sala-ano"
          type="text"
          inputMode="numeric"
          value={anoLetivo}
          onChange={(evento) => setAnoLetivo(evento.target.value)}
        />

        {erro && (
          <p className="salas-erro" role="alert">
            {erro}
          </p>
        )}

        <button type="submit" className="salas-acao">
          Criar sala
        </button>
      </form>
    </div>
  );
}
