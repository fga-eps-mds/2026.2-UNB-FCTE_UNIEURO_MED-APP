import type { SQLiteDatabase } from 'expo-sqlite';

import { protectStoredCpfs } from '@/db/cpf-migration';
import { createCpfProtector } from '@/db/cpf-protection';

import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

const protector = createCpfProtector(async () => new Uint8Array(32).fill(3), webCryptoAesGcm);

const legacyRows = [
  {
    id: 1,
    nome: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crm_numero: '12345',
    uf_crm: 'DF',
    cpf: '11144477735',
    senha_hash: 'hash-da-ana',
    criacao: '2026-09-26T13:00:00.000Z',
    last_update: '2026-09-27T09:30:00.000Z',
    ativo: 1,
  },
  {
    id: 2,
    nome: 'Bruno Lima',
    email: 'bruno.lima@unieuro.com.br',
    crm_numero: '67890',
    uf_crm: 'GO',
    cpf: '52998224725',
    senha_hash: 'hash-do-bruno',
    criacao: '2026-09-28T10:00:00.000Z',
    last_update: '2026-09-28T10:00:00.000Z',
    ativo: 0,
  },
];

function createDatabase(rows: object[] = legacyRows) {
  const database = {
    getAllAsync: jest.fn(async () => rows),
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 0, changes: 1 })),
  };
  return database as typeof database & SQLiteDatabase;
}

describe('protectStoredCpfs', () => {
  it('cria a tabela nova, copia os profissionais e troca as tabelas, nessa ordem', async () => {
    const database = createDatabase();

    await protectStoredCpfs(database, protector);

    const [create, swap] = (database.execAsync.mock.calls as unknown as [string][]).map(
      ([sql]) => sql,
    );
    expect(create).toContain('CREATE TABLE profissional_v2');
    expect(create).toContain('cpf_cifrado TEXT NOT NULL');
    expect(create).toContain('cpf_indice TEXT NOT NULL UNIQUE');
    expect(swap).toBe(
      'DROP TABLE profissional; ALTER TABLE profissional_v2 RENAME TO profissional;',
    );

    const createOrder = database.execAsync.mock.invocationCallOrder[0];
    const firstInsertOrder = database.runAsync.mock.invocationCallOrder[0];
    const swapOrder = database.execAsync.mock.invocationCallOrder[1];
    expect(createOrder).toBeLessThan(firstInsertOrder);
    expect(firstInsertOrder).toBeLessThan(swapOrder);
    expect(database.runAsync).toHaveBeenCalledTimes(2);
  });

  it('preserva os demais campos de cada profissional', async () => {
    const database = createDatabase();

    await protectStoredCpfs(database, protector);

    const [, params] = database.runAsync.mock.calls[1] as unknown as [string, unknown[]];
    expect(params[0]).toBe(2);
    expect(params.slice(1, 5)).toEqual(['Bruno Lima', 'bruno.lima@unieuro.com.br', '67890', 'GO']);
    expect(params.slice(7)).toEqual([
      'hash-do-bruno',
      '2026-09-28T10:00:00.000Z',
      '2026-09-28T10:00:00.000Z',
      0,
    ]);
  });

  it('não grava nenhum CPF em texto e permite recuperá-lo e buscá-lo', async () => {
    const database = createDatabase();

    await protectStoredCpfs(database, protector);

    for (const [index, row] of legacyRows.entries()) {
      const [, params] = database.runAsync.mock.calls[index] as unknown as [string, string[]];
      expect(params).not.toContain(row.cpf);
      expect(params[5]).toMatch(/^aes-gcm\$1\$/);
      await expect(protector.decrypt(params[5])).resolves.toBe(row.cpf);
      expect(params[6]).toBe(await protector.blindIndex(row.cpf));
    }
  });

  it('só recria a tabela quando não há profissionais', async () => {
    const database = createDatabase([]);

    await protectStoredCpfs(database, protector);

    expect(database.runAsync).not.toHaveBeenCalled();
    expect(database.execAsync).toHaveBeenCalledTimes(2);
  });

  it('não altera o banco se a cifra falhar', async () => {
    const database = createDatabase();
    const failing = {
      ...protector,
      encrypt: jest.fn(async () => {
        throw new Error('cofre indisponível');
      }),
    };

    await expect(protectStoredCpfs(database, failing)).rejects.toThrow('cofre indisponível');

    expect(database.execAsync).not.toHaveBeenCalled();
    expect(database.runAsync).not.toHaveBeenCalled();
  });
});
