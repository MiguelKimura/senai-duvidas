// O painel de concessão do professor — AC-PERK-01, AC-PERK-07, AC-PERK-10.
//
// A autorização que vale é a da rule: ela recusa quem não é dono desta sala
// mesmo com o cliente adulterado. Este painel não protege nada — ele existe
// para que conceder seja um gesto de dez segundos, no meio da aula, sem o
// professor sair da fila que está olhando.
//
// Três escolhas de produto moram aqui:
//
//   * **o professor não está na lista de premiáveis.** Premiar a si mesmo não
//     tem sentido pedagógico, e oferecer a opção convida ao engano;
//   * **"anunciar para a sala" nasce desmarcado.** A justificativa é o que dá
//     sentido ao prêmio, mas mostrá-la para a turma inteira também expõe, por
//     omissão, quem não foi premiado naquele dia;
//   * **revogar é um gesto reversível em aparência e irreversível no
//     registro.** O perk sai da fila e continua na vitrine do aluno, no
//     histórico, com o evento de auditoria ao lado.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PAPEL_DE_PROFESSOR, listarMembros } from '../../services/salas';
import {
  ErroDePerk,
  TAMANHO_MAXIMO_DA_JUSTIFICATIVA,
  VALIDADES_EM_DIAS,
  concederPerk,
  revogarPerk,
  rotuloDoTipo,
} from '../../services/perks';
import { NIVEL_MAXIMO, TIPOS_DE_PERK, perkEstaAtivo } from '../../services/filaChamados';
import { formatarDataHora } from '../../services/tempo';
import '../../styles/Perks.css';

/** O que a tela diz quando o servidor recusa por um motivo que não é de forma. */
export const ERRO_INESPERADO =
  'Não foi possível conceder a premiação agora. Tente de novo em instantes.';

/** O valor da opção "não vence". Vazio porque `<option>` só carrega string. */
const SEM_VALIDADE = '';

/** O estado inicial do formulário, e o estado para o qual ele volta. */
const FORMULARIO_VAZIO = {
  alunoUid: '',
  tipo: TIPOS_DE_PERK[0],
  nivel: '1',
  validadeEmDias: '7',
  justificativa: '',
  anunciarParaSala: false,
};

const NIVEIS = Array.from({ length: NIVEL_MAXIMO }, (_, indice) => String(indice + 1));

/**
 * O painel de premiações da sala, para o dono dela.
 *
 * @param {object} props
 * @param {string} props.salaId
 * @param {Array<object>} [props.perks] os perks que a sala já carregou — o
 *   painel não abre consulta de perk nenhuma (AC-PERF-03).
 * @param {Date|import('firebase/firestore').Timestamp|string|null} [props.agoraServidor]
 *   instante do servidor, de onde sai a validade (AC-PERK-03).
 * @param {boolean} [props.somenteLeitura] sala arquivada (AC-SALA-10).
 */
