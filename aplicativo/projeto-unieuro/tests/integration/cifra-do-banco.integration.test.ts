import { bytesToHex } from '@noble/hashes/utils';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { migrate } from '@/db/database';
import { applyDatabaseEncryption } from '@/db/database-encryption';
import {
  DATABASE_KEY_BYTES,
  DATABASE_KEY_NAME,
  loadOrCreateDatabaseKey,
  type DatabaseKeyStore,
} from '@/db/database-key';
import { createProfessionalRepository } from '@/db/professional-repository';

import { createTempCipherDatabase, type TempCipherDatabase } from '../test-support/real-sqlcipher';
import { createTempDatabase } from '../test-support/real-sqlite';
import { ANA, CPF_DA_ANA, cpfProtector } from '../test-support/tablet';

// US #17, cenário "arquivos copiados": quem copia os arquivos do aplicativo para
// outro computador não consegue ler os atendimentos, os desenhos nem os
// resultados. Estes testes usam um SQLite cifrado de verdade, em arquivo, e olham
// os bytes do arquivo, que é o que a pessoa veria. O módulo de cifra é só de
// teste: no tablet quem cifra é o SQLCipher do `expo-sqlite`.
//
// Ainda não há tabela de resultado (#12). Quando ela existir, o exame gravado em
// `gravarExame` deve incluir o escore e o teste deve conferir que ele também some
// do arquivo.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const PACIENTE = 'Maria Aparecida Teixeira';
const CPF_DO_PACIENTE = '52998224725';
const MARCADOR_DO_DESENHO = 'MARCADOR-DO-DESENHO-DO-RELOGIO';
const INICIO = '2026-11-08T14:00:00.000Z';
const CONFIRMACAO = '2026-11-08T14:03:10.000Z';

// Cabeçalho que todo arquivo SQLite sem cifra tem nos primeiros 16 bytes.
const CABECALHO_SQLITE = 'SQLite format 3\0';

const PNG = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...Array.from(MARCADOR_DO_DESENHO, (letra) => letra.charCodeAt(0)),
]);

const chaveDeTeste = (preenchimento: number) =>
  new Uint8Array(DATABASE_KEY_BYTES).fill(preenchimento);

/** Cofre em memória, no lugar do SecureStore do aparelho. */
function criarCofre(): DatabaseKeyStore & { valores: Map<string, string> } {
  const valores = new Map<string, string>();
  return {
    valores,
    get: async (nome) => valores.get(nome) ?? null,
    set: async (nome, valor) => {
      valores.set(nome, valor);
    },
  };
}

/**
 * Grava o que um exame deixa no banco: profissional, paciente e atendimento, a
 * tarefa do relógio com o traçado e a imagem final do desenho.
 */
async function gravarExame(database: SQLiteDatabase) {
  await migrate(database, cpfProtector);

  const profissionais = createProfessionalRepository(async () => database, cpfProtector);
  await profissionais.insert({
    ...ANA,
    cpf: CPF_DA_ANA,
    passwordHash: 'hash-da-senha',
    createdAt: INICIO,
  });
  const ana = await profissionais.findByEmail(ANA.email);

  const { attendanceId } = await createAttendanceRepository(
    async () => database,
    cpfProtector,
  ).createAttendance({
    patient: {
      name: PACIENTE,
      cpf: CPF_DO_PACIENTE,
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'feminino',
    },
    professionalId: ana!.id,
    startedAt: INICIO,
  });

  const tarefa = await database.runAsync(
    `INSERT INTO tarefa (id_avaliacao, tipo, ordem, largura, altura, data_hora_inicio)
     VALUES (?, 'relogio', 1, 960, 600, ?)`,
    [attendanceId, INICIO],
  );
  await database.runAsync(
    'INSERT INTO desenho (id_tarefa, imagem_final, data_hora_confirmacao) VALUES (?, ?, ?)',
    [tarefa.lastInsertRowId, PNG, CONFIRMACAO],
  );
  await database.runAsync(
    `INSERT INTO evento_tracado (id_tarefa, ordem, tipo, ponteiro, coord_x, coord_y, instante)
     VALUES (?, 1, 'inicio', 'dedo', 10.5, 20.5, 0), (?, 2, 'ponto', 'dedo', 11.5, 21.5, 16)`,
    [tarefa.lastInsertRowId, tarefa.lastInsertRowId],
  );
}

const contarPacientes = (database: SQLiteDatabase) =>
  database.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM paciente');

const DADOS_DO_EXAME = [PACIENTE, CPF_DO_PACIENTE, ANA.name, MARCADOR_DO_DESENHO];

let banco: TempCipherDatabase;
let copia: TempCipherDatabase | undefined;

beforeEach(() => {
  banco = createTempCipherDatabase();
  copia = undefined;
});

