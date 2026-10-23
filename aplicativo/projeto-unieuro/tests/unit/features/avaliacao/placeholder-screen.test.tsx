import { render, screen, userEvent, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import PlaceholderScreen, { type PlaceholderAction } from '@/features/avaliacao/placeholder-screen';

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const MENSAGEM = 'Esta etapa ainda está em construção.';

function renderizarTela(
  professional: SessionProfessional | null = profissional,
  action?: PlaceholderAction,
) {
  render(
    <SessionProvider initialProfessional={professional}>
      <PlaceholderScreen title="Etapa provisória" message={MENSAGEM} action={action} />
    </SessionProvider>,
  );
}

describe('PlaceholderScreen', () => {
  it('mostra o título e o aviso de que a etapa está em construção', () => {
    renderizarTela();

    expect(screen.getByRole('header', { name: 'Etapa provisória' })).toBeOnTheScreen();
    expect(screen.getByLabelText(`Informação. ${MENSAGEM}`)).toBeOnTheScreen();
  });

  it('oferece só o retorno ao início quando não há botão extra', () => {
    renderizarTela();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Voltar ao início' })).toBeOnTheScreen();
  });

  it('volta ao início sem deixar esta tela na pilha', async () => {
    const user = userEvent.setup();
    renderizarTela();

    await user.press(screen.getByRole('button', { name: 'Voltar ao início' }));

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('mostra o botão extra antes de "Voltar ao início" e entrega o toque a ele', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    renderizarTela(profissional, { label: 'Seguir adiante', onPress });

    const [primeiro, segundo] = screen.getAllByRole('button');
    expect(within(primeiro).getByText('Seguir adiante')).toBeOnTheScreen();
    expect(within(segundo).getByText('Voltar ao início')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Seguir adiante' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('volta ao login quando não há médico logado', () => {
    renderizarTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('header', { name: 'Etapa provisória' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
