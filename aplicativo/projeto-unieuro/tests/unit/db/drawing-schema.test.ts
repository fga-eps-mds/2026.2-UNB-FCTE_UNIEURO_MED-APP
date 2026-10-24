import type { SQLiteBindValue } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { migrate } from '@/db/database';
import { MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';

import { createTempDatabase } from '../../test-support/real-sqlite';
import {
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

// Tabelas tarefa, desenho e evento_tracado (#10), testadas direto com SQL.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const STARTED_AT = '2026-10-23T14:00:00.000Z';
const CONFIRMED_AT = '2026-10-23T14:03:10.000Z';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

type Evento = {
  ordem: number;
  tipo: string;
  instante: number;
  ponteiro?: string;
  coord_x?: number;
  coord_y?: number;
  pressao?: number;
  inclinacao_x?: number;
  inclinacao_y?: number;
};

let tablet: TabletComAnaEBruno;
let attendanceId: number;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ({ attendanceId } = await createAttendanceRepository(
    async () => tablet.database,
    cpfProtector,
  ).createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: '52998224725',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: tablet.anaId,
    startedAt: STARTED_AT,
  }));
});

afterEach(async () => {
  await tablet.fechar();
});

async function inserirTarefa(ordem = 1, tipo = 'relogio', atendimento = attendanceId) {
  const result = await tablet.database.runAsync(
    'INSERT INTO tarefa (id_avaliacao, tipo, ordem, data_hora_inicio) VALUES (?, ?, ?, ?)',
    [atendimento, tipo, ordem, STARTED_AT],
  );
  return result.lastInsertRowId;
}

function inserirEvento(tarefa: number, evento: Evento) {
  const colunas = Object.keys(evento);
  return tablet.database.runAsync(
    `INSERT INTO evento_tracado (id_tarefa, ${colunas.join(', ')})
     VALUES (?, ${colunas.map(() => '?').join(', ')})`,
    [tarefa, ...(Object.values(evento) as SQLiteBindValue[])],
  );
}

function inserirDesenho(tarefa: number, imagem: Uint8Array = PNG) {
  return tablet.database.runAsync(
    'INSERT INTO desenho (id_tarefa, imagem_final, data_hora_confirmacao) VALUES (?, ?, ?)',
    [tarefa, imagem, CONFIRMED_AT],
  );
}

const ponto = (ordem: number, instante: number, extra: Partial<Evento> = {}): Evento => ({
  ordem,
  tipo: ordem === 1 ? 'inicio' : 'ponto',
  instante,
  ponteiro: 'caneta',
  coord_x: ordem * 10,
  coord_y: ordem * 10.5,
  ...extra,
});

const contar = async (tabela: string) =>
  (await tablet.database.getFirstAsync<{ total: number }>(
    `SELECT count(*) AS total FROM ${tabela}`,
  ))!.total;

describe('Cenário: traçado guardado', () => {
  it('guarda a sequência dos pontos e o instante de cada um, ligada ao atendimento e à tarefa', async () => {
    const tarefa = await inserirTarefa();
    await inserirEvento(tarefa, ponto(1, 100));
    await inserirEvento(tarefa, ponto(2, 116));
    await inserirEvento(tarefa, ponto(3, 133));

    const linhas = await tablet.database.getAllAsync(
      `SELECT t.id_avaliacao, t.ordem AS tarefa, e.ordem, e.tipo, e.instante
       FROM evento_tracado e JOIN tarefa t ON t.id = e.id_tarefa ORDER BY e.ordem`,
    );
    expect(linhas).toEqual([
      { id_avaliacao: attendanceId, tarefa: 1, ordem: 1, tipo: 'inicio', instante: 100 },
      { id_avaliacao: attendanceId, tarefa: 1, ordem: 2, tipo: 'ponto', instante: 116 },
      { id_avaliacao: attendanceId, tarefa: 1, ordem: 3, tipo: 'ponto', instante: 133 },
    ]);
  });

  it('guarda coordenadas com casas decimais e os dados da caneta, que são opcionais', async () => {
    const tarefa = await inserirTarefa();
    await inserirEvento(
      tarefa,
      ponto(1, 100, { pressao: 0.6, inclinacao_x: 12, inclinacao_y: -3.5 }),
    );
    await inserirEvento(tarefa, ponto(2, 116, { ponteiro: 'dedo' }));

    await expect(
      tablet.database.getAllAsync(
        `SELECT ponteiro, coord_x, coord_y, pressao, inclinacao_x, inclinacao_y
         FROM evento_tracado ORDER BY ordem`,
      ),
    ).resolves.toEqual([
      {
        ponteiro: 'caneta',
        coord_x: 10,
        coord_y: 10.5,
        pressao: 0.6,
        inclinacao_x: 12,
        inclinacao_y: -3.5,
      },
      {
        ponteiro: 'dedo',
        coord_x: 20,
        coord_y: 21,
        pressao: null,
        inclinacao_x: null,
        inclinacao_y: null,
      },
    ]);
  });

  it('separa o traçado de cada uma das três tarefas do atendimento', async () => {
    const relogio = await inserirTarefa(1, 'relogio');
    const cubo = await inserirTarefa(2, 'cubo');
    await inserirTarefa(3, 'trilhas');
    await inserirEvento(relogio, ponto(1, 10));
    await inserirEvento(cubo, ponto(1, 20));

    await expect(
      tablet.database.getAllAsync(
        `SELECT t.tipo, count(e.id) AS eventos FROM tarefa t
         LEFT JOIN evento_tracado e ON e.id_tarefa = t.id GROUP BY t.id ORDER BY t.ordem`,
      ),
    ).resolves.toEqual([
      { tipo: 'relogio', eventos: 1 },
      { tipo: 'cubo', eventos: 1 },
      { tipo: 'trilhas', eventos: 0 },
    ]);
  });
});

