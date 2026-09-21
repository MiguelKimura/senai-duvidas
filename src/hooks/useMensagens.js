// A conversa da sala, escutada em tempo real.
//
// PASSO 1: a consulta de `components/Chat.js` movida para cá, sem mudar nada.
// É o incumbente contra o qual `__tests__/useMensagens.test.js` está vermelho.
import { useEffect, useState } from 'react';
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { LIMITE_DE_MENSAGENS, colecaoDeChat } from '../services/salas';
import { criarComparadorPorHorario } from '../services/tempo';

export function useMensagens(salaId) {
  const [mensagens, setMensagens] = useState([]);

  useEffect(() => {
    const consulta = query(
      colecaoDeChat(salaId),
      orderBy('horario'),
      limit(LIMITE_DE_MENSAGENS)
    );

    const cancelar = onSnapshot(consulta, (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      lista.sort(criarComparadorPorHorario());
      setMensagens(lista);
    });

    return () => cancelar();
  }, [salaId]);

  return { mensagens, temMais: false, carregarAnteriores: () => {} };
}
