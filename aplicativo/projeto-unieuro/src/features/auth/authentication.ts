import { DUMMY_PASSWORD_HASH, verifyPassword } from '@/features/auth/password';
import { toSessionProfessional, type SessionProfessional } from '@/features/auth/session';

export type Credentials = {
  email: string;
  password: string;
};

/** O que o login lê do banco: os dados da sessão e o hash para conferir a senha. */
export type StoredCredentials = SessionProfessional & {
  passwordHash: string;
};

export type CredentialsRepository = {
  findByEmail(email: string): Promise<StoredCredentials | null>;
};

// O profissional sai daqui só com os campos da sessão: o hash da senha e o CPF
// ficam na camada de dados.
export type AuthenticationResult =
  | { success: true; professional: SessionProfessional }
  | { success: false; reason: 'missing-fields' | 'invalid-credentials'; message: string };

const MISSING_FIELDS_MESSAGE = 'Preencha e-mail e senha para continuar.';
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

export async function authenticate(
  { email, password }: Credentials,
  repository: CredentialsRepository,
): Promise<AuthenticationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || password.length === 0) {
    return { success: false, reason: 'missing-fields', message: MISSING_FIELDS_MESSAGE };
  }

  const professional = await repository.findByEmail(normalizedEmail);
  const matches = await verifyPassword(password, professional?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!professional || !matches) {
    return { success: false, reason: 'invalid-credentials', message: INVALID_CREDENTIALS_MESSAGE };
  }

  return { success: true, professional: toSessionProfessional(professional) };
}
