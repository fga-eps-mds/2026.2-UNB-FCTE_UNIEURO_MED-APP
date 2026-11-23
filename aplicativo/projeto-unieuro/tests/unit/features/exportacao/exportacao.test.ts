import type { SessionProfessional } from '@/features/auth/session';
import {
  exportarExames,
  nomeDoArquivo,
  type ExportacaoRepository,
} from '@/features/exportacao/exportacao';
import type { PacienteExportado } from '@/features/exportacao/xml-exportacao';

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const AGORA = new Date(2026, 10, 12, 14, 5);

const paciente = (id: number, exames: number): PacienteExportado => ({
  id,
  dataNascimento: '1948-10-07',
  escolaridadeAnos: 5,
  sexo: null,
  exames: Array.from({ length: exames }, (_, i) => ({
    id: id * 10 + i,
    inicio: '2026-10-06T12:00:00.000Z',
    estado: 'aguardando_consentimento',
    termo: null,
    tarefas: [],
  })),
});

const repositorio = (pacientes: PacienteExportado[]) =>
  ({ lerExames: jest.fn(async () => pacientes) }) satisfies ExportacaoRepository;

describe('exportarExames (#22)', () => {
  it('exportar todos os exames: lê os do profissional e salva um XML com todos', async () => {
    const repository = repositorio([paciente(1, 2), paciente(2, 1)]);
    const salvar = jest.fn(async () => true);

    const resultado = await exportarExames(
      { profissional: ana, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      salvar,
    );

    expect(repository.lerExames).toHaveBeenCalledWith(7, undefined);
    expect(resultado).toEqual({
      estado: 'salvo',
      arquivo: 'exames_2026-11-12_1405.xml',
      pacientes: 2,
      exames: 3,
    });
    const [[arquivo, xml]] = salvar.mock.calls as unknown as [[string, string]];
    expect(arquivo).toBe('exames_2026-11-12_1405.xml');
    expect(xml).toContain('escopo="todos"');
    expect(xml).toContain(`geradaEm="${AGORA.toISOString()}"`);
    expect(xml.match(/<exame /g)).toHaveLength(3);
  });

  it('exportar os exames de um paciente: lê só os desse paciente', async () => {
    const repository = repositorio([paciente(1, 2)]);
    const salvar = jest.fn(async () => true);

    const resultado = await exportarExames(
      { profissional: ana, pacienteId: 3, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      salvar,
    );

    expect(repository.lerExames).toHaveBeenCalledWith(7, 3);
    expect(resultado).toMatchObject({ arquivo: 'exames_paciente_2026-11-12_1405.xml' });
    expect(salvar).toHaveBeenCalledWith(
      'exames_paciente_2026-11-12_1405.xml',
      expect.stringContaining('escopo="paciente"'),
    );
  });

  it('sem exame, não gera nem salva arquivo', async () => {
    const salvar = jest.fn(async () => true);

    const resultado = await exportarExames(
      { profissional: ana, agora: AGORA, versaoAplicativo: '1.4.0' },
      repositorio([]),
      salvar,
    );

    expect(resultado).toEqual({ estado: 'vazio' });
    expect(salvar).not.toHaveBeenCalled();
  });

  it('quando o profissional desiste da pasta, avisa que foi cancelado', async () => {
    const resultado = await exportarExames(
      { profissional: ana, agora: AGORA, versaoAplicativo: '1.4.0' },
      repositorio([paciente(1, 1)]),
      jest.fn(async () => false),
    );

    expect(resultado).toEqual({ estado: 'cancelado' });
  });
});

describe('nomeDoArquivo', () => {
  it('usa a data e a hora locais com dois dígitos', () => {
    expect(nomeDoArquivo(new Date(2026, 0, 5, 9, 3), 'todos')).toBe('exames_2026-01-05_0903.xml');
  });
});
