import { createAttendanceRepository } from '@/db/attendance-repository';
import { createDrawingRepository, type DrawingRecord } from '@/db/drawing-repository';
import { createExamRepository, type SqliteExamRepository } from '@/db/exam-repository';

import {
  ANA,
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const STARTED_AT = '2026-11-03T14:00:00.000Z';
// Bytes curtos com o começo de um PNG. O teste só confere que a imagem volta igual.
const PNG_RELOGIO = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const PNG_CUBO = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 4, 5, 6]);
const PNG_TRILHAS = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 7, 8, 9]);

let tablet: TabletComAnaEBruno;
let repository: SqliteExamRepository;
let attendances: ReturnType<typeof createAttendanceRepository>;
let drawings: ReturnType<typeof createDrawingRepository>;
let brunoId: number;

// Cada teste começa com um banco novo, com a Ana e o Bruno cadastrados.
beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  repository = createExamRepository(async () => tablet.database);
  attendances = createAttendanceRepository(async () => tablet.database, cpfProtector);
  drawings = createDrawingRepository(async () => tablet.database);
  brunoId = (await tablet.repository.findByEmail(BRUNO.email))!.id;
});

afterEach(async () => {
  await tablet.fechar();
});

// O CPF do paciente é único no banco, então o teste com dois pacientes passa outro CPF.
const novoAtendimento = async (professionalId: number, cpf = '52998224725') => {
  const { attendanceId } = await attendances.createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf,
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId,
    startedAt: STARTED_AT,
  });
  return attendanceId;
};

// O tipo sai da ordem, como o banco exige, com relógio 1, cubo 2 e trilhas 3.
// A hora da confirmação muda com a ordem, para saber de qual tarefa ela veio.
const desenho = (
  atendimentoId: number,
  ordem: 1 | 2 | 3,
  imagemPng: Uint8Array,
): DrawingRecord => ({
  atendimentoId,
  ordem,
  tipo: (['relogio', 'cubo', 'trilhas'] as const)[ordem - 1],
  largura: 960,
  altura: 600,
  iniciadoEm: '2026-11-03T14:01:00.000Z',
  confirmadoEm: `2026-11-03T14:0${ordem + 1}:30.000Z`,
  eventos: [{ tipo: 'inicio', ordem: 1, instante: 0, x: 10, y: 10, ponteiro: 'caneta' }],
  imagemPng,
});

// Ainda não existe código que conclua ou interrompa o exame, então o teste troca o
// estado direto no banco.
const mudarEstado = (atendimentoId: number, estado: string) =>
  tablet.database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [estado, atendimentoId]);

describe('Cenário: consultar uma avaliação salva', () => {
  it('lê o exame com o paciente, quem aplicou e os três desenhos, na ordem do exame', async () => {
    const atendimentoId = await novoAtendimento(tablet.anaId);
    // Gravados fora de ordem, para conferir que a leitura ordena pela tarefa.
    await drawings.salvarDesenho(desenho(atendimentoId, 3, PNG_TRILHAS));
    await drawings.salvarDesenho(desenho(atendimentoId, 1, PNG_RELOGIO));
    await drawings.salvarDesenho(desenho(atendimentoId, 2, PNG_CUBO));
    await mudarEstado(atendimentoId, 'concluida');

    const exame = await repository.buscarExame(tablet.anaId, atendimentoId);

    expect(exame).toMatchObject({
      id: atendimentoId,
      iniciadoEm: STARTED_AT,
      estado: 'concluida',
      pacienteNome: 'José Alves Martins',
      numeroFicha: '2026-0001',
      profissionalNome: ANA.name,
    });
    expect(exame!.desenhos.map(({ ordem, tipo }) => [ordem, tipo])).toEqual([
      [1, 'relogio'],
      [2, 'cubo'],
      [3, 'trilhas'],
    ]);
    expect(exame!.desenhos[0].confirmadoEm).toBe('2026-11-03T14:02:30.000Z');
  });

  it('devolve a imagem exatamente como foi gravada', async () => {
    const atendimentoId = await novoAtendimento(tablet.anaId);
    await drawings.salvarDesenho(desenho(atendimentoId, 1, PNG_RELOGIO));

    const exame = await repository.buscarExame(tablet.anaId, atendimentoId);

    expect(Array.from(exame!.desenhos[0].imagemPng)).toEqual(Array.from(PNG_RELOGIO));
  });

  it('no exame interrompido, lê só os desenhos já confirmados', async () => {
    const atendimentoId = await novoAtendimento(tablet.anaId);
    await drawings.salvarDesenho(desenho(atendimentoId, 1, PNG_RELOGIO));
    await mudarEstado(atendimentoId, 'interrompida');

    const exame = await repository.buscarExame(tablet.anaId, atendimentoId);

    expect(exame!.estado).toBe('interrompida');
    expect(exame!.desenhos.map(({ tipo }) => tipo)).toEqual(['relogio']);
  });

  it('lê o exame sem desenho, como o do termo recusado, com a lista vazia', async () => {
    // Com o termo recusado, o exame fica como cancelada e nenhuma tarefa é gravada.
    const atendimentoId = await novoAtendimento(tablet.anaId);
    await mudarEstado(atendimentoId, 'cancelada');

    const exame = await repository.buscarExame(tablet.anaId, atendimentoId);

    expect(exame).toMatchObject({ estado: 'cancelada', desenhos: [] });
  });

  it('não mistura os desenhos de outro exame', async () => {
    const primeiro = await novoAtendimento(tablet.anaId);
    const segundo = await novoAtendimento(tablet.anaId, '39053344705');
    // Os dois exames têm desenho na tarefa 1, então a leitura precisa filtrar pelo exame.
    await drawings.salvarDesenho(desenho(primeiro, 1, PNG_RELOGIO));
    await drawings.salvarDesenho(desenho(segundo, 1, PNG_CUBO));

    const exame = await repository.buscarExame(tablet.anaId, segundo);

    expect(exame!.desenhos).toHaveLength(1);
    expect(Array.from(exame!.desenhos[0].imagemPng)).toEqual(Array.from(PNG_CUBO));
  });
});

describe('só os exames do profissional', () => {
  it('não encontra o exame aplicado por outro médico no mesmo tablet', async () => {
    const doBruno = await novoAtendimento(brunoId);
    await drawings.salvarDesenho(desenho(doBruno, 1, PNG_RELOGIO));

    await expect(repository.buscarExame(tablet.anaId, doBruno)).resolves.toBeNull();

    await expect(repository.buscarExame(brunoId, doBruno)).resolves.toMatchObject({
      profissionalNome: BRUNO.name,
    });
  });

  it('não encontra um exame que não existe', async () => {
    await expect(repository.buscarExame(tablet.anaId, 999)).resolves.toBeNull();
  });
});
