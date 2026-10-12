import type { SQLiteDatabase } from 'expo-sqlite';

import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { hashPassword } from '@/features/auth/password';

import { createTempDatabase, type TempDatabase } from './real-sqlite';
import { webCryptoAesGcm } from './web-crypto-aes-gcm';

/**
 * Tablet de teste: um banco SQLite de verdade, com as migrations e a proteção de
 * CPF do aplicativo, e o repositório de profissionais ligado a ele.
 *
 * Quem usa precisa declarar, no próprio arquivo de teste, o mock abaixo. O
 * módulo `cpf-runtime` depende de recursos que só existem dentro do aplicativo
 * (Android Keystore), e o `jest.mock` só vale se estiver no arquivo do teste:
 *
 *     jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));
 */

export const SENHA_DE_TESTE = 'senha-da-ana';
export const CPF_DA_ANA = '11144477735';
export const CPF_DO_BRUNO = '52998224725';

export const ANA = {
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

export const BRUNO = {
  name: 'Bruno Lima',
  email: 'bruno.lima@unieuro.com.br',
  crmNumber: '54321',
  crmState: 'GO',
};

export const cpfProtector = createCpfProtector(
  async () => new Uint8Array(32).fill(6),
  webCryptoAesGcm,
);

let hashDeTeste: Promise<string> | undefined;

export function hashDaSenhaDeTeste(): Promise<string> {
  hashDeTeste ??= hashPassword(SENHA_DE_TESTE);
  return hashDeTeste;
}

export type TabletDeTeste = {
  database: SQLiteDatabase;
  repository: ReturnType<typeof createProfessionalRepository>;
  temp: TempDatabase;
  reabrir(): Promise<void>;
  encerrar(): Promise<void>;
  fechar(): Promise<void>;
};

export async function abrirTablet(): Promise<TabletDeTeste> {
  const temp = createTempDatabase();
  let fechado = false;

  const abrir = async () => {
    const database = temp.open();
    await migrate(database, cpfProtector);
    fechado = false;
    tablet.database = database;
    tablet.repository = createProfessionalRepository(async () => database, cpfProtector);
  };

  const fecharBanco = async () => {
    if (fechado) return;
    fechado = true;
    await tablet.database.closeAsync();
  };

  const tablet = {
    temp,
    async reabrir() {
      await fecharBanco();
      await abrir();
    },
    encerrar: fecharBanco,
    async fechar() {
      await fecharBanco();
      temp.cleanup();
    },
  } as TabletDeTeste;

  await abrir();
  return tablet;
}

export async function abrirTabletComAnaEBruno(): Promise<TabletDeTeste> {
  const tablet = await abrirTablet();
  const passwordHash = await hashDaSenhaDeTeste();

  for (const [perfil, cpf] of [
    [ANA, CPF_DA_ANA],
    [BRUNO, CPF_DO_BRUNO],
  ] as const) {
    await tablet.repository.insert({
      ...perfil,
      cpf,
      passwordHash,
      createdAt: '2026-09-26T13:00:00.000Z',
    });
  }
  return tablet;
}
