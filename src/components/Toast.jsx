// Os avisos do app — AC-ANIM-07, AC-ANIM-04, AC-ANIM-10.
//
// O `alert()` que este componente substitui já tinha saído do login e do
// cadastro na task 01, pelos motivos registrados lá: bloqueia a aba inteira,
// some sem deixar o texto na tela e, em parte dos laboratórios, vem suprimido
// junto com o bloqueador de pop-up — o professor clica em "Excluir", nada
// acontece, e ele não sabe se o chamado saiu. `TelaProfessor` era o último
// lugar onde ele resistia.
//
// Três decisões que valem explicação:
//
//   * **o erro espera.** Toast de erro não tem cronômetro. Um aviso de falha
//     que pisca por quatro segundos é um aviso que a pessoa não leu — e quem
//     está em aula está olhando para o próprio código, não para o canto da
//     tela;
//   * **nada some antes de 4 segundos.** É o piso que a WCAG 2.2.1 define para
//     conteúdo temporizado, e é o tempo de alguém que estava olhando para o
//     teclado levantar os olhos;
//   * **a região `aria-live` existe desde o primeiro render**, vazia. Um nó
//     criado no mesmo instante em que recebe texto não é anunciado: o leitor
//     de tela precisa já estar observando quando o conteúdo muda.
//
// Duas escolhas de marcação que parecem detalhe e não são:
//
//   * **`role="log"`, e não `role="status"`.** `log` é o papel de uma região
//     onde a informação é **acrescentada** em ordem, que é exatamente uma
//     pilha de avisos; `status` é o de um placar que se reescreve. E `status`
//     já é usado pelas telas para "Carregando...", "Abrindo a sala..." e para
//     a recusa do servidor ao salvar preferência — uma segunda região com o
//     mesmo papel em toda página faria cada uma dessas mensagens virar
//     ambígua para quem consulta a tela por papel;
//   * **portal para o `<body>`.** A pilha é `position: fixed`, e um ancestral
//     com `transform` — o cartão de premiação, por exemplo — cria um novo
//     bloco de contenção e recortaria o aviso para dentro dele.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import '../styles/Toast.css';

/** O piso da WCAG 2.2.1 para conteúdo que some sozinho. */
export const DURACAO_MINIMA_MS = 4000;

export const TIPO_SUCESSO = 'sucesso';
export const TIPO_ERRO = 'erro';
export const TIPO_AVISO = 'aviso';
export const TIPO_INFORMACAO = 'informacao';

/** O rótulo do botão de dispensa, igual em todos os avisos. */
export const ROTULO_FECHAR = 'Fechar aviso';

/** O símbolo de cada variante. Decorativo: quem informa é o texto. */
const SIMBOLO = {
  [TIPO_SUCESSO]: '✓',
  [TIPO_ERRO]: '✕',
  [TIPO_AVISO]: '!',
  [TIPO_INFORMACAO]: 'i',
};

const Contexto = createContext(null);

/**
 * Põe a pilha no `<body>`, fora da árvore de quem a disparou.
 *
 * Sem o portal, a pilha ficaria dentro do contêiner que o `render` do teste
 * devolve — e uma tela que não mostrou aviso nenhum deixaria de ser "vazia"
 * para quem a examina. Em produção o motivo é outro e maior: `position:
 * fixed` dentro de um ancestral com `transform` passa a ser relativo àquele
 * ancestral, e o cartão de premiação anima `transform`.
 */
function pilha(elemento) {
  if (typeof document === 'undefined') return elemento;

  return createPortal(elemento, document.body);
}

let sequencia = 0;

function proximoId() {
  sequencia += 1;
  return `toast-${sequencia}`;
}

/**
 * Um aviso na pilha.
 *
 * O cronômetro vive aqui, e não no provedor, porque ele precisa nascer e
 * morrer com o aviso: um `setTimeout` guardado num mapa do provedor sobrevive
 * ao aviso que o gerou quando a pessoa fecha antes do prazo, e dispara sobre
 * um id que já não existe.
 *
 * @param {object} props
 * @param {object} props.toast
 * @param {(id: string, expirou: boolean) => void} props.aoSair
 */
