import type { TipoTarefa } from '@/features/captura/drawing';
import { reconstruirTracos, type EventoTracado } from '@/features/captura/eventos-tracado';
import { ModeloAusenteError } from '@/features/inferencia/arquivo-do-modelo';
import {
  avaliarExame,
  type DesenhosDoExame,
  type SaidasDoModelo,
} from '@/features/inferencia/escore';
import type { ModeloCarregado } from '@/features/inferencia/modelo-onnx';

/**
 * Análise do exame pelo modelo de IA no tablet (#12), depois que o profissional retoma o
 * aparelho na tela final. O paciente não vê esta etapa nem o resultado (#11).
 */

/** Exame como o repositório entrega. Espelha o `ExamForAnalysisRecord` do banco. */
export type ExameParaAnalise = {
  id: number;
  state: string;
  patientName: string;
  recordNumber: string;
  events: Readonly<Record<TipoTarefa, readonly EventoTracado[]>>;
};

/** Resultado como o repositório grava. Espelha o `ModelResultRecord` do banco. */
export type ResultadoGravado = {
  probability: number;
  contributions: Readonly<Record<TipoTarefa, number>>;
  maps: Readonly<Record<TipoTarefa, Float32Array>>;
  modelVersion: string;
  durationMs: number;
  calculatedAt: string;
};

export type AnaliseRepository = {
  findExamForAnalysis(requesterId: number, examId: number): Promise<ExameParaAnalise | null>;
  saveResult(examId: number, result: ResultadoGravado): Promise<boolean>;
  markError(examId: number, at: string): Promise<void>;
};

export type DependenciasDaAnalise = {
  repository: AnaliseRepository;
  carregarModelo: () => Promise<ModeloCarregado>;
  /** Relógio em milissegundos, para medir o tempo do cálculo no tablet (E7). */
  agoraMs?: () => number;
  agora?: () => Date;
  /** Avisa a tela de cada etapa, para o checklist do protótipo acompanhar o cálculo. */
  aoAvancar?: (etapa: EtapaDaAnalise, exame: ExameParaAnalise) => void;
};

export type EtapaDaAnalise = 'abrindo-modelo' | 'calculando' | 'gravando';

export type ResultadoDaAnalise =
  | { situacao: 'concluida' }
  | { situacao: 'ja-concluida' }
  | { situacao: 'nao-encontrado' }
  | { situacao: 'sem-modelo' }
  | { situacao: 'erro'; mensagem: string };

// Só o exame que terminou as três tarefas e espera o modelo vai para o cálculo.
const ESPERA_O_MODELO = new Set(['processando_resultado', 'erro_inferencia']);

export const FALHA_NO_CALCULO =
  'Não foi possível calcular o resultado no tablet. Os desenhos continuam guardados, e o cálculo pode ser feito de novo.';
export const SEM_MODELO_NO_APK =
  'Este APK foi gerado sem o arquivo do modelo de IA. Os desenhos continuam guardados.';

function desenhosDoExame(exame: ExameParaAnalise): DesenhosDoExame {
  return {
    relogio: reconstruirTracos(exame.events.relogio),
    cubo: reconstruirTracos(exame.events.cubo),
    trilhas: reconstruirTracos(exame.events.trilhas),
  };
}

function paraGravar(saidas: SaidasDoModelo, versao: string, durationMs: number, em: Date) {
  return {
    probability: saidas.probabilidade,
    contributions: saidas.contribuicoes,
    maps: saidas.mapas,
    modelVersion: versao,
    durationMs: Math.round(durationMs),
    calculatedAt: em.toISOString(),
  };
}

export async function analisarExame(
  profissionalId: number,
  exameId: number,
  {
    repository,
    carregarModelo,
    agoraMs = () => performance.now(),
    agora = () => new Date(),
    aoAvancar = () => undefined,
  }: DependenciasDaAnalise,
): Promise<ResultadoDaAnalise> {
  const exame = await repository.findExamForAnalysis(profissionalId, exameId);
  if (!exame) return { situacao: 'nao-encontrado' };
  if (exame.state === 'concluida') return { situacao: 'ja-concluida' };
  if (!ESPERA_O_MODELO.has(exame.state)) return { situacao: 'nao-encontrado' };

  try {
    aoAvancar('abrindo-modelo', exame);
    const { versao, modelo } = await carregarModelo();
    aoAvancar('calculando', exame);
    // O tempo medido é o do cálculo do exame, sem a abertura do modelo, como no E7.
    const inicio = agoraMs();
    const saidas = await avaliarExame(desenhosDoExame(exame), modelo);
    const duracao = agoraMs() - inicio;
    aoAvancar('gravando', exame);
    const gravado = await repository.saveResult(
      exameId,
      paraGravar(saidas, versao, duracao, agora()),
    );
    return gravado ? { situacao: 'concluida' } : { situacao: 'ja-concluida' };
  } catch (erro) {
    // A mensagem do erro não vai para o log: ela pode citar o desenho ou o escore.
    await repository.markError(exameId, agora().toISOString());
    if (erro instanceof ModeloAusenteError) return { situacao: 'sem-modelo' };
    return { situacao: 'erro', mensagem: FALHA_NO_CALCULO };
  }
}
