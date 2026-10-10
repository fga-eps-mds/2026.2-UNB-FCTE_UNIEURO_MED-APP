import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { MIGRATIONS } from '@/db/schema';

import { createTempDatabase, type TempDatabase } from '../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

// Estes testes usam SQLite de verdade, em arquivo, e olham os bytes do arquivo,
// que é o que alguém veria ao copiar o banco do tablet.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const CPF = '11144477735';
const OTHER_CPF = '52998224725';

const protector = createCpfProtector(async () => new Uint8Array(32).fill(6), webCryptoAesGcm);

const newProfessional = (overrides: object = {}) => ({
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
  cpf: CPF,
  passwordHash: 'hash-da-senha',
  createdAt: '2026-09-26T13:00:00.000Z',
  ...overrides,
});

let temp: TempDatabase;

beforeEach(() => {
  temp = createTempDatabase();
});

afterEach(() => {
  temp.cleanup();
});

describe('banco novo', () => {
  it('grava o profissional sem deixar o CPF legível no arquivo e o recupera', async () => {
    const database = temp.open();
    await migrate(database, protector);
    const repository = createProfessionalRepository(async () => database, protector);

    await repository.insert(newProfessional());
    const saved = await repository.findByEmail('ana.souza@unieuro.com.br');
    const cpf = await repository.getCpf(saved!.id);
    await database.closeAsync();

    expect(cpf).toBe(CPF);
    expect(temp.rawContains(CPF)).toBe(false);
    expect(temp.rawContains('Ana Carolina Souza')).toBe(true);
  });

  it('recusa o segundo cadastro com o mesmo CPF e aceita outro CPF', async () => {
    const database = temp.open();
    await migrate(database, protector);
    const repository = createProfessionalRepository(async () => database, protector);
    await repository.insert(newProfessional());

    await expect(repository.cpfExists(CPF)).resolves.toBe(true);
    await expect(repository.cpfExists(OTHER_CPF)).resolves.toBe(false);
    await expect(
      repository.insert(
        newProfessional({ email: 'outra@unieuro.com.br', crmNumber: '99999', cpf: CPF }),
      ),
    ).rejects.toThrow(/UNIQUE/);

    await repository.insert(
      newProfessional({ email: 'bruno@unieuro.com.br', crmNumber: '67890', cpf: OTHER_CPF }),
    );
    await expect(repository.cpfExists(OTHER_CPF)).resolves.toBe(true);
    await database.closeAsync();
  });
});

describe('banco da versão 1, com CPF em texto', () => {
  async function createLegacyDatabase() {
    const database = temp.open();
    await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await database.execAsync(MIGRATIONS[0] as string);
    await database.execAsync('PRAGMA user_version = 1');
    for (const [index, cpf] of [CPF, OTHER_CPF].entries()) {
      await database.runAsync(
        `INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf, senha_hash, criacao, last_update)
         VALUES (?, ?, ?, 'DF', ?, 'hash', '2026-09-26', '2026-09-26')`,
        [`Profissional ${index}`, `p${index}@unieuro.com.br`, `1000${index}`, cpf],
      );
    }
    return database;
  }

  it('começa com o CPF legível no arquivo, o que confirma que o teste enxerga o dado', async () => {
    const database = await createLegacyDatabase();
    await database.closeAsync();

    expect(temp.rawContains(CPF)).toBe(true);
  });

  it('converte os cadastros existentes e mantém a busca de CPF funcionando', async () => {
    const database = await createLegacyDatabase();

    await migrate(database, protector);
    const repository = createProfessionalRepository(async () => database, protector);

    await expect(repository.cpfExists(CPF)).resolves.toBe(true);
    await expect(repository.cpfExists(OTHER_CPF)).resolves.toBe(true);
    await expect(repository.cpfExists('11122233396')).resolves.toBe(false);
    const first = await repository.findByEmail('p0@unieuro.com.br');
    await expect(repository.getCpf(first!.id)).resolves.toBe(CPF);
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'),
    ).resolves.toEqual({ user_version: 2 });
    await database.closeAsync();
  });

  it('não deixa o CPF antigo legível no arquivo depois da conversão', async () => {
    const database = await createLegacyDatabase();

    await migrate(database, protector);
    await database.closeAsync();

    expect(temp.rawContains(CPF)).toBe(false);
    expect(temp.rawContains(OTHER_CPF)).toBe(false);
  });
});