function Aviso({ toast, aoSair }) {
  const { id, tipo, texto, acao, duracaoMs } = toast;

  // `ref` e não dependência: `aoSair` muda de identidade a cada render do
  // provedor, e depender dela reiniciaria o cronômetro a cada aviso novo que
  // entrasse na pilha — o primeiro nunca sairia.
  const sair = useRef(aoSair);
  sair.current = aoSair;

  const eterno = tipo === TIPO_ERRO;

  useEffect(() => {
    if (eterno) return undefined;

    const prazo = Math.max(DURACAO_MINIMA_MS, Number(duracaoMs) || 0);
    const temporizador = setTimeout(() => sair.current(id, true), prazo);

    return () => clearTimeout(temporizador);
  }, [id, eterno, duracaoMs]);

  return (
    <div className="toast entra-caixa" data-tipo={tipo}>
      <span className="toast-simbolo" aria-hidden="true">
        {SIMBOLO[tipo] || SIMBOLO[TIPO_INFORMACAO]}
      </span>

      <p className="toast-texto">{texto}</p>

      {acao && (
        <button
          type="button"
          className="toast-acao"
          onClick={() => {
            acao.aoAcionar();
            sair.current(id, false);
          }}
        >
          {acao.rotulo}
        </button>
      )}

      <button
        type="button"
        className="toast-fechar"
        aria-label={ROTULO_FECHAR}
        onClick={() => sair.current(id, false)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/**
 * A pilha de avisos e a porta para dispará-los.
 *
 * Fica acima das rotas em `App.js` e dentro de `renderComProvedores` nos
 * testes: um aviso disparado por uma tela precisa sobreviver à troca dela, e
 * uma pilha por tela seria uma pilha que some no meio do aviso.
 */
export function ProvedorDeToasts({ children }) {
  const [toasts, setToasts] = useState([]);

  const fechar = useCallback((id, expirou = false) => {
    setToasts((atuais) => {
      const saindo = atuais.find((toast) => toast.id === id);

      // Só na expiração, e fora do `setState` não dá: quem disparou precisa
      // saber que o prazo venceu para tirar a gravação adiada do limbo
      // (AC-CHAMADO-04). Chamar aqui é seguro porque `aoExpirar` não mexe em
      // toast nenhum — ele grava no Firestore.
      if (saindo && expirou && saindo.aoExpirar) saindo.aoExpirar();

      return atuais.filter((toast) => toast.id !== id);
    });
  }, []);

  const mostrar = useCallback((toast) => {
    const id = toast.id || proximoId();

    setToasts((atuais) => [...atuais, { tipo: TIPO_INFORMACAO, ...toast, id }]);

    return id;
  }, []);

  const valor = useMemo(() => ({ mostrar, fechar }), [mostrar, fechar]);

  return (
    <Contexto.Provider value={valor}>
      {children}

      {/* `role="log"` já implica `aria-live="polite"`; o atributo vai
          explícito porque nem todo leitor de tela em uso nos laboratórios
          deriva um do outro. Vazio no primeiro render, de propósito. */}
      {pilha(
        <div className="toasts" role="log" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <Aviso key={toast.id} toast={toast} aoSair={fechar} />
          ))}
        </div>
      )}
    </Contexto.Provider>
  );
}

/**
 * Dispara e fecha avisos.
 *
 * @returns {{mostrar: (toast: object) => string, fechar: (id: string) => void}}
 */
export function useToasts() {
  const contexto = useContext(Contexto);

  if (!contexto) {
    // Explode em vez de virar no-op: um aviso que não aparece é uma falha
    // invisível, e a tela que a causou seria a última a ser suspeita.
    throw new Error('useToasts precisa de um <ProvedorDeToasts> acima na árvore.');
  }

  return contexto;
}
