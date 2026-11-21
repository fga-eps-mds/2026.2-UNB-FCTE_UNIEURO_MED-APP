import { render, screen, userEvent, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import PatientRoute from '@/app/paciente/[id]';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { createMarkingRepository } from '@/db/marking-repository';
import { createProfessionalRepository } from '@/db/professional-repository';
import type { SessionProfessional } from '@/features/auth/session';
import { SessionProvider } from '@/features/auth/session';
import {
  EXAME_NAO_ENCONTRADO,
  SENHA_NAO_CONFERE_MARCAR,
  marcarExame,
  type TipoMarcacao,
} from '@/features/avaliacao/marcacao';

import {
  ANA,
  BRUNO,
  SENHA_DE_TESTE,
  abrirTabletComAnaEBruno,
  cpfProtector,
  hashDaSenhaDeTeste,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

// Marcação do exame como teste ou material de ensino (#58) de ponta a ponta: a tela
// do paciente, a regra, a senha conferida como no login e o SQLite de verdade.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockAttendances: ReturnType<typeof createAttendanceRepository>;
jest.mock('@/features/home/composition', () => ({
  get patientListRepository() {
    return mockAttendances;
  },
  get patientDetailRepository() {
    return mockAttendances;
  },
}));

// A rota liga a tela à regra pela composição da avaliação; aqui a regra usa o banco do teste.
let mockMarcacoes: ReturnType<typeof createMarkingRepository>;
let mockProfissionais: TabletComAnaEBruno['repository'];
jest.mock('@/features/avaliacao/composition', () => {
  const regra = jest.requireActual<typeof import('@/features/avaliacao/marcacao')>(
    '@/features/avaliacao/marcacao',
  );
  return {
    markExam: (
      id: number,
      profissional: SessionProfessional,
      tipo: TipoMarcacao | null,
      senha: string,
    ) =>
      regra.marcarExame(
        { atendimentoId: id, profissional, tipo, senha },
        mockMarcacoes,
        mockProfissionais,
      ),
    unmarkExam: (id: number, profissional: SessionProfessional, senha: string) =>
      regra.desmarcarExame(
        { atendimentoId: id, profissional, senha },
        mockMarcacoes,
        mockProfissionais,
      ),
  };
});

const TAUIL = {
  name: 'Ricardo Tauil',
  email: 'tauil@unieuro.com.br',
  crmNumber: '99999',
  crmState: 'DF',
  cpf: '39053344705',
};

let tablet: TabletComAnaEBruno;
let ana: SessionProfessional;
let bruno: SessionProfessional;
let joseId: number;
let concluido: number;

const sessao = async (email: string): Promise<SessionProfessional> => {
  const salvo = (await tablet.repository.findByEmail(email))!;
  return {
    id: salvo.id,
    name: salvo.name,
    email: salvo.email,
    crmNumber: salvo.crmNumber,
    crmState: salvo.crmState,
  };
};

const exame = (id: number) =>
  tablet.database.getFirstAsync<{ estado: string; marcacao: string | null }>(
    'SELECT estado, marcacao FROM avaliacao WHERE id = ?',
    [id],
  );

const historico = () =>
  tablet.database.getAllAsync<{ acao: string; tipo: string | null; id_profissional: number }>(
    'SELECT acao, tipo, id_profissional FROM marcacao ORDER BY id',
  );

const renderPaciente = (profissional: SessionProfessional) => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(joseId) });
  return render(
    <SessionProvider initialProfessional={profissional}>
      <PatientRoute />
    </SessionProvider>,
  );
};

const linhaDoConcluido = async () => {
  const exames = await screen.findAllByTestId('exame');
  return exames.find((linha) => within(linha).queryByText('Concluído'))!;
};

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ana = await sessao(ANA.email);
  bruno = await sessao(BRUNO.email);
  mockAttendances = createAttendanceRepository(async () => tablet.database, cpfProtector);
  mockMarcacoes = createMarkingRepository(async () => tablet.database);
  mockProfissionais = tablet.repository;

  // José: um exame concluído e um ainda no termo, os dois aplicados pela Ana.
  concluido = (
    await mockAttendances.createAttendance({
      patient: {
        name: 'José Alves Martins',
        cpf: '52998224725',
        birthDate: '1948-03-14',
        schoolingYears: 5,
        sex: 'masculino',
      },
      professionalId: ana.id,
      startedAt: '2026-10-05T17:32:00.000Z',
    })
  ).attendanceId;
  await tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [
    concluido,
  ]);
  joseId = (await mockAttendances.findPatientByCpf('52998224725'))!.id;
  await mockAttendances.createAttendance({
    patient: { id: joseId },
    professionalId: ana.id,
    startedAt: '2026-10-06T12:00:00.000Z',
  });
});

afterEach(async () => {
  await tablet.fechar();
});

async function marcarPelaTela(senha: string, tipo = 'Teste') {
  const user = userEvent.setup();
  renderPaciente(ana);
  await linhaDoConcluido();
  await user.press(screen.getByRole('button', { name: /^Marcar o exame de 05\/10\/2026/ }));
  await user.press(screen.getByRole('radio', { name: tipo }));
  await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), senha);
  await user.press(screen.getByRole('button', { name: 'Marcar exame' }));
  return user;
}

