import { hashPassword } from '@/features/auth/password';

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRM_PATTERN = /^(\d+)\s*\/\s*([A-Za-z]{2})$/;
const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export type RegistrationInput = {
  name: string;
  email: string;
  crm: string;
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
  password: string;
};

export type NewProfessional = {
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
  passwordHash: string;
  createdAt: string;
};

export type ProfessionalRepository = {
  emailExists(email: string): Promise<boolean>;
  crmExists(crmNumber: string, crmState: string): Promise<boolean>;
  insert(professional: NewProfessional): Promise<void>;
};

export type RegistrationResult = { success: true } | { success: false; message: string };

type Validation = { valid: true; registration: ValidRegistration } | { valid: false; message: string };

const failure = (message: string) => ({ success: false, message }) as const;
const invalid = (message: string) => ({ valid: false, message }) as const;

export function parseCrm(fullCrm: string): Crm | null {
  const parts = CRM_PATTERN.exec(fullCrm.trim());
  if (!parts) return null;

  const state = parts[2].toUpperCase();
  if (!BRAZILIAN_STATES.includes(state)) return null;

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

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return invalid(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (input.password !== input.passwordConfirmation) {
    return invalid('Confira a senha e a confirmação.');
  }

  return {
    valid: true,
    registration: { name: input.name.trim(), email, crm, password: input.password },
  };
}

export async function registerProfessional(
  { name, email, crm, password }: ValidRegistration,
  repository: ProfessionalRepository,
): Promise<RegistrationResult> {
  if (await repository.emailExists(email)) {
    return failure('Já existe um profissional cadastrado com este e-mail.');
  }
  if (await repository.crmExists(crm.number, crm.state)) {
    return failure('Já existe um profissional cadastrado com este CRM.');
  }

  await repository.insert({
    name,
    email,
    crmNumber: crm.number,
    crmState: crm.state,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  });

  return { success: true };
}
