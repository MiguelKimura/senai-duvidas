import React, { useCallback, useState, useEffect } from 'react';
import Modal from './Modal';
import AnexoDoCard from './AnexoDoCard';
import TextoMarkdown from './TextoMarkdown';
import { auth } from '../firebase';
import { deleteDoc, doc, limit, onSnapshot, query, setDoc } from 'firebase/firestore';
import { camposDoAnexo, removerAnexoDoChamado } from '../services/anexos';
import { carimboServidor, completarHorariosIso, formatarDataHora } from '../services/tempo';
import { LIMITE_DE_CHAMADOS, PAPEL_DE_ALUNO, colecaoDeChamados } from '../services/salas';
import { FORMATO_MARKDOWN, formatoDoTexto } from '../utils/markdown';
import { corAutomatica } from '../utils/paleta';
import { estiloDoCard } from '../utils/cardDoChamado';
import { usePerksDaSala } from '../hooks/usePerksDaSala';
import InsigniasDoAluno from './perks/InsigniasDoAluno';
import VitrineDeConquistas from './perks/VitrineDeConquistas';
import PreferenciasDePremiacao from './perks/PreferenciasDePremiacao';
import '../styles/TelaAluno.css';
import Chat from './chat/Chat';
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

function TelaAluno({ salaId = null, somenteLeitura = false }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [problemas, setProblemas] = useState([]);
  const [usuarioNome, setUsuarioNome] = useState('');

  // A ordem da fila passa a depender dos perks da sala (AC-PERK-02). O aluno
  // vê a mesma fila do professor porque os dois a ordenam com a mesma função e
  // com o mesmo instante do servidor — discordar aqui geraria briga em sala.
  const { fila, perks, perksPorUid, agoraServidor } = usePerksDaSala(salaId, problemas);

  // A insígnia do chat sai do mesmo índice do card: uma consulta de perks por
  // sala, e não uma por balão renderizado (AC-PERK-05, AC-PERF-03).
  const insigniasDe = useCallback(
    (mensagem) => (
      <InsigniasDoAluno
        perks={perksPorUid}
        uid={mensagem.autorUid}
        agoraServidor={agoraServidor}
      />
    ),
    [perksPorUid, agoraServidor]
  );

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUsuarioNome(user.displayName || 'Aluno');
    }
  }, []);

  useEffect(() => {
    // AC-PERF-03: a fila cresce o ano letivo inteiro, e sem teto cada abertura
    // do app pagaria por novembro inteiro. O corte cobre o alvo declarado do
    // projeto (200 chamados por sala).
    const consulta = query(colecaoDeChamados(salaId), limit(LIMITE_DE_CHAMADOS));

    const unsubscribe = onSnapshot(consulta, (querySnapshot) => {
      // `horario` fica cru: quem entende os formatos que convivem no banco é
      // `services/tempo.js`, na hora de ordenar e na hora de exibir. A lista
      // também fica crua — ordená-la aqui, sem os perks, faria os cards
      // trocarem de lugar sozinhos assim que a consulta de perks respondesse.
      setProblemas(
        querySnapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
      );

      // Depois de publicar a lista, para que a reemissão provocada pela
      // escrita chegue por último e a tela fique com os dados mais novos.
      completarHorariosIso(querySnapshot.docs, auth.currentUser?.email);
    });

    return () => unsubscribe(); // Limpar o listener quando o componente for desmontado
  }, [salaId]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const addProblema = async (descricao, anexo, chamadoId, cor = null) => {
    if (!descricao) return;

    const user = auth.currentUser;
    if (!user) return;

    // A cor escolhida no painel avançado substitui o sorteio; sem escolha, o
    // sorteio continua sendo o que sempre foi (AC-COR-05). O `||` é o ponto
    // inteiro do critério: quem não abre o painel não muda de comportamento.
    const novaCor = cor || corAutomatica();

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
      // Campo aditivo: diz como `descricao` deve ser lida. Ausente significa
      // texto puro, e é por isso que nenhum chamado gravado até a v0.6.0
      // precisa ser migrado para continuar aparecendo como apareceu
      // (AC-COR-07). Um cliente antigo que ignore o campo mostra o markdown
      // como texto cru — degradação prevista e testada.
      formato: FORMATO_MARKDOWN,
      // Escrita dupla do anexo, pela mesma regra do autor: `imagem` continua
      // sendo a string de URL que todo cliente já aberto no laboratório
      // procura, e `anexo` é o objeto com o caminho no Storage e as dimensões.
      // `imagem` só sai na 1.0.0 (AC-IMG-13).
      ...camposDoAnexo(anexo),
      atendido: false,
    };

    try {
      // `setDoc` no id que o modal reservou, e não `addDoc`: o anexo já subiu
      // para `salas/{salaId}/chamados/{chamadoId}/` antes de o documento
      // existir, e deixar o servidor sortear outro id separaria os dois.
      await setDoc(doc(colecaoDeChamados(salaId), chamadoId), novoProblema);
      closeModal();
    } catch (error) {
      console.error('Erro ao adicionar problema:', error);
    }
  };

  const removerProblema = async (chamado) => {
    const id = chamado.id;

    try {
      await deleteDoc(doc(colecaoDeChamados(salaId), id));
      // Depois de apagar o documento, não antes: se a remoção do arquivo
      // falhar, o chamado já saiu da fila — que é o que o aluno pediu. O
      // contrário deixaria o card na tela sem o anexo (AC-CHAMADO-08).
      await removerAnexoDoChamado(salaId, chamado);
    } catch (error) {
      console.error('Erro ao excluir chamado:', error);
    }
  };

  return (
    <div className="tela-aluno">
      <BotaoSair />
      <h1>Bem-vindo, {usuarioNome}!</h1>
      <p>Aqui estão os problemas registrados.</p>
      {/* Sala arquivada não aceita chamado novo (AC-SALA-10). O botão some em
          vez de dar erro no clique: o aluno não tem o que fazer com um erro
          que não é dele. Quem recusa de verdade continua sendo a rule. */}
      {!somenteLeitura && (
        <button className="add-button" onClick={openModal}>
          +
        </button>
      )}
      <div className="problemas-list">
        {fila.map((problema) => (
          <div key={problema.id} className="problema-card" style={estiloDoCard(problema)}>
            <div className="card-header">
              {/* `autorNome` primeiro, `nome` como leitura do formato antigo:
                  é o outro lado da escrita dupla, e é o que mantém legível o
                  chamado que a migração copiou da coleção global. */}
              <p className="user-name">
                <strong>{problema.autorNome || problema.nome}</strong>
                <InsigniasDoAluno
                  perks={perksPorUid}
                  uid={problema.autorUid}
                  agoraServidor={agoraServidor}
                />
              </p>
              {/* A miniatura do anexo, no mesmo canto onde o olho 👁️ ficava.
                  Clicar abre o visualizador na própria página — `window.open`
                  vinha bloqueado em parte dos laboratórios (AC-IMG-10). */}
              <AnexoDoCard chamado={problema} />
            </div>

            {/* A descrição passa por um componente só, o mesmo do card do
                professor e da prévia do modal. Chamado sem `formato` é texto
                puro e continua sendo renderizado como texto (AC-COR-05). */}
            <TextoMarkdown texto={problema.descricao} formato={formatoDoTexto(problema)} />
            <p>
              <em>{formatarDataHora(problema.horario)}</em>
            </p>

            {!somenteLeitura && problema.email === auth.currentUser?.email && (
              <button className="delete-button" onClick={() => removerProblema(problema)}>
                Excluir
              </button>
            )}
          </div>
        ))}
      </div>
      {/* A vitrine fica depois da fila, e não antes: o que o aluno vem fazer
          aqui é abrir e acompanhar chamado. As conquistas dele são o que ele
          encontra ao rolar, não o que empurra a fila para fora da tela
          (AC-PERK-06). */}
      <VitrineDeConquistas
        perks={perks}
        uid={auth.currentUser?.uid}
        agoraServidor={agoraServidor}
      />

      {/* As preferências ficam ao lado da vitrine, e não numa tela de ajustes
          separada: é aqui que o aluno está quando decide que não quer mais a
          animação em tela cheia (AC-PERK-08). */}
      <PreferenciasDePremiacao />

      {isModalOpen && (
        <Modal
          salaId={salaId}
          autor={usuarioNome}
          onClose={closeModal}
          onSubmit={addProblema}
        />
      )}

      {/* O papel vai explícito: é ele que decide o selo do balão e quem pode
          usar o `!clear` (AC-CHAT-04, AC-CHAT-08). Quem abre esta tela é aluno
          na sala — a decisão de qual tela abrir é de `Sala.jsx`, pelo vínculo. */}
      <Chat
        salaId={salaId}
        papelNaSala={PAPEL_DE_ALUNO}
        somenteLeitura={somenteLeitura}
        insigniasDe={insigniasDe}
      />
    </div>
  );
}

export default TelaAluno;
