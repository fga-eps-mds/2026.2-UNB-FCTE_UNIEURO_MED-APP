import type { QuemAssina } from '@/features/avaliacao/termo-tcle';

export type EstadoAvaliacao =
  | 'aguardando_consentimento'
  | 'em_andamento'
  | 'processando_resultado'
  | 'erro_inferencia'
  | 'concluida'
  | 'cancelada'
  | 'interrompida';

export type DecisaoConsentimento = {
  atendimentoId: number;
  aceito: boolean;
  versaoTermo: string;
  quemAssina: QuemAssina;
  /** Data e hora em ISO 8601, pelo relógio do tablet. */
  decididoEm: string;
};

export type ConsentimentoRepository = {
  /**
   * Grava a decisão e muda o estado da avaliação na mesma transação. Retorna
   * `false` se a avaliação não existe ou já saiu de "aguardando consentimento".
   */
  salvarDecisao(decisao: DecisaoConsentimento): Promise<boolean>;
  buscarEstado(atendimentoId: number): Promise<EstadoAvaliacao | null>;
};

export type RegistrarDecisaoInput = Omit<DecisaoConsentimento, 'decididoEm'>;

export type ResultadoDecisao =
  | { sucesso: true; estado: 'em_andamento' | 'cancelada'; decididoEm: string }
  | { sucesso: false; motivo: 'atendimento_invalido' | 'decisao_ja_registrada' };

const idValido = (id: number) => Number.isInteger(id) && id > 0;

/**
 * Regra da decisão do TCLE. O instante é criado aqui para que toda chamada grave
 * data e hora no mesmo formato, e o relógio é injetável para testes.
 */
export async function registrarDecisaoConsentimento(
  input: RegistrarDecisaoInput,
  repository: ConsentimentoRepository,
  agora: () => Date = () => new Date(),
): Promise<ResultadoDecisao> {
  if (!idValido(input.atendimentoId)) {
    return { sucesso: false, motivo: 'atendimento_invalido' };
  }

  const decididoEm = agora().toISOString();
  const salva = await repository.salvarDecisao({ ...input, decididoEm });
  if (!salva) return { sucesso: false, motivo: 'decisao_ja_registrada' };

  return {
    sucesso: true,
    estado: input.aceito ? 'em_andamento' : 'cancelada',
    decididoEm,
  };
}

export type AcessoTarefas = 'liberado' | 'aguardando_consentimento' | 'bloqueado';

/**
 * Somente a avaliação em andamento pode abrir instruções e desenhos. A espera
 * volta ao TCLE; estados finais ou um id inexistente ficam bloqueados.
 */
export async function verificarAcessoTarefas(
  atendimentoId: number,
  repository: ConsentimentoRepository,
): Promise<AcessoTarefas> {
  if (!idValido(atendimentoId)) return 'bloqueado';

  const estado = await repository.buscarEstado(atendimentoId);
  if (estado === 'em_andamento') return 'liberado';
  if (estado === 'aguardando_consentimento') return 'aguardando_consentimento';
  return 'bloqueado';
}