describe('Cenário: traços apagados também ficam', () => {
  it('guarda o desfazer e o limpar como eventos, sem coordenadas', async () => {
    const tarefa = await inserirTarefa();
    await inserirEvento(tarefa, ponto(1, 100));
    await inserirEvento(tarefa, { ordem: 2, tipo: 'desfazer', instante: 400 });
    await inserirEvento(tarefa, { ordem: 3, tipo: 'limpar', instante: 900 });

    await expect(
      tablet.database.getAllAsync(
        'SELECT tipo, coord_x, ponteiro FROM evento_tracado ORDER BY ordem',
      ),
    ).resolves.toEqual([
      { tipo: 'inicio', coord_x: 10, ponteiro: 'caneta' },
      { tipo: 'desfazer', coord_x: null, ponteiro: null },
      { tipo: 'limpar', coord_x: null, ponteiro: null },
    ]);
  });

  it('não deixa alterar nem apagar o traçado gravado', async () => {
    const tarefa = await inserirTarefa();
    await inserirEvento(tarefa, ponto(1, 100));
    await inserirEvento(tarefa, { ordem: 2, tipo: 'desfazer', instante: 400 });

    await expect(
      tablet.database.execAsync('UPDATE evento_tracado SET instante = 0'),
    ).rejects.toThrow(/nao pode ser alterado/);
    await expect(tablet.database.execAsync('DELETE FROM evento_tracado')).rejects.toThrow(
      /nao pode ser apagado/,
    );
    expect(await contar('evento_tracado')).toBe(2);
  });
});

