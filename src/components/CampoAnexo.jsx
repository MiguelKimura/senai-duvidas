// O campo de anexo do modal — AC-IMG-01 a AC-IMG-09 e AC-IMG-12.
//
// Até a v0.5.0 havia um campo de texto e uma instrução: "Digite o URL da
// imagem". Quem acabou de tirar um print do erro não tem URL nenhuma, e é
// justamente essa pessoa que mais precisa do anexo — o professor não consegue
// diagnosticar "deu erro" escrito à mão.
//
// As três entradas novas existem porque cobrem três jeitos diferentes de a
// imagem já estar na máquina do aluno:
//
//   * **seletor** — a foto que ele já salvou, ou o recorte que gravou;
//   * **arrastar** — o arquivo que está aberto na pasta ao lado do navegador;
//   * **colar** — o PrintScreen, que não virou arquivo nenhum no disco.
//
// As três desembocam na mesma função, e por isso passam pela mesma validação:
// um `.exe` renomeado é recusado venha ele de onde vier.
//
// O campo por URL continua onde estava, com o mesmo texto: é regressão
// declarada (AC-IMG-01), e há chamado aberto assim todo dia.
import React, { useCallback, useRef, useState } from 'react';
import { ORIGEM_DE_URL, ehUrlDeImagem, enviarAnexo, removerAnexo } from '../services/anexos';
import useColarImagem from '../hooks/useColarImagem';
import '../styles/CampoAnexo.css';

/** O que o diálogo do sistema operacional oferece ao aluno. */
export const FORMATOS_ACEITOS = 'image/png,image/jpeg,image/webp,image/gif';

/** O que a tela diz quando o que foi colado no campo de link não é endereço. */
export const ERRO_DE_URL =
  'Isso não parece um endereço de imagem. Cole o endereço completo, começando com https://.';

/** O que a tela diz quando a imagem do anexo não carrega (AC-IMG-12). */
export const AVISO_DE_IMAGEM_QUEBRADA = 'Não foi possível carregar a imagem deste endereço.';

/**
 * O campo de anexo, com as quatro maneiras de anexar.
 *
 * O componente **não** guarda o anexo: quem guarda é o modal, porque é o modal
 * que grava o chamado. O que vive aqui é só o estado do envio em andamento —
 * progresso, erro e o controle de cancelamento —, que morre junto com ele.
 *
 * @param {{salaId: string|null, chamadoId: string, anexo: object|null,
 *   onAnexoMudou: (anexo: object|null) => void, desabilitado?: boolean}} props
 */
