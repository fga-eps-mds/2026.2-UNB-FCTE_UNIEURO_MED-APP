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
  repository = createConsentRepository(async () => database, protector);
  atendimentoId = await criarAtendimento(database);
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

const CPF_RESPONSAVEL = '11144477735';

const decisao = (
  aceito: boolean,
  quemAssina: 'paciente' | 'responsavel_legal' = 'paciente',
  cpfResponsavel: string | null = null,
) => {
  const dados = {
    cpfResponsavel,
    atendimentoId,
    versaoTermo: '2026-09-15',
    quemAssina,
    autorizaImagensPesquisa: true,
    autorizaDadosPesquisaFutura: false,
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
    expect(typeof repository.cpfEhDoPaciente).toBe('function');
  });
});

describe('CPF do responsável comparado ao do paciente', () => {
  const CPF_DO_PACIENTE = '52998224725';

  it('reconhece o CPF do paciente do atendimento', async () => {
    await expect(repository.cpfEhDoPaciente(atendimentoId, CPF_DO_PACIENTE)).resolves.toBe(true);
  });

  it('não confunde outro CPF com o do paciente', async () => {
    await expect(repository.cpfEhDoPaciente(atendimentoId, CPF_RESPONSAVEL)).resolves.toBe(false);
  });

  it('não acha paciente num atendimento que não existe', async () => {
    await expect(repository.cpfEhDoPaciente(atendimentoId + 999, CPF_DO_PACIENTE)).resolves.toBe(
      false,
    );
  });
});

