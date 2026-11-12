export type ConfirmacaoResultado = { confirmado: true } | { confirmado: false; mensagem: string };

export type ProfessionalCpfRepository = {
  /** Lê e decifra o CPF somente durante a conferência. */
  getCpf(professionalId: number): Promise<string | null>;
};

export const DIGITOS_VAZIOS = 'Informe os quatro primeiros dígitos do seu CPF.';
export const DIGITOS_INCOMPLETOS = 'Informe exatamente quatro dígitos.';
export const DIGITOS_INCORRETOS =
  'Dígitos incorretos. Só o profissional que aplicou o teste pode continuar.';

/**
 * Confere se quem está com o tablet é o profissional da sessão pelos quatro
 * primeiros dígitos do CPF. O CPF é lido do armazenamento protegido sob demanda:
 * ele não entra na sessão nem é devolvido para a interface.
 */
export async function confirmarProfissional(
  digitos: string,
  professionalId: number,
  repository: ProfessionalCpfRepository,
): Promise<ConfirmacaoResultado> {
  if (digitos.length === 0) return { confirmado: false, mensagem: DIGITOS_VAZIOS };
  if (!/^\d{4}$/.test(digitos)) {
    return { confirmado: false, mensagem: DIGITOS_INCOMPLETOS };
  }

  const cpf = await repository.getCpf(professionalId);
  if (!cpf || !/^\d{11}$/.test(cpf)) {
    throw new Error('CPF do profissional da sessão indisponível.');
  }

  return cpf.slice(0, 4) === digitos
    ? { confirmado: true }
    : { confirmado: false, mensagem: DIGITOS_INCORRETOS };
}
