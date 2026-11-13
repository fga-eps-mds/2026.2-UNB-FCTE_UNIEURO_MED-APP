import { createAttendanceRepository } from '@/db/attendance-repository';
import { createDrawingRepository } from '@/db/drawing-repository';
import {
  createInterruptionRepository,
  type SqliteInterruptionRepository,
} from '@/db/interruption-repository';

import {
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const INICIO = '2026-11-12T14:00:00.000Z';
const DESISTIU = '2026-11-12T14:06:00.000Z';
const RETOMOU = '2026-11-12T15:00:00.000Z';

let tablet: TabletComAnaEBruno;
let repository: SqliteInterruptionRepository;
let atendimentoId: number;

const estadoDoAtendimento = async () =>
  (await tablet.database.getFirstAsync<{
    estado: string;
    tarefa_interrupcao: number | null;
    motivo_interrupcao: string | null;
    data_hora_interrupcao: string | null;
  }>(
    `SELECT estado, tarefa_interrupcao, motivo_interrupcao, data_hora_interrupcao
     FROM avaliacao WHERE id = ?`,
    [atendimentoId],
  ))!;

const colocarEm = (estado: string) =>
  tablet.database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [estado, atendimentoId]);

async function gravarDesenho(ordem: number) {
  const tipo = (['relogio', 'cubo', 'trilhas'] as const)[ordem - 1];
  await createDrawingRepository(async () => tablet.database).salvarDesenho({
    atendimentoId,
    ordem,
    tipo,
    largura: 960,
    altura: 600,
    iniciadoEm: INICIO,
    confirmadoEm: INICIO,
    eventos: [{ tipo: 'inicio', ordem: 1, instante: 0, x: 1, y: 1, ponteiro: 'dedo' }],
    imagemPng: new Uint8Array([1, 2, 3]),
  });
}

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  repository = createInterruptionRepository(async () => tablet.database);
  ({ attendanceId: atendimentoId } = await createAttendanceRepository(
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
    startedAt: INICIO,
  }));
  await colocarEm('em_andamento');
});

afterEach(async () => {
  await tablet.fechar();
});

const desistencia = { tarefa: 2, motivo: 'cansaco' as const, interrompidoEm: DESISTIU };

describe('desistência', () => {
  it('interrompe o exame em andamento com a tarefa, o motivo e a hora', async () => {
    await expect(repository.interromper({ atendimentoId, ...desistencia })).resolves.toBe(true);

    await expect(estadoDoAtendimento()).resolves.toEqual({
      estado: 'interrompida',
      tarefa_interrupcao: 2,
      motivo_interrupcao: 'cansaco',
      data_hora_interrupcao: DESISTIU,
    });
  });

  it('aceita desistir sem motivo', async () => {
    await repository.interromper({ atendimentoId, ...desistencia, motivo: null });

    await expect(estadoDoAtendimento()).resolves.toMatchObject({ motivo_interrupcao: null });
  });

  it.each(['aguardando_consentimento', 'cancelada', 'concluida', 'interrompida'])(
    'não mexe no exame que está %s',
    async (estado) => {
      await colocarEm(estado);

      await expect(repository.interromper({ atendimentoId, ...desistencia })).resolves.toBe(false);
      await expect(estadoDoAtendimento()).resolves.toMatchObject({
        estado,
        tarefa_interrupcao: null,
      });
    },
  );

  it('recusa tarefa ou motivo fora do esquema', async () => {
    await expect(
      repository.interromper({ atendimentoId, ...desistencia, tarefa: 4 }),
    ).rejects.toThrow(/CHECK/);
    await expect(
      repository.interromper({
        atendimentoId,
        ...desistencia,
        motivo: 'sono' as unknown as 'cansaco',
      }),
    ).rejects.toThrow(/CHECK/);
  });
});

describe('exame interrompido', () => {
  it('mostra o paciente, a parada e as tarefas com desenho gravado', async () => {
    await gravarDesenho(1);
    await repository.interromper({ atendimentoId, ...desistencia });

    await expect(repository.buscarInterrompido(atendimentoId, tablet.anaId)).resolves.toEqual({
      atendimentoId,
      nomePaciente: 'José Alves Martins',
      fichaPaciente: '2026-0001',
      tarefa: 2,
      motivo: 'cansaco',
      interrompidoEm: DESISTIU,
      tarefasGravadas: [1],
    });
  });

  it('não mostra a outro profissional nem um exame que não está interrompido', async () => {
    const outro = await tablet.repository.findByEmail(BRUNO.email);
    await expect(repository.buscarInterrompido(atendimentoId, tablet.anaId)).resolves.toBeNull();

    await repository.interromper({ atendimentoId, ...desistencia });

    await expect(repository.buscarInterrompido(atendimentoId, outro!.id)).resolves.toBeNull();
  });
});

describe('retomada', () => {
  it('volta o exame interrompido para o andamento sem apagar a última parada', async () => {
    await repository.interromper({ atendimentoId, ...desistencia });

    await expect(repository.retomar(atendimentoId, tablet.anaId, RETOMOU)).resolves.toBe(true);
    await expect(estadoDoAtendimento()).resolves.toMatchObject({
      estado: 'em_andamento',
      tarefa_interrupcao: 2,
    });
  });

  it('não retoma exame de outro profissional nem exame que não está interrompido', async () => {
    const outro = await tablet.repository.findByEmail(BRUNO.email);
    await expect(repository.retomar(atendimentoId, tablet.anaId, RETOMOU)).resolves.toBe(false);

    await repository.interromper({ atendimentoId, ...desistencia });

    await expect(repository.retomar(atendimentoId, outro!.id, RETOMOU)).resolves.toBe(false);
    await expect(estadoDoAtendimento()).resolves.toMatchObject({ estado: 'interrompida' });
  });
});
