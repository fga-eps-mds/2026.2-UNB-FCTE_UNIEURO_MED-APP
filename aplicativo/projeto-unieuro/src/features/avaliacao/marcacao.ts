import { authenticate, type CredentialsRepository } from '@/features/auth/authentication';
import type { SessionProfessional } from '@/features/auth/session';

/**
 * Marcação do exame como teste ou material de ensino (#58). Nada é apagado: o exame
 * continua nas listas e no tablet, e a exportação mostra a marcação. Vale para
 * qualquer exame do próprio médico, inclusive o finalizado, e pode ser desfeita com a
 * senha (aceite do cliente em 21/11).
 */
export type TipoMarcacao = 'teste' | 'ensino';

export const TIPOS_MARCACAO: readonly { id: TipoMarcacao; rotulo: string }[] = [
  { id: 'teste', rotulo: 'Teste' },
  { id: 'ensino', rotulo: 'Material de ensino' },
];

export const ROTULO_MARCACAO: Record<TipoMarcacao, string> = {
  teste: 'Teste',
  ensino: 'Material de ensino',
};

/** A coluna do banco aceita só os dois tipos; qualquer outro valor vale como sem marcação. */
export const lerMarcacao = (valor: string | null | undefined): TipoMarcacao | null =>
  valor === 'teste' || valor === 'ensino' ? valor : null;

export const ESCOLHA_O_TIPO = 'Escolha "Teste" ou "Material de ensino".';
export const SENHA_VAZIA = 'Digite a sua senha para confirmar.';
export const SENHA_NAO_CONFERE_MARCAR = 'A senha não confere. O exame continua sem marcação.';
export const SENHA_NAO_CONFERE_DESMARCAR = 'A senha não confere. A marcação continua.';
export const EXAME_NAO_ENCONTRADO = 'Exame não encontrado entre os que você aplicou.';
export const EXAME_JA_MARCADO = 'Este exame já estava marcado. A lista foi atualizada.';
export const EXAME_SEM_MARCACAO = 'Este exame já estava sem marcação. A lista foi atualizada.';

export const SENHA_NAO_CONFERE_PACIENTE_MARCAR =
  'A senha não confere. O paciente e os exames continuam sem marcação.';
export const SENHA_NAO_CONFERE_PACIENTE_DESMARCAR =
  'A senha não confere. A marcação do paciente continua.';
export const PACIENTE_NAO_ENCONTRADO = 'Paciente não encontrado entre os que você atendeu.';
export const PACIENTE_JA_MARCADO =
  'Os seus exames deste paciente já estavam marcados. A lista foi atualizada.';
export const PACIENTE_SEM_MARCACAO =
  'Os seus exames deste paciente já estavam sem marcação. A lista foi atualizada.';
export const SUPERUSUARIO_NAO_MARCA_PACIENTE =
  'O superusuário pode ver a marcação, mas não pode marcar nem desmarcar o paciente.';

export type ExameParaMarcar = { marcacao: TipoMarcacao | null };

export type PacienteParaMarcar = {
  totalExames: number;
  marcacoes: (TipoMarcacao | null)[];
};

export type MarcacaoRepository = {
  /** Exame que o profissional aplicou, com a marcação de agora, ou `null`. */
  buscarExame(atendimentoId: number, profissionalId: number): Promise<ExameParaMarcar | null>;
  /**
   * Marca o exame e grava o histórico na mesma transação. `false` se o exame não é
   * do profissional ou já estava marcado.
   */
  marcarExame(
    atendimentoId: number,
    profissionalId: number,
    tipo: TipoMarcacao,
    dataHora: string,
  ): Promise<boolean>;
  /** Tira a marcação e grava o histórico na mesma transação. `false` se não havia marcação. */
  desmarcarExame(atendimentoId: number, profissionalId: number, dataHora: string): Promise<boolean>;
  buscarPaciente(pacienteId: number, profissionalId: number): Promise<PacienteParaMarcar | null>;
  marcarPaciente(
    pacienteId: number,
    profissionalId: number,
    tipo: TipoMarcacao,
    dataHora: string,
  ): Promise<boolean>;
  desmarcarPaciente(pacienteId: number, profissionalId: number, dataHora: string): Promise<boolean>;
};

/**
 * `desatualizado` diz que a tela mostrava o exame de um jeito que já mudou (outro pedido
 * marcou ou desmarcou antes): a tela relê o paciente para o botão ficar certo.
 */
export type ResultadoMarcacao =
  | { feito: true }
  | { feito: false; mensagem: string; desatualizado?: true };

type Pedido = {
  atendimentoId: number;
  profissional: SessionProfessional;
  senha: string;
  agora?: Date;
};

const recusa = (mensagem: string): ResultadoMarcacao => ({ feito: false, mensagem });
const desatualizado = (mensagem: string): ResultadoMarcacao => ({
  feito: false,
  mensagem,
  desatualizado: true,
});

// A mesma conferência do login, para a senha da conta e não outro segredo.
async function senhaConfere(
  senha: string,
  profissional: SessionProfessional,
  credenciais: CredentialsRepository,
) {
  const resultado = await authenticate({ email: profissional.email, password: senha }, credenciais);
  return resultado.success && resultado.professional.id === profissional.id;
}

