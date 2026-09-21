import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { auth } from '../firebase';
import { addDoc, deleteDoc, doc, limit, onSnapshot, query } from 'firebase/firestore';
import {
  carimboServidor,
  completarHorariosIso,
  criarComparadorPorHorario,
  formatarDataHora,
} from '../services/tempo';
import { LIMITE_DE_CHAMADOS, colecaoDeChamados } from '../services/salas';
import '../styles/TelaAluno.css';
import Chat from './Chat';
import BotaoSair from './BotaoSair';

// A tela do aluno, agora dentro de uma sala (AC-SALA-07).
//
// A identidade da tela não mudou — o cliente reconhece esta tela, e a task
// proíbe repaginá-la. O que mudou é **de onde** vêm os dados: de
// `salas/{salaId}/chamados` em vez da coleção global, que misturava a escola
// inteira numa fila só.
//
// Sem `salaId`, a tela cai na coleção global da v0.4.0. Esse fallback é
// deliberado e tem prazo: ele é o que impede a tela vazia para quem abrir o
// app no meio da migração, e sai na 1.0.0, junto com as coleções globais.

function TelaAluno({ salaId = null }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [problemas, setProblemas] = useState([]);
  const [usuarioNome, setUsuarioNome] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUsuarioNome(user.displayName || "Aluno");
    }
  }, []);

  useEffect(() => {
    // AC-PERF-03: a fila cresce o ano letivo inteiro, e sem teto cada abertura
    // do app pagaria por novembro inteiro. O corte cobre o alvo declarado do
    // projeto (200 chamados por sala).
    const consulta = query(colecaoDeChamados(salaId), limit(LIMITE_DE_CHAMADOS));

    const unsubscribe = onSnapshot(consulta, (querySnapshot) => {
      // `horario` fica cru: quem entende os formatos que convivem no banco é
      // `services/tempo.js`, na hora de ordenar e na hora de exibir.
      const problemasList = querySnapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      problemasList.sort(criarComparadorPorHorario());
      setProblemas(problemasList);

      // Depois de publicar a lista, para que a reemissão provocada pela
      // escrita chegue por último e a tela fique com os dados mais novos.
      completarHorariosIso(querySnapshot.docs, auth.currentUser?.email);
    });

    return () => unsubscribe(); // Limpar o listener quando o componente for desmontado
  }, [salaId]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const addProblema = async (descricao, imagem) => {
    if (!descricao) return;

    const user = auth.currentUser;
    if (!user) return;

    const novaCor = `hsl(${Math.random() * 360}, 70%, 80%)`;

    const novoProblema = {
      // Escrita dupla do autor, exigida pela seção 4 do protocolo: `autorNome`
      // é o nome novo, `nome` é o que o leitor da v0.4.0 procura. Os dois
      // carregam o mesmo conteúdo até a 1.0.0, quando `nome` sai — uma aba
      // aberta desde antes do deploy continua exibindo quem abriu o chamado.
      autorUid: user.uid,
      autorNome: usuarioNome,
      nome: usuarioNome,
      email: user.email,
      descricao,
      // AC-TEMPO-01: quem decide a posição na fila é o servidor, não o relógio
      // desta máquina. Ver services/tempo.js.
      horario: carimboServidor(),
      cor: novaCor,
      imagem: imagem || null, // Salva a imagem (se houver)
      atendido: false,
    };

    try {
      await addDoc(colecaoDeChamados(salaId), novoProblema);
      closeModal();
    } catch (error) {
      console.error("Erro ao adicionar problema:", error);
    }
  };

  const removerProblema = async (id) => {
    try {
      await deleteDoc(doc(colecaoDeChamados(salaId), id));
    } catch (error) {
      console.error("Erro ao excluir chamado:", error);
    }
  };

  // Função para abrir a imagem
  const visualizarImagem = (imagemUrl) => {
    window.open(imagemUrl, '_blank');
  };

  return (
    <div className="tela-aluno">
      <BotaoSair />
      <h1>Bem-vindo, {usuarioNome}!</h1>
      <p>Aqui estão os problemas registrados.</p>
      <button className="add-button" onClick={openModal}>+</button>
      <div className="problemas-list">
        {problemas.map((problema) => (
          <div
            key={problema.id}
            className="problema-card"
            style={{ backgroundColor: problema.cor }}
          >
            <div className="card-header">
              {/* `autorNome` primeiro, `nome` como leitura do formato antigo:
                  é o outro lado da escrita dupla, e é o que mantém legível o
                  chamado que a migração copiou da coleção global. */}
              <p className="user-name"><strong>{problema.autorNome || problema.nome}</strong></p>
              {/* Exibir ícone para visualizar a imagem no canto superior direito do card, caso haja imagem */}
              {problema.imagem && (
                <div
                  className="view-image-icon"
                  onClick={() => visualizarImagem(problema.imagem)}
                  title="Ver imagem"
                >
                  👁️
                </div>
              )}
            </div>

            <p>{problema.descricao}</p>
            <p><em>{formatarDataHora(problema.horario)}</em></p>

            {problema.email === auth.currentUser?.email && (
              <button className="delete-button" onClick={() => removerProblema(problema.id)}>
                Excluir
              </button>
            )}
          </div>
        ))}
      </div>
      {isModalOpen && <Modal onClose={closeModal} onSubmit={addProblema} />}

      <Chat salaId={salaId} />
    </div>
  );
}

export default TelaAluno;
