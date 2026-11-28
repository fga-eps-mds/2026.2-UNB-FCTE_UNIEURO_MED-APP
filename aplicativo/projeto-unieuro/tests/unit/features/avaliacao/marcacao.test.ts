import type { CredentialsRepository } from '@/features/auth/authentication';
import type { SessionProfessional } from '@/features/auth/session';
import {
  ESCOLHA_O_TIPO,
  EXAME_JA_MARCADO,
  EXAME_NAO_ENCONTRADO,
  EXAME_SEM_MARCACAO,
  PACIENTE_JA_MARCADO,
  PACIENTE_NAO_ENCONTRADO,
  PACIENTE_SEM_MARCACAO,
  ROTULO_MARCACAO,
  SENHA_NAO_CONFERE_DESMARCAR,
  SENHA_NAO_CONFERE_MARCAR,
  SENHA_NAO_CONFERE_PACIENTE_DESMARCAR,
  SENHA_NAO_CONFERE_PACIENTE_MARCAR,
  SENHA_VAZIA,
  SUPERUSUARIO_NAO_MARCA_PACIENTE,
  TIPOS_MARCACAO,
  desmarcarExame,
  desmarcarPaciente,
  lerMarcacao,
  marcarExame,
  marcarPaciente,
  type MarcacaoRepository,
  type PacienteParaMarcar,
  type TipoMarcacao,
} from '@/features/avaliacao/marcacao';

jest.mock('@/features/auth/password', () => ({
  DUMMY_PASSWORD_HASH: 'hash-ficticio',
  verifyPassword: jest.fn(
    async (password: string, hash: string) => hash === 'hash-real' && password === 'senhaForte123',
  ),
}));

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const credenciais = {
  findByEmail: jest.fn(async () => ({ ...ana, active: true, passwordHash: 'hash-real' })),
} satisfies CredentialsRepository;

const AGORA = new Date('2026-11-21T18:00:00.000Z');

function repositorio(
  marcacao: TipoMarcacao | null = null,
  extra: Partial<MarcacaoRepository> = {},
) {
  return {
    buscarExame: jest.fn(async () => ({ marcacao })),
    marcarExame: jest.fn(async () => true),
    desmarcarExame: jest.fn(async () => true),
    buscarPaciente: jest.fn(async () => ({ marcacoes: [marcacao, marcacao] })),
    marcarPaciente: jest.fn(async () => true),
    desmarcarPaciente: jest.fn(async () => true),
    ...extra,
  } satisfies MarcacaoRepository;
}

const marcar = (senha: string, tipo: TipoMarcacao | null = 'teste') => ({
  atendimentoId: 12,
  profissional: ana,
  senha,
  tipo,
  agora: AGORA,
});

const desmarcar = (senha: string) => ({
  atendimentoId: 12,
  profissional: ana,
  senha,
  agora: AGORA,
});

const marcarDadosPaciente = (
  senha: string,
  tipo: TipoMarcacao | null = 'teste',
  profissional: SessionProfessional = ana,
) => ({
  pacienteId: 5,
  profissional,
  senha,
  tipo,
  agora: AGORA,
});

const desmarcarDadosPaciente = (senha: string, profissional: SessionProfessional = ana) => ({
  pacienteId: 5,
  profissional,
  senha,
  agora: AGORA,
});

describe('tipos da marcação (#58)', () => {
  it('oferece "Teste" e "Material de ensino", com o mesmo texto do selo', () => {
    expect(TIPOS_MARCACAO.map(({ rotulo }) => rotulo)).toEqual(['Teste', 'Material de ensino']);
    for (const { id, rotulo } of TIPOS_MARCACAO) expect(ROTULO_MARCACAO[id]).toBe(rotulo);
  });

  it.each([
    ['teste', 'teste'],
    ['ensino', 'ensino'],
    [null, null],
    [undefined, null],
    ['outra', null],
  ])('lê %p do banco como %p', (valor, esperado) => {
    expect(lerMarcacao(valor)).toBe(esperado);
  });
});

