import { render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import ResultadoRoute from '@/app/resultado/[id]';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { createDrawingRepository, type TaskType } from '@/db/drawing-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  MODELO_INDISPONIVEL,
  NAO_ENCONTRADO,
  TITULO_RESULTADO,
} from '@/features/resultado/resultado-screen';

import {
  ANA,
  abrirTabletComAnaEBruno,
  BRUNO,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

// Da rota do resultado (#14) até o SQLite de verdade: o exame e os desenhos são
// gravados pelos repositórios do aplicativo, e só a navegação é simulada.
jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockTablet: TabletComAnaEBruno;
jest.mock('@/features/resultado/composition', () => {
  const { createExamResultRepository } = jest.requireActual('@/db/exam-result-repository');
  return {
    resultadoRepository: createExamResultRepository(() => Promise.resolve(mockTablet.database)),
  };
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);
const TAREFAS: { ordem: number; tipo: TaskType }[] = [
  { ordem: 1, tipo: 'relogio' },
  { ordem: 2, tipo: 'cubo' },
  { ordem: 3, tipo: 'trilhas' },
];

let exameId: number;

beforeEach(async () => {
  mockTablet = await abrirTabletComAnaEBruno();
  ({ attendanceId: exameId } = await createAttendanceRepository(
    async () => mockTablet.database,
    cpfProtector,
  ).createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: '52998224725',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: mockTablet.anaId,
    startedAt: '2026-11-03T14:00:00.000Z',
  }));
  const desenhos = createDrawingRepository(async () => mockTablet.database);
  for (const { ordem, tipo } of TAREFAS) {
    await desenhos.salvarDesenho({
      atendimentoId: exameId,
      ordem,
      tipo,
      largura: 960,
      altura: 600,
      iniciadoEm: '2026-11-03T14:00:00.000Z',
      confirmadoEm: '2026-11-03T14:03:10.000Z',
      eventos: [],
      imagemPng: PNG,
      encerraExame: false,
    });
  }
});

afterEach(async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  await mockTablet.fechar();
});

async function abrirComo(profissional: SessionProfessional) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(exameId) });
  render(
    <SessionProvider initialProfessional={profissional}>
      <ResultadoRoute />
    </SessionProvider>,
  );
}

describe('Cenário: resultado completo', () => {
  it('o médico que aplicou vê os três desenhos gravados no tablet', async () => {
    await abrirComo({ id: mockTablet.anaId, ...ANA });

    expect(await screen.findByRole('header', { name: TITULO_RESULTADO })).toBeOnTheScreen();
    expect(screen.getAllByRole('image')).toHaveLength(3);
    expect(screen.getByText(/José Alves Martins/)).toBeOnTheScreen();
    expect(screen.getByText(MODELO_INDISPONIVEL)).toBeOnTheScreen();
  });
});

describe('a tela só abre para o médico que aplicou', () => {
  it('outro médico não vê o exame', async () => {
    const bruno = (await mockTablet.repository.findByEmail(BRUNO.email))!;
    await abrirComo({ id: bruno.id, ...BRUNO });

    expect(await screen.findByRole('alert')).toHaveTextContent(NAO_ENCONTRADO);
    expect(screen.queryAllByRole('image')).toHaveLength(0);
  });
});
