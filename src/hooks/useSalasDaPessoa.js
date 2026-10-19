// As salas de quem está logado, com nome, para o seletor da sala (v1.1.0).
//
// O espelho `usuarios/{uid}/salas` só guarda o id e o papel; o nome vem de
// uma leitura por sala. São poucas salas por pessoa — o professor tem as
// turmas do ano, o aluno tem uma ou duas —, e a lista é lida uma vez por
// abertura da sala, e não a cada reemissão da fila.
import { useEffect, useState } from 'react';
import { carregarDetalhesDaSala, observarSalasDoUsuario } from '../services/salas';

/**
 * @param {string|null} uid
 * @returns {Array<{salaId: string, nome: string, curso?: string, ativa?: boolean}>}
 */
export function useSalasDaPessoa(uid) {
  const [vinculos, setVinculos] = useState([]);
  const [salas, setSalas] = useState([]);

  useEffect(() => {
    if (!uid) return undefined;

    return observarSalasDoUsuario(uid, setVinculos);
  }, [uid]);

  useEffect(() => {
    let vivo = true;

    Promise.all(vinculos.map((vinculo) => carregarDetalhesDaSala(vinculo.salaId)))
      .then((detalhes) => {
        if (vivo) setSalas(detalhes.filter(Boolean));
      })
      .catch(() => {
        if (vivo) setSalas([]);
      });

    return () => {
      vivo = false;
    };
  }, [vinculos]);

  return salas;
}
