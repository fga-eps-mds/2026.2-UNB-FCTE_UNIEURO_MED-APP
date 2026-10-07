import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { changePassword, deactivateAccount } from '@/features/auth/account';
import LoginScreen from '@/features/auth/login-screen';
import { SessionProvider } from '@/features/auth/session';
import {
  ANA,
  SENHA_DE_TESTE,
  abrirTabletComAnaEBruno,
  type TabletDeTeste,
} from '@/test-utils/professionals';

// O login lê do SQLite real, com a senha de verdade, depois das mudanças na conta (#5).

let tablet: TabletDeTeste;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
});

afterEach(async () => {
  await tablet.database.closeAsync();
});

async function entrar(senha: string) {
  const user = userEvent.setup();
  render(<LoginScreen repository={tablet.repository} />, { wrapper: SessionProvider });
  await user.type(screen.getByLabelText('E-MAIL'), ANA.email);
  await user.type(screen.getByLabelText('SENHA'), senha);
  await user.press(screen.getByRole('button', { name: 'ENTRAR' }));
}

describe('login depois das mudanças na conta', () => {
  it('entrar com conta desativada: não deixa entrar e mostra a mensagem genérica', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await deactivateAccount(tablet.anaId, SENHA_DE_TESTE, tablet.repository);

    await entrar(SENHA_DE_TESTE);

    expect(alerta).toHaveBeenCalledWith('Login', 'E-mail ou senha inválidos.');
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('troca de senha: entra com a nova senha', async () => {
    await changePassword(
      tablet.anaId,
      {
        currentPassword: SENHA_DE_TESTE,
        newPassword: 'nova-senha-123',
        confirmation: 'nova-senha-123',
      },
      tablet.repository,
    );

    await entrar('nova-senha-123');

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('troca de senha: a senha antiga deixa de valer', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await changePassword(
      tablet.anaId,
      {
        currentPassword: SENHA_DE_TESTE,
        newPassword: 'nova-senha-123',
        confirmation: 'nova-senha-123',
      },
      tablet.repository,
    );

    await entrar(SENHA_DE_TESTE);

    expect(alerta).toHaveBeenCalledWith('Login', 'E-mail ou senha inválidos.');
    expect(useRouter().replace).not.toHaveBeenCalled();
  });
});