afterEach(() => {
  banco.cleanup();
  copia?.cleanup();
});

describe('controle: o mesmo exame sem cifra', () => {
  it('deixa o paciente, o profissional e o desenho legíveis no arquivo', async () => {
    const semCifra = createTempDatabase();
    const database = semCifra.open();

    await gravarExame(database);

    // Sem este controle, os testes abaixo passariam também se a leitura dos bytes
    // estivesse quebrada e nunca encontrasse nada.
    expect(semCifra.rawContains(PACIENTE)).toBe(true);
    expect(semCifra.rawContains(ANA.name)).toBe(true);
    expect(semCifra.rawContains(MARCADOR_DO_DESENHO)).toBe(true);

    await database.closeAsync();
    semCifra.cleanup();
  });
});

describe('Cenário: arquivos copiados', () => {
  it('não deixa nada do exame legível no arquivo, nem no WAL, com o banco em uso', async () => {
    const database = banco.open();
    await applyDatabaseEncryption(database, async () => chaveDeTeste(0x0a));

    await gravarExame(database);

    // O banco continua aberto: é o que o aplicativo faz, e o WAL ainda não foi
    // incorporado ao arquivo principal.
    expect(banco.header()).not.toBe(CABECALHO_SQLITE);
    for (const dado of DADOS_DO_EXAME) {
      expect(banco.rawContains(dado)).toBe(false);
    }

    await database.closeAsync();
    for (const dado of DADOS_DO_EXAME) {
      expect(banco.rawContains(dado)).toBe(false);
    }
  });

  it('não abre o arquivo copiado sem a chave', async () => {
    const database = banco.open();
    await applyDatabaseEncryption(database, async () => chaveDeTeste(0x0a));
    await gravarExame(database);

    copia = banco.copy();
    const copiado = copia.open();

    await expect(contarPacientes(copiado)).rejects.toThrow(/not a database/i);
    await database.closeAsync();
  });

  it('não abre o arquivo copiado com uma chave que não é a dele', async () => {
    const database = banco.open();
    await applyDatabaseEncryption(database, async () => chaveDeTeste(0x0a));
    await gravarExame(database);

    copia = banco.copy();
    const copiado = copia.open();
    await applyDatabaseEncryption(copiado, async () => chaveDeTeste(0x0b));

    await expect(contarPacientes(copiado)).rejects.toThrow(/not a database/i);
    await database.closeAsync();
  });

  it('abre a mesma cópia com a chave certa, então só a chave a separa dos dados', async () => {
    const database = banco.open();
    await applyDatabaseEncryption(database, async () => chaveDeTeste(0x0a));
    await gravarExame(database);

    copia = banco.copy();
    const copiado = copia.open();
    await applyDatabaseEncryption(copiado, async () => chaveDeTeste(0x0a));

    await expect(contarPacientes(copiado)).resolves.toEqual({ total: 1 });
    await expect(
      copiado.getFirstAsync<{ nome: string }>('SELECT nome FROM paciente'),
    ).resolves.toEqual({ nome: PACIENTE });
    await database.closeAsync();
    await copiado.closeAsync();
  });
});

describe('chave guardada no cofre', () => {
  it('gera a chave na primeira abertura e reabre o banco com a mesma nas seguintes', async () => {
    const cofre = criarCofre();
    // Cada chamada devolve uma chave diferente. Se a segunda abertura ignorasse o
    // cofre e gerasse outra, o banco não abriria e o gerador seria chamado duas vezes.
    let chamadas = 0;
    const gerarChave = jest.fn(async (quantidade: number) => {
      chamadas += 1;
      return new Uint8Array(quantidade).fill(chamadas);
    });
    const carregarChave = () => loadOrCreateDatabaseKey(cofre, gerarChave);

    const primeira = banco.open();
    await applyDatabaseEncryption(primeira, carregarChave);
    await gravarExame(primeira);
    await primeira.closeAsync();

    const chaveGuardada = cofre.valores.get(DATABASE_KEY_NAME);
    expect(chaveGuardada).toBe(bytesToHex(new Uint8Array(DATABASE_KEY_BYTES).fill(1)));

    const segunda = banco.open();
    await applyDatabaseEncryption(segunda, carregarChave);

    await expect(contarPacientes(segunda)).resolves.toEqual({ total: 1 });
    expect(gerarChave).toHaveBeenCalledTimes(1);
    expect(cofre.valores.get(DATABASE_KEY_NAME)).toBe(chaveGuardada);
    expect(cofre.valores.size).toBe(1);
    // A chave fica no cofre; o arquivo do banco não a contém.
    expect(banco.rawContains(chaveGuardada!)).toBe(false);
    await segunda.closeAsync();
  });
});
