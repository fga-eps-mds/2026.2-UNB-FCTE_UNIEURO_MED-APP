import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import type { CredentialsRepository } from '@/features/auth/authentication';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import { SENHA_INCORRETA } from '@/features/avaliacao/confirmacao-profissional';
import ExameInterrompidoScreen, {
  AVISO_LOCAL,
  BOTAO_PROFISSIONAL,
  BOTAO_RETOMAR,
  FALHA_AO_CARREGAR,
  FALHA_AO_RETOMAR,
  SEM_ANALISE,
} from '@/features/avaliacao/exame-interrompido-screen';
import type { ExameInterrompido } from '@/features/avaliacao/interrupcao';

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

const exame = (extra: Partial<ExameInterrompido> = {}): ExameInterrompido => ({
  atendimentoId: 12,
  nomePaciente: 'José Alves Martins',
  fichaPaciente: '2026-0001',
  tarefa: 2,
  motivo: 'cansaco',
  interrompidoEm: '2026-11-12T14:06:00.000Z',
  tarefasGravadas: [1],
  ...extra,
});

type Opcoes = {
  carregar?: jest.Mock;
  retomar?: jest.Mock;
  professional?: SessionProfessional | null;
};

async function renderizar({
  carregar = jest.fn(async () => exame()),
  retomar = jest.fn(async () => ({ retomado: true, tarefa: 2 })),
  professional = profissional,
}: Opcoes = {}) {
  const onRetomado = jest.fn();
  render(
    <SessionProvider initialProfessional={professional}>
      <ExameInterrompidoScreen
        atendimento="12"
        repository={repositorio}
        carregar={carregar}
        retomar={retomar}
        onRetomado={onRetomado}
      />
    </SessionProvider>,
  );
  await act(async () => {});
  return { carregar, retomar, onRetomado, user: userEvent.setup() };
}

describe('ExameInterrompidoScreen', () => {
  it('mostra o paciente, o motivo, a tarefa da parada e os desenhos salvos, sem resultado', async () => {
    const { carregar } = await renderizar();

    expect(carregar).toHaveBeenCalledWith(12, 7);
    expect(screen.getByText('José Alves Martins · Ficha 2026-0001')).toBeOnTheScreen();
    expect(screen.getByText('Desistência registrada. Motivo: Cansaço.')).toBeOnTheScreen();
    expect(screen.getByText('Parou na tarefa 2: Copie este cubo')).toBeOnTheScreen();
    expect(screen.getByText('1 de 3 desenhos salvos')).toBeOnTheScreen();
    expect(screen.getByText(SEM_ANALISE)).toBeOnTheScreen();
    expect(screen.getByText(AVISO_LOCAL)).toBeOnTheScreen();
    expect(screen.queryByText(/escore|pontua|faixa|nota/i)).toBeNull();
  });

  it('diz quando a desistência foi sem motivo', async () => {
    await renderizar({ carregar: jest.fn(async () => exame({ motivo: null })) });

    expect(screen.getByText('Desistência registrada, sem motivo informado.')).toBeOnTheScreen();
  });

  it('retoma o exame na tarefa que a regra devolve', async () => {
    const { retomar, onRetomado, user } = await renderizar();

    await user.press(screen.getByRole('button', { name: BOTAO_RETOMAR }));

    expect(retomar).toHaveBeenCalledWith(12, 7);
    expect(onRetomado).toHaveBeenCalledWith(2);
  });

  it('avisa quando não consegue retomar e continua na tela', async () => {
    const { onRetomado, user } = await renderizar({
      retomar: jest.fn(async () => ({ retomado: false })),
    });

    await user.press(screen.getByRole('button', { name: BOTAO_RETOMAR }));

    expect(await screen.findByLabelText(`Erro. ${FALHA_AO_RETOMAR}`)).toBeOnTheScreen();
    expect(onRetomado).not.toHaveBeenCalled();
  });

  it('não deixa retomar com as três tarefas já gravadas', async () => {
    await renderizar({ carregar: jest.fn(async () => exame({ tarefasGravadas: [1, 2, 3] })) });

    expect(screen.getByRole('button', { name: BOTAO_RETOMAR })).toBeDisabled();
  });

  it('volta ao início se o exame não está interrompido ou é de outro profissional', async () => {
    await renderizar({ carregar: jest.fn(async () => null) });

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('avisa quando o banco falha e ainda deixa o profissional sair', async () => {
    await renderizar({ carregar: jest.fn(async () => Promise.reject(new Error('banco'))) });

    expect(screen.getByLabelText(`Erro. ${FALHA_AO_CARREGAR}`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: BOTAO_PROFISSIONAL })).toBeOnTheScreen();
  });

  it('só volta à área do profissional com a senha dele', async () => {
    const { user } = await renderizar();

    await user.press(screen.getByRole('button', { name: BOTAO_PROFISSIONAL }));
    await user.type(screen.getByLabelText('Senha do profissional'), 'errada');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByLabelText(`Erro. ${SENHA_INCORRETA}`)).toBeOnTheScreen();
    expect(useRouter().dismissTo).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Senha do profissional'), 'senhaForte123');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(useRouter().dismissTo).toHaveBeenCalledWith('/menu');
  });

  it('cancelar a senha volta aos botões da tela', async () => {
    const { user } = await renderizar();

    await user.press(screen.getByRole('button', { name: BOTAO_PROFISSIONAL }));
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Senha do profissional')).toBeNull();
    expect(screen.getByRole('button', { name: BOTAO_RETOMAR })).toBeOnTheScreen();
  });

  it('sem profissional logado, volta ao login sem ler o banco', async () => {
    const { carregar } = await renderizar({ professional: null });

    expect(carregar).not.toHaveBeenCalled();
    expect(screen.queryByText(BOTAO_RETOMAR)).toBeNull();
  });
});
