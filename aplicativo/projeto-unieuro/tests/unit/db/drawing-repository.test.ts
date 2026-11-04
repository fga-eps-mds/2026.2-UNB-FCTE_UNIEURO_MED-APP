import { createAttendanceRepository } from '@/db/attendance-repository';
import {
  createDrawingRepository,
  type DrawingRecord,
  type SqliteDrawingRepository,
  type TracingEventRecord,
} from '@/db/drawing-repository';

import {
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const STARTED_AT = '2026-11-03T14:00:00.000Z';
const CONFIRMED_AT = '2026-11-03T14:03:10.000Z';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

let tablet: TabletComAnaEBruno;
let repository: SqliteDrawingRepository;
let attendanceId: number;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  repository = createDrawingRepository(async () => tablet.database);
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

const EVENTOS: TracingEventRecord[] = [
  { tipo: 'inicio', ordem: 1, instante: 100, x: 10, y: 20, ponteiro: 'caneta', pressao: 0.4 },
  {
    tipo: 'ponto',
    ordem: 2,
    instante: 116,
    x: 12.5,
    y: 21,
    ponteiro: 'caneta',
    pressao: 1.37,
    inclinacaoX: 12,
    inclinacaoY: -3,
  },
  { tipo: 'inicio', ordem: 3, instante: 900, x: 50, y: 60, ponteiro: 'dedo' },
];

const desenho = (extra: Partial<DrawingRecord> = {}): DrawingRecord => ({
  atendimentoId: attendanceId,
  ordem: 1,
  tipo: 'relogio',
  largura: 960,
  altura: 600,
  iniciadoEm: STARTED_AT,
  confirmadoEm: CONFIRMED_AT,
  eventos: EVENTOS,
  imagemPng: PNG,
  ...extra,
});

const contar = async (tabela: string) =>
  (await tablet.database.getFirstAsync<{ total: number }>(
    `SELECT count(*) AS total FROM ${tabela}`,
  ))!.total;

const eventosGravados = () =>
  tablet.database.getAllAsync(
    `SELECT e.ordem, e.tipo, e.ponteiro, e.coord_x, e.coord_y, e.instante, e.pressao,
       e.inclinacao_x, e.inclinacao_y
     FROM evento_tracado e ORDER BY e.ordem`,
  );

describe('Cenário: traçado guardado', () => {
  it('grava a tarefa ligada ao atendimento, com o tamanho do quadro, o início e o término', async () => {
    await repository.salvarDesenho(desenho());

    await expect(
      tablet.database.getAllAsync(
        `SELECT id_avaliacao, tipo, ordem, largura, altura, data_hora_inicio, data_hora_termino
         FROM tarefa`,
      ),
    ).resolves.toEqual([
      {
        id_avaliacao: attendanceId,
        tipo: 'relogio',
        ordem: 1,
        largura: 960,
        altura: 600,
        data_hora_inicio: STARTED_AT,
        data_hora_termino: CONFIRMED_AT,
      },
    ]);
  });

  it('grava cada ponto na sequência, com o instante, o ponteiro, a pressão e a inclinação', async () => {
    await repository.salvarDesenho(desenho());

    await expect(eventosGravados()).resolves.toEqual([
      {
        ordem: 1,
        tipo: 'inicio',
        ponteiro: 'caneta',
        coord_x: 10,
        coord_y: 20,
        instante: 100,
        pressao: 0.4,
        inclinacao_x: null,
        inclinacao_y: null,
      },
      {
        ordem: 2,
        tipo: 'ponto',
        ponteiro: 'caneta',
        coord_x: 12.5,
        coord_y: 21,
        instante: 116,
        pressao: 1.37,
        inclinacao_x: 12,
        inclinacao_y: -3,
      },
      {
        ordem: 3,
        tipo: 'inicio',
        ponteiro: 'dedo',
        coord_x: 50,
        coord_y: 60,
        instante: 900,
        pressao: null,
        inclinacao_x: null,
        inclinacao_y: null,
      },
    ]);
  });

  it('grava em lotes um traçado com mais de 100 pontos', async () => {
    const longo: TracingEventRecord[] = Array.from({ length: 250 }, (_, indice) => ({
      tipo: indice === 0 ? 'inicio' : 'ponto',
      ordem: indice + 1,
      instante: indice * 16,
      x: indice,
      y: indice / 2,
      ponteiro: 'caneta',
    }));

    await repository.salvarDesenho(desenho({ eventos: longo }));

    expect(await contar('evento_tracado')).toBe(250);
    const ultimo = await tablet.database.getFirstAsync<{ ordem: number; instante: number }>(
      'SELECT ordem, instante FROM evento_tracado ORDER BY ordem DESC LIMIT 1',
    );
    expect(ultimo).toEqual({ ordem: 250, instante: 249 * 16 });
  });

  it('grava as três tarefas do mesmo atendimento', async () => {
    await repository.salvarDesenho(desenho());
    await repository.salvarDesenho(desenho({ ordem: 2, tipo: 'cubo' }));
    await repository.salvarDesenho(desenho({ ordem: 3, tipo: 'trilhas' }));

    await expect(
      tablet.database.getAllAsync('SELECT ordem, tipo FROM tarefa ORDER BY ordem'),
    ).resolves.toEqual([
      { ordem: 1, tipo: 'relogio' },
      { ordem: 2, tipo: 'cubo' },
      { ordem: 3, tipo: 'trilhas' },
    ]);
    expect(await contar('desenho')).toBe(3);
  });
});

describe('Cenário: traços apagados também ficam', () => {
  it('grava o desfazer e o limpar junto com os pontos apagados', async () => {
    const comApagados: TracingEventRecord[] = [
      ...EVENTOS,
      { tipo: 'desfazer', ordem: 4, instante: 1200 },
      { tipo: 'limpar', ordem: 5, instante: 1500 },
    ];

    await repository.salvarDesenho(desenho({ eventos: comApagados }));

    const gravados = await tablet.database.getAllAsync<{ tipo: string; coord_x: number | null }>(
      'SELECT tipo, coord_x FROM evento_tracado ORDER BY ordem',
    );
    expect(gravados).toEqual([
      { tipo: 'inicio', coord_x: 10 },
      { tipo: 'ponto', coord_x: 12.5 },
      { tipo: 'inicio', coord_x: 50 },
      { tipo: 'desfazer', coord_x: null },
      { tipo: 'limpar', coord_x: null },
    ]);
  });
});

describe('Cenário: imagem final guardada', () => {
  it('grava o PNG ligado à tarefa, com a hora da confirmação', async () => {
    await repository.salvarDesenho(desenho());

    const gravado = await tablet.database.getFirstAsync<{
      tipo: string;
      id_avaliacao: number;
      imagem_final: Uint8Array;
      data_hora_confirmacao: string;
    }>(
      `SELECT t.tipo, t.id_avaliacao, d.imagem_final, d.data_hora_confirmacao
       FROM desenho d JOIN tarefa t ON t.id = d.id_tarefa`,
    );
    expect(gravado).toMatchObject({
      tipo: 'relogio',
      id_avaliacao: attendanceId,
      data_hora_confirmacao: CONFIRMED_AT,
    });
    expect(Array.from(gravado!.imagem_final)).toEqual(Array.from(PNG));
  });
});

describe('Cenário: tudo ou nada', () => {
  const nadaGravado = async () => {
    expect(await contar('tarefa')).toBe(0);
    expect(await contar('evento_tracado')).toBe(0);
    expect(await contar('desenho')).toBe(0);
  };

  it('não grava a tarefa nem o traçado quando a imagem é recusada', async () => {
    await expect(
      repository.salvarDesenho(desenho({ imagemPng: new Uint8Array() })),
    ).rejects.toThrow(/CHECK/);

    await nadaGravado();
  });

  it('não grava a tarefa nem a imagem quando um evento do traçado é recusado', async () => {
    const invalido: TracingEventRecord[] = [
      ...EVENTOS,
      { tipo: 'ponto', ordem: 4, instante: -1, x: 1, y: 1, ponteiro: 'caneta' },
    ];

    await expect(repository.salvarDesenho(desenho({ eventos: invalido }))).rejects.toThrow(/CHECK/);

    await nadaGravado();
  });

  it('desfaz os lotes já gravados quando um evento de um lote seguinte é recusado', async () => {
    const longo: TracingEventRecord[] = Array.from({ length: 250 }, (_, indice) => ({
      tipo: indice === 0 ? 'inicio' : 'ponto',
      ordem: indice + 1,
      // O evento 150, no segundo lote, tem instante negativo e é recusado.
      instante: indice === 149 ? -1 : indice * 16,
      x: indice,
      y: indice,
      ponteiro: 'caneta',
    }));

    await expect(repository.salvarDesenho(desenho({ eventos: longo }))).rejects.toThrow(/CHECK/);

    await nadaGravado();
  });

  it('não grava nada quando a ordem não combina com o tipo da tarefa', async () => {
    await expect(repository.salvarDesenho(desenho({ ordem: 1, tipo: 'cubo' }))).rejects.toThrow(
      /CHECK/,
    );

    await nadaGravado();
  });

  it('recusa gravar de novo a mesma tarefa e mantém só a primeira gravação', async () => {
    await repository.salvarDesenho(desenho());

    await expect(repository.salvarDesenho(desenho())).rejects.toThrow(/UNIQUE/);

    expect(await contar('tarefa')).toBe(1);
    expect(await contar('evento_tracado')).toBe(EVENTOS.length);
    expect(await contar('desenho')).toBe(1);
  });

  it('não grava nada para um atendimento que não existe', async () => {
    await expect(repository.salvarDesenho(desenho({ atendimentoId: 9999 }))).rejects.toThrow(
      /FOREIGN KEY/,
    );

    await nadaGravado();
  });
});
