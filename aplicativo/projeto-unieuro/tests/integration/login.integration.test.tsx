import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import LoginScreen from '@/features/auth/login-screen';
import { SessionProvider, useSession } from '@/features/auth/session';

import {
  ANA,
  CPF_DA_ANA,
  SENHA_DE_TESTE,
  abrirTabletComAnaEBruno,
  type TabletDeTeste,
} from '../test-support/tablet';

/**
 * Integração do login: tela → verificação de senha → repositório → SQLite real.
 * A Ana e o Bruno já estão gravados no banco, com o hash PBKDF2 da senha de teste.
 */

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let tablet: TabletDeTeste;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
});

afterEach(async () => {
  await tablet.fechar();
});

function SessaoAtual() {
  const { professional } = useSession();
  return <Text testID="sessao">{professional ? JSON.stringify(professional) : 'sem sessão'}</Text>;
}

async function entrar(email: string, senha: string) {
  const user = userEvent.setup();
  render(
    <SessionProvider>
      <LoginScreen repository={tablet.repository} />
      <SessaoAtual />
    </SessionProvider>,
  );
  await user.type(screen.getByLabelText('E-MAIL'), email);
  await user.type(screen.getByLabelText('SENHA'), senha);
  await user.press(screen.getByRole('button', { name: 'ENTRAR' }));
}

const sessao = () => screen.getByTestId('sessao').props.children as string;

const CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos.';

describe('login com SQLite real', () => {
  it('credenciais corretas: abre o menu e guarda o profissional lido do banco', async () => {
    await entrar(ANA.email, SENHA_DE_TESTE);

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
    expect(screen.queryByText(CREDENCIAIS_INVALIDAS)).not.toBeOnTheScreen();
    const { id } = (await tablet.repository.findByEmail(ANA.email))!;
    expect(JSON.parse(sessao())).toEqual({ id, ...ANA });
  });

  it('credenciais corretas: o CPF e o hash da senha não vão para a sessão', async () => {
    await entrar(ANA.email, SENHA_DE_TESTE);

    expect(sessao()).not.toContain(CPF_DA_ANA);
    expect(sessao()).not.toContain('pbkdf2');
  });

  it.each([
    ['em maiúsculas', 'ANA.SOUZA@UNIEURO.COM.BR'],
    ['com espaços nas pontas', '  ana.souza@unieuro.com.br  '],
  ])('e-mail %s: encontra a mesma conta', async (_caso, email) => {
    await entrar(email, SENHA_DE_TESTE);

    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });

  it('senha errada: mensagem genérica e nenhuma sessão', async () => {
    await entrar(ANA.email, 'senha-errada-123');

    expect(await screen.findByText(CREDENCIAIS_INVALIDAS)).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(sessao()).toBe('sem sessão');
  });

  it('e-mail que não está no banco: a mesma mensagem da senha errada', async () => {
    await entrar('ninguem@unieuro.com.br', SENHA_DE_TESTE);

    expect(await screen.findByText(CREDENCIAIS_INVALIDAS)).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(sessao()).toBe('sem sessão');
  });

  it('o login devolve a conta de quem entrou, e não a de outro profissional do banco', async () => {
    await entrar('bruno.lima@unieuro.com.br', SENHA_DE_TESTE);

    expect(JSON.parse(sessao())).toMatchObject({ name: 'Bruno Lima', crmState: 'GO' });
    expect(sessao()).not.toContain('Ana Carolina Souza');
  });
});
