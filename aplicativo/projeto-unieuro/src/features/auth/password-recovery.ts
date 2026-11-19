import { hashPassword } from '@/features/auth/password';
import { MIN_PASSWORD_LENGTH, parseCrm } from '@/features/auth/registration';
import { parseCpf } from '@/features/shared/cpf';

// Sem internet não dá para mandar e-mail, então a identidade é confirmada pelo CPF e pelo
// CRM com UF do cadastro e o médico cria uma senha nova, sem ver a antiga (#48). Os dados
// que confirmam a identidade ainda precisam do aceite do PO.

// Limite proposto para a #48: 5 erros seguidos bloqueiam a recuperação no tablet por 15 min.
// Os dois valores ainda precisam ser combinados com o PO.
export const MAX_FAILED_ATTEMPTS = 5;
export const BLOCK_MINUTES = 15;
const MILLISECONDS_PER_MINUTE = 60_000;

export const IDENTITY_NOT_CONFIRMED_MESSAGE =
  'Não foi possível confirmar a sua identidade. Confira os dados e tente de novo. A senha não mudou.';

export type PasswordRecoveryInput = {
  cpf: string;
  crm: string;
  newPassword: string;
  confirmation: string;
};

export type RecoveryErrors = Partial<Record<keyof PasswordRecoveryInput, string>>;

export type RecoveryAccount = { id: number; active: boolean };

export type PasswordRecoveryRepository = {
  findByCpfAndCrm(
    cpf: string,
    crmNumber: string,
    crmState: string,
  ): Promise<RecoveryAccount | null>;
  updatePasswordHash(id: number, passwordHash: string, updatedAt: string): Promise<void>;
};

export type RecoveryAttempts = { failures: number; blockedUntil: string | null };

export type RecoveryAttemptsStore = {
  read(): Promise<RecoveryAttempts>;
  write(attempts: RecoveryAttempts): Promise<void>;
};

export const NO_FAILED_ATTEMPTS: RecoveryAttempts = { failures: 0, blockedUntil: null };

export type PasswordRecoveryResult =
  | { success: true }
  | { success: false; reason: 'invalid-fields'; errors: RecoveryErrors }
  | { success: false; reason: 'identity-not-confirmed' | 'blocked'; message: string };

type ValidRecovery = { cpf: string; crmNumber: string; crmState: string; newPassword: string };

type RecoveryValidation =
  | { valid: true; recovery: ValidRecovery }
  | { valid: false; errors: RecoveryErrors };

// O CPF, o CRM e a nova senha seguem as mesmas regras do cadastro (#5).
export function validateRecovery(input: PasswordRecoveryInput): RecoveryValidation {
  const errors: RecoveryErrors = {};
  const cpf = parseCpf(input.cpf);
  const crm = parseCrm(input.crm);

  if (!input.cpf.trim()) errors.cpf = 'Preencha o CPF.';
  else if (!cpf) errors.cpf = 'Informe um CPF válido.';

  if (!input.crm.trim()) errors.crm = 'Preencha o CRM e a UF.';
  else if (!crm) errors.crm = 'Informe o CRM e a UF, por exemplo 12345/DF.';

  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (input.newPassword !== input.confirmation) {
    errors.confirmation = 'Confira a nova senha e a confirmação.';
  }

  if (!cpf || !crm || Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    recovery: { cpf, crmNumber: crm.number, crmState: crm.state, newPassword: input.newPassword },
  };
}

type BlockedAttempts = RecoveryAttempts & { blockedUntil: string };

export function isBlocked(attempts: RecoveryAttempts, now: Date): attempts is BlockedAttempts {
  return attempts.blockedUntil !== null && now.getTime() < Date.parse(attempts.blockedUntil);
}

// Depois do bloqueio, a contagem recomeça do zero.
function currentAttempts(attempts: RecoveryAttempts, now: Date): RecoveryAttempts {
  const blockExpired = attempts.blockedUntil !== null && !isBlocked(attempts, now);
  return blockExpired ? NO_FAILED_ATTEMPTS : attempts;
}

export function attemptsAfterFailure(attempts: RecoveryAttempts, now: Date): RecoveryAttempts {
  const failures = currentAttempts(attempts, now).failures + 1;
  if (failures < MAX_FAILED_ATTEMPTS) return { failures, blockedUntil: null };

  const blockedUntil = new Date(now.getTime() + BLOCK_MINUTES * MILLISECONDS_PER_MINUTE);
  return { failures, blockedUntil: blockedUntil.toISOString() };
}

function blockedResult(attempts: BlockedAttempts, now: Date): PasswordRecoveryResult {
  const remaining = Date.parse(attempts.blockedUntil) - now.getTime();
  const minutes = Math.ceil(remaining / MILLISECONDS_PER_MINUTE);
  return {
    success: false,
    reason: 'blocked',
    message: `Muitas tentativas seguidas. Tente de novo daqui a ${minutes} min. A senha não mudou.`,
  };
}

// CPF e CRM não são segredo (o CRM é público), então as tentativas seguidas com dados
// errados são limitadas no tablet inteiro, já que não dá para saber de quem é a conta.
// A mensagem é a mesma para qualquer dado errado, para a tela não dizer quem tem conta.
export async function recoverPassword(
  input: PasswordRecoveryInput,
  repository: PasswordRecoveryRepository,
  attemptsStore: RecoveryAttemptsStore,
  now: Date = new Date(),
): Promise<PasswordRecoveryResult> {
  const validation = validateRecovery(input);
  if (!validation.valid)
    return { success: false, reason: 'invalid-fields', errors: validation.errors };

  // Campo vazio ou mal digitado não gasta tentativa. Só conta o erro que chega a ser
  // conferido com o cadastro.
  const attempts = await attemptsStore.read();
  if (isBlocked(attempts, now)) return blockedResult(attempts, now);

  const { cpf, crmNumber, crmState, newPassword } = validation.recovery;
  const account = await repository.findByCpfAndCrm(cpf, crmNumber, crmState);

  // Conta desativada não volta a entrar por aqui: ela recebe a mesma resposta de dado errado.
  if (!account?.active) {
    const updated = attemptsAfterFailure(attempts, now);
    await attemptsStore.write(updated);
    if (isBlocked(updated, now)) return blockedResult(updated, now);
    return {
      success: false,
      reason: 'identity-not-confirmed',
      message: IDENTITY_NOT_CONFIRMED_MESSAGE,
    };
  }

  await repository.updatePasswordHash(
    account.id,
    await hashPassword(newPassword),
    now.toISOString(),
  );
  await attemptsStore.write(NO_FAILED_ATTEMPTS);
  return { success: true };
}
