// O campo de digitação — AC-CHAT-09, AC-CHAT-11.
//
// O campo não sabe o que é um comando, não sabe o que é uma sala e não fala com
// o Firestore. Ele entrega o texto para quem chamou e mostra o que voltar de
// erro. É o que permite usar o mesmo campo na conversa da turma e na conversa
// direta, onde as regras de envio são outras.
//
// Duas coisas que a v0.7.0 não fazia e que doem todo dia:
//
// **O texto sobrevive à falha.** Ali o campo era limpo antes de a escrita
// terminar, então uma recusa da rule — ou a rede do laboratório caindo —
// apagava o que a pessoa escreveu. Aqui o campo só esvazia depois do sucesso.
//
// **Shift+Enter quebra linha.** Um chat onde Enter sempre envia obriga a
// escrever tudo numa linha só, e o aluno que quer colar três linhas de erro
// manda três mensagens.
import React, { useState } from 'react';
import { FaArrowRight } from 'react-icons/fa';
import { TAMANHO_MAXIMO_DA_MENSAGEM } from '../../services/chat';

/**
 * A partir de quantos caracteres o contador aparece.
 *
 * 400 de 500 — os últimos 20%. Antes disso o limite é teórico e o número seria
 * só ruído ao lado de toda frase digitada.
 */
export const CONTADOR_A_PARTIR_DE = 400;

const AVISO_DE_ARQUIVADA = 'Sala arquivada — a conversa está em somente leitura.';

/**
 * O campo de escrever mensagem.
 *
 * @param {object} props
 * @param {(texto: string) => (void|Promise<void>)} props.aoEnviar recebe o
 *   texto. Se rejeitar, a mensagem **continua no campo** e o motivo aparece.
 * @param {(digitando: boolean) => void} [props.aoDigitar] AC-CHAT-11. Opcional:
 *   a conversa direta o usa, a aba da sala pode não usar.
 * @param {boolean} [props.somenteLeitura] sala arquivada (AC-SALA-10).
 * @param {string} [props.valorInicial] só para teste e para rascunho futuro.
 */
export default function CampoMensagem({
  aoEnviar,
  aoDigitar,
  somenteLeitura = false,
  valorInicial = '',
}) {
  const [texto, setTexto] = useState(valorInicial);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const avisarDigitacao = (digitando) => {
    if (aoDigitar) aoDigitar(digitando);
  };

  const escrever = (valor) => {
    // O corte no `onChange` cobre o texto colado, que não passa por tecla
    // nenhuma. `maxLength` sozinho já barra a digitação, mas em parte dos
    // navegadores ele não se aplica a uma colagem programática.
    setTexto(valor.slice(0, TAMANHO_MAXIMO_DA_MENSAGEM));
    setErro(null);
    avisarDigitacao(valor.trim() !== '');
  };

  const enviar = async () => {
    const limpo = texto.trim();
    if (limpo === '' || enviando) return;

    setEnviando(true);

    try {
      await aoEnviar(limpo);
      setTexto('');
      setErro(null);
      avisarDigitacao(false);
    } catch (falha) {
      // O texto fica. Perder o que a pessoa escreveu por causa de uma recusa
      // do servidor é o pior desfecho possível deste componente.
      setErro(falha.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  };

  const aoTeclar = (evento) => {
    if (evento.key !== 'Enter' || evento.shiftKey) return;

    evento.preventDefault();
    enviar();
  };

  const mostrarContador = texto.length >= CONTADOR_A_PARTIR_DE;
  const noLimite = texto.length >= TAMANHO_MAXIMO_DA_MENSAGEM;

  return (
    <div className="campo-mensagem">
      {erro && (
        <p className="campo-mensagem-erro" role="alert">
          {erro}
        </p>
      )}

      {somenteLeitura && <p className="campo-mensagem-aviso">{AVISO_DE_ARQUIVADA}</p>}

      <div className="campo-mensagem-linha">
        <input
          type="text"
          className="campo-mensagem-entrada"
          value={texto}
          maxLength={TAMANHO_MAXIMO_DA_MENSAGEM}
          disabled={somenteLeitura}
          onChange={(evento) => escrever(evento.target.value)}
          onKeyDown={aoTeclar}
          onBlur={() => avisarDigitacao(false)}
          placeholder="Escreva uma mensagem"
        />

        <button
          type="button"
          className="enviar-btn"
          onClick={enviar}
          disabled={somenteLeitura || enviando}
          aria-label="Enviar mensagem"
        >
          <FaArrowRight />
        </button>
      </div>

      {mostrarContador && (
        <p
          className={`campo-mensagem-contador${
            noLimite ? ' campo-mensagem-contador--no-limite' : ''
          }`}
        >
          {texto.length}/{TAMANHO_MAXIMO_DA_MENSAGEM}
        </p>
      )}
    </div>
  );
}
