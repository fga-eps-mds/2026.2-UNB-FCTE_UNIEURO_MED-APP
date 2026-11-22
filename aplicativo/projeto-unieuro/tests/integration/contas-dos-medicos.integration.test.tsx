import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import SuperusuarioRoute from '@/app/superusuario';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import type { ContasRepository } from '@/features/superusuario/contas';
import { CARREGANDO_CONTAS } from '@/features/superusuario/tabela-contas';

import {
  ANA,
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  hashDaSenhaDeTeste,
  type TabletDeTeste,
} from '../test-support/tablet';

// Contas dos médicos na área do superusuário. Com rota, hook,
// e a regra e o SQLite de verdade, com a trava do superusuário na consulta.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockRepository: ContasRepository;
jest.mock('@/features/superusuario/composition', () => ({
  get contasRepository() {
    return mockRepository;
  },
}));

const TAUIL = {
  name: 'Carlos Bernardo Tauil',
  email: 'carlos.tauil@unieuro.com.br',
  crmNumber: '12771',
  crmState: 'DF',
};

let tablet: TabletDeTeste;

const sessao = async (email: string): Promise<SessionProfessional> => {
  const saved = (await tablet.repository.findByEmail(email))!;
  return {
    id: saved.id,
    name: saved.name,
    email: saved.email,
    crmNumber: saved.crmNumber,
    crmState: saved.crmState,
    superuser: saved.superuser,
  };
};

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  mockRepository = tablet.repository;

  await tablet.repository.insertSuperuser(
    {
      ...TAUIL,
      cpf: '39053344705',
      passwordHash: await hashDaSenhaDeTeste(),
      createdAt: '2026-09-26T13:00:00.000Z',
    },
    null,
  );

  const attendances = createAttendanceRepository(async () => tablet.database, cpfProtector);
  const ana = await sessao(ANA.email);
  await attendances.createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: '12345678909',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: ana.id,
    startedAt: '2026-10-06T12:00:00.000Z',
  });
});

afterEach(async () => {
  await tablet.fechar();
});

const abrirArea = (professional: SessionProfessional) =>
  render(
    <SessionProvider initialProfessional={professional}>
      <SuperusuarioRoute />
    </SessionProvider>,
  );

describe('Cenário: visualizar médicos', () => {
  it('o superusuário vê as contas do tablet com a situação e os exames gravados no banco', async () => {
    abrirArea(await sessao(TAUIL.email));
    expect(screen.getByLabelText(CARREGANDO_CONTAS)).toBeOnTheScreen();

    expect(
      await screen.findByLabelText('Ana Carolina Souza, CRM 12345/DF, Ativa, 1 exame'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Bruno Lima, CRM 54321/GO, Ativa, 0 exames')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Carlos Bernardo Tauil, CRM 12771/DF, Superusuário, 0 exames'),
    ).toBeOnTheScreen();
  });

  it('a conta desativada aparece com o selo "Desativada"', async () => {
    const bruno = await sessao(BRUNO.email);
    await tablet.repository.deactivate(bruno.id, '2026-11-01T12:00:00.000Z');

    abrirArea(await sessao(TAUIL.email));

    expect(
      await screen.findByLabelText('Bruno Lima, CRM 54321/GO, Desativada, 0 exames'),
    ).toBeOnTheScreen();
  });

  it('busca pelo CRM gravado no banco', async () => {
    const user = userEvent.setup();
    abrirArea(await sessao(TAUIL.email));
    await screen.findByText('Ana Carolina Souza');

    await user.type(screen.getByLabelText('Buscar médico'), '54321');

    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen();
    expect(screen.queryByText('Ana Carolina Souza')).toBeNull();
  });
});

describe('Cenário: acesso de um profissional comum', () => {
  it('um médico comum que chega pela rota não vê a área, e o banco não devolve conta nenhuma', async () => {
    const consultar = jest.spyOn(tablet.repository, 'listAccounts');
    const ana = await sessao(ANA.email);

    abrirArea(ana);

    await waitFor(() => expect(consultar).toHaveBeenCalledWith(ana.id));
    await expect(consultar.mock.results[0].value).resolves.toEqual([]);
    expect(screen.queryByTestId('area-superusuario')).toBeNull();
    expect(screen.queryByText('Bruno Lima')).toBeNull();
  });
});
