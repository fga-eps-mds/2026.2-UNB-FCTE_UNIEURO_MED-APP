import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import SettingsScreen from '@/features/settings/settings-screen';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.1.0' } },
}));

const profissional: SessionProfessional = {
  id: 1,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

function renderTela(sessao: SessionProfessional | null = profissional) {
  return render(
    <SessionProvider initialProfessional={sessao}>
      <SettingsScreen />
    </SessionProvider>,
  );
}

describe('SettingsScreen', () => {
  it('mostra os dados do profissional autenticado', () => {
    renderTela();

    expect(screen.getByRole('header', { name: 'Meus dados' })).toBeOnTheScreen();
    expect(screen.getByText('ana.souza@unieuro.com.br')).toBeOnTheScreen();
    expect(screen.getAllByText('12345/DF').length).toBeGreaterThan(0);
  });

  it('mostra a versão do aplicativo e que ele funciona sem internet', () => {
    renderTela();

    expect(screen.getByText('Versão 1.1.0')).toBeOnTheScreen();
    expect(screen.getByText(/Funciona sem internet/)).toBeOnTheScreen();
  });

  it('volta para a tela inicial', async () => {
    const user = userEvent.setup();
    renderTela();

    await user.press(screen.getByRole('button', { name: 'Voltar para o início' }));

    expect(useRouter().back).toHaveBeenCalled();
  });

  it('encerra a sessão e volta para o login', async () => {
    const user = userEvent.setup();
    renderTela();

    await user.press(screen.getByRole('button', { name: 'Sair do aplicativo' }));

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('header', { name: 'Configurações' })).toBeNull();
  });

  it('ao sair, fecha a tela inicial que ficou embaixo antes de voltar ao login', async () => {
    const router = useRouter();
    jest.mocked(router.canDismiss).mockReturnValueOnce(true);
    const user = userEvent.setup();
    renderTela();

    await user.press(screen.getByRole('button', { name: 'Sair do aplicativo' }));

    expect(router.dismissAll).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('volta para o login quando ninguém entrou', () => {
    renderTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });
});
