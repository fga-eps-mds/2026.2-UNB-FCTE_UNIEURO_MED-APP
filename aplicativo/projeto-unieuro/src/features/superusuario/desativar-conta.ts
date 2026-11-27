import {
  CONFIRME_COM_A_SUA_SENHA,
  SENHA_DO_SUPERUSUARIO_ERRADA,
  senhaDoSuperusuarioConfere,
  type ConfirmacaoRepository,
} from '@/features/superusuario/confirmacao';

export type DesativacaoRepository = ConfirmacaoRepository & {
  /** Só desativa a conta ativa de um médico a pedido de um superusuário ativo. */
  deactivateDoctor(targetId: number, actorId: number, deactivatedAt: string): Promise<boolean>;
};

export const CONTA_NAO_DESATIVADA =
  'Esta conta não pode ser desativada. Volte ao início e abra a área de novo.';

export type DesativacaoResultado = { success: true } | { success: false; message: string };

/**
 * O superusuário desativa a conta de um médico. Os exames
 * que o médico aplicou continuam no tablet.
 */
export async function desativarConta(
  superusuarioId: number,
  senhaDoSuperusuario: string,
  medicoId: number,
  repository: DesativacaoRepository,
  agora: Date = new Date(),
): Promise<DesativacaoResultado> {
  if (!senhaDoSuperusuario) return { success: false, message: CONFIRME_COM_A_SUA_SENHA };

  if (!(await senhaDoSuperusuarioConfere(superusuarioId, senhaDoSuperusuario, repository))) {
    return { success: false, message: SENHA_DO_SUPERUSUARIO_ERRADA };
  }

  // O banco recusa se a conta já estava desativada, se é de superusuário ou se quem
  // pede perdeu o perfil enquanto a tela estava aberta.
  if (!(await repository.deactivateDoctor(medicoId, superusuarioId, agora.toISOString()))) {
    return { success: false, message: CONTA_NAO_DESATIVADA };
  }
  return { success: true };
}
