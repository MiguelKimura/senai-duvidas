import React, { useState, useEffect } from 'react';
import { deleteDoc, doc, limit, onSnapshot, query } from 'firebase/firestore';
import { formatarDataHora } from '../services/tempo';
import { LIMITE_DE_CHAMADOS, PAPEL_DE_PROFESSOR, colecaoDeChamados } from '../services/salas';
import { removerAnexoDoChamado } from '../services/anexos';
import { formatoDoTexto } from '../utils/markdown';
import { estiloDoCard } from '../utils/cardDoChamado';
import { usePerksDaSala } from '../hooks/usePerksDaSala';
import '../styles/TelaProfessor.css';
import AnexoDoCard from './AnexoDoCard';
import TextoMarkdown from './TextoMarkdown';
import Chat from './chat/Chat';
import BotaoSair from './BotaoSair';

// A tela do professor, agora dentro de uma sala (AC-SALA-07).
//
// A fila que ele vê é a da turma dele, e não mais a da escola inteira. Sem
// `salaId`, cai na coleção global da v0.4.0 pelo mesmo fallback da tela do
// aluno — o que mantém a tela útil enquanto a migração não rodou.
function TelaProfessor({ salaId = null, somenteLeitura = false }) {
  const [problemas, setProblemas] = useState([]);

  // A fila que a tela desenha sai daqui, e não do estado cru: a ordem dela
  // depende dos perks da sala, e quem os carrega — uma vez, não uma por card —
  // é este hook (AC-PERK-02, AC-PERF-03).
  const { fila } = usePerksDaSala(salaId, problemas);

  useEffect(() => {
    // AC-PERF-03: mesmo teto da tela do aluno, pela mesma razão.
    const consulta = query(colecaoDeChamados(salaId), limit(LIMITE_DE_CHAMADOS));

    const unsubscribe = onSnapshot(consulta, (querySnapshot) => {
      // A fila do professor é a mesma do aluno, e a ordem dela é decidida no
      // mesmo lugar: `services/filaChamados.js`. O professor não preenche
      // `horarioIso` de ninguém — quem faz isso é o cliente do autor.
      //
      // O estado guarda a lista **crua**: ordenar aqui, antes de os perks
      // chegarem, faria a fila reordenar sozinha na frente da turma quando o
      // segundo snapshot chegasse.
      setProblemas(
        querySnapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
      );
    });

    return () => unsubscribe();
  }, [salaId]);

  const handleDelete = async (chamado) => {
    try {
      await deleteDoc(doc(colecaoDeChamados(salaId), chamado.id));
      // O professor apaga o chamado de um aluno, e o anexo é do aluno: sem
      // isto ele ficaria no Storage sem documento nenhum apontando para ele,
      // ocupando a cota da escola para sempre (AC-CHAMADO-08).
      await removerAnexoDoChamado(salaId, chamado);
      alert('Chamado excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir o chamado:', error);
      alert('Erro ao excluir o chamado. Tente novamente mais tarde.');
    }
  };

  return (
    <div className="tela-professor">
      <BotaoSair />
      <h1>Chamados dos Alunos</h1>

      <div className="problemas-list">
        {fila.map((problema) => (
          <div key={problema.id} className="problema-card" style={estiloDoCard(problema)}>
            <div className="card-header">
              <div className="user-name-wrapper">
                <p className="user-name">
                  <strong>{problema.autorNome || problema.nome}</strong>
                </p>
              </div>

              {/* A mesma miniatura do card do aluno, pelo mesmo componente.
                  Até a v0.5.0 eram dois trechos de JSX copiados, e já tinham
                  divergido no nome da função que abriam. */}
              <AnexoDoCard chamado={problema} />
            </div>

            {/* O mesmo componente do card do aluno, pelo mesmo motivo do
                `AnexoDoCard`: a fila e a mesma, e o card precisa ser o
                mesmo (AC-COR-07). */}
            <TextoMarkdown texto={problema.descricao} formato={formatoDoTexto(problema)} />
            <p>
              <em>{formatarDataHora(problema.horario)}</em>
            </p>

            {/* Botão de exclusão posicionado abaixo do conteúdo do card.
                Some na sala arquivada, que é somente leitura (AC-SALA-10). */}
            {!somenteLeitura && (
              <div className="delete-button-container">
                <button className="delete-button" onClick={() => handleDelete(problema)}>
                  Excluir
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Quem chega a esta tela é o professor da sala, pelo vínculo que
          `Sala.jsx` conferiu. O papel vai junto porque é ele que libera o
          `!clear` na interface — a autorização que vale é a da rule. */}
      <Chat salaId={salaId} papelNaSala={PAPEL_DE_PROFESSOR} somenteLeitura={somenteLeitura} />
    </div>
  );
}

export default TelaProfessor;
