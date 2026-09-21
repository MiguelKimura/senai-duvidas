// A conversa da sala, escutada em janela — AC-CHAT-06, AC-PERF-03, AC-PERF-04.
//
// A v0.7.0 escutava assim:
//
//     query(colecaoDeChat(salaId), orderBy('horario'), limit(300))
//
// Crescente com `limit` devolve as **mais antigas**. Numa sala em novembro,
// isso é a conversa de março: 300 documentos que ninguém vai ler, pagos por
// cada aluno cada vez que a tela abre, enquanto a mensagem de agora não cabe.
// O corte estava lá; o que faltava era a direção.
//
// Aqui a consulta é decrescente e a janela começa em 50. Quem quiser o que veio
// antes pede — e pedir é o caso raro, porque a conversa que interessa numa aula
// é a de hoje.
//
// **Por que a janela cresce em vez de usar cursor.** Um `startAfter` com o
// último documento leria só as 50 novas por página, e seria mais barato num
// cenário de muitas páginas. Ele traz junto duas coisas que este chat não pode
// pagar: um segundo conjunto de resultados fora do `onSnapshot` — que não
// recebe edição nem deleção em tempo real e sai de sincronia com a janela viva
// — e um cursor que expira quando a mensagem-âncora é apagada pelo `!clear`.
// Com o teto de 300 da sala, a janela crescente custa no pior caso seis
// releituras por aula, e mantém **uma** fonte de verdade na tela.
//
// **Uma ressalva honesta sobre o legado.** O `orderBy` do Firestore ordena por
// TIPO antes de ordenar por valor: `Timestamp` vem antes de `string`. Uma
// mensagem da v0.1.0 com `horario` em string ISO, portanto, não se intercala
// com as novas na ordenação do servidor — ela é alcançada pela paginação, e a
// ordem que a tela mostra é decidida aqui, por `criarComparadorPorHorario`,
// como em toda tela deste app.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { MENSAGENS_POR_PAGINA } from '../services/chat';
import { LIMITE_DE_MENSAGENS, colecaoDeChat } from '../services/salas';
import { criarComparadorPorHorario } from '../services/tempo';

/**
 * Escuta a conversa da sala em janela crescente.
 *
 * @param {string|null} salaId `null` cai na coleção global da v0.4.0.
 * @param {{porPagina?: number, teto?: number}} [opcoes]
 * @returns {{
 *   mensagens: Array<object>,
 *   temMais: boolean,
 *   carregando: boolean,
 *   carregarAnteriores: () => void
 * }}
 */
export function useMensagens(salaId, opcoes = {}) {
  const { porPagina = MENSAGENS_POR_PAGINA, teto = LIMITE_DE_MENSAGENS } = opcoes;

  const [janela, setJanela] = useState(porPagina);
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Trocar de sala reinicia a janela. Sem isto, quem paginou a conversa da
  // sala A entraria na sala B já pagando 300 leituras — a paginação de uma
  // conversa não diz nada sobre a outra.
  useEffect(() => {
    setJanela(porPagina);
    setMensagens([]);
    setCarregando(true);
  }, [salaId, porPagina]);

  useEffect(() => {
    const consulta = query(
      colecaoDeChat(salaId),
      orderBy('horario', 'desc'),
      limit(Math.min(janela, teto))
    );

    const cancelar = onSnapshot(consulta, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      // O servidor entregou da mais nova para a mais velha, e por tipo antes
      // de por valor. A ordem que a tela usa é decidida aqui.
      lista.sort(criarComparadorPorHorario());

      setMensagens(lista);
      setCarregando(false);
    });

    return () => cancelar();
  }, [salaId, janela, teto]);

  /**
   * Há mensagem anterior à janela.
   *
   * A janela ter vindo cheia é indício, não prova: pode haver exatamente 50
   * mensagens na sala. Mostrar o botão a mais custa um clique que não traz
   * nada; escondê-lo a menos esconde a conversa de ontem para sempre.
   */
  const temMais = useMemo(
    () => mensagens.length >= janela && janela < teto,
    [mensagens.length, janela, teto]
  );

  const carregarAnteriores = useCallback(() => {
    setJanela((atual) => Math.min(atual + porPagina, teto));
  }, [porPagina, teto]);

  return { mensagens, temMais, carregando, carregarAnteriores };
}
