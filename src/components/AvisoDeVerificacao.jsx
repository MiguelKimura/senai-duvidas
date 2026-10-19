// O aviso de "confirme seu e-mail" para quem vai virar professor.
//
// Aparece só para a conta com e-mail @sp.senai.br ainda não confirmado. Até a
// confirmação, a conta entra como aluno — é o mesmo papel que a Security Rule
// enxerga, porque o token ainda diz `email_verified: false`. O aviso existe
// para que a professora não fique procurando o botão "Criar sala" sem saber
// por que ele não aparece.
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { enviarConfirmacaoDeEmail, recarregarUsuario } from '../services/auth';
import { aguardaConfirmacaoDeProfessor } from '../utils/professorPorDominio';

export const TEXTO_DO_AVISO =
  'Para liberar o acesso de professor, confirme o seu e-mail @sp.senai.br: ' +
  'abra o link que enviamos para a sua caixa de entrada (confira também o spam).';

export const TEXTO_REENVIADO = 'Enviamos um novo link. Pode levar alguns minutos para chegar.';

export const TEXTO_AINDA_NAO =
  'O e-mail ainda não aparece como confirmado. Abra o link e tente de novo.';

const TEXTO_FALHA = 'Não foi possível falar com o servidor agora. Tente de novo em instantes.';

export default function AvisoDeVerificacao() {
  const { usuario, tentarNovamente } = useAuth();
  const [mensagem, setMensagem] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  if (!aguardaConfirmacaoDeProfessor(usuario)) return null;

  const executar = async (acao) => {
    setOcupado(true);
    setMensagem(null);

    try {
      await acao();
    } catch {
      setMensagem(TEXTO_FALHA);
    } finally {
      setOcupado(false);
    }
  };

  const reenviar = () =>
    executar(async () => {
      await enviarConfirmacaoDeEmail(usuario);
      setMensagem(TEXTO_REENVIADO);
    });

  const jaConfirmei = () =>
    executar(async () => {
      await recarregarUsuario(usuario);

      if (usuario.emailVerified) {
        // Refaz a resolução do papel com o token novo: é aqui que a conta
        // sobe para professor, sem precisar sair e entrar de novo.
        tentarNovamente();
      } else {
        setMensagem(TEXTO_AINDA_NAO);
      }
    });

  return (
    <section className="aviso-verificacao" aria-label="Confirmação do e-mail de professor">
      <p>{TEXTO_DO_AVISO}</p>

      <div className="aviso-verificacao-acoes">
        <button type="button" className="salas-acao" disabled={ocupado} onClick={jaConfirmei}>
          Já confirmei
        </button>
        <button
          type="button"
          className="salas-acao salas-acao-discreta"
          disabled={ocupado}
          onClick={reenviar}
        >
          Reenviar e-mail
        </button>
      </div>

      {mensagem && (
        <p className="aviso-verificacao-mensagem" role="status">
          {mensagem}
        </p>
      )}
    </section>
  );
}
