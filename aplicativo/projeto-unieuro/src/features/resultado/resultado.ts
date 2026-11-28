import {
  montarMapaDoDesenho,
  type MapaDoDesenho,
  type TracadoDoDesenho,
} from '@/features/resultado/mapa-do-desenho';

/**
 * Resultado do exame para o médico (#14): cada desenho do paciente, na ordem das
 * tarefas, e o espaço do resultado do modelo. O paciente nunca vê esta tela.
 *
 * O modelo da #12 recebe os três desenhos juntos e devolve uma probabilidade para o
 * exame inteiro, e não um escore por desenho. Por isso o resultado do modelo fica num
 * lugar só, e cada desenho tem o seu espaço para o que influenciou a pontuação.
 */
export type TipoDesenho = 'relogio' | 'cubo' | 'trilhas';

/** Resultado do modelo como o repositório entrega. Espelha o `ModelResultRecord` do banco. */
export type ResultadoDoModeloGravado = {
  probability: number;
  contributions: Readonly<Record<TipoDesenho, number>>;
  maps: Readonly<Record<TipoDesenho, Float32Array>>;
  modelVersion: string;
  durationMs: number;
  calculatedAt: string;
};

/** Exame como o repositório entrega. Espelha o `ExamResultRecord` do banco. */
export type ExameComDesenhos = {
  id: number;
  startedAt: string;
  state: string;
  patientName: string;
  recordNumber: string;
  appliedBy: string;
  professionalId: number;
  drawings: { tipo: TipoDesenho; ordem: number; imagemPng: Uint8Array }[];
  /** Resultado do modelo, quando o cálculo já foi feito no tablet (#12). */
  model?: ResultadoDoModeloGravado | null;
  /** Quadro e traçado de cada tarefa, para pôr o mapa do modelo sobre o desenho. */
  traces?: Partial<Record<TipoDesenho, TracadoDoDesenho>>;
};

export type ResultadoRepository = {
  findExamResult(requesterId: number, examId: number): Promise<ExameComDesenhos | null>;
};

export type InfluenciaDoDesenho = {
  /** Parte do peso total do escore que veio deste desenho, de 0 a 1. */
  parteDoPeso: number;
  /** Para que lado o desenho puxou o escore. */
  puxaPara: 'ccl' | 'sem-ccl';
};

export type DesenhoDoResultado = {
  tipo: TipoDesenho;
  titulo: string;
  /** Imagem pronta para o componente `Image`, ou `null` se o desenho não foi gravado. */
  imagem: string | null;
  /** O que pesou neste desenho, ou `null` antes do cálculo do modelo. */
  influencia: InfluenciaDoDesenho | null;
  /** Onde o desenho pesou, ou `null` antes do cálculo ou sem traço para alinhar o mapa. */
  mapa: MapaDoDesenho | null;
};

export type ModeloDoResultado = {
  probabilidade: number;
  classe: 'ccl' | 'sem-ccl';
  calculadoEm: string;
};

export type ResultadoDoExame = Omit<ExameComDesenhos, 'drawings' | 'model' | 'traces'> & {
  desenhos: DesenhoDoResultado[];
  /** Resultado do modelo, ou `null` antes do cálculo. */
  modelo: ModeloDoResultado | null;
};

/**
 * Corte da classe prevista. O artigo de origem e o treino usam 0,5, e o PO citou esse valor
 * como o usual na Ata 12. A faixa de incerteza perto do corte saiu da #13 na mesma ata.
 */
export const CORTE_DA_CLASSE = 0.5;

export const TAREFAS_DO_RESULTADO: readonly { tipo: TipoDesenho; titulo: string }[] = [
  { tipo: 'relogio', titulo: 'Relógio' },
  { tipo: 'cubo', titulo: 'Cubo' },
  { tipo: 'trilhas', titulo: 'Trilhas' },
];

/** Os estados em que o exame já tem os três desenhos e, portanto, um resultado a mostrar. */
const ESTADOS_COM_RESULTADO = new Set(['processando_resultado', 'erro_inferencia', 'concluida']);

export function temResultado(estado: string): boolean {
  return ESTADOS_COM_RESULTADO.has(estado);
}

/** O exame terminou as tarefas e ainda espera o cálculo, ou o cálculo anterior falhou. */
export function esperaOModelo(estado: string): boolean {
  return estado === 'processando_resultado' || estado === 'erro_inferencia';
}

function influencias(
  modelo: ResultadoDoModeloGravado,
): Partial<Record<TipoDesenho, InfluenciaDoDesenho>> {
  const pesoTotal = TAREFAS_DO_RESULTADO.reduce(
    (soma, { tipo }) => soma + Math.abs(modelo.contributions[tipo]),
    0,
  );
  const resultado: Partial<Record<TipoDesenho, InfluenciaDoDesenho>> = {};
  for (const { tipo } of TAREFAS_DO_RESULTADO) {
    const contribuicao = modelo.contributions[tipo];
    resultado[tipo] = {
      parteDoPeso: pesoTotal > 0 ? Math.abs(contribuicao) / pesoTotal : 0,
      puxaPara: contribuicao >= 0 ? 'ccl' : 'sem-ccl',
    };
  }
  return resultado;
}

const PEDACO = 0x8000;

/** PNG do banco como `data:` URI. O `btoa` vem do Hermes, sem biblioteca a mais. */
export function pngParaDataUri(png: Uint8Array): string {
  let binario = '';
  for (let inicio = 0; inicio < png.length; inicio += PEDACO) {
    binario += String.fromCharCode(...png.subarray(inicio, inicio + PEDACO));
  }
  return `data:image/png;base64,${btoa(binario)}`;
}

/** Sempre os três desenhos, na ordem das tarefas, mesmo que algum não tenha sido gravado. */
export function montarResultado(exame: ExameComDesenhos): ResultadoDoExame {
  const { drawings, model, traces, ...cabecalho } = exame;
  const porDesenho = model ? influencias(model) : {};
  return {
    ...cabecalho,
    modelo: model
      ? {
          probabilidade: model.probability,
          classe: model.probability >= CORTE_DA_CLASSE ? 'ccl' : 'sem-ccl',
          calculadoEm: model.calculatedAt,
        }
      : null,
    desenhos: TAREFAS_DO_RESULTADO.map(({ tipo, titulo }) => {
      const gravado = drawings.find((desenho) => desenho.tipo === tipo);
      const tracado = traces?.[tipo];
      return {
        tipo,
        titulo,
        imagem: gravado ? pngParaDataUri(gravado.imagemPng) : null,
        influencia: porDesenho[tipo] ?? null,
        mapa: model && tracado ? montarMapaDoDesenho(model.maps[tipo], tracado) : null,
      };
    }),
  };
}

export async function carregarResultado(
  profissionalId: number,
  exameId: number,
  repository: ResultadoRepository,
): Promise<ResultadoDoExame | null> {
  const exame = await repository.findExamResult(profissionalId, exameId);
  return exame ? montarResultado(exame) : null;
}
