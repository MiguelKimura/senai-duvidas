// O modal de novo chamado — AC-IMG-02, AC-IMG-09, AC-IMG-11.
//
// O modal deixa de ser "um textarea e um campo de URL" e passa a ter seções.
// Não é enfeite: a task 05 acrescenta o painel de opções avançadas — cor e
// markdown — dentro deste mesmo modal, e a diferença entre "acrescentar uma
// seção" e "reescrever o modal inteiro" é só esta organização existir antes.
//
// O ponto delicado é o id do chamado. O anexo sobe **antes** de o chamado
// existir, porque o aluno escolhe a imagem enquanto ainda está escrevendo.
// Para que o arquivo já nasça na pasta definitiva —
// `salas/{salaId}/chamados/{chamadoId}/` —, o modal reserva o id do documento
// na abertura, sem escrever nada no banco. A alternativa seria subir para um
// lugar provisório e mover depois, e o Storage não move objeto: copia, e paga
// duas vezes, em banda e em cota.
import React, { useRef, useState } from 'react';
import { useDialogoModal } from '../hooks/useDialogoModal';
import CampoAnexo from './CampoAnexo';
import PainelAvancado from './PainelAvancado';
import { removerAnexo } from '../services/anexos';
import { reservarChamado } from '../services/salas';
import { corAutomatica } from '../utils/paleta';
import { guardarCorPreferida, lerCorPreferida } from '../utils/preferenciaDeCor';
import '../styles/Modal.css';

const ID_DO_TITULO = 'modal-novo-chamado-titulo';

function Modal({ salaId = null, onClose, onSubmit, autor = '' }) {
  const [descricao, setDescricao] = useState('');
  const [anexo, setAnexo] = useState(null);
  // A preferência do chamado anterior já entra marcada (AC-COR-10). `null`
  // significa "não escolheu", e é o que mantém o sorteio de sempre.
  const [cor, setCor] = useState(lerCorPreferida);

  // Sorteada uma vez, na abertura, e não na hora de gravar. É o que faz a
  // prévia mostrar **a** cor que o card vai ter: sortear de novo no envio
  // transformaria a prévia em enfeite (AC-COR-09).
  const sorteada = useRef(null);
  if (sorteada.current === null) sorteada.current = corAutomatica();

  // Reservado uma vez, na abertura. `useRef` com inicialização preguiçosa
  // porque `reservarChamado` sorteia um id novo a cada chamada — recalculá-lo
  // a cada render mudaria a pasta do anexo no meio do envio.
  const referencia = useRef(null);
  if (referencia.current === null) referencia.current = reservarChamado(salaId);

  const chamadoId = referencia.current.id;

  const dialogo = useRef(null);
  const campoDaDescricao = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    guardarCorPreferida(cor);
    onSubmit(descricao, anexo, chamadoId, cor || sorteada.current);
    setDescricao('');
    setAnexo(null);
  };

  /**
   * Fechar sem concluir não pode deixar órfão no Storage.
   *
   * O anexo já subiu, e o chamado que o referenciaria nunca vai existir:
   * ninguém mais teria como chegar àquele caminho, e o arquivo ficaria
   * ocupando a cota da escola para sempre (AC-CHAMADO-08, mesmo espírito).
   */
  const fechar = () => {
    if (anexo && anexo.caminho) removerAnexo(anexo.caminho);
    onClose();
  };

  // O foco inicial vai no campo, e não no primeiro focável: aqui não há ação
  // destrutiva a proteger, e o que o aluno veio fazer é escrever. `Esc` passa
  // por `fechar`, e não por `onClose` — desistir do chamado continua tendo de
  // apagar o anexo que já subiu, senão o arquivo fica órfão na cota da escola.
  const { aoTeclar } = useDialogoModal({
    referencia: dialogo,
    aoFechar: fechar,
    focoInicial: () => campoDaDescricao.current,
  });

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div className="modal-overlay entra-sobreposicao" onKeyDown={aoTeclar} role="presentation">
      <div
        className="modal entra-caixa"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ID_DO_TITULO}
        ref={dialogo}
      >
        <h2 id={ID_DO_TITULO}>Descreva o seu problema</h2>

        <section className="modal-secao" data-testid="secao-descricao">
          <textarea
            ref={campoDaDescricao}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o problema"
          />
        </section>

        <section className="modal-secao" data-testid="secao-anexo">
          <CampoAnexo
            salaId={salaId}
            chamadoId={chamadoId}
            anexo={anexo}
            onAnexoMudou={setAnexo}
          />
        </section>

        {/* As opções avançadas (task 05). Abaixo das duas seções de cima, e
            fechadas: o aluno com pressa escreve e envia sem passar por aqui.
            O campo de link continua na seção de anexo, fora do painel — colar
            uma URL não pode ficar mais caro do que já era (AC-IMG-01). */}
        <PainelAvancado
          cor={cor}
          corAutomatica={sorteada.current}
          onCorMudou={setCor}
          descricao={descricao}
          autor={autor}
        />

        <div className="buttons-container">
          <button onClick={handleSubmit}>Concluir</button>
          <button className="close-button" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
