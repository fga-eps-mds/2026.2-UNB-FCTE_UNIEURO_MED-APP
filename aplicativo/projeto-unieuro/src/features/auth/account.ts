import { hashPassword, verifyPassword } from '@/features/auth/password';
import { MIN_PASSWORD_LENGTH, isBrazilianState, isValidEmail } from '@/features/auth/registration';

/**
 * Manutenção da conta do profissional (#5): consultar, editar os dados, trocar
 * a senha e desativar. Toda alteração exige a senha atual, para que ninguém
 * mude a conta de outro médico num tablet deixado aberto.
 */

export type AccountProfile = {
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
};

export type StoredAccount = AccountProfile & {
  id: number;
  passwordHash: string;
  active: boolean;
};

export type AccountRepository = {
  findById(id: number): Promise<StoredAccount | null>;
  emailInUseByOther(email: string, id: number): Promise<boolean>;
  crmInUseByOther(crmNumber: string, crmState: string, id: number): Promise<boolean>;
  updateProfile(id: number, profile: AccountProfile, updatedAt: string): Promise<void>;
  updatePasswordHash(id: number, passwordHash: string, updatedAt: string): Promise<void>;
  deactivate(id: number, deactivatedAt: string): Promise<void>;
};

export type ProfileErrors = Partial<Record<keyof AccountProfile | 'currentPassword', string>>;

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
};

export type PasswordErrors = Partial<Record<keyof PasswordChangeInput, string>>;

export const WRONG_PASSWORD_MESSAGE = 'A senha atual não confere.';
const MISSING_PASSWORD_MESSAGE = 'Confirme com a sua senha atual.';

type ProfileValidation =
  | { valid: true; profile: AccountProfile }
  | { valid: false; errors: ProfileErrors };

/** Mesmas regras do cadastro, com uma mensagem para cada campo a corrigir. */
export function validateProfile(input: AccountProfile): ProfileValidation {
  const errors: ProfileErrors = {};
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const crmNumber = input.crmNumber.trim();
  const crmState = input.crmState.trim().toUpperCase();

  if (!name) errors.name = 'Preencha o nome.';

  if (!email) errors.email = 'Preencha o e-mail.';
  else if (!isValidEmail(email)) errors.email = 'Informe um e-mail válido.';

  if (!crmNumber) errors.crmNumber = 'Preencha o CRM.';
  else if (!/^\d+$/.test(crmNumber)) errors.crmNumber = 'O CRM tem só números.';

  if (!isBrazilianState(crmState)) errors.crmState = 'Informe a UF do CRM, por exemplo DF.';

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, profile: { name, email, crmNumber, crmState } };
}

async function findActiveWithPassword(
  id: number,
  password: string,
  repository: AccountRepository,
): Promise<StoredAccount | null> {
  const account = await repository.findById(id);
  if (!account?.active) return null;
  return (await verifyPassword(password, account.passwordHash)) ? account : null;
}

export type ProfileUpdateResult =
  | { success: true; profile: AccountProfile & { id: number } }
  | { success: false; errors: ProfileErrors };

/**
 * A senha é conferida antes da busca por e-mail e CRM repetidos, para que a
 * tela não sirva para descobrir quem está cadastrado no tablet.
 */
export async function updateProfile(
  id: number,
  input: AccountProfile,
  currentPassword: string,
  repository: AccountRepository,
  now: Date = new Date(),
): Promise<ProfileUpdateResult> {
  const validation = validateProfile(input);
  const errors: ProfileErrors = validation.valid ? {} : { ...validation.errors };
  if (!currentPassword) errors.currentPassword = MISSING_PASSWORD_MESSAGE;
  if (!validation.valid || errors.currentPassword) return { success: false, errors };

  const { profile } = validation;
  if (!(await findActiveWithPassword(id, currentPassword, repository))) {
    return { success: false, errors: { currentPassword: WRONG_PASSWORD_MESSAGE } };
  }

  if (await repository.emailInUseByOther(profile.email, id)) {
    return { success: false, errors: { email: 'Este e-mail já está em uso por outra conta.' } };
  }
  if (await repository.crmInUseByOther(profile.crmNumber, profile.crmState, id)) {
    return { success: false, errors: { crmNumber: 'Este CRM já está em uso por outra conta.' } };
  }

  await repository.updateProfile(id, profile, now.toISOString());
  return { success: true, profile: { id, ...profile } };
}

export type PasswordChangeResult = { success: true } | { success: false; errors: PasswordErrors };

export async function changePassword(
  id: number,
  { currentPassword, newPassword, confirmation }: PasswordChangeInput,
  repository: AccountRepository,
  now: Date = new Date(),
): Promise<PasswordChangeResult> {
  const errors: PasswordErrors = {};
  if (!currentPassword) errors.currentPassword = 'Informe a senha atual.';
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (newPassword !== confirmation) errors.confirmation = 'Confira a nova senha e a confirmação.';
  if (Object.keys(errors).length > 0) return { success: false, errors };

  if (!(await findActiveWithPassword(id, currentPassword, repository))) {
    return { success: false, errors: { currentPassword: WRONG_PASSWORD_MESSAGE } };
  }

  await repository.updatePasswordHash(id, await hashPassword(newPassword), now.toISOString());
  return { success: true };
}

export type DeactivationResult = { success: true } | { success: false; message: string };

export async function deactivateAccount(
  id: number,
  password: string,
  repository: AccountRepository,
  now: Date = new Date(),
): Promise<DeactivationResult> {
  if (!password) return { success: false, message: MISSING_PASSWORD_MESSAGE };

  if (!(await findActiveWithPassword(id, password, repository))) {
    return { success: false, message: WRONG_PASSWORD_MESSAGE };
  }

  await repository.deactivate(id, now.toISOString());
  return { success: true };
}
