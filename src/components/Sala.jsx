// A porta da sala — AC-SALA-07, AC-SALA-09, AC-SALA-10, AC-SEC-02.
//
// Quem decide qual tela abrir aqui **não** é o papel global do `AuthContext`.
// Ser professor no SENAI não é ser professor desta sala: o papel que vale é o
// do vínculo `salas/{salaId}/membros/{uid}`, que é o mesmo documento que as
// rules consultam do outro lado. Um professor que digite na barra de endereços
// a URL da sala de um colega recebe a mesma recusa que um estranho.
//
// A checagem daqui não é a proteção — a proteção é a rule, e ela vale mesmo
// com o cliente adulterado. O que esta tela faz é traduzir a recusa numa frase
// em português, em vez de deixar uma tela vazia sem explicação.
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PAPEL_DE_PROFESSOR, lerPapelNaSala, lerSala } from '../services/salas';
import PainelDaTurma from './PainelDaTurma';
import TelaAluno from './TelaAluno';
import TelaProfessor from './TelaProfessor';
import '../styles/Salas.css';

const RECUSA = 'Você não faz parte desta sala. Peça o PIN ao professor da turma.';

export default function Sala() {
  const { salaId } = useParams();
  const { usuario } = useAuth();

  const [estado, setEstado] = useState({ situacao: 'carregando' });

  const uid = usuario?.uid;

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
      <header className="sala-cabecalho">
        <h2>
          {sala.nome} — {sala.curso} · {sala.anoLetivo}
        </h2>

        {somenteLeitura && (
          <p className="sala-cartao-arquivada">
            Sala arquivada — somente leitura. O ano letivo dela terminou.
          </p>
        )}
      </header>

      {ehDono && <PainelDaTurma salaId={salaId} podeRemover={!somenteLeitura} />}

      {papelNaSala === PAPEL_DE_PROFESSOR ? (
        <TelaProfessor salaId={salaId} somenteLeitura={somenteLeitura} ehDono={ehDono} />
      ) : (
        <TelaAluno salaId={salaId} somenteLeitura={somenteLeitura} />
      )}
    </div>
  );
}
