import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { createConsentRepository } from '@/db/consent-repository';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';
import type { ConsentimentoRepository } from '@/features/avaliacao/consentimento';

import { createTempDatabase, type TempDatabase } from '../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const INICIO = '2026-10-24T12:00:00.000Z';
const DECISAO = '2026-10-24T12:04:35.000Z';
const ASSINATURA_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const protector = createCpfProtector(async () => new Uint8Array(32).fill(7), webCryptoAesGcm);

let temp: TempDatabase;
let database: SQLiteDatabase;
let repository: ConsentimentoRepository;
let atendimentoId: number;

async function criarAtendimento(databaseToUse: SQLiteDatabase) {
  const professionals = createProfessionalRepository(async () => databaseToUse, protector);
  await professionals.insert({
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    cpf: '11144477735',
    passwordHash: 'hash-da-senha',
    createdAt: INICIO,
  });
  const professional = await professionals.findByEmail('ana.souza@unieuro.com.br');
  const attendances = createAttendanceRepository(async () => databaseToUse, protector);
  return (
    await attendances.createAttendance({
      patient: {
        name: 'José Alves Martins',
        cpf: '52998224725',
        birthDate: '1948-03-14',
        schoolingYears: 5,
        sex: 'masculino',
      },
      professionalId: professional!.id,
      startedAt: INICIO,
    })
  ).attendanceId;
}

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);
  repository = createConsentRepository(async () => database);
  atendimentoId = await criarAtendimento(database);
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

const decisao = (aceito: boolean, quemAssina: 'paciente' | 'responsavel_legal' = 'paciente') => {
  const dados = {
    atendimentoId,
    versaoTermo: '2026-09-15',
    quemAssina,
    decididoEm: DECISAO,
  };
  return aceito
    ? ({ ...dados, aceito: true, assinaturaPng: ASSINATURA_PNG } as const)
    : ({ ...dados, aceito: false, assinaturaPng: null } as const);
};

describe('contrato', () => {
  it('atende ao repositório da regra de consentimento', () => {
    expect(typeof repository.salvarDecisao).toBe('function');
    expect(typeof repository.buscarEstado).toBe('function');
  });
});

describe('migration da versão 5', () => {
  it('cria a tabela de consentimento vazia em um banco novo', async () => {
    const columns = await database.getAllAsync<{ name: string }>(
      'PRAGMA table_info(consentimento)',
    );

    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'id_avaliacao',
      'versao_tcle',
      'aceito',
      'assinado_por',
      'assinatura_png',
      'data_hora',
    ]);
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'),
    ).resolves.toEqual({ user_version: SCHEMA_VERSION });
  });

  it('leva um banco da versão 4 à versão 5 sem perder a avaliação', async () => {
    const legacyTemp = createTempDatabase();
    const legacy = legacyTemp.open();
    await legacy.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    for (const step of MIGRATIONS.slice(0, 4)) {
      if (typeof step === 'string') await legacy.execAsync(step);
      else await step(legacy, protector);
    }
    await legacy.execAsync('PRAGMA user_version = 4');
    const legacyAttendanceId = await criarAtendimento(legacy);

    await migrate(legacy, protector);

    await expect(
      legacy.getFirstAsync('SELECT estado FROM avaliacao WHERE id = ?', [legacyAttendanceId]),
    ).resolves.toEqual({ estado: 'aguardando_consentimento' });
    await expect(
      legacy.getFirstAsync<{ total: number }>('SELECT count(*) AS total FROM consentimento'),
    ).resolves.toEqual({ total: 0 });
    await legacy.closeAsync();
    legacyTemp.cleanup();
  });
});

describe('decisão e estado da avaliação', () => {
  it('sem decisão, não cria consentimento e mantém a espera', async () => {
    await expect(repository.buscarEstado(atendimentoId)).resolves.toBe('aguardando_consentimento');
    await expect(
      database.getFirstAsync<{ total: number }>('SELECT count(*) AS total FROM consentimento'),
    ).resolves.toEqual({ total: 0 });
  });

  it('aceite pelo paciente grava todos os dados e libera as tarefas', async () => {
    await expect(repository.salvarDecisao(decisao(true))).resolves.toBe(true);

    await expect(repository.buscarEstado(atendimentoId)).resolves.toBe('em_andamento');
    await expect(
      database.getFirstAsync(
        `SELECT id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora
         FROM consentimento WHERE id_avaliacao = ?`,
        [atendimentoId],
      ),
    ).resolves.toEqual({
      id_avaliacao: atendimentoId,
      versao_tcle: '2026-09-15',
      aceito: 1,
      assinado_por: 'paciente',
      assinatura_png: ASSINATURA_PNG,
      data_hora: DECISAO,
    });
  });

  it('aceite pelo responsável registra quem manifestou a decisão', async () => {
    await repository.salvarDecisao(decisao(true, 'responsavel_legal'));

    await expect(
      database.getFirstAsync('SELECT assinado_por FROM consentimento WHERE id_avaliacao = ?', [
        atendimentoId,
      ]),
    ).resolves.toEqual({ assinado_por: 'responsavel_legal' });
  });

  it('recusa grava a decisão e cancela a avaliação', async () => {
    await expect(repository.salvarDecisao(decisao(false))).resolves.toBe(true);

    await expect(repository.buscarEstado(atendimentoId)).resolves.toBe('cancelada');
    await expect(
      database.getFirstAsync(
        'SELECT aceito, assinatura_png FROM consentimento WHERE id_avaliacao = ?',
        [atendimentoId],
      ),
    ).resolves.toEqual({ aceito: 0, assinatura_png: null });
  });

  it('não aceita consentimento sem a imagem da assinatura', async () => {
    const aceite = decisao(true);
    if (!aceite.aceito) throw new Error('O cenário precisa de um aceite.');

    await expect(
      repository.salvarDecisao({ ...aceite, assinaturaPng: new Uint8Array() }),
    ).rejects.toThrow(/CHECK/);

    await expect(repository.buscarEstado(atendimentoId)).resolves.toBe('aguardando_consentimento');
  });

  it('não substitui a primeira decisão nem cria uma segunda', async () => {
    await repository.salvarDecisao(decisao(true));

    await expect(repository.salvarDecisao(decisao(false))).resolves.toBe(false);
    await expect(repository.buscarEstado(atendimentoId)).resolves.toBe('em_andamento');
    await expect(
      database.getFirstAsync<{ total: number }>('SELECT count(*) AS total FROM consentimento'),
    ).resolves.toEqual({ total: 1 });
  });

  it('desfaz a mudança de estado se o registro do consentimento falhar', async () => {
    await expect(
      repository.salvarDecisao({
        ...decisao(true),
        quemAssina: 'outro' as 'paciente',
      }),
    ).rejects.toThrow(/CHECK/);

    await expect(repository.buscarEstado(atendimentoId)).resolves.toBe('aguardando_consentimento');
    await expect(
      database.getFirstAsync<{ total: number }>('SELECT count(*) AS total FROM consentimento'),
    ).resolves.toEqual({ total: 0 });
  });

  it('não grava para uma avaliação inexistente', async () => {
    await expect(
      repository.salvarDecisao({ ...decisao(true), atendimentoId: atendimentoId + 999 }),
    ).resolves.toBe(false);
    await expect(
      database.getFirstAsync<{ total: number }>('SELECT count(*) AS total FROM consentimento'),
    ).resolves.toEqual({ total: 0 });
  });

  it('não encontra estado para uma avaliação inexistente', async () => {
    await expect(repository.buscarEstado(atendimentoId + 999)).resolves.toBeNull();
  });
});