export default function PainelDePerks({
  salaId,
  perks = [],
  agoraServidor = null,
  somenteLeitura = false,
}) {
  const { usuario } = useAuth();

  const [alunos, setAlunos] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    let vivo = true;

    listarMembros(salaId)
      .then((membros) => {
        if (!vivo) return;

        // O professor fora da lista: ele concede, não recebe.
        setAlunos(membros.filter((membro) => membro.papel !== PAPEL_DE_PROFESSOR));
      })
      .catch(() => {
        if (vivo) setErro(ERRO_INESPERADO);
      });

    return () => {
      vivo = false;
    };
  }, [salaId]);

  const ativos = useMemo(
    () => perks.filter((perk) => perkEstaAtivo(perk, agoraServidor)),
    [perks, agoraServidor]
  );

  const alterar = useCallback((campo, valor) => {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }, []);

  const professor = useMemo(
    () =>
      usuario
        ? { uid: usuario.uid, nome: usuario.displayName || usuario.email || 'Professor' }
        : null,
    [usuario]
  );

  const enviar = useCallback(
    async (evento) => {
      evento.preventDefault();
      setErro(null);
      setAviso(null);

      const aluno = alunos.find((candidato) => candidato.uid === formulario.alunoUid);

      if (!aluno || !professor) {
        setErro('Escolha o aluno que vai receber a premiação.');
        return;
      }

      try {
        await concederPerk(salaId, { uid: aluno.uid, nome: aluno.nome }, professor, {
          tipo: formulario.tipo,
          nivel: Number(formulario.nivel),
          justificativa: formulario.justificativa,
          validadeEmDias:
            formulario.validadeEmDias === SEM_VALIDADE
              ? null
              : Number(formulario.validadeEmDias),
          anunciarParaSala: formulario.anunciarParaSala,
          agoraServidor,
        });

        setAviso(`${rotuloDoTipo(formulario.tipo)} concedida a ${aluno.nome}.`);
        setFormulario(FORMULARIO_VAZIO);
      } catch (falha) {
        // `ErroDePerk` já vem em português e é sobre o que o professor
        // digitou. Qualquer outra falha é do servidor, e dizer o motivo dela
        // em inglês no meio da aula não ajudaria ninguém.
        setErro(falha instanceof ErroDePerk ? falha.message : ERRO_INESPERADO);
      }
    },
    [alunos, formulario, professor, salaId, agoraServidor]
  );

  const revogar = useCallback(
    async (perk) => {
      setErro(null);
      setAviso(null);

      try {
        await revogarPerk(salaId, perk, professor);
        setAviso(`Premiação de ${perk.alunoNome} revogada.`);
      } catch {
        setErro(ERRO_INESPERADO);
      }
    },
    [salaId, professor]
  );

  return (
    <section className="perk-painel" aria-label="Conceder premiações">
      <h3>Premiações</h3>

      {erro && (
        <p className="salas-erro" role="alert">
          {erro}
        </p>
      )}

      {aviso && (
        <p className="perk-painel-aviso" role="status">
          {aviso}
        </p>
      )}

      {!somenteLeitura && (
        <form className="perk-painel-formulario" onSubmit={enviar}>
          <label>
            Aluno
            <select
              value={formulario.alunoUid}
              onChange={(evento) => alterar('alunoUid', evento.target.value)}
            >
              <option value="">Escolha…</option>
              {alunos.map((aluno) => (
                <option key={aluno.uid} value={aluno.uid}>
                  {aluno.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tipo
            <select
              value={formulario.tipo}
              onChange={(evento) => alterar('tipo', evento.target.value)}
            >
              {TIPOS_DE_PERK.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {rotuloDoTipo(tipo)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nível
            <select
              value={formulario.nivel}
              onChange={(evento) => alterar('nivel', evento.target.value)}
            >
              {NIVEIS.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {nivel}
                </option>
              ))}
            </select>
          </label>

          <label>
            Validade
            <select
              value={formulario.validadeEmDias}
              onChange={(evento) => alterar('validadeEmDias', evento.target.value)}
            >
              {VALIDADES_EM_DIAS.map((dias) => (
                <option key={dias} value={String(dias)}>
                  {dias} {dias === 1 ? 'dia' : 'dias'}
                </option>
              ))}
              <option value={SEM_VALIDADE}>Sem validade (permanente)</option>
            </select>
          </label>

          <label>
            Justificativa (opcional)
            <textarea
              value={formulario.justificativa}
              maxLength={TAMANHO_MAXIMO_DA_JUSTIFICATIVA + 1}
              onChange={(evento) => alterar('justificativa', evento.target.value)}
            />
          </label>

          <label className="perk-painel-caixa">
            <input
              type="checkbox"
              checked={formulario.anunciarParaSala}
              onChange={(evento) => alterar('anunciarParaSala', evento.target.checked)}
            />
            Anunciar para a sala
          </label>

          <div className="perk-painel-acoes">
            <button type="submit">Conceder premiação</button>
          </div>
        </form>
      )}

      <h4>Premiações ativas na sala</h4>

      {ativos.length === 0 ? (
        <p className="perk-vitrine-vazio">Nenhuma premiação ativa nesta sala.</p>
      ) : (
        <ul className="perk-painel-lista" aria-label="Premiações ativas na sala">
          {ativos.map((perk) => (
            <li key={perk.id}>
              <span>
                {perk.alunoNome} — {rotuloDoTipo(perk.tipo)} nível {Number(perk.nivel) || 1}
                {perk.expiraEm ? ` (até ${formatarDataHora(perk.expiraEm)})` : ' (permanente)'}
              </span>

              {!somenteLeitura && (
                <button
                  type="button"
                  className="salas-acao salas-acao-discreta"
                  onClick={() => revogar(perk)}
                >
                  Revogar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