describe('marcarExame (#58)', () => {
  it('Cenário: marcar um exame: grava o tipo, o profissional e a hora depois da senha', async () => {
    const repository = repositorio();

    await expect(
      marcarExame(marcar('senhaForte123', 'ensino'), repository, credenciais),
    ).resolves.toEqual({ feito: true });

    expect(repository.buscarExame).toHaveBeenCalledWith(12, 7);
    expect(repository.marcarExame).toHaveBeenCalledWith(
      12,
      7,
      'ensino',
      '2026-11-21T18:00:00.000Z',
    );
  });

  it('pede o tipo antes de qualquer outra conferência', async () => {
    const repository = repositorio();

    await expect(
      marcarExame(marcar('senhaForte123', null), repository, credenciais),
    ).resolves.toEqual({ feito: false, mensagem: ESCOLHA_O_TIPO });
    expect(repository.buscarExame).not.toHaveBeenCalled();
  });

  it('Cenário: senha incorreta: avisa e o exame continua sem marcação', async () => {
    const repository = repositorio();

    await expect(marcarExame(marcar('errada'), repository, credenciais)).resolves.toEqual({
      feito: false,
      mensagem: SENHA_NAO_CONFERE_MARCAR,
    });
    expect(repository.marcarExame).not.toHaveBeenCalled();
  });

  it('pede a senha quando ela está vazia', async () => {
    await expect(marcarExame(marcar(''), repositorio(), credenciais)).resolves.toEqual({
      feito: false,
      mensagem: SENHA_VAZIA,
    });
  });

  it('Cenário: exame de outro médico: não encontra o exame e não marca', async () => {
    const repository = repositorio(null, { buscarExame: jest.fn(async () => null) });

    await expect(marcarExame(marcar('senhaForte123'), repository, credenciais)).resolves.toEqual({
      feito: false,
      mensagem: EXAME_NAO_ENCONTRADO,
    });
    expect(repository.marcarExame).not.toHaveBeenCalled();
  });

  it('não marca de novo um exame que já está marcado', async () => {
    const repository = repositorio('teste');

    await expect(marcarExame(marcar('senhaForte123'), repository, credenciais)).resolves.toEqual({
      feito: false,
      mensagem: EXAME_JA_MARCADO,
      desatualizado: true,
    });
    expect(repository.marcarExame).not.toHaveBeenCalled();
  });

  it('avisa quando o banco recusa, porque outro pedido marcou antes', async () => {
    const repository = repositorio(null, { marcarExame: jest.fn(async () => false) });

    await expect(marcarExame(marcar('senhaForte123'), repository, credenciais)).resolves.toEqual({
      feito: false,
      mensagem: EXAME_JA_MARCADO,
      desatualizado: true,
    });
  });

  it('não aceita a senha de outra conta com o mesmo e-mail', async () => {
    const outra = {
      findByEmail: jest.fn(async () => ({
        ...ana,
        id: 99,
        active: true,
        passwordHash: 'hash-real',
      })),
    } satisfies CredentialsRepository;

    await expect(marcarExame(marcar('senhaForte123'), repositorio(), outra)).resolves.toEqual({
      feito: false,
      mensagem: SENHA_NAO_CONFERE_MARCAR,
    });
  });

  it('usa a hora do tablet quando não recebe outra', async () => {
    const repository = repositorio();

    await marcarExame(
      { atendimentoId: 12, profissional: ana, senha: 'senhaForte123', tipo: 'teste' },
      repository,
      credenciais,
    );

    expect(repository.marcarExame).toHaveBeenCalledWith(12, 7, 'teste', expect.any(String));
  });
});

