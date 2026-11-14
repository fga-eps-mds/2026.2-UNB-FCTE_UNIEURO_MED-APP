import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import HomeRoute from '@/app/menu';
import PatientRoute from '@/app/paciente/[id]';
import { createAttendanceRepository, type PatientRecord } from '@/db/attendance-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { NOT_FOUND_MESSAGE } from '@/features/home/patient-detail-screen';

import {
  ANA,
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletDeTeste,
} from '../test-support/tablet';

// Tela do paciente (#59) de ponta a ponta: a lista, a rota, o hook, a regra e o
// SQLite de verdade. Os atendimentos são gravados pelo mesmo repositório do
// "Novo exame", e a situação dos exames é a gravada na coluna `estado`.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockRepository: ReturnType<typeof createAttendanceRepository>;
jest.mock('@/features/home/composition', () => ({
  get patientListRepository() {
    return mockRepository;
  },
  get patientDetailRepository() {
    return mockRepository;
  },
}));

const CPF_DO_JOSE = '12345678909';

const paciente = (name: string, cpf: string): PatientRecord => ({
  name,
  cpf,
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
});

let tablet: TabletDeTeste;
let attendances: ReturnType<typeof createAttendanceRepository>;
let ana: SessionProfessional;
let bruno: SessionProfessional;
let joseId: number;
let antonioId: number;

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
  attendances = createAttendanceRepository(async () => tablet.database, cpfProtector);
  mockRepository = attendances;

  // José: dois exames com a Ana (o primeiro concluído) e um com o Bruno.
  const primeiro = await attendances.createAttendance({
    patient: paciente('José Alves Martins', CPF_DO_JOSE),
    professionalId: ana.id,
    startedAt: '2026-09-28T13:05:00.000Z',
  });
  await tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [
    primeiro.attendanceId,
  ]);
  joseId = (await attendances.findPatientByCpf(CPF_DO_JOSE))!.id;
  await attendances.createAttendance({
    patient: { id: joseId },
    professionalId: ana.id,
    startedAt: '2026-10-05T17:32:00.000Z',
  });
  await attendances.createAttendance({
    patient: { id: joseId },
    professionalId: bruno.id,
    startedAt: '2026-10-06T12:00:00.000Z',
  });
  await attendances.createAttendance({
    patient: paciente('Antônio Carlos Ferreira', '98765432100'),
    professionalId: ana.id,
    startedAt: '2026-10-07T12:00:00.000Z',
  });
  antonioId = (await attendances.findPatientByCpf('98765432100'))!.id;
});

afterEach(async () => {
  await tablet.fechar();
});

const renderPaciente = (professional: SessionProfessional, id: string | number) => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(id) });
  return render(
    <SessionProvider initialProfessional={professional}>
      <PatientRoute />
    </SessionProvider>,
  );
};

describe('Cenário: abrir um paciente', () => {
  it('abre os exames do paciente que o médico tocou na lista', async () => {
    const user = userEvent.setup();
    render(
      <SessionProvider initialProfessional={ana}>
        <HomeRoute />
      </SessionProvider>,
    );

    await user.press(await screen.findByRole('button', { name: /José Alves Martins, ficha/ }));

    expect(useRouter().push).toHaveBeenCalledWith({
      pathname: '/paciente/[id]',
      params: { id: String(joseId) },
    });
  });

  it('mostra os dados do paciente e os exames dele, do mais recente ao mais antigo', async () => {
    renderPaciente(ana, joseId);

    expect(await screen.findByRole('header', { name: 'José Alves Martins' })).toBeOnTheScreen();
    expect(screen.getByText('2026-0001')).toBeOnTheScreen();
    expect(screen.getByText('5 anos')).toBeOnTheScreen();
    expect(screen.getByText('Masculino')).toBeOnTheScreen();
    expect(screen.getByText('2 exames, do mais recente para o mais antigo')).toBeOnTheScreen();
    const exames = screen.getAllByTestId('exame');
    expect(exames).toHaveLength(2);
    // O exame mais recente do José com a Ana ainda aguarda o termo; o outro foi concluído.
    expect(exames[0]).toHaveTextContent(/Aguardando o termo/);
    expect(exames[1]).toHaveTextContent(/Concluído/);
  });

  it('não mostra o exame que outro médico aplicou no mesmo paciente', async () => {
    renderPaciente(ana, joseId);
    await screen.findAllByTestId('exame');

    expect(screen.getAllByTestId('exame')).toHaveLength(2);
    expect(screen.getAllByText('Aplicado por Ana Carolina Souza')).toHaveLength(2);
    expect(screen.queryByText(/Bruno Lima/)).toBeNull();
  });

  it('mostra ao outro médico só o exame dele no mesmo paciente', async () => {
    renderPaciente(bruno, joseId);

    expect(await screen.findByText('1 exame')).toBeOnTheScreen();
    expect(screen.getAllByTestId('exame')).toHaveLength(1);
    expect(screen.getByText('Aplicado por Bruno Lima')).toBeOnTheScreen();
  });

  it('não abre um paciente que só outro médico atendeu', async () => {
    renderPaciente(bruno, antonioId);

    expect(await screen.findByText(NOT_FOUND_MESSAGE)).toBeOnTheScreen();
    expect(screen.queryByText('Antônio Carlos Ferreira')).toBeNull();
  });

  it.each(['999', '1abc', '-1', ''])('não abre o paciente de endereço "%s"', async (id) => {
    renderPaciente(ana, id);

    expect(await screen.findByText(NOT_FOUND_MESSAGE)).toBeOnTheScreen();
  });

  it('mostra o exame aplicado depois, quando a tela volta a ter foco', async () => {
    renderPaciente(ana, antonioId);
    await screen.findByText('1 exame');

    await attendances.createAttendance({
      patient: { id: antonioId },
      professionalId: ana.id,
      startedAt: '2026-10-14T12:00:00.000Z',
    });
    const voltarAoPaciente = jest.mocked(useFocusEffect).mock.calls.at(-1)![0];
    await act(async () => {
      voltarAoPaciente();
    });

    expect(
      await screen.findByText('2 exames, do mais recente para o mais antigo'),
    ).toBeOnTheScreen();
  });
});
