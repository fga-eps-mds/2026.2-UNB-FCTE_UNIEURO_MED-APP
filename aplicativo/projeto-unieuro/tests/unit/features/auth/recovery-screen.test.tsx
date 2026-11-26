import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import RecoveryScreen from '@/features/auth/recovery-screen';
import {
  type RecoveryAttempts,
  type RecoveryAttemptsStore,
} from '@/features/auth/password-recovery';

jest.mock('@/features/auth/password', () => ({
  hashPassword: jest.fn(async (value) => `hash:${value}`),
}));

function setup(active = true) {
  let attempts: RecoveryAttempts = { failures: 0, blockedUntil: null };
  const store: RecoveryAttemptsStore = {
    read: jest.fn(async () => attempts),
    write: jest.fn(async (value) => {
      attempts = value;
    }),
  };
  const repository = {
    findByCpfAndCrm: jest.fn(async (_cpf: string, crm: string) =>
      crm === '12345' ? { id: 1, active } : null,
    ),
    updatePasswordHash: jest.fn(async () => {}),
  };
  render(<RecoveryScreen repository={repository} attemptsStore={store} />);
  return { repository, store };
}

function preencher(crm = '12345/DF', senha = 'novasenha') {
  fireEvent.changeText(screen.getByLabelText('CPF'), '11144477735');
  fireEvent.changeText(screen.getByLabelText('CRM COM UF'), crm);
  fireEvent.changeText(screen.getByLabelText('NOVA SENHA'), senha);
  fireEvent.changeText(screen.getByLabelText('CONFIRMAR NOVA SENHA'), senha);
}

describe('recuperação de senha', () => {
  it('valida os campos e permite corrigir a senha', async () => {
    const { repository } = setup();
    preencher('12345/DF', 'curta');
    fireEvent.press(screen.getByRole('button', { name: 'Criar nova senha' }));
    expect(
      await screen.findByText('A nova senha precisa ter pelo menos 8 caracteres.'),
    ).toBeOnTheScreen();
    expect(repository.findByCpfAndCrm).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('NOVA SENHA'), 'novasenha');
    expect(
      screen.queryByText('A nova senha precisa ter pelo menos 8 caracteres.'),
    ).not.toBeOnTheScreen();
  });

  it('troca a senha, limpa os campos e oferece retorno ao login', async () => {
    const { repository } = setup();
    preencher();
    expect(screen.getByLabelText('CPF')).toHaveProp('value', '111.444.777-35');
    expect(screen.getByLabelText('NOVA SENHA')).toHaveProp('secureTextEntry', true);
    fireEvent.press(screen.getByRole('button', { name: 'Criar nova senha' }));
    expect(await screen.findByText('Senha alterada. Entre com sua nova senha.')).toBeOnTheScreen();
    expect(repository.updatePasswordHash).toHaveBeenCalledWith(
      1,
      'hash:novasenha',
      expect.any(String),
    );
    expect(screen.queryByLabelText('NOVA SENHA')).not.toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Voltar para o login' }));
    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });

  it('mostra mensagem genérica quando os dados não conferem e bloqueia após cinco tentativas', async () => {
    const { repository } = setup();
    preencher('12346/DF');
    for (let i = 0; i < 5; i++) {
      fireEvent.press(screen.getByRole('button', { name: 'Criar nova senha' }));
      if (i < 4)
        await screen.findByText(
          'Não foi possível confirmar a sua identidade. Confira os dados e tente de novo. A senha não mudou.',
        );
      else await screen.findByText(/Muitas tentativas seguidas/);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Criar nova senha' })).toBeEnabled(),
      );
    }
    expect(repository.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('informa falhas inesperadas e permite tentar novamente', async () => {
    const { repository } = setup();
    repository.findByCpfAndCrm.mockRejectedValueOnce(new Error('erro'));
    preencher();
    fireEvent.press(screen.getByRole('button', { name: 'Criar nova senha' }));
    expect(
      await screen.findByText('Não foi possível recuperar a senha. Tente novamente.'),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Criar nova senha' }));
    expect(await screen.findByText('Senha alterada. Entre com sua nova senha.')).toBeOnTheScreen();
  });
});