describe('desmarcarExame (#58)', () => {
  it('desfaz a marcação depois da senha, registrando a hora', async () => {
    const repository = repositorio('teste');

    await expect(
      desmarcarExame(desmarcar('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({ feito: true });
    expect(repository.desmarcarExame).toHaveBeenCalledWith(12, 7, '2026-11-21T18:00:00.000Z');
  });

  it('com a senha errada, a marcação continua', async () => {
    const repository = repositorio('ensino');

    await expect(desmarcarExame(desmarcar('errada'), repository, credenciais)).resolves.toEqual({
      feito: false,
      mensagem: SENHA_NAO_CONFERE_DESMARCAR,
    });
    expect(repository.desmarcarExame).not.toHaveBeenCalled();
  });

  it('pede a senha quando ela está vazia', async () => {
    await expect(desmarcarExame(desmarcar(''), repositorio('teste'), credenciais)).resolves.toEqual(
      {
        feito: false,
        mensagem: SENHA_VAZIA,
      },
    );
  });

  it('não desmarca o exame de outro médico', async () => {
    const repository = repositorio(null, { buscarExame: jest.fn(async () => null) });

    await expect(
      desmarcarExame(desmarcar('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({ feito: false, mensagem: EXAME_NAO_ENCONTRADO });
  });

  it('avisa quando o exame já está sem marcação', async () => {
    const repository = repositorio(null);

    await expect(
      desmarcarExame(desmarcar('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({ feito: false, mensagem: EXAME_SEM_MARCACAO, desatualizado: true });
    expect(repository.desmarcarExame).not.toHaveBeenCalled();
  });

  it('avisa quando o banco recusa, porque outro pedido desmarcou antes', async () => {
    const repository = repositorio('teste', { desmarcarExame: jest.fn(async () => false) });

    await expect(
      desmarcarExame(desmarcar('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({ feito: false, mensagem: EXAME_SEM_MARCACAO, desatualizado: true });
  });

  it('usa a hora do tablet quando não recebe outra', async () => {
    const repository = repositorio('teste');

    await desmarcarExame(
      { atendimentoId: 12, profissional: ana, senha: 'senhaForte123' },
      repository,
      credenciais,
    );

    expect(repository.desmarcarExame).toHaveBeenCalledWith(12, 7, expect.any(String));
  });
});

describe('marcarPaciente (#47)', () => {
  it('Cenário: marcar um paciente: grava o tipo, o profissional e a hora depois da senha', async () => {
    const repository = repositorio();

    await expect(
      marcarPaciente(marcarDadosPaciente('senhaForte123', 'ensino'), repository, credenciais),
    ).resolves.toEqual({ feito: true });

    expect(repository.buscarPaciente).toHaveBeenCalledWith(5, 7);
    expect(repository.marcarPaciente).toHaveBeenCalledWith(
      5,
      7,
      'ensino',
      '2026-11-21T18:00:00.000Z',
    );
  });

  it('Cenário: superusuário: não permite marcar o paciente', async () => {
    const repository = repositorio();

    await expect(
      marcarPaciente(
        marcarDadosPaciente('senhaForte123', 'teste', { ...ana, superuser: true }),
        repository,
        credenciais,
      ),
    ).resolves.toEqual({ feito: false, mensagem: SUPERUSUARIO_NAO_MARCA_PACIENTE });
    expect(repository.buscarPaciente).not.toHaveBeenCalled();
    expect(repository.marcarPaciente).not.toHaveBeenCalled();
  });

  it('pede o tipo antes de consultar o banco', async () => {
    const repository = repositorio();

    await expect(
      marcarPaciente(marcarDadosPaciente('senhaForte123', null), repository, credenciais),
    ).resolves.toEqual({ feito: false, mensagem: ESCOLHA_O_TIPO });
    expect(repository.buscarPaciente).not.toHaveBeenCalled();
  });

  it('Cenário: senha incorreta: avisa e o paciente continua sem marcação', async () => {
    const repository = repositorio();

    await expect(
      marcarPaciente(marcarDadosPaciente('errada'), repository, credenciais),
    ).resolves.toEqual({
      feito: false,
      mensagem: SENHA_NAO_CONFERE_PACIENTE_MARCAR,
    });
    expect(repository.marcarPaciente).not.toHaveBeenCalled();
  });

  it('pede a senha quando ela está vazia', async () => {
    await expect(
      marcarPaciente(marcarDadosPaciente(''), repositorio(), credenciais),
    ).resolves.toEqual({
      feito: false,
      mensagem: SENHA_VAZIA,
    });
  });

  it('Cenário: paciente de outro médico: não encontra nem marca', async () => {
    const repository = repositorio(null, { buscarPaciente: jest.fn(async () => null) });

    await expect(
      marcarPaciente(marcarDadosPaciente('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({
      feito: false,
      mensagem: PACIENTE_NAO_ENCONTRADO,
    });
    expect(repository.marcarPaciente).not.toHaveBeenCalled();
  });

  it('marca o restante se parte dos exames do médico já tinha outra marcação ou estava sem', async () => {
    const repository = repositorio(null, {
      buscarPaciente: jest.fn(
        async (): Promise<PacienteParaMarcar> => ({
          marcacoes: ['teste', null],
        }),
      ),
    });

    await expect(
      marcarPaciente(marcarDadosPaciente('senhaForte123', 'teste'), repository, credenciais),
    ).resolves.toEqual({ feito: true });
    expect(repository.marcarPaciente).toHaveBeenCalledTimes(1);
  });

  it('avisa quando todos os exames do médico já estavam marcados, mesmo com outro tipo', async () => {
    const repository = repositorio('ensino');

    await expect(
      marcarPaciente(marcarDadosPaciente('senhaForte123', 'teste'), repository, credenciais),
    ).resolves.toEqual({
      feito: false,
      mensagem: PACIENTE_JA_MARCADO,
      desatualizado: true,
    });
    expect(repository.marcarPaciente).not.toHaveBeenCalled();
  });

  it('avisa quando todos os exames do médico já estavam marcados com o mesmo tipo', async () => {
    const repository = repositorio('teste');

    await expect(
      marcarPaciente(marcarDadosPaciente('senhaForte123', 'teste'), repository, credenciais),
    ).resolves.toEqual({
      feito: false,
      mensagem: PACIENTE_JA_MARCADO,
      desatualizado: true,
    });
    expect(repository.marcarPaciente).not.toHaveBeenCalled();
  });

  it('avisa quando o banco recusa por já estar marcado', async () => {
    const repository = repositorio(null, { marcarPaciente: jest.fn(async () => false) });

    await expect(
      marcarPaciente(marcarDadosPaciente('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({
      feito: false,
      mensagem: PACIENTE_JA_MARCADO,
      desatualizado: true,
    });
  });
});

describe('desmarcarPaciente (#47)', () => {
  it('desfaz a marcação de todos os exames do médico no paciente após conferir a senha', async () => {
    const repository = repositorio('teste');

    await expect(
      desmarcarPaciente(desmarcarDadosPaciente('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({ feito: true });
    expect(repository.desmarcarPaciente).toHaveBeenCalledWith(5, 7, '2026-11-21T18:00:00.000Z');
  });

  it('Cenário: superusuário: não permite desmarcar o paciente', async () => {
    const repository = repositorio('teste');

    await expect(
      desmarcarPaciente(
        desmarcarDadosPaciente('senhaForte123', { ...ana, superuser: true }),
        repository,
        credenciais,
      ),
    ).resolves.toEqual({ feito: false, mensagem: SUPERUSUARIO_NAO_MARCA_PACIENTE });
    expect(repository.desmarcarPaciente).not.toHaveBeenCalled();
  });

  it('com a senha errada, mantém a marcação do paciente', async () => {
    const repository = repositorio('ensino');

    await expect(
      desmarcarPaciente(desmarcarDadosPaciente('errada'), repository, credenciais),
    ).resolves.toEqual({
      feito: false,
      mensagem: SENHA_NAO_CONFERE_PACIENTE_DESMARCAR,
    });
    expect(repository.desmarcarPaciente).not.toHaveBeenCalled();
  });

  it('avisa quando nenhum exame do médico está marcado', async () => {
    const repository = repositorio(null);

    await expect(
      desmarcarPaciente(desmarcarDadosPaciente('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({
      feito: false,
      mensagem: PACIENTE_SEM_MARCACAO,
      desatualizado: true,
    });
    expect(repository.desmarcarPaciente).not.toHaveBeenCalled();
  });
});