describe('Cenário: imagem final guardada', () => {
  it('guarda a imagem PNG ligada à tarefa e ao atendimento', async () => {
    const tarefa = await inserirTarefa();
    await inserirDesenho(tarefa);

    const desenho = await tablet.database.getFirstAsync<{
      id_avaliacao: number;
      imagem_final: Uint8Array;
      data_hora_confirmacao: string;
    }>(
      `SELECT t.id_avaliacao, d.imagem_final, d.data_hora_confirmacao
       FROM desenho d JOIN tarefa t ON t.id = d.id_tarefa`,
    );
    expect(desenho!.id_avaliacao).toBe(attendanceId);
    expect(Array.from(desenho!.imagem_final)).toEqual(Array.from(PNG));
    expect(desenho!.data_hora_confirmacao).toBe(CONFIRMED_AT);
  });

  it('recusa desenho sem imagem', async () => {
    const tarefa = await inserirTarefa();

    await expect(inserirDesenho(tarefa, new Uint8Array())).rejects.toThrow(/CHECK/);
  });

  it('recusa um segundo desenho para a mesma tarefa', async () => {
    const tarefa = await inserirTarefa();
    await inserirDesenho(tarefa);

    await expect(inserirDesenho(tarefa)).rejects.toThrow(/UNIQUE/);
  });

  it('recusa desenho de uma tarefa que não existe', async () => {
    await expect(inserirDesenho(999)).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('restrições da tarefa', () => {
  it('aceita as três tarefas na ordem combinada', async () => {
    await inserirTarefa(1, 'relogio');
    await inserirTarefa(2, 'cubo');
    await inserirTarefa(3, 'trilhas');

    expect(await contar('tarefa')).toBe(3);
  });

  it('recusa uma quarta tarefa', async () => {
    await expect(inserirTarefa(4, 'relogio')).rejects.toThrow(/CHECK/);
  });

  it('recusa repetir a mesma tarefa no atendimento', async () => {
    await inserirTarefa(1, 'relogio');

    await expect(inserirTarefa(1, 'relogio')).rejects.toThrow(/UNIQUE/);
  });

  it.each([
    [1, 'cubo'],
    [1, 'trilhas'],
    [2, 'relogio'],
    [3, 'cubo'],
  ])('recusa a tarefa %i com o tipo %s, fora da ordem combinada', async (ordem, tipo) => {
    await expect(inserirTarefa(ordem, tipo)).rejects.toThrow(/CHECK/);
    expect(await contar('tarefa')).toBe(0);
  });

  it('recusa tipo de tarefa desconhecido', async () => {
    await expect(inserirTarefa(1, 'pentagono')).rejects.toThrow(/CHECK/);
  });

  it('recusa tarefa de um atendimento que não existe', async () => {
    await expect(inserirTarefa(1, 'relogio', 999)).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('restrições do evento', () => {
  it.each<[string, Evento]>([
    ['ponto sem coordenada', { ordem: 1, tipo: 'ponto', instante: 10, ponteiro: 'caneta' }],
    ['ponto sem ponteiro', { ordem: 1, tipo: 'inicio', instante: 10, coord_x: 1, coord_y: 1 }],
    [
      'desfazer com coordenada',
      { ordem: 1, tipo: 'desfazer', instante: 10, coord_x: 1, coord_y: 1 },
    ],
    ['limpar com pressão', { ordem: 1, tipo: 'limpar', instante: 10, pressao: 0.5 }],
    ['tipo desconhecido', { ordem: 1, tipo: 'apagar', instante: 10 }],
    ['ponteiro desconhecido', ponto(1, 10, { ponteiro: 'luva' })],
    ['pressão acima de 1', ponto(1, 10, { pressao: 1.5 })],
    ['instante negativo', ponto(1, -1)],
    ['ordem zero', { ordem: 0, tipo: 'limpar', instante: 10 }],
  ])('recusa %s', async (_caso, evento) => {
    const tarefa = await inserirTarefa();

    await expect(inserirEvento(tarefa, evento)).rejects.toThrow(/CHECK/);
  });

  it('recusa repetir a ordem de um evento na mesma tarefa', async () => {
    const tarefa = await inserirTarefa();
    await inserirEvento(tarefa, ponto(1, 10));

    await expect(inserirEvento(tarefa, ponto(1, 20))).rejects.toThrow(/UNIQUE/);
  });

  it('recusa evento de uma tarefa que não existe', async () => {
    await expect(inserirEvento(999, ponto(1, 10))).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('migration da versão 5', () => {
  it('leva um banco da versão 4 à 5 sem perder o atendimento já registrado', async () => {
    const legacyTemp = createTempDatabase();
    const legacy = legacyTemp.open();
    try {
      await legacy.execAsync('PRAGMA foreign_keys = ON;');
      for (const step of MIGRATIONS.slice(0, 4)) {
        if (typeof step === 'string') await legacy.execAsync(step);
        else await step(legacy, cpfProtector);
      }
      await legacy.execAsync('PRAGMA user_version = 4');
      const professional = await legacy.runAsync(
        `INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update)
         VALUES ('Bruno Lima', 'bruno@unieuro.com.br', '67890', 'GO', 'cifra', ?, 'hash', 'x', 'x')`,
        ['a'.repeat(64)],
      );
      const patient = await legacy.runAsync(
        `INSERT INTO paciente (nome, cpf_cifrado, cpf_indice, numero_ficha, data_nascimento, escolaridade_anos, criacao, last_update)
         VALUES ('Maria Lima', 'cifra', ?, '2026-0001', '1950-07-02', 8, 'x', 'x')`,
        ['b'.repeat(64)],
      );
      const attendance = await legacy.runAsync(
        `INSERT INTO avaliacao (id_profissional, id_paciente, data_hora_inicio, last_update)
         VALUES (?, ?, ?, ?)`,
        [professional.lastInsertRowId, patient.lastInsertRowId, STARTED_AT, STARTED_AT],
      );

      await migrate(legacy, cpfProtector);

      await expect(legacy.getFirstAsync('PRAGMA user_version')).resolves.toEqual({
        user_version: SCHEMA_VERSION,
      });
      await expect(
        legacy.getFirstAsync('SELECT id_paciente FROM avaliacao WHERE id = ?', [
          attendance.lastInsertRowId,
        ]),
      ).resolves.toEqual({ id_paciente: patient.lastInsertRowId });
      await expect(
        legacy.runAsync(
          'INSERT INTO tarefa (id_avaliacao, tipo, ordem, data_hora_inicio) VALUES (?, ?, ?, ?)',
          [attendance.lastInsertRowId, 'relogio', 1, STARTED_AT],
        ),
      ).resolves.toMatchObject({ changes: 1 });
    } finally {
      await legacy.closeAsync();
      legacyTemp.cleanup();
    }
  });
});
