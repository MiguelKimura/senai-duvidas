// O balão de fala — AC-CHAT-01 a AC-CHAT-04, AC-CHAT-07, AC-CHAT-12.
//
// Componente sem estado e sem banco: recebe uma mensagem já lida e decide como
// ela aparece. Quem escuta o Firestore é `hooks/useMensagens`, quem decide
// agrupamento é `ListaMensagens`, e quem resolve papel é a sala.
//
// A v0.7.0 renderizava `<strong>{nome}</strong>: {texto}` e parava aí. Isso
// deixava de fora o horário (que ela **gravava** e nunca mostrava), a distinção
// entre professor e aluno, e qualquer chance de um link existir. E punha o
// texto do usuário direto no JSX — o que é seguro por acidente, porque React
// escapa, mas fechava a porta para o markdown que a task 05 já tinha
// construído e testado.
import React from 'react';
import { paraHtmlDeMensagem } from '../../utils/markdown';
import { corDaMensagem } from '../../utils/corUsuario';
import { formatarHora, estaPendente, paraData } from '../../services/tempo';
import { PAPEL_DE_PROFESSOR } from '../../services/salas';

/** O que o selo do professor diz (AC-CHAT-04). */
export const ROTULO_DE_PROFESSOR = 'Professor';

/**
 * O nome de quem falou, na ordem da compatibilidade retroativa.
 *
 * `autorNome` é o campo desta versão; `nome` é o que a v0.1.0 gravava e o que a
 * migração da task 03 copiou. Nunca o nome de quem está lendo — uma mensagem
 * sem autor identificado é "Alguém", não é você.
 */
function nomeDoAutor(mensagem) {
  return mensagem.autorNome || mensagem.nome || 'Alguém';
}

/**
 * O instante da mensagem em forma legível por máquina, para o `<time>`.
 *
 * Devolve `undefined` — e não string vazia — quando não há data: um
 * `dateTime=""` é marcação inválida, e o leitor de tela anuncia o vazio.
 */
function instanteIso(horario) {
  const data = paraData(horario);

  return data ? data.toISOString() : undefined;
}

/**
 * Uma mensagem do chat.
 *
 * @param {object} props
 * @param {object} props.mensagem documento já lido de `salas/{salaId}/chat`.
 * @param {boolean} [props.ehMinha] a mensagem é de quem está lendo — decide o
 *   lado do balão, e **nada** sobre a cor (AC-CHAT-02).
 * @param {boolean} [props.agrupada] continua o bloco do mesmo autor: o nome e
 *   o selo não se repetem (AC-CHAT-03).
 * @param {React.ReactNode} [props.insignias] ponto de extensão da task 07 — a
 *   insígnia do perk entra ao lado do nome, sem que este arquivo precise saber
 *   o que é um perk.
 */
export default function Mensagem({ mensagem, ehMinha = false, agrupada = false, insignias }) {
  const cor = corDaMensagem(mensagem);
  const pendente = estaPendente(mensagem.horario);
  const ehProfessor = mensagem.autorPapel === PAPEL_DE_PROFESSOR;

  const classes = [
    'mensagem',
    ehMinha ? 'mensagem--minha' : 'mensagem--de-outro',
    agrupada ? 'mensagem--agrupada' : '',
    pendente ? 'mensagem--enviando' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // A única entrega de HTML cru do chat, e ela recebe exatamente o que
  // `paraHtmlDeMensagem` devolveu na linha de cima — a mesma tranca do card do
  // chamado, com `<a>` a mais e o `rel` escrito pelo sanitizador.
  const html = paraHtmlDeMensagem(mensagem.texto);

  return (
    <li className={classes}>
      {!agrupada && (
        <p className="mensagem-cabecalho">
          <span className="mensagem-autor">{nomeDoAutor(mensagem)}</span>
          {ehProfessor && <span className="mensagem-selo">{ROTULO_DE_PROFESSOR}</span>}
          {insignias && <span className="mensagem-insignias">{insignias}</span>}
        </p>
      )}

      <div className="mensagem-balao" style={{ backgroundColor: cor.fundo, color: cor.texto }}>
        <div className="mensagem-texto" dangerouslySetInnerHTML={{ __html: html }} />

        <time className="mensagem-horario" dateTime={instanteIso(mensagem.horario)}>
          {formatarHora(mensagem.horario)}
        </time>
      </div>
    </li>
  );
}
