import { authenticate, type CredentialsRepository } from '@/features/auth/authentication';
import type { SessionProfessional } from '@/features/auth/session';
import type { EstadoAvaliacao } from '@/features/avaliacao/consentimento';

/**
 * Estados depois dos três desenhos. Ata 12 (09/11): exame finalizado faz parte da
 * pesquisa e não pode ser excluído. O banco tem a mesma lista nos gatilhos da
 * versão 10 (`schema.ts`).
 */
export const ESTADOS_FINALIZADOS: readonly EstadoAvaliacao[] = [
  'processando_resultado',
  'erro_inferencia',
  'concluida',
];

export const exameFinalizado = (estado: string) =>
  (ESTADOS_FINALIZADOS as readonly string[]).includes(estado);

/** A tela do exame só oferece "Excluir" quando isto é verdade (#58). */
export const podeExcluirExame = (estado: string) => !exameFinalizado(estado);

export const SENHA_VAZIA = 'Digite a sua senha para confirmar.';
export const SENHA_NAO_CONFERE = 'A senha não confere. Nada foi apagado.';
export const EXAME_FINALIZADO =
  'Exame finalizado não pode ser excluído, porque faz parte da pesquisa.';
export const PACIENTE_COM_EXAME_FINALIZADO =
  'Este paciente tem exame finalizado e não pode ser excluído, porque o exame faz parte da pesquisa.';
export const EXAME_NAO_ENCONTRADO = 'Exame não encontrado entre os que você aplicou.';
export const PACIENTE_NAO_ENCONTRADO = 'Paciente não encontrado entre os que você atendeu.';

export type ExameParaExcluir = { estado: string };
export type PacienteParaExcluir = { exames: number; finalizados: number };

export type ExclusaoRepository = {
  /** Exame do profissional que ainda não foi excluído, ou `null`. */
  buscarExame(atendimentoId: number, profissionalId: number): Promise<ExameParaExcluir | null>;
  /**
   * Marca o exame e grava o registro na mesma transação. `false` se o exame não é
   * do profissional, já foi excluído ou foi finalizado nesse meio-tempo.
   */
  excluirExame(atendimentoId: number, profissionalId: number, dataHora: string): Promise<boolean>;
  /** Exames ainda não excluídos que o profissional aplicou nesse paciente. */
  resumirPaciente(pacienteId: number, profissionalId: number): Promise<PacienteParaExcluir>;
  /** Marca esses exames e grava o registro na mesma transação, se nenhum estiver finalizado. */
  excluirPaciente(pacienteId: number, profissionalId: number, dataHora: string): Promise<boolean>;
};

export type ResultadoExclusao = { excluido: true } | { excluido: false; mensagem: string };

type Pedido = {
  profissional: SessionProfessional;
  senha: string;
  agora?: Date;
};

const recusa = (mensagem: string): ResultadoExclusao => ({ excluido: false, mensagem });

// A mesma conferência do login, para a senha da conta e não outro segredo.
async function senhaConfere(
  senha: string,
  profissional: SessionProfessional,
  credenciais: CredentialsRepository,
) {
  const resultado = await authenticate({ email: profissional.email, password: senha }, credenciais);
  return resultado.success && resultado.professional.id === profissional.id;
}

/**
 * Exclusão de um exame aberto por engano (#58). Só o profissional que aplicou,
 * só antes de finalizar, e só com a senha dele. O exame sai das listas, mas
 * continua no tablet com a data e o profissional da exclusão.
 */
export async function excluirExame(
  { atendimentoId, profissional, senha, agora = new Date() }: Pedido & { atendimentoId: number },
  repository: ExclusaoRepository,
  credenciais: CredentialsRepository,
): Promise<ResultadoExclusao> {
  const exame = await repository.buscarExame(atendimentoId, profissional.id);
  if (!exame) return recusa(EXAME_NAO_ENCONTRADO);
  if (exameFinalizado(exame.estado)) return recusa(EXAME_FINALIZADO);
  if (senha.length === 0) return recusa(SENHA_VAZIA);
  if (!(await senhaConfere(senha, profissional, credenciais))) return recusa(SENHA_NAO_CONFERE);

  const excluido = await repository.excluirExame(
    atendimentoId,
    profissional.id,
    agora.toISOString(),
  );
  return excluido ? { excluido: true } : recusa(EXAME_FINALIZADO);
}

/**
 * Exclusão de um paciente cadastrado por engano (#47). Recusada se ele tem exame
 * finalizado com este profissional. Os exames dele com outro médico não mudam.
 */
export async function excluirPaciente(
  { pacienteId, profissional, senha, agora = new Date() }: Pedido & { pacienteId: number },
  repository: ExclusaoRepository,
  credenciais: CredentialsRepository,
): Promise<ResultadoExclusao> {
  const resumo = await repository.resumirPaciente(pacienteId, profissional.id);
  if (resumo.exames === 0) return recusa(PACIENTE_NAO_ENCONTRADO);
  if (resumo.finalizados > 0) return recusa(PACIENTE_COM_EXAME_FINALIZADO);
  if (senha.length === 0) return recusa(SENHA_VAZIA);
  if (!(await senhaConfere(senha, profissional, credenciais))) return recusa(SENHA_NAO_CONFERE);

  const excluido = await repository.excluirPaciente(
    pacienteId,
    profissional.id,
    agora.toISOString(),
  );
  return excluido ? { excluido: true } : recusa(PACIENTE_COM_EXAME_FINALIZADO);
}
