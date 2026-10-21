import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import type { CredentialsRepository } from '@/features/auth/authentication';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { SENHA_INCORRETA } from '@/features/avaliacao/confirmacao-profissional';
import TelaFinalScreen, {
  AGRADECIMENTO,
  BOTAO_PROFISSIONAL,
  ORIENTACAO,
} from '@/features/avaliacao/tela-final-screen';

jest.mock('@/features/auth/password', () => ({
  DUMMY_PASSWORD_HASH: 'hash-ficticio',
  verifyPassword: jest.fn(
    async (password: string, hash: string) => hash === 'hash-real' && password === 'senhaForte123',
  ),
}));

const profissional: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const repositorio = {
  findByEmail: jest.fn(async () => ({ ...profissional, active: true, passwordHash: 'hash-real' })),
} satisfies CredentialsRepository;

function renderizarTela(professional: SessionProfessional | null = profissional) {
  render(
    <SessionProvider initialProfessional={professional}>
      <TelaFinalScreen repository={repositorio} />
    </SessionProvider>,
  );
}

async function pedirConfirmacao() {
  const user = userEvent.setup();
  renderizarTela();
  await user.press(screen.getByRole('button', { name: BOTAO_PROFISSIONAL }));
  return user;
}

describe('TelaFinalScreen', () => {
  it('fim do teste: mostra só o agradecimento, sem escore, faixa ou resultado', () => {
    renderizarTela();

    expect(screen.getByRole('header', { name: AGRADECIMENTO })).toBeOnTheScreen();
    expect(screen.getByText(ORIENTACAO)).toBeOnTheScreen();
    expect(screen.queryByText(/escore|pontua|faixa|resultado|nota/i)).toBeNull();
  });

  it('resultado protegido: pede a senha do profissional antes de sair da tela', async () => {
    await pedirConfirmacao();

    expect(screen.getByLabelText('Senha do profissional')).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('resultado protegido: com a senha certa, volta à área do profissional', async () => {
    const user = await pedirConfirmacao();

    await user.type(screen.getByLabelText('Senha do profissional'), 'senhaForte123');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('resultado protegido: com a senha errada, avisa e continua na tela final', async () => {
    const user = await pedirConfirmacao();

    await user.type(screen.getByLabelText('Senha do profissional'), 'chute123');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByLabelText(`Erro. ${SENHA_INCORRETA}`)).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Senha do profissional')).toHaveDisplayValue('');
  });

  it('cancelar a confirmação volta ao agradecimento, sem senha guardada', async () => {
    const user = await pedirConfirmacao();

    await user.type(screen.getByLabelText('Senha do profissional'), 'senhaForte123');
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Senha do profissional')).toBeNull();
    await user.press(screen.getByRole('button', { name: BOTAO_PROFISSIONAL }));
    expect(screen.getByLabelText('Senha do profissional')).toHaveDisplayValue('');
  });

  it('volta ao login quando não há médico logado', () => {
    renderizarTela(null);

    expect(useRouter().replace).toHaveBeenCalledWith('/');
    expect(screen.queryByText(AGRADECIMENTO)).toBeNull();
  });
});
