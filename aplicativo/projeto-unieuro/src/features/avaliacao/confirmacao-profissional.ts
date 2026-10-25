import { authenticate, type CredentialsRepository } from '@/features/auth/authentication';
import type { SessionProfessional } from '@/features/auth/session';

export type ConfirmacaoResultado = { confirmado: true } | { confirmado: false; mensagem: string };

export const SENHA_VAZIA = 'Digite a sua senha para continuar.';
export const SENHA_INCORRETA =
  'Senha incorreta. Só o profissional que aplicou o teste pode continuar.';

/**
 * Confere se quem está com o tablet é o profissional da sessão, pela senha dele,
 * antes de sair da tela final do paciente (#11, cenário "resultado protegido").
 * Usa a mesma conferência do login, sem outro esquema de senha.
 */
export async function confirmarProfissional(
  senha: string,
  profissional: SessionProfessional,
  repository: CredentialsRepository,
): Promise<ConfirmacaoResultado> {
  if (senha.length === 0) return { confirmado: false, mensagem: SENHA_VAZIA };

  const resultado = await authenticate({ email: profissional.email, password: senha }, repository);
  if (resultado.success && resultado.professional.id === profissional.id) {
    return { confirmado: true };
  }
  return { confirmado: false, mensagem: SENHA_INCORRETA };
}
