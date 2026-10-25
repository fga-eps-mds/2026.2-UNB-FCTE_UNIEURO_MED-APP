import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import ConsentPlaceholderScreen, {
  CONSENT_PENDING_MESSAGE,
} from '@/features/avaliacao/consent-placeholder-screen';

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

function renderizarTela(
  professional: SessionProfessional | null = profissional,
  atendimento?: string | readonly string[],
) {
  render(
    <SessionProvider initialProfessional={professional}>
      <ConsentPlaceholderScreen atendimento={atendimento} />
    </SessionProvider>,
  );
}

describe('ConsentPlaceholderScreen', () => {
  it('confirma o registro e avisa que o termo ainda está em construção', () => {
    renderizarTela();

    expect(screen.getByRole('header', { name: 'Termo de consentimento' })).toBeOnTheScreen();
    expect(screen.getByLabelText(`Informação. ${CONSENT_PENDING_MESSAGE}`)).toBeOnTheScreen();
  });

  it('volta ao início sem deixar esta tela na pilha', async () => {
    const user = userEvent.setup();
    renderizarTela();

    await user.press(screen.getByRole('button', { name: 'Voltar ao início' }));

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('abre a instrução da tarefa 1 do atendimento, sem deixar esta tela na pilha', async () => {
    const user = userEvent.setup();
    renderizarTela(profissional, '12');

    await user.press(screen.getByRole('button', { name: 'Iniciar as tarefas' }));

    expect(useRouter().replace).toHaveBeenCalledWith({
      pathname: '/instrucao',
      params: { atendimento: '12', tarefa: '1' },
    });
  });

  it('não oferece o início das tarefas sem um atendimento', () => {
    renderizarTela();

    expect(screen.queryByRole('button', { name: 'Iniciar as tarefas' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Voltar ao início' })).toBeOnTheScreen();
  });

  it('volta ao login quando não há médico logado', () => {
    renderizarTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('header', { name: 'Termo de consentimento' })).toBeNull();
  });
});