export default function CampoAnexo({
  salaId,
  chamadoId,
  anexo,
  onAnexoMudou,
  desabilitado = false,
}) {
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState(null);
  const [recebendo, setRecebendo] = useState(false);
  const [imagemQuebrada, setImagemQuebrada] = useState(false);
  const [linkDigitado, setLinkDigitado] = useState('');
  const controle = useRef(null);

  const enviando = progresso !== null;

  /**
   * Valida, sobe e devolve o anexo ao modal.
   *
   * O erro anterior é limpo **antes** de começar: o aluno que escolheu outra
   * imagem depois de uma falha não pode continuar olhando para a mensagem da
   * tentativa passada enquanto a nova sobe.
   */
  const anexarArquivo = useCallback(
    async (arquivo) => {
      if (!arquivo || desabilitado) return;

      setErro(null);
      setImagemQuebrada(false);
      setProgresso(0);

      const abortador = new AbortController();
      controle.current = abortador;

      try {
        const enviado = await enviarAnexo(arquivo, {
          salaId,
          chamadoId,
          sinal: abortador.signal,
          onProgresso: (fracao) => setProgresso(Math.round(fracao * 100)),
        });

        onAnexoMudou(enviado);
      } catch (falha) {
        // Cancelar é escolha do aluno, não erro: mostrar uma faixa vermelha
        // para quem apertou "Cancelar" só assusta.
        if (!falha.cancelado) setErro(falha.message);
      } finally {
        controle.current = null;
        setProgresso(null);
      }
    },
    [chamadoId, desabilitado, onAnexoMudou, salaId]
  );

  useColarImagem(anexarArquivo, { ativo: !desabilitado });

  const cancelar = () => {
    if (controle.current) controle.current.abort();
  };

  const aoSoltar = (evento) => {
    evento.preventDefault();
    setRecebendo(false);

    const [arquivo] = [...((evento.dataTransfer && evento.dataTransfer.files) || [])];
    anexarArquivo(arquivo);
  };

  const aoArrastarPorCima = (evento) => {
    // Sem o `preventDefault`, o navegador abre a imagem na própria aba e a
    // descrição que o aluno estava escrevendo vai junto com a página.
    evento.preventDefault();
    if (!desabilitado) setRecebendo(true);
  };

  const aoDigitarLink = (evento) => {
    const valor = evento.target.value;
    setLinkDigitado(valor);
    setImagemQuebrada(false);

    if (valor.trim() === '') {
      setErro(null);
      onAnexoMudou(null);
      return;
    }

    if (!ehUrlDeImagem(valor)) {
      setErro(ERRO_DE_URL);
      onAnexoMudou(null);
      return;
    }

    setErro(null);
    onAnexoMudou({ url: valor.trim(), origem: ORIGEM_DE_URL });
  };

  /**
   * Tira o anexo do formulário e o arquivo do Storage.
   *
   * O arquivo já subiu quando o aluno escolheu a imagem — antes de o chamado
   * existir —, então desistir dele aqui é a única chance de ele não virar
   * órfão: ninguém mais vai saber que aquele caminho existe.
   */
  const remover = () => {
    setImagemQuebrada(false);
    setLinkDigitado('');
    if (anexo && anexo.caminho) removerAnexo(anexo.caminho);
    onAnexoMudou(null);
  };

  return (
    <div
      className={`zona-de-anexo${recebendo ? ' zona-de-anexo--recebendo' : ''}`}
      data-testid="zona-de-anexo"
      onDragOver={aoArrastarPorCima}
      onDragLeave={() => setRecebendo(false)}
      onDrop={aoSoltar}
    >
      <label className="campo-anexo-rotulo" htmlFor="campo-anexo-arquivo">
        Anexar imagem do computador
      </label>
      <input
        id="campo-anexo-arquivo"
        type="file"
        accept={FORMATOS_ACEITOS}
        disabled={desabilitado || enviando}
        onChange={(evento) => anexarArquivo(evento.target.files && evento.target.files[0])}
      />
      <p className="campo-anexo-dica">
        Arraste a imagem para cá ou cole a captura de tela com Ctrl+V.
      </p>

      <div className="image-url-container">
        <input
          type="text"
          value={linkDigitado}
          placeholder="Cole o link da imagem"
          disabled={desabilitado || enviando}
          onChange={aoDigitarLink}
        />
        <p>Digite o URL da imagem</p>
      </div>

      {enviando && (
        <div className="campo-anexo-envio">
          <progress max="100" value={progresso} aria-label="Enviando a imagem">
            {progresso}%
          </progress>
          <button type="button" className="campo-anexo-cancelar" onClick={cancelar}>
            Cancelar envio
          </button>
        </div>
      )}

      {erro && (
        <p className="campo-anexo-erro" role="alert">
          {erro}
        </p>
      )}

      {anexo && (
        <div className="image-preview">
          {imagemQuebrada ? (
            <p className="campo-anexo-quebrada">{AVISO_DE_IMAGEM_QUEBRADA}</p>
          ) : (
            <img
              src={anexo.url}
              alt="Pré-visualização do anexo"
              onError={() => setImagemQuebrada(true)}
            />
          )}
          <button type="button" className="delete-image-btn" onClick={remover}>
            Remover imagem
          </button>
        </div>
      )}
    </div>
  );
}
