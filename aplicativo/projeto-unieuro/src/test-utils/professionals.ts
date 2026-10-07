import type { SQLiteDatabase } from 'expo-sqlite';

import { createProfessionalRepository } from '@/db/professional-repository';
import type { AccountProfile } from '@/features/auth/account';
import { hashPassword } from '@/features/auth/password';
import { openTestDatabase } from '@/test-utils/sqlite';

export const SENHA_DE_TESTE = 'senha-da-ana';

export const ANA: AccountProfile = {
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

export const BRUNO: AccountProfile = {
  name: 'Bruno Lima',
  email: 'bruno.lima@unieuro.com.br',
  crmNumber: '54321',
  crmState: 'GO',
};

let hashDeTeste: Promise<string> | undefined;

/** O PBKDF2 é lento de propósito; o hash da senha de teste é calculado uma vez só. */
export function hashDaSenhaDeTeste(): Promise<string> {
  hashDeTeste ??= hashPassword(SENHA_DE_TESTE);
  return hashDeTeste;
}

export type TabletDeTeste = {
  database: SQLiteDatabase;
  repository: ReturnType<typeof createProfessionalRepository>;
  anaId: number;
};

/** Banco real em memória com a Ana e o Bruno cadastrados com a senha de teste. */
export async function abrirTabletComAnaEBruno(): Promise<TabletDeTeste> {
  const database = await openTestDatabase();
  const repository = createProfessionalRepository(async () => database);
  const passwordHash = await hashDaSenhaDeTeste();

  const cadastros: [AccountProfile, string][] = [
    [ANA, '11144477735'],
    [BRUNO, '52998224725'],
  ];
  for (const [perfil, cpf] of cadastros) {
    await repository.insert({
      ...perfil,
      cpf,
      passwordHash,
      createdAt: '2026-09-26T13:00:00.000Z',
    });
  }

  const ana = await repository.findByEmail(ANA.email);
  return { database, repository, anaId: ana!.id };
}
