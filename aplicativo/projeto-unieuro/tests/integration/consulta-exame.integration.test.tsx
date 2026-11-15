import { render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import ExameRoute from '@/app/exame';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { createDrawingRepository, type DrawingRecord } from '@/db/drawing-repository';
import { createExamRepository } from '@/db/exam-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import type { ExameRepository } from '@/features/home/exame';
import { EXAME_NAO_ENCONTRADO } from '@/features/home/ver-exame-screen';

import {
  ANA,
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletDeTeste,
} from '../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockRepository: ExameRepository;
jest.mock('@/features/home/composition', () => ({
  get exameRepository() {
    return mockRepository;
  },
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BASE64 = 'iVBORw0KGgo=';

let tablet: TabletDeTeste;
let ana: SessionProfessional;
let bruno: SessionProfessional;

const sessao = async (email: string): Promise<SessionProfessional> => {
  const saved = (await tablet.repository.findByEmail(email))!;
  return {
    id: saved.id,
    name: saved.name,
    email: saved.email,
    crmNumber: saved.crmNumber,
    crmState: saved.crmState,
  };
};

const novoAtendimento = async (professionalId: number) => {
  const { attendanceId } = await createAttendanceRepository(
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
    professionalId,
    startedAt: '2026-11-03T14:00:00.000Z',
  });
  return attendanceId;
};

const gravarDesenho = (atendimentoId: number, ordem: 1 | 2 | 3) => {
  const desenho: DrawingRecord = {
    atendimentoId,
    ordem,
    tipo: (['relogio', 'cubo', 'trilhas'] as const)[ordem - 1],
    largura: 960,
    altura: 600,
    iniciadoEm: '2026-11-03T14:01:00.000Z',
    confirmadoEm: '2026-11-03T14:02:00.000Z',
    eventos: [{ tipo: 'inicio', ordem: 1, instante: 0, x: 10, y: 10, ponteiro: 'caneta' }],
    imagemPng: PNG,
  };
  return createDrawingRepository(async () => tablet.database).salvarDesenho(desenho);
};

const abrirExame = (professional: SessionProfessional, atendimentoId: number) => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ atendimento: String(atendimentoId) });
  return render(
    <SessionProvider initialProfessional={professional}>
      <ExameRoute />
    </SessionProvider>,
  );
};

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ana = await sessao(ANA.email);
  bruno = await sessao(BRUNO.email);
  mockRepository = createExamRepository(async () => tablet.database);
});

afterEach(async () => {
  await tablet.fechar();
});

describe('Cenário: consultar uma avaliação salva', () => {
  it('o profissional abre o exame salvo e vê os dados e os três desenhos gravados', async () => {
    const atendimentoId = await novoAtendimento(ana.id);
    await gravarDesenho(atendimentoId, 1);
    await gravarDesenho(atendimentoId, 2);
    await gravarDesenho(atendimentoId, 3);
    await tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [
      atendimentoId,
    ]);

    abrirExame(ana, atendimentoId);

    expect(await screen.findByText('José Alves Martins')).toBeTruthy();
    expect(screen.getByText('2026-0001')).toBeTruthy();
    expect(screen.getByText('Concluído')).toBeTruthy();
    expect(screen.getByText('3 de 3 desenhos gravados neste tablet.')).toBeTruthy();
    for (const nome of ['Relógio', 'Cubo', 'Trilhas']) {
      expect(screen.getByRole('image', { name: `Desenho: ${nome}` }).props.source).toEqual({
        uri: `data:image/png;base64,${PNG_BASE64}`,
      });
    }
  });

  it('o exame interrompido mostra o desenho salvo e as tarefas não realizadas', async () => {
    const atendimentoId = await novoAtendimento(ana.id);
    await gravarDesenho(atendimentoId, 1);
    await tablet.database.runAsync("UPDATE avaliacao SET estado = 'interrompida' WHERE id = ?", [
      atendimentoId,
    ]);

    abrirExame(ana, atendimentoId);

    expect(await screen.findByText('1 de 3 desenhos gravados neste tablet.')).toBeTruthy();
    expect(screen.getByText('Interrompido')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Desenho: Relógio' })).toBeTruthy();
    expect(screen.getByLabelText('Cubo: não realizado')).toBeTruthy();
    expect(screen.getByLabelText('Trilhas: não realizado')).toBeTruthy();
  });

  it('o exame aplicado por outro médico no mesmo tablet não aparece', async () => {
    const doBruno = await novoAtendimento(bruno.id);
    await gravarDesenho(doBruno, 1);

    abrirExame(ana, doBruno);

    expect(await screen.findByRole('header', { name: EXAME_NAO_ENCONTRADO })).toBeTruthy();
    expect(screen.queryByText('José Alves Martins')).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });
});
