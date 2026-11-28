import { hashPassword } from '@/features/auth/password';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/registration';

export type RedefinicaoRepository = {
  /** Só troca a senha de um médico com a conta ativa, a pedido de um superusuário ativo. */
  resetDoctorPassword(
    targetId: number,
    actorId: number,
    passwordHash: string,
    updatedAt: string,
  ): Promise<boolean>;
};

export type RedefinicaoInput = {
  novaSenha: string;
  confirmacao: string;
};

/** Um erro por campo, mostrado embaixo dele. `geral` é o erro que não é de um campo só. */
export type RedefinicaoErros = Partial<Record<keyof RedefinicaoInput | 'geral', string>>;

export type RedefinicaoResultado = { success: true } | { success: false; errors: RedefinicaoErros };

/** Quando o banco recusa: a conta foi desativada ou quem pede perdeu o perfil de superusuário. */
export const SENHA_NAO_REDEFINIDA =
  'A senha desta conta não pode ser redefinida. Volte ao início e abra a área de novo.';

/**
 * O superusuário redefine a senha de um médico que a esqueceu. A nova senha segue
 * as regras do cadastro.
 * `agora` é parâmetro para o teste fixar a data gravada em `last_update`.
 */
export async function redefinirSenha(
  superusuarioId: number,
  medicoId: number,
  { novaSenha, confirmacao }: RedefinicaoInput,
  repository: RedefinicaoRepository,
  agora: Date = new Date(),
): Promise<RedefinicaoResultado> {
  // Junta todos os erros dos campos para a tela mostrar de uma vez
  const errors: RedefinicaoErros = {};
  if (novaSenha.length < MIN_PASSWORD_LENGTH) {
    errors.novaSenha = `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (novaSenha !== confirmacao) errors.confirmacao = 'Confira a nova senha e a confirmação.';
  if (Object.keys(errors).length > 0) return { success: false, errors };

  // Só o hash vai para o banco, com o mesmo esquema do cadastro, nunca a senha em texto.
  const trocada = await repository.resetDoctorPassword(
    medicoId,
    superusuarioId,
    await hashPassword(novaSenha),
    agora.toISOString(),
  );
  if (!trocada) return { success: false, errors: { geral: SENHA_NAO_REDEFINIDA } };
  return { success: true };
}
