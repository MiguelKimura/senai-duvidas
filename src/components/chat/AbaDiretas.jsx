// A aba das mensagens diretas — AC-DM-01 a AC-DM-06.
//
// Dois estados e um só: ou a lista de conversas, ou uma conversa aberta.
//
// **Quem pode falar com quem.** O professor fala com qualquer aluno da sala; o
// aluno fala com o professor da sala. Aluno↔aluno **não** — é o AC-DM-07, que
// o roadmap marca como configurável pelo professor e desativado por padrão, e
// que não está nesta versão. Esconder aqui é conveniência de interface; o que
// impede de verdade é a rule, que exige que os dois sejam membros da sala e
// que quem cria participe da conversa.
//
// **A privacidade não mora neste arquivo.** Nada aqui filtra conversa de
// terceiro: a consulta é `where('participantes', 'array-contains', uid)` e a
// rule só entrega o que essa consulta pode ver (AC-DM-04).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ListaConversas from './ListaConversas';
import Conversa from './Conversa';
import { abrirConversa, observarConversas } from '../../services/chat';
import { PAPEL_DE_PROFESSOR, listarMembros } from '../../services/salas';

/**
 * Com quem esta pessoa pode iniciar uma conversa nesta versão.
 *
 * @param {Array<object>} membros vínculos da sala.
 * @param {{uid: string, papel?: string}} pessoa
 * @returns {Array<object>}
 */
export function contatosPossiveis(membros, pessoa) {
  const souProfessor = pessoa.papel === PAPEL_DE_PROFESSOR;

  return membros
    .filter((membro) => membro.uid !== pessoa.uid)
    .filter((membro) => souProfessor || membro.papel === PAPEL_DE_PROFESSOR);
}

/**
 * A aba de conversas privadas.
 *
 * @param {object} props
 * @param {string} props.salaId
 * @param {{uid: string, nome: string, papel?: string}} props.pessoa
 * @param {boolean} [props.somenteLeitura] sala arquivada (AC-SALA-10).
 */
export default function AbaDiretas({ salaId, pessoa, somenteLeitura = false }) {
  const [conversas, setConversas] = useState([]);
  const [membros, setMembros] = useState([]);
  const [escolhendoContato, setEscolhendoContato] = useState(false);
  const [aberta, setAberta] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!salaId || !pessoa) return undefined;

    return observarConversas(salaId, pessoa.uid, setConversas);
  }, [salaId, pessoa]);

  useEffect(() => {
    if (!salaId) return undefined;

    let vivo = true;

    listarMembros(salaId)
      .then((lista) => {
        if (vivo) setMembros(lista);
      })
      .catch(() => {
        if (vivo) setMembros([]);
      });

    return () => {
      vivo = false;
    };
  }, [salaId]);

  const contatos = useMemo(
    () => (pessoa ? contatosPossiveis(membros, pessoa) : []),
    [membros, pessoa]
  );

  /** Abre — ou reencontra — a conversa com alguém da lista de contatos. */
  const comecarCom = useCallback(
    async (contato) => {
      setErro(null);

      try {
        const id = await abrirConversa(salaId, pessoa, { uid: contato.uid, nome: contato.nome });

        setAberta({ id, outroUid: contato.uid, outroNome: contato.nome });
        setEscolhendoContato(false);
      } catch (falha) {
        // A recusa vem da rule — sala arquivada, vínculo removido — e precisa
        // aparecer. Conversa que não abre sem explicação é o pior desfecho.
        setErro(falha.message || 'Não foi possível abrir a conversa.');
      }
    },
    [salaId, pessoa]
  );

  if (aberta) {
    return (
      <Conversa
        salaId={salaId}
        conversa={aberta}
        pessoa={pessoa}
        somenteLeitura={somenteLeitura}
        aoVoltar={() => setAberta(null)}
      />
    );
  }

  return (
    <div className="aba-diretas">
      {erro && (
        <p className="conversas-erro" role="alert">
          {erro}
        </p>
      )}

      <button
        type="button"
        className="conversas-nova"
        onClick={() => setEscolhendoContato((aberto) => !aberto)}
      >
        Nova conversa
      </button>

      {escolhendoContato && (
        <ul className="conversas-contatos">
          {contatos.length === 0 && (
            <li className="conversas-aviso">Ninguém disponível para conversar nesta sala.</li>
          )}

          {contatos.map((contato) => (
            <li key={contato.uid}>
              <button type="button" onClick={() => comecarCom(contato)}>
                {contato.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ListaConversas
        uid={pessoa ? pessoa.uid : null}
        conversas={conversas}
        aoAbrir={(conversa) => setAberta(conversa)}
      />
    </div>
  );
}
