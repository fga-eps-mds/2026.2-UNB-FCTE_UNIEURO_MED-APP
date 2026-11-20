/**
 * Resultado do exame para o médico (#14): cada desenho do paciente, na ordem das
 * tarefas, e o espaço do resultado do modelo. O paciente nunca vê esta tela.
 *
 * O modelo da #12 recebe os três desenhos juntos e devolve uma probabilidade para o
 * exame inteiro, e não um escore por desenho. Por isso o resultado do modelo fica num
 * lugar só, e cada desenho tem o seu espaço para o que influenciou a pontuação.
 */
export type TipoDesenho = 'relogio' | 'cubo' | 'trilhas';

/** Exame como o repositório entrega. Espelha o `ExamResultRecord` do banco. */
export type ExameComDesenhos = {
  id: number;
  startedAt: string;
  state: string;
  patientName: string;
  recordNumber: string;
  appliedBy: string;
  drawings: { tipo: TipoDesenho; ordem: number; imagemPng: Uint8Array }[];
};

export type ResultadoRepository = {
  findExamResult(requesterId: number, examId: number): Promise<ExameComDesenhos | null>;
};

export type DesenhoDoResultado = {
  tipo: TipoDesenho;
  titulo: string;
  /** Imagem pronta para o componente `Image`, ou `null` se o desenho não foi gravado. */
  imagem: string | null;
};

export type ResultadoDoExame = Omit<ExameComDesenhos, 'drawings'> & {
  desenhos: DesenhoDoResultado[];
};

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
  const { drawings, ...cabecalho } = exame;
  return {
    ...cabecalho,
    desenhos: TAREFAS_DO_RESULTADO.map(({ tipo, titulo }) => {
      const gravado = drawings.find((desenho) => desenho.tipo === tipo);
      return { tipo, titulo, imagem: gravado ? pngParaDataUri(gravado.imagemPng) : null };
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
