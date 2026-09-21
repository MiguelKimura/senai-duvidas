// A lista de salas de cada pessoa — AC-SALA-06, AC-SALA-08, AC-SALA-09, AC-SALA-10.
//
// Esta é a tela inicial de quem já está autenticado, e é ela que cumpre a
// promessa central da task: o aluno digita o PIN uma vez em fevereiro e, de
// março a novembro, entra clicando no nome da sala.
//
// A lista vem do **espelho** `usuarios/{uid}/salas`, não das salas. A
// autoridade sobre quem é membro continua sendo `salas/{salaId}/membros/{uid}`
// — é ela que as rules consultam —, mas perguntar "de quais salas eu sou
// membro?" a partir dali exigiria varrer as salas de todo mundo, que é
// exatamente o que o AC-SEC-02 proíbe e o AC-PERF-03 encarece.
//
// As contagens do AC-SALA-08 só são buscadas para quem é dono: são duas
// consultas por sala, e o aluno não tem o que fazer com elas.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  PAPEL_DE_PROFESSOR,
  arquivarSala,
  carregarDetalhesDaSala,
  observarSalasDoUsuario,
  regerarPin,
} from '../services/salas';
import BotaoSair from './BotaoSair';
import PainelDoPin from './PainelDoPin';
import '../styles/Salas.css';

const ERRO_INESPERADO = 'Não foi possível falar com o servidor agora. Tente de novo em instantes.';

/** "1 membro" / "3 membros", sem o "(s)" que ninguém escreve à mão. */
function plural(quantidade, singular, plural_) {
  return `${quantidade} ${quantidade === 1 ? singular : plural_}`;
}

export default function MinhasSalas() {
  const { usuario, papel } = useAuth();
  const navegar = useNavigate();

  const [vinculos, setVinculos] = useState([]);
  const [detalhes, setDetalhes] = useState({});
  const [pinNovo, setPinNovo] = useState(null);
  const [erro, setErro] = useState(null);

  // Incrementado depois de cada escrita, para que os detalhes sejam relidos.
  // Atualizar o estado local na mão seria mais rápido e seria outra verdade: a
  // que a tela inventou, e não a que o banco aceitou.
  const [versao, setVersao] = useState(0);

  const uid = usuario?.uid;

  useEffect(() => {
    if (!uid) return undefined;

    // O retorno do `onSnapshot` é o cancelamento, e ele é o retorno do effect:
    // sem isso, trocar de tela deixaria um listener por montagem (AC-PERF-04).
    return observarSalasDoUsuario(uid, setVinculos);
  }, [uid]);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const carregadas = await Promise.all(
          vinculos.map((vinculo) =>
            carregarDetalhesDaSala(vinculo.salaId, {
              comContagens: vinculo.papel === PAPEL_DE_PROFESSOR,
            })
          )
        );

        if (!vivo) return;

        const mapa = {};
        vinculos.forEach((vinculo, indice) => {
          // `null` é a sala que sumiu ou da qual a pessoa foi removida: o
          // espelho dela fica para trás, e o cartão simplesmente não aparece.
          if (carregadas[indice]) mapa[vinculo.salaId] = carregadas[indice];
        });

        setDetalhes(mapa);
      } catch {
        if (vivo) setErro(ERRO_INESPERADO);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [vinculos, versao]);

  const salas = useMemo(
    () => vinculos.map((vinculo) => detalhes[vinculo.salaId]).filter(Boolean),
    [detalhes, vinculos]
  );

  const gerarPinNovo = useCallback(async (salaId) => {
    setErro(null);

    try {
      setPinNovo(await regerarPin(salaId));
      setVersao((anterior) => anterior + 1);
    } catch {
      setErro(ERRO_INESPERADO);
    }
  }, []);

  const arquivar = useCallback(async (salaId) => {
    setErro(null);

    try {
      await arquivarSala(salaId);
      // O PIN em destaque some junto: a sala arquivada não aceita mais ninguém.
      setPinNovo(null);
      setVersao((anterior) => anterior + 1);
    } catch {
      setErro(ERRO_INESPERADO);
    }
  }, []);

  return (
    <div className="tela-salas">
      <BotaoSair />
      <h1>Minhas salas</h1>

      {erro && (
        <p className="salas-erro" role="alert">
          {erro}
        </p>
      )}

      {pinNovo && <PainelDoPin pin={pinNovo} titulo="Novo PIN da sala" />}

      <div className="salas-barra">
        <button type="button" className="salas-acao" onClick={() => navegar('/salas/entrar')}>
          Entrar com PIN
        </button>

        {papel === PAPEL_DE_PROFESSOR && (
          <button type="button" className="salas-acao" onClick={() => navegar('/salas/nova')}>
            Criar sala
          </button>
        )}
      </div>

      {salas.length === 0 ? (
        <p className="salas-vazio">
          Você ainda não está em nenhuma sala. Peça o PIN ao professor da turma e entre por
          &quot;Entrar com PIN&quot;.
        </p>
      ) : (
        <ul className="salas-lista">
          {salas.map((sala) => {
            const ehDono = sala.professorUid === uid;

            return (
              <li className="sala-cartao" key={sala.salaId}>
                <h2>{sala.nome}</h2>
                <p className="sala-cartao-dados">{sala.curso}</p>
                <p className="sala-cartao-dados">Ano letivo {sala.anoLetivo}</p>

                {!sala.ativa && (
                  <p className="sala-cartao-arquivada">Sala arquivada — somente leitura</p>
                )}

                {ehDono && (
                  <>
                    <p className="sala-cartao-dados">
                      {plural(sala.totalMembros ?? 0, 'membro', 'membros')}
                    </p>
                    <p className="sala-cartao-dados">
                      {plural(sala.chamadosAbertos ?? 0, 'chamado aberto', 'chamados abertos')}
                    </p>
                  </>
                )}

                <button
                  type="button"
                  className="salas-acao"
                  onClick={() => navegar(`/sala/${sala.salaId}`)}
                >
                  Abrir sala
                </button>

                {ehDono && sala.ativa && (
                  <>
                    <button
                      type="button"
                      className="salas-acao salas-acao-discreta"
                      onClick={() => gerarPinNovo(sala.salaId)}
                    >
                      Gerar novo PIN
                    </button>
                    <button
                      type="button"
                      className="salas-acao salas-acao-discreta"
                      onClick={() => arquivar(sala.salaId)}
                    >
                      Arquivar sala
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
