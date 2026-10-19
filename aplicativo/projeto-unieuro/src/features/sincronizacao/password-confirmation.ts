import { verifyPassword } from '@/features/auth/password';

export type AccountSource = {
  findByEmail(email: string): Promise<{ passwordHash: string; active: boolean } | null>;
};

export type ConfirmPassword = (email: string, password: string) => Promise<boolean>;

/** Senha do profissional logado, pedida antes de qualquer troca. Conta desativada não passa. */
export function createPasswordConfirmation(repository: AccountSource): ConfirmPassword {
  return async (email, password) => {
    if (!email || password.length === 0) return false;
    const account = await repository.findByEmail(email);
    if (!account?.active) return false;
    return verifyPassword(password, account.passwordHash);
  };
}
