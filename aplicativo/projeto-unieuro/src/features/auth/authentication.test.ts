import { authenticate, type CredentialsRepository } from '@/features/auth/authentication';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '@/features/auth/password';

jest.mock('@/features/auth/password', () => ({
  DUMMY_PASSWORD_HASH: 'hash-ficticio',
  verifyPassword: jest.fn(async (password: string, hash: string) => hash === 'hash-real' && password === 'senhaForte123'),
}));

function createRepository(passwordHash: string | null = 'hash-real') {
  return {
    findByEmail: jest.fn(async () => (passwordHash ? { passwordHash } : null)),
  } satisfies CredentialsRepository;
}

describe('authenticate', () => {
  beforeEach(() => jest.mocked(verifyPassword).mockClear());

  it('aceita e-mail e senha corretos', async () => {
    const repository = createRepository();

    const result = await authenticate({ email: 'ana@unieuro.com.br', password: 'senhaForte123' }, repository);

    expect(result).toEqual({ success: true });
  });

  it('normaliza o e-mail antes de consultar o repositório', async () => {
    const repository = createRepository();

    await authenticate({ email: '  Ana@Unieuro.com.BR ', password: 'senhaForte123' }, repository);

    expect(repository.findByEmail).toHaveBeenCalledWith('ana@unieuro.com.br');
  });

  it.each([
    ['e-mail em branco', '   ', 'senhaForte123'],
    ['senha em branco', 'ana@unieuro.com.br', ''],
  ])('recusa %s sem consultar o repositório', async (_caso, email, password) => {
    const repository = createRepository();

    const result = await authenticate({ email, password }, repository);

    expect(result).toEqual({
      success: false,
      reason: 'missing-fields',
      message: 'Preencha e-mail e senha para continuar.',
    });
    expect(repository.findByEmail).not.toHaveBeenCalled();
  });

  it('recusa a senha incorreta', async () => {
    const result = await authenticate(
      { email: 'ana@unieuro.com.br', password: 'senhaErrada' },
      createRepository(),
    );

    expect(result).toEqual({
      success: false,
      reason: 'invalid-credentials',
      message: 'E-mail ou senha inválidos.',
    });
  });

  it('recusa o e-mail não cadastrado com a mesma mensagem da senha incorreta', async () => {
    const result = await authenticate(
      { email: 'naoexiste@unieuro.com.br', password: 'senhaForte123' },
      createRepository(null),
    );

    expect(result).toEqual({
      success: false,
      reason: 'invalid-credentials',
      message: 'E-mail ou senha inválidos.',
    });
  });

  it('verifica a senha contra o hash fictício quando o e-mail não existe', async () => {
    await authenticate({ email: 'naoexiste@unieuro.com.br', password: 'senhaForte123' }, createRepository(null));

    expect(verifyPassword).toHaveBeenCalledWith('senhaForte123', DUMMY_PASSWORD_HASH);
  });

  it('propaga a falha do repositório', async () => {
    const repository: CredentialsRepository = {
      findByEmail: jest.fn(async () => {
        throw new Error('banco indisponível');
      }),
    };

    await expect(
      authenticate({ email: 'ana@unieuro.com.br', password: 'senhaForte123' }, repository),
    ).rejects.toThrow('banco indisponível');
  });
});
