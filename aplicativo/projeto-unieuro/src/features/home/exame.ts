/**
 * Regras do "Ver exame". Converte o que o repositório entrega no que a tela
 * mostra, sem saber onde os dados estão guardados.
 */
import { valorDoParametro, type ParametroDeRota } from '@/features/avaliacao/tarefas';
import {
  EXAM_STATUS_LABEL,
  formatDate,
  toExamStatus,
  type ExamStatus,
} from '@/features/home/patients';

export type TipoTarefa = 'relogio' | 'cubo' | 'trilhas';

// Espelham os tipos de `db/exam-repository.ts`, que esta camada não importa.
export type DesenhoGravado = {
  tipo: TipoTarefa;
  ordem: number;
  confirmadoEm: string;
  imagemPng: Uint8Array;
};

export type ExameGravado = {
  id: number;
  iniciadoEm: string;
  estado: string;
  pacienteNome: string;
  numeroFicha: string;
  profissionalNome: string;
  desenhos: DesenhoGravado[];
};

export type ExameRepository = {
  /** Devolve `null` também para o exame aplicado por outro profissional. */
  buscarExame(profissionalId: number, atendimentoId: number): Promise<ExameGravado | null>;
};

// O que a tela mostra de cada tarefa. Sem desenho gravado,
// a imagem e a hora ficam `null`.
export type DesenhoDaConsulta = {
  ordem: number;
  tipo: TipoTarefa;
  nome: string;
  imagemUri: string | null;
  confirmadoAs: string | null;
};

// O exame como a tela mostra, com a data e a hora já no fuso do tablet.
export type ExameDaConsulta = {
  id: number;
  pacienteNome: string;
  numeroFicha: string;
  profissionalNome: string;
  data: string;
  hora: string;
  situacao: ExamStatus | null;
  situacaoTexto: string;
  desenhos: DesenhoDaConsulta[];
  desenhosGravados: number;
  resultado: string;
};

export const TAREFAS_DO_EXAME: readonly { ordem: number; tipo: TipoTarefa; nome: string }[] = [
  { ordem: 1, tipo: 'relogio', nome: 'Relógio' },
  { ordem: 2, tipo: 'cubo', nome: 'Cubo' },
  { ordem: 3, tipo: 'trilhas', nome: 'Trilhas' },
];

// repete o texto do exame interrompido.
export const SITUACAO_EM_ANDAMENTO = 'Em andamento';

export const RESULTADO_INDISPONIVEL =
  'O resultado do modelo ainda não está disponível no aplicativo.';

export const SEM_ANALISE = 'Sem análise do modelo: ele precisa dos três desenhos.';

const twoDigits = (value: number) => String(value).padStart(2, '0');

// o exame é gravado em UTC e a hora aparece no fuso do tablet.
export function formatarHora(isoDate: string): string {
  const date = new Date(isoDate);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// O `<Image>` só recebe a imagem do banco como texto em base64. A conversão é feita
// à mão porque o `btoa` depende da versão do motor JavaScript do aparelho.
export function paraBase64(bytes: Uint8Array): string {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const temSegundo = i + 1 < bytes.length;
    const temTerceiro = i + 2 < bytes.length;
    const bloco =
      (bytes[i] << 16) | ((temSegundo ? bytes[i + 1] : 0) << 8) | (temTerceiro ? bytes[i + 2] : 0);
    texto +=
      BASE64[(bloco >> 18) & 63] +
      BASE64[(bloco >> 12) & 63] +
      (temSegundo ? BASE64[(bloco >> 6) & 63] : '=') +
      (temTerceiro ? BASE64[bloco & 63] : '=');
  }
  return texto;
}

export function pngParaDataUri(png: Uint8Array): string {
  return `data:image/png;base64,${paraBase64(png)}`;
}

/** Exame que ainda não terminou não tem selo na lista de pacientes". */
export function situacaoDoExame(estado: string): { situacao: ExamStatus | null; texto: string } {
  const situacao = toExamStatus(estado);
  return { situacao, texto: situacao ? EXAM_STATUS_LABEL[situacao] : SITUACAO_EM_ANDAMENTO };
}

/** As três tarefas aparecem sempre e a que não tem desenho gravado fica sem imagem. */
export function paraConsulta(exame: ExameGravado): ExameDaConsulta {
  const desenhos = TAREFAS_DO_EXAME.map(({ ordem, tipo, nome }) => {
    // Procura pela ordem, porque o repositório só devolve as tarefas com desenho.
    const gravado = exame.desenhos.find((desenho) => desenho.ordem === ordem);
    return {
      ordem,
      tipo,
      nome,
      imagemUri: gravado ? pngParaDataUri(gravado.imagemPng) : null,
      confirmadoAs: gravado ? formatarHora(gravado.confirmadoEm) : null,
    };
  });
  const desenhosGravados = desenhos.filter((desenho) => desenho.imagemUri !== null).length;
  const { situacao, texto } = situacaoDoExame(exame.estado);

  return {
    id: exame.id,
    pacienteNome: exame.pacienteNome,
    numeroFicha: exame.numeroFicha,
    profissionalNome: exame.profissionalNome,
    data: formatDate(exame.iniciadoEm),
    hora: formatarHora(exame.iniciadoEm),
    situacao,
    situacaoTexto: texto,
    desenhos,
    desenhosGravados,
    // O modelo precisa dos três desenhos para analisar.
    resultado: desenhosGravados < TAREFAS_DO_EXAME.length ? SEM_ANALISE : RESULTADO_INDISPONIVEL,
  };
}

/**
 * Só aceita inteiro positivo escrito sem zeros à esquerda. Um id
 * inválido vira `null`, e o banco não é consultado
 */
export function lerAtendimento(valor: ParametroDeRota): number | null {
  const texto = valorDoParametro(valor);
  if (texto === undefined || !/^[1-9]\d*$/.test(texto)) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) ? id : null;
}
