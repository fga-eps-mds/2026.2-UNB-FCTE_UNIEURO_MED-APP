import type { SQLiteDatabase } from 'expo-sqlite';

import { createProfessionalRepository } from '@/db/professional-repository';
import type { AccountRepository } from '@/features/auth/account';
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
  cpf: '11144477735',
  senha_hash: 'hash-da-senha',
  criacao: '2026-09-26T13:00:00.000Z',
  last_update: '2026-09-26T13:00:00.000Z',
  ativo: 1,
  desativacao: null,
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

it('atende aos contratos usados pelo cadastro e pela manutenção da conta', () => {
  const repository = createRepository(createDatabase()) satisfies ProfessionalRepository &
    AccountRepository;

  expect(repository).toBeDefined();
});

describe('emailExists', () => {
  it.each([
    ['existe', { 1: 1 }, true],
    ['não existe', null, false],
  ])('informa quando o e-mail %s', async (_case, firstRow, expected) => {
    const database = createDatabase(firstRow);

    await expect(
      createRepository(database).emailExists(' ana.souza@unieuro.com.br '),
    ).resolves.toBe(expected);
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

describe('cpfExists', () => {
  it.each([
    ['existe', { 1: 1 }, true],
    ['não existe', null, false],
  ])('informa quando o CPF %s', async (_case, firstRow, expected) => {
    const database = createDatabase(firstRow);

    await expect(createRepository(database).cpfExists('11144477735')).resolves.toBe(expected);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT 1 FROM profissional WHERE cpf = ? LIMIT 1',
      ['11144477735'],
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
      cpf: '11144477735',
      passwordHash: 'hash-da-senha',
      createdAt: '2026-09-26T13:00:00.000Z',
    });

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf, senha_hash, criacao, last_update)',
      ),
      [
        'Ana Carolina Souza',
        'ana.souza@unieuro.com.br',
        '12345',
        'DF',
        '11144477735',
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
    cpf: '11144477735',
    passwordHash: 'hash-da-senha',
    createdAt: '2026-09-26T13:00:00.000Z',
    updatedAt: '2026-09-26T13:00:00.000Z',
    active: true,
    deactivatedAt: null,
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

  it('marca como inativo o profissional desativado, com a data da desativação', async () => {
    const database = createDatabase({ ...row, ativo: 0, desativacao: '2026-10-07T12:00:00.000Z' });

    await expect(createRepository(database).findById(7)).resolves.toMatchObject({
      active: false,
      deactivatedAt: '2026-10-07T12:00:00.000Z',
    });
  });

  it('devolve null quando não encontra o profissional', async () => {
    await expect(
      createRepository(createDatabase()).findByEmail('outra@unieuro.com.br'),
    ).resolves.toBeNull();
  });
});

describe('manutenção da conta', () => {
  it('procura o e-mail em outras contas, ignorando a do próprio profissional', async () => {
    const database = createDatabase({ 1: 1 });

    await expect(
      createRepository(database).emailInUseByOther(' outra@unieuro.com.br ', 7),
    ).resolves.toBe(true);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT 1 FROM profissional WHERE email = ? AND id <> ? LIMIT 1',
      ['outra@unieuro.com.br', 7],
    );
  });

  it('procura o CRM em outras contas, ignorando a do próprio profissional', async () => {
    const database = createDatabase();

    await expect(createRepository(database).crmInUseByOther('54321', 'GO', 7)).resolves.toBe(false);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT 1 FROM profissional WHERE crm_numero = ? AND uf_crm = ? AND id <> ? LIMIT 1',
      ['54321', 'GO', 7],
    );
  });

  it('atualiza os dados do cadastro e a data da última alteração', async () => {
    const database = createDatabase();

    await createRepository(database).updateProfile(
      7,
      { name: 'Ana Souza', email: 'ana@unieuro.com.br', crmNumber: '54321', crmState: 'GO' },
      '2026-10-07T12:00:00.000Z',
    );

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE profissional SET nome = ?, email = ?, crm_numero = ?'),
      ['Ana Souza', 'ana@unieuro.com.br', '54321', 'GO', '2026-10-07T12:00:00.000Z', 7],
    );
  });

  it('troca o hash da senha', async () => {
    const database = createDatabase();

    await createRepository(database).updatePasswordHash(7, 'novo-hash', '2026-10-07T12:00:00.000Z');

    expect(database.runAsync).toHaveBeenCalledWith(
      'UPDATE profissional SET senha_hash = ?, last_update = ? WHERE id = ?',
      ['novo-hash', '2026-10-07T12:00:00.000Z', 7],
    );
  });

  it('desativa só uma conta ativa, gravando a data da desativação', async () => {
    const database = createDatabase();

    await createRepository(database).deactivate(7, '2026-10-07T12:00:00.000Z');

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringMatching(
        /SET ativo = 0, desativacao = \?, last_update = \?\s+WHERE id = \? AND ativo = 1/,
      ),
      ['2026-10-07T12:00:00.000Z', '2026-10-07T12:00:00.000Z', 7],
    );
  });
});
