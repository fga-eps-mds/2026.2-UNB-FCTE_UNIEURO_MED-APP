import type { CredentialsRepository } from '@/features/auth/authentication';
import type { SessionProfessional } from '@/features/auth/session';
import {
  SENHA_INCORRETA,
  SENHA_VAZIA,
  confirmarProfissional,
} from '@/features/avaliacao/confirmacao-profissional';

jest.mock('@/features/auth/password', () => ({
  DUMMY_PASSWORD_HASH: 'hash-ficticio',
  verifyPassword: jest.fn(
    async (password: string, hash: string) => hash === 'hash-real' && password === 'senhaForte123',
  ),
}));

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

function criarRepositorio(doBanco: Partial<SessionProfessional & { active: boolean }> = {}) {
  return {
    findByEmail: jest.fn(async () => ({
      ...profissional,
      active: true,
      ...doBanco,
      passwordHash: 'hash-real',
    })),
  } satisfies CredentialsRepository;
}

describe('confirmarProfissional', () => {
  it('confirma o profissional da sessão pela senha dele', async () => {
    const repositorio = criarRepositorio();

    await expect(
      confirmarProfissional('senhaForte123', profissional, repositorio),
    ).resolves.toEqual({ confirmado: true });
    expect(repositorio.findByEmail).toHaveBeenCalledWith('ana@unieuro.com.br');
  });

  it('recusa a senha errada', async () => {
    await expect(
      confirmarProfissional('outraSenha', profissional, criarRepositorio()),
    ).resolves.toEqual({ confirmado: false, mensagem: SENHA_INCORRETA });
  });

  it('pede a senha quando ela está vazia, sem consultar o banco', async () => {
    const repositorio = criarRepositorio();

    await expect(confirmarProfissional('', profissional, repositorio)).resolves.toEqual({
      confirmado: false,
      mensagem: SENHA_VAZIA,
    });
    expect(repositorio.findByEmail).not.toHaveBeenCalled();
  });

  it('recusa quando o e-mail leva a outro profissional', async () => {
    await expect(
      confirmarProfissional('senhaForte123', profissional, criarRepositorio({ id: 99 })),
    ).resolves.toEqual({ confirmado: false, mensagem: SENHA_INCORRETA });
  });

  it('recusa a conta desativada, como o login', async () => {
    await expect(
      confirmarProfissional('senhaForte123', profissional, criarRepositorio({ active: false })),
    ).resolves.toEqual({ confirmado: false, mensagem: SENHA_INCORRETA });
  });
});
