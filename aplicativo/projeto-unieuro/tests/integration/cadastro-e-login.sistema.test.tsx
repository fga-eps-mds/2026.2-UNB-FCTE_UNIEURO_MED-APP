import { render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import LoginScreen from '@/features/auth/login-screen';
import RegisterScreen from '../../src/features/auth/register-screen';
import { SessionProvider, useSession } from '@/features/auth/session';

import { abrirTablet, type TabletDeTeste } from '../test-support/tablet';

/**
 * Teste de sistema: o caminho completo de um profissional novo, da tela de
 * cadastro até a tela de login, passando pelo mesmo banco SQLite real.
 */

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let tablet: TabletDeTeste;

beforeEach(async () => {
  tablet = await abrirTablet();
});

afterEach(async () => {
  await tablet.fechar();
});

function SessaoAtual() {
  const { professional } = useSession();
  return <Text testID="sessao">{professional ? professional.name : 'sem sessão'}</Text>;
}

async function criarConta(senha: string, cpf = '111.444.777-35') {
  const user = userEvent.setup();
  const tela = render(<RegisterScreen repository={tablet.repository} />);
  await user.type(screen.getByLabelText('NOME COMPLETO'), 'Ana Carolina Souza');
  await user.type(screen.getByLabelText('E-MAIL'), 'Ana.Souza@unieuro.com.br');
  await user.type(screen.getByLabelText('CRM'), '12345/DF');
  await user.type(screen.getByLabelText('CPF'), cpf);
  await user.type(screen.getByLabelText('SENHA'), senha);
  await user.type(screen.getByLabelText('CONFIRMAR SENHA'), senha);
  await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));
  return tela;
}

async function fazerLogin(email: string, senha: string) {
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

const MENSAGEM_DE_SUCESSO = 'Conta criada. Entre com o e-mail e a senha cadastrados.';
const CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos.';

describe('cadastro e login, da tela ao SQLite', () => {
  it('quem acabou de se cadastrar entra com o e-mail e a senha cadastrados', async () => {
    const cadastro = await criarConta('senha-da-ana');
    expect(await screen.findByText(MENSAGEM_DE_SUCESSO)).toBeOnTheScreen();
    cadastro.unmount();

    await fazerLogin('ana.souza@unieuro.com.br', 'senha-da-ana');

    expect(useRouter().replace).toHaveBeenLastCalledWith('/menu');
    expect(screen.getByTestId('sessao')).toHaveTextContent('Ana Carolina Souza');
  });

  it('o e-mail digitado com outra caixa de letras no login encontra a conta cadastrada', async () => {
    const cadastro = await criarConta('senha-da-ana');
    expect(await screen.findByText(MENSAGEM_DE_SUCESSO)).toBeOnTheScreen();
    cadastro.unmount();

    await fazerLogin('ANA.SOUZA@UNIEURO.COM.BR', 'senha-da-ana');

    expect(useRouter().replace).toHaveBeenLastCalledWith('/menu');
  });

  it('o cadastro continua valendo depois de fechar e reabrir o banco, como ao reiniciar o app', async () => {
    const cadastro = await criarConta('senha-da-ana');
    expect(await screen.findByText(MENSAGEM_DE_SUCESSO)).toBeOnTheScreen();
    cadastro.unmount();

    await tablet.reabrir();
    await fazerLogin('ana.souza@unieuro.com.br', 'senha-da-ana');

    expect(useRouter().replace).toHaveBeenLastCalledWith('/menu');
    expect(screen.getByTestId('sessao')).toHaveTextContent('Ana Carolina Souza');
  });

  it('quem acabou de se cadastrar não entra com senha diferente da cadastrada', async () => {
    const cadastro = await criarConta('senha-da-ana');
    expect(await screen.findByText(MENSAGEM_DE_SUCESSO)).toBeOnTheScreen();
    cadastro.unmount();

    await fazerLogin('ana.souza@unieuro.com.br', 'outra-senha-123');

    expect(await screen.findByText(CREDENCIAIS_INVALIDAS)).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('sessao')).toHaveTextContent('sem sessão');
  });

  it('um cadastro recusado não deixa conta no banco: o login não entra', async () => {
    const cadastro = await criarConta('senha-da-ana', '111.444.777-00'); // CPF inválido
    expect(await screen.findByText('Informe um CPF válido.')).toBeOnTheScreen();
    cadastro.unmount();

    await fazerLogin('ana.souza@unieuro.com.br', 'senha-da-ana');

    expect(await screen.findByText(CREDENCIAIS_INVALIDAS)).toBeOnTheScreen();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });
});
