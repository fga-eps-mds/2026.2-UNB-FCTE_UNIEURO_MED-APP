/**
 * Desistência e retomada do exame (#25). Quem desiste para na tarefa atual, os
 * desenhos já confirmados ficam gravados, e a retomada abre a primeira tarefa
 * ainda sem desenho, sem repetir as que já foram feitas.
 */
import { TOTAL_TAREFAS } from '@/features/avaliacao/tarefas';

export type MotivoDesistencia = 'cansaco' | 'nao_quis_continuar' | 'mal_estar' | 'outro';

export const MOTIVOS_DESISTENCIA: readonly { id: MotivoDesistencia; rotulo: string }[] = [
  { id: 'cansaco', rotulo: 'Cansaço' },
  { id: 'nao_quis_continuar', rotulo: 'Não quis continuar' },
  { id: 'mal_estar', rotulo: 'Mal-estar' },
  { id: 'outro', rotulo: 'Outro' },
];

export const ROTULO_MOTIVO: Record<MotivoDesistencia, string> = Object.fromEntries(
  MOTIVOS_DESISTENCIA.map(({ id, rotulo }) => [id, rotulo]),
) as Record<MotivoDesistencia, string>;

export type ExameInterrompido = {
  atendimentoId: number;
  nomePaciente: string;
  fichaPaciente: string;
  tarefa: number;
  motivo: MotivoDesistencia | null;
  interrompidoEm: string;
  tarefasGravadas: number[];
};

export type InterrupcaoRepository = {
  interromper(registro: {
    atendimentoId: number;
    tarefa: number;
    motivo: MotivoDesistencia | null;
    interrompidoEm: string;
  }): Promise<boolean>;
  buscarInterrompido(
    atendimentoId: number,
    profissionalId: number,
  ): Promise<ExameInterrompido | null>;
  retomar(atendimentoId: number, profissionalId: number, retomadoEm: string): Promise<boolean>;
};

export type DesistenciaInput = {
  atendimentoId: number;
  tarefa: number;
  motivo: MotivoDesistencia | null;
};

const tarefaValida = (tarefa: number) =>
  Number.isInteger(tarefa) && tarefa >= 1 && tarefa <= TOTAL_TAREFAS;

/** Lança erro se o exame não estava em andamento: nada muda no banco nesse caso. */
export async function desistirDoExame(
  { atendimentoId, tarefa, motivo }: DesistenciaInput,
  repository: InterrupcaoRepository,
  agora: () => Date = () => new Date(),
): Promise<void> {
  if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
    throw new Error('Atendimento inválido ao registrar a desistência.');
  }
  if (!tarefaValida(tarefa)) throw new Error('Tarefa inválida ao registrar a desistência.');

  const registrada = await repository.interromper({
    atendimentoId,
    tarefa,
    motivo,
    interrompidoEm: agora().toISOString(),
  });
  if (!registrada) throw new Error('O exame não estava em andamento.');
}

/** Primeira tarefa sem desenho confirmado, ou `null` se as três já foram feitas. */
export function proximaTarefa(tarefasGravadas: readonly number[]): number | null {
  for (let tarefa = 1; tarefa <= TOTAL_TAREFAS; tarefa += 1) {
    if (!tarefasGravadas.includes(tarefa)) return tarefa;
  }
  return null;
}

export type RetomadaResultado = { retomado: true; tarefa: number } | { retomado: false };

/**
 * Volta o exame para o andamento e diz em qual tarefa ele continua. Não retoma
 * exame de outro profissional, exame que não está interrompido nem exame com as
 * três tarefas já gravadas.
 */
export async function retomarExame(
  atendimentoId: number,
  profissionalId: number,
  repository: InterrupcaoRepository,
  agora: () => Date = () => new Date(),
): Promise<RetomadaResultado> {
  const exame = await repository.buscarInterrompido(atendimentoId, profissionalId);
  if (!exame) return { retomado: false };

  const tarefa = proximaTarefa(exame.tarefasGravadas);
  if (tarefa === null) return { retomado: false };

  const retomado = await repository.retomar(atendimentoId, profissionalId, agora().toISOString());
  return retomado ? { retomado: true, tarefa } : { retomado: false };
}
