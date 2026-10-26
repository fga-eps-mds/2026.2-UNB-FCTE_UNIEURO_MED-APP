import { hashPassword } from '@/features/auth/password';
import { parseCpf } from '@/features/shared/cpf';

export const MIN_PASSWORD_LENGTH = 8;

// Os trechos do domínio não aceitam ponto, senão a regex volta atrás a cada ponto e
// fica lenta com texto longo (apontamento S8786 do SonarCloud).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const CRM_PATTERN = /^(\d+)\s*\/\s*([A-Za-z]{2})$/;
const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

export type RegistrationInput = {
  name: string;
  email: string;
  crm: string;
  cpf: string;
  password: string;
  passwordConfirmation: string;
};

export type Crm = {
  number: string;
  state: string;
};

export type ValidRegistration = {
  name: string;
  email: string;
  crm: Crm;
  cpf: string;
  password: string;
};

export type NewProfessional = {
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  cpf: string;
  passwordHash: string;
  createdAt: string;
};

export type ProfessionalRepository = {
  emailExists(email: string): Promise<boolean>;
  crmExists(crmNumber: string, crmState: string): Promise<boolean>;
  cpfExists(cpf: string): Promise<boolean>;
  insert(professional: NewProfessional): Promise<void>;
};

export type RegistrationFieldErrors = Partial<Record<keyof RegistrationInput, string>>;
export type RegistrationResult =
  | { success: true }
  | { success: false; message: string; field?: 'email' | 'crm' | 'cpf' };

type Validation =
  | { valid: true; registration: ValidRegistration }
  | { valid: false; message: string };

const failure = (message: string, field: 'email' | 'crm' | 'cpf') =>
  ({ success: false, message, field }) as const;
const invalid = (message: string) => ({ valid: false, message }) as const;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export function isBrazilianState(state: string): boolean {
  return BRAZILIAN_STATES.includes(state.toUpperCase());
}

export function parseCrm(fullCrm: string): Crm | null {
  const parts = CRM_PATTERN.exec(fullCrm.trim());
  if (!parts) return null;

  const state = parts[2].toUpperCase();
  if (!isBrazilianState(state)) return null;

  return { number: parts[1], state };
}

export function validateRegistration(input: RegistrationInput): Validation {
  if (Object.values(input).some((value) => value.trim().length === 0)) {
    return invalid('Preencha todos os campos para continuar.');
  }

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return invalid('Informe um e-mail válido.');

  const crm = parseCrm(input.crm);
  if (!crm) return invalid('Informe o CRM no formato 12345/DF.');

  const cpf = parseCpf(input.cpf);
  if (!cpf) return invalid('Informe um CPF válido.');

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return invalid(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (input.password !== input.passwordConfirmation) {
    return invalid('Confira a senha e a confirmação.');
  }

  return {
    valid: true,
    registration: { name: input.name.trim(), email, crm, cpf, password: input.password },
  };
}

export function collectRegistrationFieldErrors(input: RegistrationInput): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const crmRaw = input.crm.trim();
  const cpfRaw = input.cpf.trim();
  const password = input.password;
  const passwordConfirmation = input.passwordConfirmation;

  if (!name) errors.name = 'Preencha o nome.';

  if (!email) errors.email = 'Preencha o e-mail.';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Informe um e-mail válido.';

  if (!crmRaw) errors.crm = 'Preencha o CRM.';
  else if (!parseCrm(crmRaw)) errors.crm = 'Informe o CRM no formato 12345/DF.';

  if (!cpfRaw) errors.cpf = 'Preencha o CPF.';
  else if (!parseCpf(cpfRaw)) errors.cpf = 'Informe um CPF válido.';

  if (!password) errors.password = 'Preencha a senha.';
  else if (password.length < MIN_PASSWORD_LENGTH)
    errors.password = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;

  if (!passwordConfirmation) errors.passwordConfirmation = 'Preencha a confirmação de senha.';
  else if (password && password !== passwordConfirmation)
    errors.passwordConfirmation = 'Confira a senha e a confirmação.';

  return errors;
}

export async function registerProfessional(
  { name, email, crm, cpf, password }: ValidRegistration,
  repository: ProfessionalRepository,
): Promise<RegistrationResult> {
  if (await repository.emailExists(email)) {
    return failure('Já existe um profissional cadastrado com este e-mail.', 'email');
  }
  if (await repository.crmExists(crm.number, crm.state)) {
    return failure('Já existe um profissional cadastrado com este CRM.', 'crm');
  }
  if (await repository.cpfExists(cpf)) {
    return failure('Já existe um profissional cadastrado com este CPF.', 'cpf');
  }

  await repository.insert({
    name,
    email,
    crmNumber: crm.number,
    crmState: crm.state,
    cpf,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  });

  return { success: true };
}
