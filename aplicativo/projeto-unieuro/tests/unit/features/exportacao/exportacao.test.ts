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
    marcacao: null,
    tarefas: [],
  })),
});

const repositorio = (pacientes: PacienteExportado[]) =>
  ({
    lerExames: jest.fn(async () => pacientes),
    lerExamesDeTodos: jest.fn(async () => pacientes),
  }) satisfies ExportacaoRepository;

describe('exportarExames (#22)', () => {
  it('exportar todos os exames: lê os do profissional e salva um XML com todos', async () => {
    const repository = repositorio([paciente(1, 2), paciente(2, 1)]);
    const salvar = jest.fn(async () => true);

    const resultado = await exportarExames(
      { profissional: ana, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      salvar,
    );

    expect(repository.lerExames).toHaveBeenCalledWith(7, undefined, undefined);
    expect(repository.lerExamesDeTodos).not.toHaveBeenCalled();
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

    expect(repository.lerExames).toHaveBeenCalledWith(7, 3, undefined);
    expect(resultado).toMatchObject({ arquivo: 'exames_paciente_2026-11-12_1405.xml' });
    expect(salvar).toHaveBeenCalledWith(
      'exames_paciente_2026-11-12_1405.xml',
      expect.stringContaining('escopo="paciente"'),
    );
  });

  it('exportar um exame solo: lê só esse exame, com escopo exame e o número dele no nome', async () => {
    const repository = repositorio([paciente(1, 1)]);
    const salvar = jest.fn(async () => true);

    const resultado = await exportarExames(
      { profissional: ana, exameId: 10, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      salvar,
    );

    expect(repository.lerExames).toHaveBeenCalledWith(7, undefined, 10);
    expect(resultado).toEqual({
      estado: 'salvo',
      arquivo: 'exame_10_2026-11-12_1405.xml',
      pacientes: 1,
      exames: 1,
    });
    expect(salvar).toHaveBeenCalledWith(
      'exame_10_2026-11-12_1405.xml',
      expect.stringContaining('escopo="exame"'),
    );
  });

  it('com paciente e exame no mesmo pedido, o exame específico vence', async () => {
    const repository = repositorio([paciente(1, 1)]);
    const salvar = jest.fn(async () => true);

    await exportarExames(
      { profissional: ana, pacienteId: 1, exameId: 10, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      salvar,
    );

    expect(salvar).toHaveBeenCalledWith(
      'exame_10_2026-11-12_1405.xml',
      expect.stringContaining('escopo="exame"'),
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

describe('exportarExames da coleta inteira (#138)', () => {
  const responsavel: SessionProfessional = { ...ana, id: 1, superuser: true };

  it('responsável exporta a coleta inteira: lê os exames de todos os profissionais', async () => {
    const repository = repositorio([paciente(1, 2), paciente(2, 1)]);
    const salvar = jest.fn(async () => true);

    const resultado = await exportarExames(
      { profissional: responsavel, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      salvar,
    );

    expect(repository.lerExamesDeTodos).toHaveBeenCalledWith(1);
    expect(repository.lerExames).not.toHaveBeenCalled();
    expect(resultado).toEqual({
      estado: 'salvo',
      arquivo: 'coleta_2026-11-12_1405.xml',
      pacientes: 2,
      exames: 3,
    });
    expect(salvar).toHaveBeenCalledWith(
      'coleta_2026-11-12_1405.xml',
      expect.stringContaining('escopo="coleta"'),
    );
  });

  it('o médico comum continua exportando só os dele', async () => {
    const repository = repositorio([paciente(1, 1)]);

    await exportarExames(
      { profissional: { ...ana, superuser: false }, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      jest.fn(async () => true),
    );

    expect(repository.lerExames).toHaveBeenCalledWith(7, undefined, undefined);
    expect(repository.lerExamesDeTodos).not.toHaveBeenCalled();
  });

  it('com o paciente, o responsável exporta pelo escopo do paciente, como antes', async () => {
    const repository = repositorio([paciente(1, 1)]);

    const resultado = await exportarExames(
      { profissional: responsavel, pacienteId: 3, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      jest.fn(async () => true),
    );

    expect(repository.lerExames).toHaveBeenCalledWith(1, 3, undefined);
    expect(repository.lerExamesDeTodos).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ arquivo: 'exames_paciente_2026-11-12_1405.xml' });
  });

  it('com um exame aberto, o responsável exporta só aquele exame, e não a coleta', async () => {
    const repository = repositorio([paciente(1, 1)]);
    const salvar = jest.fn(async () => true);

    await exportarExames(
      { profissional: responsavel, exameId: 10, agora: AGORA, versaoAplicativo: '1.4.0' },
      repository,
      salvar,
    );

    expect(repository.lerExames).toHaveBeenCalledWith(1, undefined, 10);
    expect(repository.lerExamesDeTodos).not.toHaveBeenCalled();
    expect(salvar).toHaveBeenCalledWith(
      'exame_10_2026-11-12_1405.xml',
      expect.stringContaining('escopo="exame"'),
    );
  });

  it('coleta sem exame não gera arquivo', async () => {
    const salvar = jest.fn(async () => true);

    const resultado = await exportarExames(
      { profissional: responsavel, agora: AGORA, versaoAplicativo: '1.4.0' },
      repositorio([]),
      salvar,
    );

    expect(resultado).toEqual({ estado: 'vazio' });
    expect(salvar).not.toHaveBeenCalled();
  });
});

describe('nomeDoArquivo', () => {
  it('usa a data e a hora locais com dois dígitos', () => {
    expect(nomeDoArquivo(new Date(2026, 0, 5, 9, 3), 'todos')).toBe('exames_2026-01-05_0903.xml');
  });

  it('no escopo exame, leva o número do exame para não repetir o nome no mesmo minuto', () => {
    const agora = new Date(2026, 0, 5, 9, 3);

    expect(nomeDoArquivo(agora, 'exame', 7)).toBe('exame_7_2026-01-05_0903.xml');
    expect(nomeDoArquivo(agora, 'exame', 8)).not.toBe(nomeDoArquivo(agora, 'exame', 7));
  });

  it('no escopo exame, sem o número, usa só o prefixo exame_', () => {
    expect(nomeDoArquivo(new Date(2026, 0, 5, 9, 3), 'exame')).toBe('exame_2026-01-05_0903.xml');
  });

  it('usa o prefixo coleta_ no escopo coleta', () => {
    expect(nomeDoArquivo(new Date(2026, 0, 5, 9, 3), 'coleta')).toBe('coleta_2026-01-05_0903.xml');
  });

  it('usa o prefixo exames_paciente_ no escopo paciente', () => {
    expect(nomeDoArquivo(new Date(2026, 0, 5, 9, 3), 'paciente')).toBe(
      'exames_paciente_2026-01-05_0903.xml',
    );
  });
});
