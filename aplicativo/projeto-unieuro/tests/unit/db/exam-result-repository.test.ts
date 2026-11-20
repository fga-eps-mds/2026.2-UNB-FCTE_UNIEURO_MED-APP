import { createAttendanceRepository } from '@/db/attendance-repository';
import { createDrawingRepository, type TaskType } from '@/db/drawing-repository';
import {
  createExamResultRepository,
  type SqliteExamResultRepository,
} from '@/db/exam-result-repository';

import {
  abrirTabletComAnaEBruno,
  BRUNO,
  cpfProtector,
  hashDaSenhaDeTeste,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const INICIO = '2026-11-03T14:00:00.000Z';
const png = (marca: number) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marca]);
const TAREFAS: { ordem: number; tipo: TaskType }[] = [
  { ordem: 1, tipo: 'relogio' },
  { ordem: 2, tipo: 'cubo' },
  { ordem: 3, tipo: 'trilhas' },
];

let tablet: TabletComAnaEBruno;
let repository: SqliteExamResultRepository;
let exameId: number;
let brunoId: number;

async function gravarDesenhos(atendimentoId: number, tarefas = TAREFAS) {
  const desenhos = createDrawingRepository(async () => tablet.database);
  // Gravados fora de ordem, para conferir que o resultado sai na ordem das tarefas.
  for (const { ordem, tipo } of [...tarefas].reverse()) {
    await desenhos.salvarDesenho({
      atendimentoId,
      ordem,
      tipo,
      largura: 960,
      altura: 600,
      iniciadoEm: INICIO,
      confirmadoEm: '2026-11-03T14:03:10.000Z',
      eventos: [],
      imagemPng: png(ordem),
    });
  }
}

async function criarSuperusuario(): Promise<number> {
  await tablet.repository.insertSuperuser(
    {
      name: 'Carlos Bernardo Tauil',
      email: 'carlos.tauil@unieuro.com.br',
      crmNumber: '12771',
      crmState: 'DF',
      cpf: '39053344705',
      passwordHash: await hashDaSenhaDeTeste(),
      createdAt: '2026-09-26T13:00:00.000Z',
    },
    null,
  );
  return (await tablet.repository.findByEmail('carlos.tauil@unieuro.com.br'))!.id;
}

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  repository = createExamResultRepository(async () => tablet.database);
  brunoId = (await tablet.repository.findByEmail(BRUNO.email))!.id;
  ({ attendanceId: exameId } = await createAttendanceRepository(
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
});

afterEach(async () => {
  await tablet.fechar();
});

describe('findExamResult', () => {
  it('traz o exame do médico com o paciente, quem aplicou e os desenhos na ordem das tarefas', async () => {
    await gravarDesenhos(exameId);

    const exame = await repository.findExamResult(tablet.anaId, exameId);

    expect(exame).toMatchObject({
      id: exameId,
      startedAt: INICIO,
      patientName: 'José Alves Martins',
      appliedBy: 'Ana Carolina Souza',
    });
    expect(exame!.recordNumber).toEqual(expect.any(String));
    expect(exame!.drawings.map(({ tipo, ordem }) => [ordem, tipo])).toEqual([
      [1, 'relogio'],
      [2, 'cubo'],
      [3, 'trilhas'],
    ]);
    expect(Array.from(exame!.drawings[1].imagemPng)).toEqual(Array.from(png(2)));
  });

  it('não mostra o exame de um médico para outro', async () => {
    await gravarDesenhos(exameId);

    await expect(repository.findExamResult(brunoId, exameId)).resolves.toBeNull();
  });

  it('o superusuário vê o exame de qualquer médico (#49)', async () => {
    await gravarDesenhos(exameId);
    const tauilId = await criarSuperusuario();

    const exame = await repository.findExamResult(tauilId, exameId);

    expect(exame?.appliedBy).toBe('Ana Carolina Souza');
    expect(exame?.drawings).toHaveLength(3);
  });

  it('um exame sem desenho gravado vem com a lista vazia', async () => {
    const exame = await repository.findExamResult(tablet.anaId, exameId);

    expect(exame?.drawings).toEqual([]);
  });

  it('um exame que não existe não devolve nada', async () => {
    await expect(repository.findExamResult(tablet.anaId, 9999)).resolves.toBeNull();
  });
});
