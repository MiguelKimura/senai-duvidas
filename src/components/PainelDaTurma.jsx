// O painel da turma, só para o dono da sala — AC-SALA-08, AC-SALA-09.
//
// Remover um aluno e gerar um PIN novo são **um gesto só**, e não dois botões
// ao lado um do outro. Separados, eles não resolvem o problema que existe de
// verdade: o aluno removido tem o PIN anotado no caderno e entra de novo em
// dez segundos. O PIN novo é o que fecha a porta — e por isso ele aparece na
// tela logo depois, para o professor repassar a quem ficou.
import React, { useCallback, useEffect, useState } from 'react';
import { PAPEL_DE_PROFESSOR, listarMembros, removerMembroERegerarPin } from '../services/salas';
import PainelDoPin from './PainelDoPin';

const ERRO_INESPERADO = 'Não foi possível atualizar a turma agora. Tente de novo em instantes.';

/**
 * Lista os membros e permite remover alunos.
 *
 * @param {{salaId: string, podeRemover: boolean}} props `podeRemover` é falso
 *   na sala arquivada, que não aceita mais escrita nenhuma (AC-SALA-10).
 */
export default function PainelDaTurma({ salaId, podeRemover = true }) {
  const [membros, setMembros] = useState([]);
  const [pinNovo, setPinNovo] = useState(null);
  const [erro, setErro] = useState(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;

    listarMembros(salaId)
      .then((lista) => {
        if (vivo) setMembros(lista);
      })
      .catch(() => {
        if (vivo) setErro(ERRO_INESPERADO);
      });

    return () => {
      vivo = false;
    };
  }, [salaId, versao]);

  const remover = useCallback(
    async (uid) => {
      setErro(null);

      try {
        setPinNovo(await removerMembroERegerarPin(salaId, uid));
        setVersao((anterior) => anterior + 1);
      } catch {
        setErro(ERRO_INESPERADO);
      }
    },
    [salaId]
  );

  return (
    <section className="painel-da-turma" aria-label="Turma da sala">
      <h2>Turma</h2>

      {erro && (
        <p className="salas-erro" role="alert">
          {erro}
        </p>
      )}

      {pinNovo && <PainelDoPin pin={pinNovo} titulo="Novo PIN da sala" />}

      <ul className="painel-da-turma-lista">
        {membros.map((membro) => (
          <li key={membro.uid}>
            <span>{membro.nome}</span>

            {/* O professor não se remove da própria sala: a sala ficaria sem
                dono, e ninguém poderia arquivá-la nem gerar PIN novo. */}
            {podeRemover && membro.papel !== PAPEL_DE_PROFESSOR && (
              <button
                type="button"
                className="salas-acao salas-acao-discreta"
                onClick={() => remover(membro.uid)}
              >
                Remover {membro.nome}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
