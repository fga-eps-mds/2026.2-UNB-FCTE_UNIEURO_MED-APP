import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import ResultadoRoute from '@/app/resultado/[id]';
import { createDrawingRepository, type TaskType } from '@/db/drawing-repository';
import { createExamResultRepository } from '@/db/exam-result-repository';
import { createExportRepository } from '@/db/export-repository';
import { createMarkingRepository } from '@/db/marking-repository';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { exportarExames } from '@/features/exportacao/exportacao';
import { validarNoEsquema } from '../test-support/esquema-exportacao';
import { gravarExamesParaExportar, PNG_DO_RELOGIO } from '../test-support/exames-para-exportar';
import {
  ANA,
  abrirTabletComAnaEBruno,
  hashDaSenhaDeTeste,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let mockResultRepository: ReturnType<typeof createExamResultRepository>;
jest.mock('@/features/resultado/composition', () => ({
  get resultadoRepository() {
    return mockResultRepository;
  },
}));

let mockExportar: (
  profissional: SessionProfessional,
  exameId: number,
) => ReturnType<typeof exportarExames>;
jest.mock('@/features/exportacao/composition', () => ({
  exportarExame: (profissional: SessionProfessional, exameId: number) =>
    mockExportar(profissional, exameId),
}));

let tablet: TabletComAnaEBruno;
let ana: SessionProfessional;
const salvos: { nome: string; conteudo: string }[] = [];

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  await gravarExamesParaExportar(tablet);

  // Deixa o exame 1 concluído com os três desenhos para abrir na tela de Resultado (#14).
  const desenhos = createDrawingRepository(async () => tablet.database);
  for (const [ordem, tipo] of [
    [2, 'cubo'],
    [3, 'trilhas'],
  ] as [number, TaskType][]) {
    await desenhos.salvarDesenho({
      atendimentoId: 1,
      ordem,
      tipo,
      largura: 800,
      altura: 600,
      iniciadoEm: '2026-10-06T12:06:00.000Z',
      confirmadoEm: '2026-10-06T12:07:00.000Z',
      encerraExame: ordem === 3,
      eventos: [],
      imagemPng: PNG_DO_RELOGIO,
    });
  }
  await tablet.database.runAsync("UPDATE avaliacao SET estado = 'concluida' WHERE id = 1");

  const open = async () => tablet.database;
  mockResultRepository = createExamResultRepository(open);
  salvos.length = 0;
  mockExportar = (profissional, exameId) =>
    exportarExames(
      {
        profissional,
        exameId,
        agora: new Date(2026, 10, 12, 14, 30),
        versaoAplicativo: '1.4.0',
      },
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

function abrirResultado(profissional: SessionProfessional | null, exameId: number) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: String(exameId) });
  return render(
    <SessionProvider initialProfessional={profissional}>
      <ResultadoRoute />
    </SessionProvider>,
  );
}

describe('exportar XML de um exame solo na tela de resultado (#22)', () => {
  it('gera XML válido no esquema v1 contendo apenas o exame aberto, sem dados pessoais', async () => {
    abrirResultado(ana, 1);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Exportar exame (XML)' }));
    await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
    screen.unmount();

    expect(salvos).toHaveLength(1);
    const { nome, conteudo } = salvos[0];
    expect(nome).toBe('exame_1_2026-11-12_1430.xml');
    expect(conteudo).toContain('escopo="exame"');
    expect(conteudo.match(/<exame /g)).toHaveLength(1);
    expect(conteudo).toContain('<exame id="1"');
    expect(conteudo).not.toContain('<exame id="2"');
    expect(conteudo).not.toMatch(/José|12345678909|2026-0001|1948-10-07/);
    await expect(validarNoEsquema(conteudo)).resolves.toEqual([]);
  });

  it('exame com termo recusado sai só com a situação e a decisão do termo, e valida no esquema', async () => {
    abrirResultado(ana, 2);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Exportar exame (XML)' }));
    await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
    screen.unmount();

    const { nome, conteudo } = salvos[0];
    expect(nome).toBe('exame_2_2026-11-12_1430.xml');
    expect(conteudo).toContain('<termo ');
    expect(conteudo).toContain('aceito="nao"');
    expect(conteudo).not.toContain('<tarefa ');
    await expect(validarNoEsquema(conteudo)).resolves.toEqual([]);
  });

  it('inclui a marcação quando o exame estiver marcado como teste', async () => {
    await createMarkingRepository(async () => tablet.database).marcarExame(
      1,
      ana.id,
      'teste',
      '2026-10-20T09:15:00.000Z',
    );
    abrirResultado(ana, 1);
    const user = userEvent.setup();

    await user.press(await screen.findByRole('button', { name: 'Exportar exame (XML)' }));
    await user.press(screen.getByRole('button', { name: 'Salvar arquivo' }));
    screen.unmount();

    expect(salvos[0].conteudo).toContain(
      '<marcacao tipo="teste" marcadaEm="2026-10-20T09:15:00.000Z" crm="12345" uf="DF"/>',
    );
    await expect(validarNoEsquema(salvos[0].conteudo)).resolves.toEqual([]);
  });

  it('superusuário vendo exame de outro médico não exporta nem gera arquivo', async () => {
    const criadoEm = '2026-10-01T00:00:00.000Z';

    await tablet.repository.insertSuperuser(
      {
        name: 'Carlos Bernardo Tauil',
        email: 'carlos.tauil@unieuro.com.br',
        crmNumber: '12771',
        crmState: 'DF',
        cpf: '39053344705',
        passwordHash: await hashDaSenhaDeTeste(),
        createdAt: criadoEm,
      },
      null,
    );

    const superRow = await tablet.repository.findByEmail('carlos.tauil@unieuro.com.br');
    expect(superRow).not.toBeNull();

    abrirResultado(
      {
        id: superRow!.id,
        name: 'Carlos Bernardo Tauil',
        email: 'carlos.tauil@unieuro.com.br',
        crmNumber: '12771',
        crmState: 'DF',
        superuser: true,
      },
      1,
    );

    expect(await screen.findByText('José Alves Martins · Ficha 2026-0001')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Exportar exame (XML)' })).toBeNull();
    expect(salvos).toEqual([]);
  });
});
