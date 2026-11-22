import { fireEvent, render, screen } from '@testing-library/react-native';
import { authenticate } from '@/features/auth/authentication';
import RecoveryScreen from '@/features/auth/recovery-screen';
import { ANA, SENHA_DE_TESTE, abrirTabletComAnaEBruno } from '../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

it('recupera pela tela e permite entrar com a nova senha no banco local', async () => {
  const tablet = await abrirTabletComAnaEBruno();
  try {
    const attemptsStore = {
      read: async () => ({ failures: 0, blockedUntil: null }),
      write: async () => {},
    };
    render(<RecoveryScreen repository={tablet.repository} attemptsStore={attemptsStore} />);
    fireEvent.changeText(screen.getByLabelText('CPF'), '11144477735');
    fireEvent.changeText(screen.getByLabelText('CRM COM UF'), '12345/DF');
    fireEvent.changeText(screen.getByLabelText('NOVA SENHA'), 'nova-senha-segura');
    fireEvent.changeText(screen.getByLabelText('CONFIRMAR NOVA SENHA'), 'nova-senha-segura');
    fireEvent.press(screen.getByRole('button', { name: 'SALVAR NOVA SENHA' }));
    expect(
      await screen.findByText('Senha alterada. Entre com sua nova senha.', {}, { timeout: 30000 }),
    ).toBeOnTheScreen();
    expect(
      (await authenticate({ email: ANA.email, password: 'nova-senha-segura' }, tablet.repository))
        .success,
    ).toBe(true);
    expect(
      (await authenticate({ email: ANA.email, password: SENHA_DE_TESTE }, tablet.repository))
        .success,
    ).toBe(false);
  } finally {
    await tablet.fechar();
  }
}, 60000);