/** Marca um exame que o próprio profissional aplicou, confirmado pela senha dele. */
export async function marcarExame(
  {
    atendimentoId,
    profissional,
    senha,
    agora = new Date(),
    tipo,
  }: Pedido & { tipo: TipoMarcacao | null },
  repository: MarcacaoRepository,
  credenciais: CredentialsRepository,
): Promise<ResultadoMarcacao> {
  if (tipo === null) return recusa(ESCOLHA_O_TIPO);
  const exame = await repository.buscarExame(atendimentoId, profissional.id);
  if (!exame) return recusa(EXAME_NAO_ENCONTRADO);
  if (exame.marcacao !== null) return desatualizado(EXAME_JA_MARCADO);
  if (senha.length === 0) return recusa(SENHA_VAZIA);
  if (!(await senhaConfere(senha, profissional, credenciais))) {
    return recusa(SENHA_NAO_CONFERE_MARCAR);
  }

  const feito = await repository.marcarExame(
    atendimentoId,
    profissional.id,
    tipo,
    agora.toISOString(),
  );
  return feito ? { feito: true } : desatualizado(EXAME_JA_MARCADO);
}

/** Desfaz a marcação de um exame do próprio profissional, confirmado pela senha dele. */
export async function desmarcarExame(
  { atendimentoId, profissional, senha, agora = new Date() }: Pedido,
  repository: MarcacaoRepository,
  credenciais: CredentialsRepository,
): Promise<ResultadoMarcacao> {
  const exame = await repository.buscarExame(atendimentoId, profissional.id);
  if (!exame) return recusa(EXAME_NAO_ENCONTRADO);
  if (exame.marcacao === null) return desatualizado(EXAME_SEM_MARCACAO);
  if (senha.length === 0) return recusa(SENHA_VAZIA);
  if (!(await senhaConfere(senha, profissional, credenciais))) {
    return recusa(SENHA_NAO_CONFERE_DESMARCAR);
  }

  const feito = await repository.desmarcarExame(
    atendimentoId,
    profissional.id,
    agora.toISOString(),
  );
  return feito ? { feito: true } : desatualizado(EXAME_SEM_MARCACAO);
}

type PedidoPaciente = {
  pacienteId: number;
  profissional: SessionProfessional;
  senha: string;
  agora?: Date;
};

/** Marca todos os exames que o próprio profissional aplicou no paciente (#47). */
export async function marcarPaciente(
  {
    pacienteId,
    profissional,
    senha,
    agora = new Date(),
    tipo,
  }: PedidoPaciente & { tipo: TipoMarcacao | null },
  repository: MarcacaoRepository,
  credenciais: CredentialsRepository,
): Promise<ResultadoMarcacao> {
  if (profissional.superuser === true) return recusa(SUPERUSUARIO_NAO_MARCA_PACIENTE);
  if (tipo === null) return recusa(ESCOLHA_O_TIPO);
  const paciente = await repository.buscarPaciente(pacienteId, profissional.id);
  if (!paciente || paciente.totalExames === 0) return recusa(PACIENTE_NAO_ENCONTRADO);
  if (paciente.marcacoes.every((m) => m === tipo)) return desatualizado(PACIENTE_JA_MARCADO);
  if (senha.length === 0) return recusa(SENHA_VAZIA);
  if (!(await senhaConfere(senha, profissional, credenciais))) {
    return recusa(SENHA_NAO_CONFERE_PACIENTE_MARCAR);
  }

  const feito = await repository.marcarPaciente(
    pacienteId,
    profissional.id,
    tipo,
    agora.toISOString(),
  );
  return feito ? { feito: true } : desatualizado(PACIENTE_JA_MARCADO);
}

/** Desfaz a marcação dos exames que o próprio profissional aplicou no paciente (#47). */
export async function desmarcarPaciente(
  { pacienteId, profissional, senha, agora = new Date() }: PedidoPaciente,
  repository: MarcacaoRepository,
  credenciais: CredentialsRepository,
): Promise<ResultadoMarcacao> {
  if (profissional.superuser === true) return recusa(SUPERUSUARIO_NAO_MARCA_PACIENTE);
  const paciente = await repository.buscarPaciente(pacienteId, profissional.id);
  if (!paciente || paciente.totalExames === 0) return recusa(PACIENTE_NAO_ENCONTRADO);
  if (paciente.marcacoes.every((m) => m === null)) return desatualizado(PACIENTE_SEM_MARCACAO);
  if (senha.length === 0) return recusa(SENHA_VAZIA);
  if (!(await senhaConfere(senha, profissional, credenciais))) {
    return recusa(SENHA_NAO_CONFERE_PACIENTE_DESMARCAR);
  }

  const feito = await repository.desmarcarPaciente(
    pacienteId,
    profissional.id,
    agora.toISOString(),
  );
  return feito ? { feito: true } : desatualizado(PACIENTE_SEM_MARCACAO);
}
