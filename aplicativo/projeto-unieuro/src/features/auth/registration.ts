import { hashPassword } from '@/features/auth/password';

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

export type RegistrationResult = { success: true } | { success: false; message: string };

type Validation =
  | { valid: true; registration: ValidRegistration }
  | { valid: false; message: string };

const failure = (message: string) => ({ success: false, message }) as const;
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

function cpfCheckDigit(base: string): number {
  let sum = 0;
  let weight = base.length + 1;
  for (const digit of base) {
    sum += Number(digit) * weight;
    weight -= 1;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Valida o CPF pelos dígitos verificadores, não só pela quantidade de dígitos. */
function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const firstNine = digits.slice(0, 9);
  const firstCheck = cpfCheckDigit(firstNine);
  const secondCheck = cpfCheckDigit(firstNine + String(firstCheck));

  return digits === `${firstNine}${firstCheck}${secondCheck}`;
}

/** Normaliza o CPF (mantendo só os dígitos) e valida os dígitos verificadores. */
export function parseCpf(fullCpf: string): string | null {
  const digits = fullCpf.replace(/\D/g, '');
  return isValidCpf(digits) ? digits : null;
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

export function collectRegistrationErrors(input: RegistrationInput): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  const email = input.email.trim();
  const crmRaw = input.crm.trim();
  const cpfRaw = input.cpf.trim();
  const password = input.password;
  const passwordConfirmation = input.passwordConfirmation;

  if (name.length === 0) errors.push('Preencha o nome.');
  if (email.length === 0) errors.push('Preencha o e-mail.');
  if (crmRaw.length === 0) errors.push('Preencha o CRM.');
  if (cpfRaw.length === 0) errors.push('Preencha o CPF.');
  if (password.length === 0) errors.push('Preencha a senha.');
  if (passwordConfirmation.length === 0) errors.push('Preencha a confirmação de senha.');

  if (email.length > 0 && !EMAIL_PATTERN.test(email)) errors.push('Informe um e-mail válido.');

  const crm = parseCrm(crmRaw);
  if (crmRaw.length > 0 && !crm) errors.push('Informe o CRM no formato 12345/DF.');

  if (cpfRaw.length > 0 && !parseCpf(cpfRaw)) errors.push('Informe um CPF válido.');

  if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH)
    errors.push(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);

  if (password.length > 0 && passwordConfirmation.length > 0 && password !== passwordConfirmation)
    errors.push('Confira a senha e a confirmação.');

  return errors;
}

export async function registerProfessional(
  { name, email, crm, cpf, password }: ValidRegistration,
  repository: ProfessionalRepository,
): Promise<RegistrationResult> {
  if (await repository.emailExists(email)) {
    return failure('Já existe um profissional cadastrado com este e-mail.');
  }
  if (await repository.crmExists(crm.number, crm.state)) {
    return failure('Já existe um profissional cadastrado com este CRM.');
  }
  if (await repository.cpfExists(cpf)) {
    return failure('Já existe um profissional cadastrado com este CPF.');
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
