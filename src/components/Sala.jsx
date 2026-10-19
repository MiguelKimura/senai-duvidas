// A porta da sala — AC-SALA-07, AC-SALA-09, AC-SALA-10, AC-SEC-02.
//
// Para entrar, todo mundo precisa do vínculo `salas/{salaId}/membros/{uid}`
// (criado pelo PIN). Quem não tem vínculo recebe a recusa, professor ou não.
//
// Dentro da sala, a tela do professor abre pelo vínculo de professor **ou**
// pelo papel global do `AuthContext` (v1.1.1): o professor que entra pelo PIN
// na sala de um colega ganha vínculo de aluno, mas modera a fila do mesmo
// jeito — as rules dão a ele excluir e atender chamados. O que é só do dono
// (PIN, premiações, turma) continua preso a `ehDono`.
//
// A checagem daqui não é a proteção — a proteção é a rule, e ela vale mesmo
// com o cliente adulterado. O que esta tela faz é traduzir a recusa numa frase
// em português, em vez de deixar uma tela vazia sem explicação.
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PAPEL_DE_PROFESSOR, lerPapelNaSala, lerSala } from '../services/salas';
import SeloDoPin from './SeloDoPin';
import TelaAluno from './TelaAluno';
import { useSalasDaPessoa } from '../hooks/useSalasDaPessoa';
import TelaProfessor from './TelaProfessor';
import '../styles/Salas.css';

const RECUSA = 'Você não faz parte desta sala. Peça o PIN ao professor da turma.';

export default function Sala() {
  const { salaId } = useParams();
  const { usuario, papel } = useAuth();
  const navegar = useNavigate();

  const [estado, setEstado] = useState({ situacao: 'carregando' });

  const uid = usuario?.uid;

  // As outras salas da pessoa, para trocar de turma sem voltar à lista
  // (v1.1.0). O professor que dá aula para três turmas no mesmo dia troca
  // daqui.
  const salasDaPessoa = useSalasDaPessoa(uid);

  useEffect(() => {
    if (!salaId || !uid) return undefined;

    let vivo = true;
    setEstado({ situacao: 'carregando' });

    (async () => {
      // O papel primeiro: sem vínculo, nem o nome da sala é carregado. Ler a
      // sala antes e esconder depois deixaria o nome dela no estado de uma
      // pessoa que não devia sequer saber que ela existe (AC-SEC-02).
      const papelNaSala = await lerPapelNaSala(salaId, uid);

      if (!vivo) return;

      if (!papelNaSala) {
        setEstado({ situacao: 'recusada' });
        return;
      }

      const sala = await lerSala(salaId);

      if (!vivo) return;

      setEstado(sala ? { situacao: 'aberta', sala, papelNaSala } : { situacao: 'recusada' });
    })().catch(() => {
      if (vivo) setEstado({ situacao: 'recusada' });
    });

    return () => {
      vivo = false;
    };
  }, [salaId, uid]);

  if (estado.situacao === 'carregando') {
    return (
      <p className="tela-salas" role="status">
        Abrindo a sala...
      </p>
    );
  }

  if (estado.situacao === 'recusada') {
    return (
      <div className="tela-salas">
        <p className="salas-erro" role="alert">
          {RECUSA}
        </p>
      </div>
    );
  }

  const { sala, papelNaSala } = estado;
  const ehDono = sala.professorUid === uid;
  const somenteLeitura = sala.ativa === false;

  return (
    <div className="sala">
      {/* O PIN num canto, a aula inteira, só para o dono (v1.1.0). */}
      {ehDono && <SeloDoPin salaId={salaId} podeGerar={!somenteLeitura} />}

      <header className="sala-cabecalho">
        <h2>
          {sala.nome} — {sala.curso} · {sala.anoLetivo}
        </h2>

        <nav className="sala-navegacao" aria-label="Salas">
          <button
            type="button"
            className="sala-navegacao-voltar"
            onClick={() => navegar('/salas')}
          >
            Minhas salas
          </button>

          {salasDaPessoa.length > 1 && (
            <select
              className="sala-navegacao-seletor"
              aria-label="Trocar de sala"
              value={salaId}
              onChange={(evento) => navegar(`/sala/${evento.target.value}`)}
            >
              {salasDaPessoa.map((outra) => (
                <option key={outra.salaId} value={outra.salaId}>
                  {outra.nome}
                  {outra.curso ? ` — ${outra.curso}` : ''}
                </option>
              ))}
            </select>
          )}
        </nav>

        {somenteLeitura && (
          <p className="sala-cartao-arquivada">
            Sala arquivada — somente leitura. O ano letivo dela terminou.
          </p>
        )}
      </header>

      {/* A tela do professor vale para o vínculo de professor e também para a
          conta de professor que entrou pelo PIN (v1.1.1): o professor que
          acompanha a turma do colega ficava com a tela do aluno e não
          conseguia moderar a fila. O que é só do dono — premiações, turma e
          PIN — continua dependendo de `ehDono`. */}
      {papelNaSala === PAPEL_DE_PROFESSOR || papel === PAPEL_DE_PROFESSOR ? (
        <TelaProfessor salaId={salaId} somenteLeitura={somenteLeitura} ehDono={ehDono} />
      ) : (
        <TelaAluno salaId={salaId} somenteLeitura={somenteLeitura} />
      )}
    </div>
  );
}
