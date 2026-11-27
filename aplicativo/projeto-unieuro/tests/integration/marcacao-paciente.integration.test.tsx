import { render, screen, userEvent, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import HomeRoute from '@/app/menu';
import PatientRoute from '@/app/paciente/[id]';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { createExportRepository } from '@/db/export-repository';
import { createMarkingRepository } from '@/db/marking-repository';
import { createProfessionalRepository } from '@/db/professional-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  PACIENTE_NAO_ENCONTRADO,
  SENHA_NAO_CONFERE_PACIENTE_MARCAR,
  SUPERUSUARIO_NAO_MARCA_PACIENTE,
  marcarPaciente,
  type TipoMarcacao,
} from '@/features/avaliacao/marcacao';
import { exportarExames } from '@/features/exportacao/exportacao';

import { validarNoEsquema } from '../test-support/esquema-exportacao';
import {
  ANA,
  BRUNO,
  SENHA_DE_TESTE,
  abrirTabletComAnaEBruno,
  cpfProtector,
  hashDaSenhaDeTeste,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

// Marcação do paciente como teste ou material de ensino (#47) de ponta a ponta:
// tela do paciente, tela inicial, regra, senha conferida como no login, SQLite real e XML.

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
    markPatient: (
      id: number,
      profissional: SessionProfessional,
      tipo: TipoMarcacao | null,
      senha: string,
    ) =>
      regra.marcarPaciente(
        { pacienteId: id, profissional, tipo, senha },
        mockMarcacoes,
        mockProfissionais,
      ),
    unmarkPatient: (id: number, profissional: SessionProfessional, senha: string) =>
      regra.desmarcarPaciente(
        { pacienteId: id, profissional, senha },
        mockMarcacoes,
        mockProfissionais,
      ),
  };
});

jest.mock('@/features/exportacao/composition', () => ({
  exportarTodosOsExames: jest.fn(),
  exportarExamesDoPaciente: jest.fn(),
}));

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
let exameAna1: number;
let exameAna2: number;
let exameBruno: number;

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
  tablet.database.getFirstAsync<{
    estado: string;
    marcacao: string | null;
    marcado_em: string | null;
    marcado_por: number | null;
  }>('SELECT estado, marcacao, marcado_em, marcado_por FROM avaliacao WHERE id = ?', [id]);

const renderPaciente = (profissional: SessionProfessional, patientId = joseId) => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(patientId) });
  return render(
    <SessionProvider initialProfessional={profissional}>
      <PatientRoute />
    </SessionProvider>,
  );
};

async function marcarPacientePelaTela(senha: string, tipo = 'Teste') {
  const user = userEvent.setup();
  renderPaciente(ana);
  await screen.findByRole('header', { name: 'José Alves Martins' });
  await user.press(
    screen.getByRole('button', { name: 'Marcar paciente como teste ou material de ensino' }),
  );
  await user.press(screen.getByRole('radio', { name: tipo }));
  await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), senha);
  await user.press(screen.getByRole('button', { name: 'Confirmar marcação' }));
  return user;
}

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ana = await sessao(ANA.email);
  bruno = await sessao(BRUNO.email);
  mockAttendances = createAttendanceRepository(async () => tablet.database, cpfProtector);
  mockMarcacoes = createMarkingRepository(async () => tablet.database);
  mockProfissionais = tablet.repository;

  // José foi atendido duas vezes pela Ana e uma vez pelo Bruno.
  exameAna1 = (
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
    exameAna1,
  ]);
  joseId = (await mockAttendances.findPatientByCpf('52998224725'))!.id;

  exameAna2 = (
    await mockAttendances.createAttendance({
      patient: { id: joseId },
      professionalId: ana.id,
      startedAt: '2026-10-06T12:00:00.000Z',
    })
  ).attendanceId;
  await tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [
    exameAna2,
  ]);

  exameBruno = (
    await mockAttendances.createAttendance({
      patient: { id: joseId },
      professionalId: bruno.id,
      startedAt: '2026-10-07T10:00:00.000Z',
    })
  ).attendanceId;
  await tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = ?", [
    exameBruno,
  ]);
});

afterEach(async () => {
  await tablet.fechar();
});

