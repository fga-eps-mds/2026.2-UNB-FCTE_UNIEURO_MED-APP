import { hashPassword } from '@/features/auth/password';
import { createPasswordConfirmation } from '@/features/sincronizacao/password-confirmation';

const EMAIL = 'ana.souza@unieuro.com.br';
const SENHA = 'senha-da-ana';

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(SENHA);
});

const repositoryWith = (account: { passwordHash: string; active: boolean } | null) => ({
  findByEmail: jest.fn(async () => account),
});

describe('confirmação pela senha do profissional da sessão', () => {
  it('confirma com a senha certa da conta ativa', async () => {
    const repository = repositoryWith({ passwordHash, active: true });

    await expect(createPasswordConfirmation(repository)(EMAIL, SENHA)).resolves.toBe(true);
    expect(repository.findByEmail).toHaveBeenCalledWith(EMAIL);
  });

  it('recusa a senha errada', async () => {
    const confirm = createPasswordConfirmation(repositoryWith({ passwordHash, active: true }));

    await expect(confirm(EMAIL, 'outra-senha')).resolves.toBe(false);
  });

  it('recusa uma conta desativada, mesmo com a senha certa', async () => {
    const confirm = createPasswordConfirmation(repositoryWith({ passwordHash, active: false }));

    await expect(confirm(EMAIL, SENHA)).resolves.toBe(false);
  });

  it('recusa sem consultar o banco quando falta e-mail ou senha', async () => {
    const repository = repositoryWith({ passwordHash, active: true });
    const confirm = createPasswordConfirmation(repository);

    await expect(confirm('', SENHA)).resolves.toBe(false);
    await expect(confirm(EMAIL, '')).resolves.toBe(false);
    expect(repository.findByEmail).not.toHaveBeenCalled();
  });

  it('recusa quando a conta não existe neste tablet', async () => {
    await expect(createPasswordConfirmation(repositoryWith(null))(EMAIL, SENHA)).resolves.toBe(
      false,
    );
  });
});