describe('migrations do consentimento', () => {
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
      'autoriza_imagens_pesquisa',
      'autoriza_dados_pesquisa_futura',
      'cpf_responsavel_cifrado',
    ]);
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'),
    ).resolves.toEqual({ user_version: SCHEMA_VERSION });
  });

  it('leva um banco da versão 4 à versão 7 sem perder a avaliação', async () => {
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

  it('leva um banco da versão 6 à versão 7 com consentimentos já gravados, sem alterá-los', async () => {
    const legacyTemp = createTempDatabase();
    const legacy = legacyTemp.open();
    await legacy.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    for (const step of MIGRATIONS.slice(0, 6)) {
      if (typeof step === 'string') await legacy.execAsync(step);
      else await step(legacy, protector);
    }
    await legacy.execAsync('PRAGMA user_version = 6');

    // Dois atendimentos do mesmo profissional: um aceito, com assinatura, e uma recusa.
    const aceitoId = await criarAtendimento(legacy);
    const professional = await legacy.getFirstAsync<{ id: number }>(
      'SELECT id FROM profissional LIMIT 1',
    );
    const attendances = createAttendanceRepository(async () => legacy, protector);
    const recusadoId = (
      await attendances.createAttendance({
        patient: {
          name: 'Maria das Dores Lima',
          cpf: '11144477735',
          birthDate: '1950-06-02',
          schoolingYears: 8,
          sex: 'feminino',
        },
        professionalId: professional!.id,
        startedAt: INICIO,
      })
    ).attendanceId;
    const inserir = (id: number, aceito: number, quem: string, assinatura: Uint8Array | null) =>
      legacy.runAsync(
        `INSERT INTO consentimento
           (id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, '2026-09-15', aceito, quem, assinatura, DECISAO],
      );
    await inserir(aceitoId, 1, 'paciente', ASSINATURA_PNG);
    await inserir(recusadoId, 0, 'responsavel_legal', null);

    const colunasAntigas = `id, id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora`;
    const antes = await legacy.getAllAsync(
      `SELECT ${colunasAntigas} FROM consentimento ORDER BY id`,
    );
    expect(antes).toHaveLength(2);

    await migrate(legacy, protector);

    await expect(legacy.getFirstAsync('PRAGMA user_version')).resolves.toEqual({
      user_version: SCHEMA_VERSION,
    });
    // As colunas que já existiam continuam idênticas, linha a linha.
    await expect(
      legacy.getAllAsync(`SELECT ${colunasAntigas} FROM consentimento ORDER BY id`),
    ).resolves.toEqual(antes);
    // As duas colunas novas ficam sem resposta (NULL) nos registros antigos.
    await expect(
      legacy.getAllAsync(
        `SELECT autoriza_imagens_pesquisa, autoriza_dados_pesquisa_futura
         FROM consentimento ORDER BY id`,
      ),
    ).resolves.toEqual([
      { autoriza_imagens_pesquisa: null, autoriza_dados_pesquisa_futura: null },
      { autoriza_imagens_pesquisa: null, autoriza_dados_pesquisa_futura: null },
    ]);
    // O estado das avaliações também não muda.
    await expect(
      legacy.getAllAsync('SELECT id, estado FROM avaliacao ORDER BY id'),
    ).resolves.toEqual([
      { id: aceitoId, estado: 'aguardando_consentimento' },
      { id: recusadoId, estado: 'aguardando_consentimento' },
    ]);
    await legacy.closeAsync();
    legacyTemp.cleanup();
  });

  it('aceita só nulo, 0 ou 1 nas colunas de autorização', async () => {
    const inserir = (imagens: number, futura: number) =>
      database.runAsync(
        `INSERT INTO consentimento
           (id_avaliacao, versao_tcle, aceito, assinado_por, data_hora,
            autoriza_imagens_pesquisa, autoriza_dados_pesquisa_futura)
         VALUES (?, '2026-09-15', 0, 'paciente', ?, ?, ?)`,
        [atendimentoId, DECISAO, imagens, futura],
      );

    await expect(inserir(2, 0)).rejects.toThrow();
    await expect(inserir(1, -1)).rejects.toThrow();
    await expect(inserir(1, 0)).resolves.toBeDefined();
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
        `SELECT id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora,
                autoriza_imagens_pesquisa, autoriza_dados_pesquisa_futura
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
      autoriza_imagens_pesquisa: 1,
      autoriza_dados_pesquisa_futura: 0,
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

describe('CPF do responsável legal (migration da versão 8)', () => {
  const cifradoDe = async () =>
    (
      await database.getFirstAsync<{ cpf_responsavel_cifrado: string | null }>(
        'SELECT cpf_responsavel_cifrado FROM consentimento WHERE id_avaliacao = ?',
        [atendimentoId],
      )
    )?.cpf_responsavel_cifrado;

  it('leva um banco da versão 7 à versão 8 sem alterar os consentimentos já gravados', async () => {
    const legacyTemp = createTempDatabase();
    const legacy = legacyTemp.open();
    await legacy.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    for (const step of MIGRATIONS.slice(0, 7)) {
      if (typeof step === 'string') await legacy.execAsync(step);
      else await step(legacy, protector);
    }
    await legacy.execAsync('PRAGMA user_version = 7');
    const legacyAttendanceId = await criarAtendimento(legacy);
    // Aceite antigo pelo responsável legal: foi gravado sem nenhum identificador dele.
    await legacy.runAsync(
      `INSERT INTO consentimento
         (id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora)
       VALUES (?, '2026-09-15', 1, 'responsavel_legal', ?, ?)`,
      [legacyAttendanceId, ASSINATURA_PNG, DECISAO],
    );
    const colunasAntigas = `id, id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora`;
    const antes = await legacy.getAllAsync(`SELECT ${colunasAntigas} FROM consentimento`);

    await migrate(legacy, protector);

    await expect(legacy.getFirstAsync('PRAGMA user_version')).resolves.toEqual({
      user_version: SCHEMA_VERSION,
    });
    await expect(
      legacy.getAllAsync(`SELECT ${colunasAntigas} FROM consentimento`),
    ).resolves.toEqual(antes);
    await expect(
      legacy.getFirstAsync('SELECT cpf_responsavel_cifrado FROM consentimento'),
    ).resolves.toEqual({ cpf_responsavel_cifrado: null });
    await legacy.closeAsync();
    legacyTemp.cleanup();
  });

  it('aceite pelo responsável legal grava o CPF dele junto da versão, assinatura, data e hora', async () => {
    await expect(
      repository.salvarDecisao(decisao(true, 'responsavel_legal', CPF_RESPONSAVEL)),
    ).resolves.toBe(true);

    await expect(
      database.getFirstAsync(
        `SELECT versao_tcle, aceito, assinado_por, assinatura_png, data_hora
         FROM consentimento WHERE id_avaliacao = ?`,
        [atendimentoId],
      ),
    ).resolves.toEqual({
      versao_tcle: '2026-09-15',
      aceito: 1,
      assinado_por: 'responsavel_legal',
      assinatura_png: ASSINATURA_PNG,
      data_hora: DECISAO,
    });
    expect(await cifradoDe()).toEqual(expect.any(String));
    await expect(protector.decrypt((await cifradoDe())!)).resolves.toBe(CPF_RESPONSAVEL);
  });

  it('nunca grava o CPF do responsável em texto, nem em nenhuma coluna do consentimento', async () => {
    await repository.salvarDecisao(decisao(true, 'responsavel_legal', CPF_RESPONSAVEL));

    const linha = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM consentimento WHERE id_avaliacao = ?',
      [atendimentoId],
    );
    const valores = Object.values(linha!).map((valor) =>
      valor instanceof Uint8Array
        ? Array.from(valor, (byte) => String.fromCodePoint(byte)).join('')
        : String(valor),
    );
    for (const valor of valores) expect(valor).not.toContain(CPF_RESPONSAVEL);
    expect(await cifradoDe()).toMatch(/^aes-gcm\$1\$/);
  });

  it('cifra do mesmo CPF muda a cada gravação, como no CPF do paciente', async () => {
    await repository.salvarDecisao(decisao(true, 'responsavel_legal', CPF_RESPONSAVEL));
    const primeira = await cifradoDe();
    await database.runAsync('DELETE FROM consentimento');
    await database.runAsync("UPDATE avaliacao SET estado = 'aguardando_consentimento'");

    await repository.salvarDecisao(decisao(true, 'responsavel_legal', CPF_RESPONSAVEL));

    expect(await cifradoDe()).not.toBe(primeira);
  });

  it('aceite pelo paciente não grava CPF de responsável', async () => {
    await repository.salvarDecisao(decisao(true, 'paciente'));

    expect(await cifradoDe()).toBeNull();
  });

  it('descarta o CPF entregue junto de um aceite do paciente', async () => {
    await repository.salvarDecisao(decisao(true, 'paciente', CPF_RESPONSAVEL));

    expect(await cifradoDe()).toBeNull();
  });

  it('a recusa não grava CPF de responsável', async () => {
    await repository.salvarDecisao(decisao(false, 'responsavel_legal', CPF_RESPONSAVEL));

    expect(await cifradoDe()).toBeNull();
    await expect(repository.buscarEstado(atendimentoId)).resolves.toBe('cancelada');
  });

  it('o banco recusa CPF de responsável em registro do paciente ou em recusa', async () => {
    const inserir = (aceito: number, quem: string, assinatura: Uint8Array | null) =>
      database.runAsync(
        `INSERT INTO consentimento
           (id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora,
            cpf_responsavel_cifrado)
         VALUES (?, '2026-09-15', ?, ?, ?, ?, 'aes-gcm$1$00')`,
        [atendimentoId, aceito, quem, assinatura, DECISAO],
      );

    await expect(inserir(1, 'paciente', ASSINATURA_PNG)).rejects.toThrow(/CHECK/);
    await expect(inserir(0, 'responsavel_legal', null)).rejects.toThrow(/CHECK/);
    await expect(inserir(1, 'responsavel_legal', ASSINATURA_PNG)).resolves.toBeDefined();
  });

  it('o banco recusa CPF cifrado em branco', async () => {
    await expect(
      database.runAsync(
        `INSERT INTO consentimento
           (id_avaliacao, versao_tcle, aceito, assinado_por, assinatura_png, data_hora,
            cpf_responsavel_cifrado)
         VALUES (?, '2026-09-15', 1, 'responsavel_legal', ?, ?, '   ')`,
        [atendimentoId, ASSINATURA_PNG, DECISAO],
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('não muda o estado da avaliação se a cifra do CPF falhar', async () => {
    const protetorComFalha = {
      ...protector,
      encrypt: jest.fn().mockRejectedValue(new Error('Keystore indisponível')),
    };
    const comFalha = createConsentRepository(async () => database, protetorComFalha);

    await expect(
      comFalha.salvarDecisao(decisao(true, 'responsavel_legal', CPF_RESPONSAVEL)),
    ).rejects.toThrow('Keystore indisponível');

    await expect(repository.buscarEstado(atendimentoId)).resolves.toBe('aguardando_consentimento');
    await expect(
      database.getFirstAsync<{ total: number }>('SELECT count(*) AS total FROM consentimento'),
    ).resolves.toEqual({ total: 0 });
  });
});
