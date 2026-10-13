import type { SQLiteDatabase } from 'expo-sqlite';

import { createCpfProtector, type CpfProtector } from '@/db/cpf-protection';
import { createProfessionalRepository } from '@/db/professional-repository';
import type { ProfessionalRepository } from '@/features/auth/registration';

import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

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

const CPF = '11144477735';

// Protetor de mentira, sem criptografia: devolve valores que não contêm o CPF,
// para que os testes afirmem que só o valor protegido chega ao banco.
const protector: CpfProtector = {
  blindIndex: jest.fn(async () => 'indice-do-cpf'),
  encrypt: jest.fn(async () => 'cpf-cifrado'),
  decrypt: jest.fn(async () => CPF),
};

function createDatabase(firstRow: object | null = null) {
  const database = {
    getFirstAsync: jest.fn(async () => firstRow),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 7, changes: 1 })),
  };
  return database as typeof database & SQLiteDatabase;
}

function createRepository(database: SQLiteDatabase) {
  return createProfessionalRepository(async () => database, protector);
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

    await expect(createRepository(database).cpfExists(CPF)).resolves.toBe(expected);
    expect(protector.blindIndex).toHaveBeenCalledWith(CPF);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT 1 FROM profissional WHERE cpf_indice = ? LIMIT 1',
      ['indice-do-cpf'],
    );
  });

  it('não envia o CPF ao banco na consulta', async () => {
    const database = createDatabase();

    await createRepository(database).cpfExists(CPF);

    expect(JSON.stringify(database.getFirstAsync.mock.calls)).not.toContain(CPF);
  });
});

describe('getCpf', () => {
  it('decifra o CPF do profissional', async () => {
    const database = createDatabase({ cpf_cifrado: 'cpf-cifrado' });

    await expect(createRepository(database).getCpf(7)).resolves.toBe(CPF);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT cpf_cifrado FROM profissional WHERE id = ? LIMIT 1',
      [7],
    );
    expect(protector.decrypt).toHaveBeenCalledWith('cpf-cifrado');
  });

  it('devolve null quando o profissional não existe', async () => {
    await expect(createRepository(createDatabase()).getCpf(99)).resolves.toBeNull();
    expect(protector.decrypt).not.toHaveBeenCalled();
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
      cpf: CPF,
      passwordHash: 'hash-da-senha',
      createdAt: '2026-09-26T13:00:00.000Z',
    });

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        'INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update)',
      ),
      [
        'Ana Carolina Souza',
        'ana.souza@unieuro.com.br',
        '12345',
        'DF',
        'cpf-cifrado',
        'indice-do-cpf',
        'hash-da-senha',
        '2026-09-26T13:00:00.000Z',
        '2026-09-26T13:00:00.000Z',
      ],
    );
  });

  it('nunca grava o CPF em texto', async () => {
    const database = createDatabase();

    await createRepository(database).insert({
      name: 'Ana Carolina Souza',
      email: 'ana.souza@unieuro.com.br',
      crmNumber: '12345',
      crmState: 'DF',
      cpf: CPF,
      passwordHash: 'hash-da-senha',
      createdAt: '2026-09-26T13:00:00.000Z',
    });

    expect(JSON.stringify(database.runAsync.mock.calls)).not.toContain(CPF);
    expect(protector.encrypt).toHaveBeenCalledWith(CPF);
    expect(protector.blindIndex).toHaveBeenCalledWith(CPF);
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

  it('não traz o CPF nas leituras comuns', async () => {
    const found = await createRepository(createDatabase(row)).findById(7);

    expect(found).not.toHaveProperty('cpf');
  });

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
    await expect(
      createRepository(createDatabase()).findByEmail('outra@unieuro.com.br'),
    ).resolves.toBeNull();
  });
});

describe('duplicidade de CPF com a proteção real', () => {
  // Banco em memória que só entende o que o repositório pergunta: guarda o
  // índice de cada CPF gravado e responde se um índice já existe.
  function createMemoryDatabase() {
    const indices = new Set<string>();
    const database = {
      getFirstAsync: jest.fn(async (_sql: string, params: string[]) =>
        indices.has(params[0]) ? { 1: 1 } : null,
      ),
      runAsync: jest.fn(async (_sql: string, params: string[]) => {
        indices.add(params[5]);
        return { lastInsertRowId: 1, changes: 1 };
      }),
    };
    return database as typeof database & SQLiteDatabase;
  }

  const realProtector = createCpfProtector(async () => new Uint8Array(32).fill(4), webCryptoAesGcm);

  const newProfessional = (cpf: string) => ({
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    cpf,
    passwordHash: 'hash-da-senha',
    createdAt: '2026-09-26T13:00:00.000Z',
  });

  it('reconhece o CPF já cadastrado e aceita outro CPF', async () => {
    const database = createMemoryDatabase();
    const repository = createProfessionalRepository(async () => database, realProtector);

    await expect(repository.cpfExists(CPF)).resolves.toBe(false);
    await repository.insert(newProfessional(CPF));

    await expect(repository.cpfExists(CPF)).resolves.toBe(true);
    await expect(repository.cpfExists('52998224725')).resolves.toBe(false);
  });

  it('não grava o CPF em texto em nenhuma parte do que vai ao banco', async () => {
    const database = createMemoryDatabase();
    const repository = createProfessionalRepository(async () => database, realProtector);

    await repository.insert(newProfessional(CPF));

    expect(JSON.stringify(database.runAsync.mock.calls)).not.toContain(CPF);
  });
});
