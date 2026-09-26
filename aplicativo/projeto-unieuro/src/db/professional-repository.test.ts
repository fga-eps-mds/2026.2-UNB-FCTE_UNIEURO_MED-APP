import type { SQLiteDatabase } from 'expo-sqlite';

import { createProfessionalRepository } from '@/db/professional-repository';
import type { ProfessionalRepository } from '@/features/auth/registration';

jest.mock('@/db/database', () => ({
  getDatabase: jest.fn(),
}));

const row = {
  id: 7,
  nome: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crm_numero: '12345',
  uf_crm: 'DF',
  senha_hash: 'hash-da-senha',
  criacao: '2026-09-26T13:00:00.000Z',
  last_update: '2026-09-26T13:00:00.000Z',
  ativo: 1,
};

function createDatabase(firstRow: object | null = null) {
  const database = {
    getFirstAsync: jest.fn(async () => firstRow),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 7, changes: 1 })),
  };
  return database as typeof database & SQLiteDatabase;
}

function createRepository(database: SQLiteDatabase) {
  return createProfessionalRepository(async () => database);
}

it('atende ao contrato usado pelo cadastro', () => {
  const repository = createRepository(createDatabase()) satisfies ProfessionalRepository;

  expect(repository).toBeDefined();
});

describe('emailExists', () => {
  it.each([
    ['existe', { 1: 1 }, true],
    ['não existe', null, false],
  ])('informa quando o e-mail %s', async (_case, firstRow, expected) => {
    const database = createDatabase(firstRow);

    await expect(createRepository(database).emailExists(' ana.souza@unieuro.com.br ')).resolves.toBe(
      expected,
    );
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT 1 FROM profissional WHERE email = ? LIMIT 1',
      ['ana.souza@unieuro.com.br'],
    );
  });
});

describe('crmExists', () => {
  it.each([
    ['existe', { 1: 1 }, true],
    ['não existe', null, false],
  ])('informa quando o CRM %s', async (_case, firstRow, expected) => {
    const database = createDatabase(firstRow);

    await expect(createRepository(database).crmExists('12345', 'DF')).resolves.toBe(expected);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT 1 FROM profissional WHERE crm_numero = ? AND uf_crm = ? LIMIT 1',
      ['12345', 'DF'],
    );
  });
});

describe('insert', () => {
  it('grava o profissional com a data de criação nas duas datas', async () => {
    const database = createDatabase();

    await createRepository(database).insert({
      name: 'Ana Carolina Souza',
      email: 'ana.souza@unieuro.com.br',
      crmNumber: '12345',
      crmState: 'DF',
      passwordHash: 'hash-da-senha',
      createdAt: '2026-09-26T13:00:00.000Z',
    });

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'INSERT INTO profissional (nome, email, crm_numero, uf_crm, senha_hash, criacao, last_update)',
      ),
      [
        'Ana Carolina Souza',
        'ana.souza@unieuro.com.br',
        '12345',
        'DF',
        'hash-da-senha',
        '2026-09-26T13:00:00.000Z',
        '2026-09-26T13:00:00.000Z',
      ],
    );
  });
});

describe('consultas', () => {
  const professional = {
    id: 7,
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    passwordHash: 'hash-da-senha',
    createdAt: '2026-09-26T13:00:00.000Z',
    updatedAt: '2026-09-26T13:00:00.000Z',
    active: true,
  };

  it('busca o profissional pelo e-mail', async () => {
    const database = createDatabase(row);

    await expect(
      createRepository(database).findByEmail(' ana.souza@unieuro.com.br '),
    ).resolves.toEqual(professional);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      expect.stringMatching(/FROM profissional WHERE email = \? LIMIT 1$/),
      ['ana.souza@unieuro.com.br'],
    );
  });

  it('busca o profissional pelo id', async () => {
    const database = createDatabase(row);

    await expect(createRepository(database).findById(7)).resolves.toEqual(professional);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      expect.stringMatching(/FROM profissional WHERE id = \? LIMIT 1$/),
      [7],
    );
  });

  it('marca como inativo o profissional desativado', async () => {
    const database = createDatabase({ ...row, ativo: 0 });

    await expect(createRepository(database).findById(7)).resolves.toMatchObject({ active: false });
  });

  it('devolve null quando não encontra o profissional', async () => {
    await expect(createRepository(createDatabase()).findByEmail('outra@unieuro.com.br')).resolves.toBeNull();
  });
});
