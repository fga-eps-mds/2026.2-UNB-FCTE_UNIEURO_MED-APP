import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import type { AccountRepository } from '@/features/auth/account';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import SettingsScreen from '@/features/settings/settings-screen';
import {
  ANA,
  SENHA_DE_TESTE,
  abrirTabletComAnaEBruno,
  type TabletDeTeste,
} from '@/test-utils/professionals';

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

const semBanco = {} as AccountRepository;

function renderTela(
  sessao: SessionProfessional | null = profissional,
  repository: AccountRepository = semBanco,
) {
  return render(
    <SessionProvider initialProfessional={sessao}>
      <SettingsScreen repository={repository} />
    </SessionProvider>,
  );
}

describe('SettingsScreen', () => {
  it('consulta dos meus dados: mostra o nome, o e-mail e o CRM de quem entrou', () => {
    renderTela();

    expect(screen.getByRole('header', { name: 'Meus dados' })).toBeOnTheScreen();
    expect(screen.getAllByText('Ana Carolina Souza').length).toBeGreaterThan(0);
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

  it('volta para o login quando ninguém entrou', () => {
    renderTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });

  it.each(['Editar dados', 'Trocar senha'])(
    'abre a edição da conta pelo botão %s',
    async (botao) => {
      const user = userEvent.setup();
      renderTela();

      await user.press(screen.getByRole('button', { name: botao }));

      expect(useRouter().push).toHaveBeenCalledWith('/edit-account');
    },
  );

  describe('desativação da conta, com SQLite real', () => {
    let tablet: TabletDeTeste;

    beforeEach(async () => {
      tablet = await abrirTabletComAnaEBruno();
    });

    afterEach(async () => {
      await tablet.database.closeAsync();
    });

    const renderDaAna = () => renderTela({ id: tablet.anaId, ...ANA }, tablet.repository);

    async function pedirDesativacao(senha: string) {
      const user = userEvent.setup();
      renderDaAna();
      await user.press(screen.getByRole('button', { name: 'Desativar minha conta' }));
      expect(screen.getByRole('header', { name: 'Desativar a sua conta?' })).toBeOnTheScreen();
      await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), senha);
      return user;
    }

    it('conta desativada: encerra a sessão, volta ao login e registra a data e a hora', async () => {
      const user = await pedirDesativacao(SENHA_DE_TESTE);

      await user.press(screen.getByRole('button', { name: 'Desativar conta' }));

      expect(useRouter().replace).toHaveBeenCalledWith('/');
      expect(screen.queryByRole('header', { name: 'Configurações' })).toBeNull();
      const conta = await tablet.repository.findById(tablet.anaId);
      expect(conta).toMatchObject({ active: false, deactivatedAt: expect.any(String) });
    });

    it('desativação cancelada: a conta continua ativa', async () => {
      const user = await pedirDesativacao(SENHA_DE_TESTE);

      await user.press(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('header', { name: 'Desativar a sua conta?' })).toBeNull();
      expect(useRouter().replace).not.toHaveBeenCalled();
      await expect(tablet.repository.findById(tablet.anaId)).resolves.toMatchObject({
        active: true,
      });
    });

    it('senha atual incorreta: informa que a senha não confere e a conta continua ativa', async () => {
      const user = await pedirDesativacao('senha-errada');

      await user.press(screen.getByRole('button', { name: 'Desativar conta' }));

      expect(screen.getByText('A senha atual não confere.')).toBeOnTheScreen();
      expect(useRouter().replace).not.toHaveBeenCalled();
      await expect(tablet.repository.findById(tablet.anaId)).resolves.toMatchObject({
        active: true,
      });
    });

    it('avisa quando o banco falha ao desativar', async () => {
      const user = userEvent.setup();
      const quebrado = {
        findById: jest.fn().mockRejectedValue(new Error('banco indisponível')),
      } as unknown as AccountRepository;
      renderTela(profissional, quebrado);
      await user.press(screen.getByRole('button', { name: 'Desativar minha conta' }));
      await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), SENHA_DE_TESTE);

      await user.press(screen.getByRole('button', { name: 'Desativar conta' }));

      expect(
        screen.getByText('Não foi possível desativar a conta. Tente de novo.'),
      ).toBeOnTheScreen();
    });
  });
});
