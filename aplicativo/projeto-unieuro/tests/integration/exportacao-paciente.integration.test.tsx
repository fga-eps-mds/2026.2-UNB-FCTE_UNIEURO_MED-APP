import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import PatientRoute from '@/app/paciente/[id]';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { createExportRepository } from '@/db/export-repository';
import { createMarkingRepository } from '@/db/marking-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { exportarExames } from '@/features/exportacao/exportacao';

import { validarNoEsquema } from '../test-support/esquema-exportacao';
import { gravarExamesParaExportar } from '../test-support/exames-para-exportar';
import {
  ANA,
  BRUNO,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

// Exportação de um paciente (#22) de ponta a ponta: a rota da tela do paciente (#59),
// a regra, o gerador e o SQLite de verdade. Só o seletor de pastas do Android é
// trocado por um que guarda o arquivo.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockRepository: ReturnType<typeof createAttendanceRepository>;
jest.mock('@/features/home/composition', () => ({
  get patientDetailRepository() {
    return mockRepository;
  },
}));

let mockExportar: (
  profissional: SessionProfessional,
  pacienteId: number,
) => ReturnType<typeof exportarExames>;
jest.mock('@/features/exportacao/composition', () => ({
  exportarExamesDoPaciente: (profissional: SessionProfessional, pacienteId: number) =>
    mockExportar(profissional, pacienteId),
}));

let tablet: TabletComAnaEBruno;
let ana: SessionProfessional;
let bruno: SessionProfessional;
let ids: Awaited<ReturnType<typeof gravarExamesParaExportar>>;
const salvos: { nome: string; conteudo: string }[] = [];

const sessao = async (email: string): Promise<SessionProfessional> => {
  const salva = (await tablet.repository.findByEmail(email))!;
  return {
    id: salva.id,
    name: salva.name,
    email: salva.email,
    crmNumber: salva.crmNumber,
    crmState: salva.crmState,
  };
};

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ids = await gravarExamesParaExportar(tablet);
  const open = async () => tablet.database;
  mockRepository = createAttendanceRepository(open, cpfProtector);
  salvos.length = 0;
  mockExportar = (profissional, pacienteId) =>
    exportarExames(
      {
        profissional,
        pacienteId,
        agora: new Date(2026, 10, 12, 14, 30),
        versaoAplicativo: '1.4.0',
      },
      createExportRepository(open),
      async (nome, conteudo) => {
        salvos.push({ nome, conteudo });
        return true;
      },
    );
  ana = await sessao(ANA.email);
  bruno = await sessao(BRUNO.email);
});

afterEach(async () => {
  await tablet.fechar();
});

function abrirPaciente(profissional: SessionProfessional, pacienteId: number) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(pacienteId) });
  return render(
    <SessionProvider initialProfessional={profissional}>
      <PatientRoute />
    </SessionProvider>,
  );
}

async function exportar() {
  const user = userEvent.setup();
  await user.press(
    await screen.findByRole('button', { name: 'Exportar exames deste paciente (XML)' }),
  );
  await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
  return salvos[0];
}

describe('exportar os exames de um paciente em XML (#22)', () => {
  it('gera no tablet um XML só com os exames do paciente aberto, no esquema v1', async () => {
    abrirPaciente(ana, ids.jose.id);

    const arquivo = await exportar();
    // A validação leva perto de um segundo; sem a tela montada, ela não atualiza fora do act.
    screen.unmount();

    expect(arquivo.nome).toBe('exames_paciente_2026-11-12_1430.xml');
    expect(arquivo.conteudo).toContain('escopo="paciente"');
    expect(arquivo.conteudo).toContain('<profissional crm="12345" uf="DF"/>');
    expect(arquivo.conteudo.match(/<paciente /g)).toHaveLength(1);
    expect(arquivo.conteudo.match(/<exame /g)).toHaveLength(2);
    expect(arquivo.conteudo).toContain('<tarefa ordem="1" tipo="relogio"');
    expect(arquivo.conteudo).toMatch(/<desenho [^>]*>iVBORwECAw==<\/desenho>/);
    await expect(validarNoEsquema(arquivo.conteudo)).resolves.toEqual([]);
  });

  it('não leva exame de outro paciente nem de outro profissional, nem dado pessoal', async () => {
    abrirPaciente(ana, ids.jose.id);

    const { conteudo } = await exportar();

    // Antônio (da Ana) e Maria (do Bruno) ficam de fora; os exames do José são os 1 e 2.
    expect(conteudo).not.toMatch(/Antônio|Maria|José|2026-000\d|12345678909|1948-10-07/);
    expect(conteudo).not.toContain('estado="aguardando_consentimento"');
    expect(conteudo).not.toContain(`<paciente id="${ids.antonio.id}"`);
    expect(conteudo).toContain(`<paciente id="${ids.jose.id}"`);
    expect(conteudo.match(/<exame id="(\d+)"/g)).toEqual(['<exame id="1"', '<exame id="2"']);
  });

  it('o profissional que não atendeu o paciente não consegue exportá-lo', async () => {
    abrirPaciente(bruno, ids.jose.id);

    expect(await screen.findByText('Paciente não encontrado')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Exportar exames deste paciente (XML)' }),
    ).toBeNull();
    expect(salvos).toEqual([]);
  });

  it('ausência de envio automático: sem o pedido do profissional, nada é gerado', async () => {
    abrirPaciente(ana, ids.jose.id);
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Exportar exames deste paciente (XML)' }));

    expect(screen.getByRole('header', { name: 'Exportar exames do paciente' })).toBeOnTheScreen();
    expect(salvos).toEqual([]);
  });

  it('sem sessão, nada é exportado', () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(ids.jose.id) });
    render(
      <SessionProvider initialProfessional={null}>
        <PatientRoute />
      </SessionProvider>,
    );

    expect(
      screen.queryByRole('button', { name: 'Exportar exames deste paciente (XML)' }),
    ).toBeNull();
    expect(salvos).toEqual([]);
  });

  it('o exame marcado como teste sai no XML com a marcação, o médico e a data e a hora', async () => {
    await createMarkingRepository(async () => tablet.database).marcarExame(
      1,
      ana.id,
      'teste',
      '2026-10-20T09:15:00.000Z',
    );
    abrirPaciente(ana, ids.jose.id);

    const { conteudo } = await exportar();
    screen.unmount();

    expect(conteudo.match(/<exame /g)).toHaveLength(2);
    expect(conteudo).toContain(
      '<marcacao tipo="teste" marcadaEm="2026-10-20T09:15:00.000Z" crm="12345" uf="DF"/>',
    );
    expect(conteudo.match(/<marcacao /g)).toHaveLength(1);
    await expect(validarNoEsquema(conteudo)).resolves.toEqual([]);
  });

  it('o exame com a marcação desfeita sai sem o elemento', async () => {
    const marcacoes = createMarkingRepository(async () => tablet.database);
    await marcacoes.marcarExame(1, ana.id, 'ensino', '2026-10-20T09:15:00.000Z');
    await marcacoes.desmarcarExame(1, ana.id, '2026-10-21T09:15:00.000Z');
    abrirPaciente(ana, ids.jose.id);

    const { conteudo } = await exportar();

    expect(conteudo).not.toContain('<marcacao');
  });
});