describe('marcar um exame como teste ou material de ensino (#58)', () => {
  it('Cenário: marcar um exame: continua na lista com a marcação, registrada com o profissional', async () => {
    await marcarPelaTela(SENHA_DE_TESTE);

    expect(await within(await linhaDoConcluido()).findByText('Teste')).toBeOnTheScreen();
    expect(screen.getAllByTestId('exame')).toHaveLength(2);
    await expect(exame(concluido)).resolves.toEqual({ estado: 'concluida', marcacao: 'teste' });
    await expect(historico()).resolves.toEqual([
      { acao: 'marcar', tipo: 'teste', id_profissional: ana.id },
    ]);
  });

  it('Cenário: nada é apagado: o paciente e os exames continuam na tela inicial e no tablet', async () => {
    await marcarPelaTela(SENHA_DE_TESTE, 'Material de ensino');
    await within(await linhaDoConcluido()).findByText('Material de ensino');

    const pacientes = await mockAttendances.listAttendedPatients(ana.id);
    expect(pacientes).toEqual([expect.objectContaining({ id: joseId, attendanceCount: 2 })]);
    await expect(
      tablet.database.getFirstAsync('SELECT COUNT(*) AS n FROM avaliacao'),
    ).resolves.toEqual({ n: 2 });
  });

  it('Cenário: senha incorreta: avisa e o exame continua sem marcação', async () => {
    await marcarPelaTela('senha-errada');

    expect(await screen.findByText(SENHA_NAO_CONFERE_MARCAR)).toBeOnTheScreen();
    await expect(exame(concluido)).resolves.toMatchObject({ marcacao: null });
    await expect(historico()).resolves.toEqual([]);
  });

  it('Cenário: marcação cancelada: o exame continua sem marcação', async () => {
    const user = userEvent.setup();
    renderPaciente(ana);
    await linhaDoConcluido();

    await user.press(screen.getByRole('button', { name: /^Marcar o exame de 05\/10\/2026/ }));
    await user.press(screen.getByRole('radio', { name: 'Teste' }));
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByTestId('marcacao')).toBeNull();
    await expect(exame(concluido)).resolves.toMatchObject({ marcacao: null });
  });

  it('desfaz a marcação com a senha, e o histórico guarda quem marcou e quem desfez', async () => {
    const user = await marcarPelaTela(SENHA_DE_TESTE);
    await within(await linhaDoConcluido()).findByText('Teste');

    await user.press(
      screen.getByRole('button', { name: 'Desfazer a marcação do exame de 05/10/2026 · 14:32' }),
    );
    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), SENHA_DE_TESTE);
    await user.press(screen.getAllByRole('button', { name: 'Desfazer marcação' }).at(-1)!);

    await screen.findByRole('button', { name: /^Marcar o exame de 05\/10\/2026/ });
    expect(screen.queryByTestId('marcacao')).toBeNull();
    await expect(historico()).resolves.toEqual([
      { acao: 'marcar', tipo: 'teste', id_profissional: ana.id },
      { acao: 'desmarcar', tipo: null, id_profissional: ana.id },
    ]);
  });

  it('Cenário: exame de outro médico: não aparece para ele e não pode ser marcado por ele', async () => {
    renderPaciente(bruno);
    expect(
      await screen.findByRole('header', { name: 'Paciente não encontrado' }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('exame')).toBeNull();

    await expect(
      marcarExame(
        { atendimentoId: concluido, profissional: bruno, tipo: 'teste', senha: SENHA_DE_TESTE },
        mockMarcacoes,
        tablet.repository,
      ),
    ).resolves.toEqual({ feito: false, mensagem: EXAME_NAO_ENCONTRADO });
    await expect(exame(concluido)).resolves.toMatchObject({ marcacao: null });
  });

  it('Cenário: superusuário: vê a marcação do exame de outro médico, sem poder mudá-la', async () => {
    await mockMarcacoes.marcarExame(concluido, ana.id, 'ensino', '2026-11-21T18:00:00.000Z');
    const professionals = createProfessionalRepository(async () => tablet.database, cpfProtector);
    await professionals.insertSuperuser(
      {
        name: TAUIL.name,
        email: TAUIL.email,
        crmNumber: TAUIL.crmNumber,
        crmState: TAUIL.crmState,
        cpf: TAUIL.cpf,
        passwordHash: await hashDaSenhaDeTeste(),
        createdAt: '2026-09-26T13:00:00.000Z',
      },
      null,
    );
    const tauil = { ...(await sessao(TAUIL.email)), superuser: true };

    renderPaciente(tauil);

    const linha = await linhaDoConcluido();
    expect(within(linha).getByTestId('marcacao')).toHaveTextContent('Material de ensino');
    expect(linha).toHaveTextContent(/Aplicado por Ana Carolina Souza/);
    expect(screen.queryByRole('button', { name: /marcação|^Marcar/ })).toBeNull();
  });
});
