import { render, screen, userEvent } from '@testing-library/react-native';

import HomeRoute from '@/app/menu';
import { createAttendanceRepository, type PatientRecord } from '@/db/attendance-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import type { PatientListRepository } from '@/features/home/patients';

import {
  ANA,
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletDeTeste,
} from '../test-support/tablet';

// Tela inicial (#77) de ponta a ponta: a rota, o hook, a regra e o SQLite de
// verdade. Os atendimentos são gravados pelo mesmo repositório do "Novo exame".

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockRepository: PatientListRepository;
jest.mock('@/features/home/composition', () => ({
  get patientListRepository() {
    return mockRepository;
  },
}));

const paciente = (name: string, cpf: string): PatientRecord => ({
  name,
  cpf,
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
});

let tablet: TabletDeTeste;
let ana: SessionProfessional;
let bruno: SessionProfessional;

const sessao = async (email: string) => {
  const saved = (await tablet.repository.findByEmail(email))!;
  return {
    id: saved.id,
    name: saved.name,
    email: saved.email,
    crmNumber: saved.crmNumber,
    crmState: saved.crmState,
  };
};

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ana = await sessao(ANA.email);
  bruno = await sessao(BRUNO.email);

  const attendances = createAttendanceRepository(async () => tablet.database, cpfProtector);
  mockRepository = attendances;

  await attendances.createAttendance({
    patient: paciente('José Alves Martins', '12345678909'),
    professionalId: ana.id,
    startedAt: '2026-10-13T12:10:00.000Z',
  });
  await attendances.createAttendance({
    patient: paciente('Antônio Carlos Ferreira', '98765432100'),
    professionalId: ana.id,
    startedAt: '2026-10-12T12:00:00.000Z',
  });
  await attendances.createAttendance({
    patient: paciente('Maria das Dores', '39053344705'),
    professionalId: bruno.id,
    startedAt: '2026-10-13T15:00:00.000Z',
  });
});

afterEach(async () => {
  await tablet.fechar();
});

const renderInicio = (professional: SessionProfessional) =>
  render(
    <SessionProvider initialProfessional={professional}>
      <HomeRoute />
    </SessionProvider>,
  );

describe('tela inicial com os pacientes do banco', () => {
  it('mostra o paciente registrado com nome, ficha, data e número de exames', async () => {
    renderInicio(ana);

    expect(
      await screen.findByRole('button', { name: /José Alves Martins, ficha 2026-0001/ }),
    ).toBeOnTheScreen();
    expect(screen.getByText('2 pacientes e 2 exames aplicados por você.')).toBeOnTheScreen();
    expect(screen.getByText('13/10/2026')).toBeOnTheScreen();
    expect(screen.queryByText('Nenhum paciente ainda')).toBeNull();
  });

  it('não mostra os pacientes atendidos só por outro profissional', async () => {
    renderInicio(ana);
    await screen.findByText('José Alves Martins');

    expect(screen.queryByText('Maria das Dores')).toBeNull();
  });

  it('mostra ao outro profissional só os pacientes dele', async () => {
    renderInicio(bruno);

    expect(await screen.findByText('Maria das Dores')).toBeOnTheScreen();
    expect(screen.queryByText('José Alves Martins')).toBeNull();
  });

  it('busca pelo nome ou pelo número da ficha gravados no banco', async () => {
    const user = userEvent.setup();
    renderInicio(ana);
    await screen.findByText('José Alves Martins');

    await user.type(screen.getByLabelText('Buscar paciente'), 'antonio');
    expect(screen.getByText('Antônio Carlos Ferreira')).toBeOnTheScreen();
    expect(screen.queryByText('José Alves Martins')).toBeNull();

    await user.clear(screen.getByLabelText('Buscar paciente'));
    await user.type(screen.getByLabelText('Buscar paciente'), '2026-0001');
    expect(screen.getByText('José Alves Martins')).toBeOnTheScreen();
    expect(screen.queryByText('Antônio Carlos Ferreira')).toBeNull();
  });
});
