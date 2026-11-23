import { render, screen, userEvent } from '@testing-library/react-native';

import HomeRoute from '@/app/menu';
import { createAttendanceRepository } from '@/db/attendance-repository';
import { createExportRepository } from '@/db/export-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { exportarExames } from '@/features/exportacao/exportacao';
import type { PatientListRepository } from '@/features/home/patients';

import { validarNoEsquema } from '../test-support/esquema-exportacao';
import { gravarExamesParaExportar } from '../test-support/exames-para-exportar';
import {
  ANA,
  abrirTabletComAnaEBruno,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

// Exportação em XML (#22) de ponta a ponta: a tela inicial, a regra e o SQLite de
// verdade. Só o seletor de pastas do Android é trocado por um que guarda o arquivo.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockPatients: PatientListRepository;
jest.mock('@/features/home/composition', () => ({
  get patientListRepository() {
    return mockPatients;
  },
}));

let mockExportar: (profissional: SessionProfessional) => ReturnType<typeof exportarExames>;
jest.mock('@/features/exportacao/composition', () => ({
  exportarTodosOsExames: (profissional: SessionProfessional) => mockExportar(profissional),
}));

let tablet: TabletComAnaEBruno;
let ana: SessionProfessional;
const salvos: { nome: string; conteudo: string }[] = [];

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  await gravarExamesParaExportar(tablet);
  const open = async () => tablet.database;
  mockPatients = createAttendanceRepository(open, cpfProtector);
  salvos.length = 0;
  mockExportar = (profissional) =>
    exportarExames(
      { profissional, agora: new Date(2026, 10, 12, 14, 30), versaoAplicativo: '1.4.0' },
      createExportRepository(open),
      async (nome, conteudo) => {
        salvos.push({ nome, conteudo });
        return true;
      },
    );

  const salva = (await tablet.repository.findByEmail(ANA.email))!;
  ana = {
    id: salva.id,
    name: salva.name,
    email: salva.email,
    crmNumber: salva.crmNumber,
    crmState: salva.crmState,
  };
});

afterEach(async () => {
  await tablet.fechar();
});

async function exportarTodos() {
  const user = userEvent.setup();
  render(
    <SessionProvider initialProfessional={ana}>
      <HomeRoute />
    </SessionProvider>,
  );
  await screen.findByText('José Alves Martins');
  await user.press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));
  await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
  return salvos[0];
}

describe('exportar os dados da avaliação em XML (#22)', () => {
  it('exportação solicitada: gera no tablet um XML com os desenhos e os traçados', async () => {
    const arquivo = await exportarTodos();

    expect(arquivo.nome).toBe('exames_2026-11-12_1430.xml');
    expect(arquivo.conteudo).toContain('<tarefa ordem="1" tipo="relogio"');
    expect(arquivo.conteudo).toContain('<evento ordem="3" tipo="desfazer" instante="900"/>');
    expect(arquivo.conteudo).toMatch(/<desenho [^>]*>iVBORwECAw==<\/desenho>/);
    expect(screen.getByText('Arquivo salvo: exames_2026-11-12_1430.xml')).toBeOnTheScreen();
  });

  it('arquivo válido: o XML segue o esquema e corresponde aos exames do banco', async () => {
    const { conteudo } = await exportarTodos();
    // A validação leva perto de um segundo; sem a tela montada, a lista não atualiza fora do act.
    screen.unmount();

    await expect(validarNoEsquema(conteudo)).resolves.toEqual([]);
    expect(conteudo).toContain('<profissional crm="12345" uf="DF"/>');
    expect(conteudo.match(/<paciente /g)).toHaveLength(2);
    expect(conteudo.match(/<exame /g)).toHaveLength(3);
    expect(conteudo).toContain('estado="cancelada"');
    expect(conteudo).toContain('estado="aguardando_consentimento"');
  });

  it('exportar todos os exames: só os pacientes que o profissional atendeu, sem identificação', async () => {
    const { conteudo } = await exportarTodos();

    expect(conteudo).not.toMatch(/José|Antônio|Maria|2026-000\d|12345678909|1948-10-07/);
    expect(conteudo).not.toContain('idadeAnos="81"');
    expect(conteudo).toContain('idadeAnos="77"');
  });

  it('ausência de envio automático: sem o pedido do profissional, nada é gerado', async () => {
    render(
      <SessionProvider initialProfessional={ana}>
        <HomeRoute />
      </SessionProvider>,
    );
    await screen.findByText('José Alves Martins');
    await userEvent.setup().press(screen.getByRole('button', { name: 'Exportar todos (XML)' }));

    expect(salvos).toEqual([]);
  });
});
