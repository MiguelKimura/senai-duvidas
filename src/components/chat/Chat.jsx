// O chat da sala — AC-CHAT-*, AC-DM-01.
//
// Esta é a casca: o botão flutuante, o painel e as duas abas. Ela não fala com
// o Firestore e não decide permissão. O que ela sabe é quem está lendo e com
// que papel — e o papel vem da **sala**, não do `AuthContext`: ser professor no
// SENAI não é ser professor desta sala (AC-SEC-02).
//
// O painel fechado não escuta nada. Não é detalhe de performance: com 40 alunos
// numa sala, um listener por aluno aberto o dia inteiro é a maior fonte de
// leitura do app, e a maioria das telas fica com o chat fechado.
import React, { useMemo, useState } from 'react';
import { FaComments } from 'react-icons/fa';
import AbaSala from './AbaSala';
import AbaDiretas from './AbaDiretas';
import { useAuth } from '../../contexts/AuthContext';
import { PAPEL_DE_ALUNO } from '../../services/salas';
import '../../styles/Chat.css';

const ABA_DA_SALA = 'sala';
const ABA_DAS_DIRETAS = 'diretas';

/**
 * A conversa da turma e as conversas privadas.
 *
 * @param {object} props
 * @param {string|null} [props.salaId] `null` cai na coleção global da v0.4.0.
 *   Sem sala não há conversa privada: ela vive dentro da sala.
 * @param {'aluno'|'professor'} [props.papelNaSala] papel do **vínculo**, que é
 *   o que a rule consulta do outro lado.
 * @param {boolean} [props.somenteLeitura] sala arquivada (AC-SALA-10).
 * @param {(mensagem: object) => React.ReactNode} [props.insigniasDe] as
 *   insígnias de quem falou (AC-PERK-05). Vem pronta da sala, que já carregou
 *   os perks — o chat não consulta o banco por causa disso (AC-PERF-03).
 */
export default function Chat({
  salaId = null,
  papelNaSala = PAPEL_DE_ALUNO,
  somenteLeitura = false,
  insigniasDe,
}) {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState(ABA_DA_SALA);

  const pessoa = useMemo(
    () =>
      usuario
        ? {
            uid: usuario.uid,
            nome: usuario.displayName || 'Aluno',
            email: usuario.email || null,
            papel: papelNaSala,
          }
        : null,
    [usuario, papelNaSala]
  );

  return (
    <div className="chat-container">
      <button
        type="button"
        className="toggle-chat-btn"
        aria-expanded={aberto}
        aria-label={aberto ? 'Fechar o chat' : 'Abrir o chat'}
        onClick={() => setAberto((atual) => !atual)}
      >
        <FaComments aria-hidden="true" />
      </button>

      {aberto && !pessoa && (
        <div className="chat-box">
          {/* Sem sessão resolvida não há autor para assinar a mensagem. Oferecer
              o campo aqui deixaria alguém digitar e receber um erro em inglês
              vindo de `autor.uid` — que é o que acontecia enquanto esta guarda
              não existia (AC-ANIM-04). */}
          <p className="chat-aviso" role="status">
            Carregando a conversa...
          </p>
        </div>
      )}

      {aberto && pessoa && (
        <div className="chat-box">
          <div className="chat-abas" role="tablist" aria-label="Conversas">
            <button
              type="button"
              role="tab"
              id="aba-sala"
              aria-selected={aba === ABA_DA_SALA}
              className={aba === ABA_DA_SALA ? 'chat-aba chat-aba--ativa' : 'chat-aba'}
              onClick={() => setAba(ABA_DA_SALA)}
            >
              Sala
            </button>

            {/* Sem sala não há conversa privada: ela mora dentro da sala, e a
                rule que a protege é escrita em cima do vínculo com a sala. */}
            {salaId && (
              <button
                type="button"
                role="tab"
                id="aba-diretas"
                aria-selected={aba === ABA_DAS_DIRETAS}
                className={aba === ABA_DAS_DIRETAS ? 'chat-aba chat-aba--ativa' : 'chat-aba'}
                onClick={() => setAba(ABA_DAS_DIRETAS)}
              >
                Diretas
              </button>
            )}
          </div>

          {aba === ABA_DA_SALA || !salaId ? (
            <div role="tabpanel" aria-labelledby="aba-sala">
              <AbaSala
                salaId={salaId}
                pessoa={pessoa}
                somenteLeitura={somenteLeitura}
                insigniasDe={insigniasDe}
              />
            </div>
          ) : (
            <div role="tabpanel" aria-labelledby="aba-diretas">
              <AbaDiretas salaId={salaId} pessoa={pessoa} somenteLeitura={somenteLeitura} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
