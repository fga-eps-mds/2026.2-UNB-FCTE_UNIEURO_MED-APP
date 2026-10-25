import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import DrawingPlaceholderScreen, {
  DRAWING_PENDING_MESSAGE,
} from '@/features/avaliacao/drawing-placeholder-screen';

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

function renderizarTela(professional: SessionProfessional | null = profissional) {
  render(
    <SessionProvider initialProfessional={professional}>
      <DrawingPlaceholderScreen />
    </SessionProvider>,
  );
}

describe('DrawingPlaceholderScreen', () => {
  it('avisa que a área de desenho ainda está em construção', () => {
    renderizarTela();

    expect(screen.getByRole('header', { name: 'Área de desenho' })).toBeOnTheScreen();
    expect(screen.getByLabelText(`Informação. ${DRAWING_PENDING_MESSAGE}`)).toBeOnTheScreen();
  });

  it('volta ao início sem deixar esta tela na pilha', async () => {
    const user = userEvent.setup();
    renderizarTela();

    await user.press(screen.getByRole('button', { name: 'Voltar ao início' }));

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('volta ao login quando não há médico logado', () => {
    renderizarTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('header', { name: 'Área de desenho' })).toBeNull();
  });
});
