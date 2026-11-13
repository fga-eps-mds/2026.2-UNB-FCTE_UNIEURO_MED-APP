import type { CredentialsRepository } from '@/features/auth/authentication';
import type { SessionProfessional } from '@/features/auth/session';
import {
  EXAME_FINALIZADO,
  EXAME_NAO_ENCONTRADO,
  PACIENTE_COM_EXAME_FINALIZADO,
  PACIENTE_NAO_ENCONTRADO,
  SENHA_NAO_CONFERE,
  SENHA_VAZIA,
  excluirExame,
  excluirPaciente,
  podeExcluirExame,
  type ExclusaoRepository,
} from '@/features/avaliacao/exclusao';

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

const AGORA = new Date('2026-11-12T18:00:00.000Z');

function repositorio(extra: Partial<ExclusaoRepository> = {}) {
  return {
    buscarExame: jest.fn(async () => ({ estado: 'em_andamento' })),
    excluirExame: jest.fn(async () => true),
    resumirPaciente: jest.fn(async () => ({ exames: 2, finalizados: 0 })),
    excluirPaciente: jest.fn(async () => true),
    ...extra,
  } satisfies ExclusaoRepository;
}

describe('podeExcluirExame', () => {
  it.each(['aguardando_consentimento', 'em_andamento', 'interrompida', 'cancelada'])(
    'oferece a exclusão para o exame %s',
    (estado) => expect(podeExcluirExame(estado)).toBe(true),
  );

  it.each(['processando_resultado', 'erro_inferencia', 'concluida'])(
    'não oferece a exclusão para o exame finalizado (%s)',
    (estado) => expect(podeExcluirExame(estado)).toBe(false),
  );
});

describe('excluirExame (#58)', () => {
  const pedido = (senha: string) => ({ atendimentoId: 12, profissional: ana, senha, agora: AGORA });

  it('com a senha certa, exclui com a data e o profissional', async () => {
    const repository = repositorio();

    await expect(excluirExame(pedido('senhaForte123'), repository, credenciais)).resolves.toEqual({
      excluido: true,
    });
    expect(repository.buscarExame).toHaveBeenCalledWith(12, 7);
    expect(repository.excluirExame).toHaveBeenCalledWith(12, 7, '2026-11-12T18:00:00.000Z');
  });

  it('com a senha errada, avisa e não exclui', async () => {
    const repository = repositorio();

    await expect(excluirExame(pedido('errada'), repository, credenciais)).resolves.toEqual({
      excluido: false,
      mensagem: SENHA_NAO_CONFERE,
    });
    expect(repository.excluirExame).not.toHaveBeenCalled();
  });

  it('sem senha, pede a senha', async () => {
    await expect(excluirExame(pedido(''), repositorio(), credenciais)).resolves.toEqual({
      excluido: false,
      mensagem: SENHA_VAZIA,
    });
  });

  it('exame finalizado não pode ser excluído, nem com a senha certa', async () => {
    const repository = repositorio({ buscarExame: jest.fn(async () => ({ estado: 'concluida' })) });

    await expect(excluirExame(pedido('senhaForte123'), repository, credenciais)).resolves.toEqual({
      excluido: false,
      mensagem: EXAME_FINALIZADO,
    });
    expect(repository.excluirExame).not.toHaveBeenCalled();
  });

  it('exame de outro médico não é encontrado', async () => {
    const repository = repositorio({ buscarExame: jest.fn(async () => null) });

    await expect(excluirExame(pedido('senhaForte123'), repository, credenciais)).resolves.toEqual({
      excluido: false,
      mensagem: EXAME_NAO_ENCONTRADO,
    });
  });

  it('se o exame foi finalizado entre a conferência e a gravação, avisa', async () => {
    const repository = repositorio({ excluirExame: jest.fn(async () => false) });

    await expect(excluirExame(pedido('senhaForte123'), repository, credenciais)).resolves.toEqual({
      excluido: false,
      mensagem: EXAME_FINALIZADO,
    });
  });

  it('usa a hora atual quando não recebe uma', async () => {
    const repository = repositorio();

    await excluirExame(
      { atendimentoId: 12, profissional: ana, senha: 'senhaForte123' },
      repository,
      credenciais,
    );

    expect(repository.excluirExame).toHaveBeenCalledWith(12, 7, expect.any(String));
  });
});

describe('excluirPaciente (#47)', () => {
  const pedido = (senha: string) => ({ pacienteId: 3, profissional: ana, senha, agora: AGORA });

  it('paciente sem exame finalizado: com a senha certa, exclui', async () => {
    const repository = repositorio();

    await expect(
      excluirPaciente(pedido('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({ excluido: true });
    expect(repository.resumirPaciente).toHaveBeenCalledWith(3, 7);
    expect(repository.excluirPaciente).toHaveBeenCalledWith(3, 7, '2026-11-12T18:00:00.000Z');
  });

  it('paciente com exame finalizado: informa que não é permitido, sem pedir a senha', async () => {
    const repository = repositorio({
      resumirPaciente: jest.fn(async () => ({ exames: 2, finalizados: 1 })),
    });

    await expect(excluirPaciente(pedido(''), repository, credenciais)).resolves.toEqual({
      excluido: false,
      mensagem: PACIENTE_COM_EXAME_FINALIZADO,
    });
    expect(repository.excluirPaciente).not.toHaveBeenCalled();
  });

  it('senha incorreta: avisa e não exclui', async () => {
    const repository = repositorio();

    await expect(excluirPaciente(pedido('errada'), repository, credenciais)).resolves.toEqual({
      excluido: false,
      mensagem: SENHA_NAO_CONFERE,
    });
    expect(repository.excluirPaciente).not.toHaveBeenCalled();
  });

  it('sem senha, pede a senha', async () => {
    await expect(excluirPaciente(pedido(''), repositorio(), credenciais)).resolves.toEqual({
      excluido: false,
      mensagem: SENHA_VAZIA,
    });
  });

  it('paciente de outro médico não é encontrado', async () => {
    const repository = repositorio({
      resumirPaciente: jest.fn(async () => ({ exames: 0, finalizados: 0 })),
    });

    await expect(
      excluirPaciente(pedido('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({ excluido: false, mensagem: PACIENTE_NAO_ENCONTRADO });
  });

  it('se um exame foi finalizado no meio do caminho, avisa', async () => {
    const repository = repositorio({ excluirPaciente: jest.fn(async () => false) });

    await expect(
      excluirPaciente(pedido('senhaForte123'), repository, credenciais),
    ).resolves.toEqual({ excluido: false, mensagem: PACIENTE_COM_EXAME_FINALIZADO });
  });

  it('usa a hora atual quando não recebe uma', async () => {
    const repository = repositorio();

    await excluirPaciente(
      { pacienteId: 3, profissional: ana, senha: 'senhaForte123' },
      repository,
      credenciais,
    );

    expect(repository.excluirPaciente).toHaveBeenCalledWith(3, 7, expect.any(String));
  });
});
