import { findActiveWithPassword, type AccountRepository } from '@/features/auth/account';

/**
 * Confirmação das ações da área do superusuário. Desativar uma conta, redefinir
 * uma senha e criar um superusuário pedem a senha do super usuário
 */

export const CONFIRME_COM_A_SUA_SENHA = 'Confirme com a sua senha de superusuário.';
export const SENHA_DO_SUPERUSUARIO_ERRADA = 'A sua senha não confere.';

export type ConfirmacaoRepository = Pick<AccountRepository, 'findById'>;

export async function senhaDoSuperusuarioConfere(
  superusuarioId: number,
  senha: string,
  repository: ConfirmacaoRepository,
): Promise<boolean> {
  return (await findActiveWithPassword(superusuarioId, senha, repository)) !== null;
}