describe('marcar um paciente como teste ou material de ensino (#47)', () => {
  it('Cenário: marcar um paciente e paciente atendido também por outro médico', async () => {
    await marcarPacientePelaTela(SENHA_DE_TESTE, 'Material de ensino');

    await screen.findByRole('button', { name: 'Desfazer marcação do paciente' });
    for (const linha of screen.getAllByTestId('exame')) {
      expect(within(linha).getByTestId('marcacao')).toHaveTextContent('Material de ensino');
    }

    // Só os exames da Ana foram marcados; o do Bruno no mesmo paciente fica intacto.
    await expect(exame(exameAna1)).resolves.toMatchObject({
      estado: 'concluida',
      marcacao: 'ensino',
      marcado_por: ana.id,
    });
    await expect(exame(exameAna2)).resolves.toMatchObject({
      estado: 'concluida',
      marcacao: 'ensino',
      marcado_por: ana.id,
    });
    await expect(exame(exameBruno)).resolves.toMatchObject({
      estado: 'concluida',
      marcacao: null,
      marcado_por: null,
    });
  });

  it('Cenário: nada é apagado e o paciente continua na lista inicial com o selo', async () => {
    await marcarPacientePelaTela(SENHA_DE_TESTE, 'Teste');
    await screen.findByRole('button', { name: 'Desfazer marcação do paciente' });

    render(
      <SessionProvider initialProfessional={ana}>
        <HomeRoute />
      </SessionProvider>,
    );

    const selo = await screen.findByTestId('marcacao-paciente');
    expect(selo).toHaveTextContent('Teste');
    expect(screen.getByText('José Alves Martins')).toBeOnTheScreen();
    await expect(
      tablet.database.getFirstAsync('SELECT COUNT(*) AS n FROM avaliacao'),
    ).resolves.toEqual({ n: 3 });
  });

  it('Cenário: marcação na exportação: exames do paciente marcado saem no XML válido', async () => {
    await marcarPacientePelaTela(SENHA_DE_TESTE, 'Teste');
    await screen.findByRole('button', { name: 'Desfazer marcação do paciente' });

    const salvos: string[] = [];
    const resultado = await exportarExames(
      { profissional: ana, agora: new Date(2026, 10, 26, 14, 0), versaoAplicativo: '1.4.0' },
      createExportRepository(async () => tablet.database),
      async (_nome, conteudo) => {
        salvos.push(conteudo);
        return true;
      },
    );

    expect(resultado).toMatchObject({ estado: 'salvo', exames: 2 });
    expect(salvos[0]).toContain('<marcacao tipo="teste"');
    expect(salvos[0]).toContain('crm="12345" uf="DF"');
    await expect(validarNoEsquema(salvos[0])).resolves.toEqual([]);
  });

  it('Cenário: marcação cancelada: paciente e exames continuam sem marcação', async () => {
    const user = userEvent.setup();
    renderPaciente(ana);
    await screen.findByRole('header', { name: 'José Alves Martins' });

    await user.press(
      screen.getByRole('button', { name: 'Marcar paciente como teste ou material de ensino' }),
    );
    await user.press(screen.getByRole('radio', { name: 'Teste' }));
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByTestId('marcacao')).toBeNull();
    await expect(exame(exameAna1)).resolves.toMatchObject({ marcacao: null });
    await expect(exame(exameAna2)).resolves.toMatchObject({ marcacao: null });
  });

  it('Cenário: senha incorreta: informa o erro e nada recebe marcação', async () => {
    await marcarPacientePelaTela('senha-errada', 'Teste');

    expect(await screen.findByText(SENHA_NAO_CONFERE_PACIENTE_MARCAR)).toBeOnTheScreen();
    await expect(exame(exameAna1)).resolves.toMatchObject({ marcacao: null });
    await expect(exame(exameAna2)).resolves.toMatchObject({ marcacao: null });
  });

  it('Cenário: paciente de outro médico: não aparece nem pode ser marcado por quem não o atendeu', async () => {
    const { attendanceId: mariaAtendimento } = await mockAttendances.createAttendance({
      patient: {
        name: 'Maria das Dores',
        cpf: '11144477735',
        birthDate: '1950-05-20',
        schoolingYears: 4,
        sex: 'feminino',
      },
      professionalId: ana.id,
      startedAt: '2026-10-08T10:00:00.000Z',
    });
    const mariaId = (await mockAttendances.findPatientByCpf('11144477735'))!.id;

    renderPaciente(bruno, mariaId);
    expect(
      await screen.findByRole('header', { name: 'Paciente não encontrado' }),
    ).toBeOnTheScreen();

    await expect(
      marcarPaciente(
        { pacienteId: mariaId, profissional: bruno, tipo: 'teste', senha: SENHA_DE_TESTE },
        mockMarcacoes,
        tablet.repository,
      ),
    ).resolves.toEqual({ feito: false, mensagem: PACIENTE_NAO_ENCONTRADO });
    await expect(exame(mariaAtendimento)).resolves.toMatchObject({ marcacao: null });
  });

  it('Cenário: superusuário: vê a marcação do paciente e dos exames, sem poder marcar ou desmarcar', async () => {
    await mockMarcacoes.marcarPaciente(joseId, ana.id, 'ensino', '2026-11-21T18:00:00.000Z');
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

    await screen.findByRole('header', { name: 'José Alves Martins' });
    expect(screen.getAllByText('Material de ensino').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByRole('button', { name: /Marcar paciente|Desfazer marcação do paciente/ }),
    ).toBeNull();

    await expect(
      marcarPaciente(
        { pacienteId: joseId, profissional: tauil, tipo: 'teste', senha: SENHA_DE_TESTE },
        mockMarcacoes,
        tablet.repository,
      ),
    ).resolves.toEqual({ feito: false, mensagem: SUPERUSUARIO_NAO_MARCA_PACIENTE });
  });
});
