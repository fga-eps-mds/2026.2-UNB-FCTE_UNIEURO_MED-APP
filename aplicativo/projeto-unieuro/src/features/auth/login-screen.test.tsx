import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import LoginScreen from '@/features/auth/login-screen';

jest.mock('@/features/auth/password', () => ({
  DUMMY_PASSWORD_HASH: 'dummy-hash',
  verifyPassword: jest
    .fn()
    .mockImplementation(async (senha, hash) => hash !== 'dummy-hash' && senha !== 'senhaerrada'),
}));

describe('LoginScreen', () => {
  it('apresenta o nome do produto como cabeçalho', () => {
    render(<LoginScreen />);

    expect(screen.getByRole('header', { name: 'MNEMA' })).toBeOnTheScreen();
  });

  it('identifica os campos para leitores de tela', () => {
    render(<LoginScreen />);

    expect(screen.getByLabelText('E-MAIL')).toBeOnTheScreen();
    expect(screen.getByLabelText('SENHA')).toBeOnTheScreen();
  });

  it('associa cada campo ao seu rótulo visível', () => {
    render(<LoginScreen />);

    expect(screen.getByLabelText('E-MAIL')).toHaveProp('accessibilityLabelledBy', 'email-label');
    expect(screen.getByLabelText('SENHA')).toHaveProp('accessibilityLabelledBy', 'password-label');
  });

  it('esconde o conteúdo do campo de senha', () => {
    render(<LoginScreen />);

    expect(screen.getByLabelText('SENHA')).toHaveProp('secureTextEntry', true);
  });

  it('expõe as três ações como botões', () => {
    render(<LoginScreen />);

    expect(screen.getByRole('button', { name: 'ENTRAR' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'ESQUECI MINHA SENHA' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'CRIAR CONTA' })).toBeOnTheScreen();
  });

  it('guarda o que é digitado nos campos', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByLabelText('E-MAIL'), 'ana.souza@unieuro.com.br');

    expect(screen.getByLabelText('E-MAIL')).toHaveProp('value', 'ana.souza@unieuro.com.br');
  });

  it('leva para o cadastro ao tocar em "CRIAR CONTA"', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

    expect(useRouter().push).toHaveBeenCalledWith('/register');
  });

  it('avisa que o acesso ainda não está conectado', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

    expect(screen.getByText('O acesso ainda não está disponível.')).toBeOnTheScreen();
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it('avisa que a recuperação de senha ainda não está conectada', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.press(screen.getByRole('button', { name: 'ESQUECI MINHA SENHA' }));

    expect(screen.getByText('A recuperação de senha ainda não está disponível.')).toBeOnTheScreen();
  });

  describe('medição da área disponível', () => {
    function dispararLayout(width: number, height: number) {
      fireEvent(screen.UNSAFE_getByType(ScrollView), 'layout', {
        nativeEvent: { layout: { width, height } },
      });
    }

    it('passa para a disposição de tablet quando a área medida é larga', () => {
      render(<LoginScreen />);

      dispararLayout(800, 1280);

      expect(screen.getByRole('header', { name: 'MNEMA' })).toHaveStyle({ fontSize: 42 });
    });

    it('volta para a disposição de telefone quando a área medida é estreita', () => {
      render(<LoginScreen />);

      dispararLayout(800, 1280);
      dispararLayout(390, 844);

      expect(screen.getByRole('header', { name: 'MNEMA' })).toHaveStyle({ fontSize: 36 });
    });

    it('mantém a disposição quando a mesma medida chega de novo', () => {
      render(<LoginScreen />);

      dispararLayout(800, 1280);
      dispararLayout(800, 1280);

      expect(screen.getByRole('header', { name: 'MNEMA' })).toHaveStyle({ fontSize: 42 });
    });
  });

  describe('fluxo de autenticação real', () => {
    it('indica os campos vazios sem consultar o banco', async () => {
      const user = userEvent.setup();
      const repository = { findByEmail: jest.fn() };
      render(<LoginScreen repository={repository as any} />);

      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));
      expect(screen.getByText('Preencha o e-mail.')).toBeOnTheScreen();
      expect(screen.getByText('Preencha a senha.')).toBeOnTheScreen();
      expect(screen.getByLabelText('E-MAIL')).toHaveProp('accessibilityHint', 'Preencha o e-mail.');
      expect(repository.findByEmail).not.toHaveBeenCalled();
    });

    it('realiza o login com sucesso quando o repositório encontra o profissional', async () => {
      const mockRepository = {
        findByEmail: jest.fn().mockResolvedValue({
          id: '1',
          name: 'Doutor Teste',
          email: 'teste@unieuro.com.br',
          crm: '12345/DF',
          passwordHash: 'hash_valido',
        }),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.type(screen.getByLabelText('E-MAIL'), 'teste@unieuro.com.br');
      await user.type(screen.getByLabelText('SENHA'), 'senha1234');
      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

      expect(mockRepository.findByEmail).toHaveBeenCalledWith('teste@unieuro.com.br');
    });

    it('mostra mensagem genérica quando o e-mail não é encontrado no repositório', async () => {
      // A mensagem é a mesma de senha incorreta, de propósito: evita que a tela
      // revele quais e-mails estão cadastrados (enumeração de e-mail).
      const mockRepository = {
        findByEmail: jest.fn().mockResolvedValue(null),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.type(screen.getByLabelText('E-MAIL'), 'naoexiste@unieuro.com.br');
      await user.type(screen.getByLabelText('SENHA'), 'senha1234');
      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

      expect(screen.getByText('E-mail ou senha inválidos.')).toBeOnTheScreen();
      expect(screen.getByLabelText('Erro. E-mail ou senha inválidos.')).toBeOnTheScreen();
    });

    it('mostra a mesma mensagem quando a senha está incorreta', async () => {
      const mockRepository = {
        findByEmail: jest.fn().mockResolvedValue({
          id: '1',
          name: 'Doutor Teste',
          email: 'teste@unieuro.com.br',
          crm: '12345/DF',
          passwordHash: 'hash_valido',
        }),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.type(screen.getByLabelText('E-MAIL'), 'teste@unieuro.com.br');
      await user.type(screen.getByLabelText('SENHA'), 'senhaerrada');
      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

      expect(screen.getByText('E-mail ou senha inválidos.')).toBeOnTheScreen();
    });

    it('realiza o login com sucesso e navega para o menu principal', async () => {
      const mockRepository = {
        findByEmail: jest.fn().mockResolvedValue({
          id: '1',
          name: 'Doutor Teste',
          email: 'teste@unieuro.com.br',
          crm: '12345/DF',
          passwordHash: 'hash_valido',
        }),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.type(screen.getByLabelText('E-MAIL'), 'teste@unieuro.com.br');
      await user.type(screen.getByLabelText('SENHA'), 'senha_correta');
      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

      expect(useRouter().replace).toHaveBeenCalledWith('/menu');
    });
    it('mostra uma faixa se ocorrer um erro inesperado no repositório', async () => {
      const mockRepository = {
        findByEmail: jest.fn().mockRejectedValue(new Error('Erro de base de dados')),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.type(screen.getByLabelText('E-MAIL'), 'teste@unieuro.com.br');
      await user.type(screen.getByLabelText('SENHA'), 'senha1234');
      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

      expect(screen.getByText('Não foi possível entrar. Tente novamente.')).toBeOnTheScreen();
    });

    it('impede cliques repetidos enquanto o carregamento está ativo', async () => {
      const mockRepository = {
        findByEmail: jest.fn().mockReturnValue(new Promise(() => {})),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.type(screen.getByLabelText('E-MAIL'), 'teste@unieuro.com.br');
      await user.type(screen.getByLabelText('SENHA'), 'senha1234');

      const botao = screen.getByRole('button', { name: 'ENTRAR' });
      await user.press(botao);
      await user.press(botao);

      expect(mockRepository.findByEmail).toHaveBeenCalledTimes(1);
    });
    it('limpa o erro do campo quando a pessoa começa a corrigi-lo', async () => {
      const mockRepository = {
        findByEmail: jest.fn(),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));
      await user.type(screen.getByLabelText('E-MAIL'), 'ana@unieuro.com.br');

      expect(screen.queryByText('Preencha o e-mail.')).not.toBeOnTheScreen();
      expect(screen.getByText('Preencha a senha.')).toBeOnTheScreen();
      expect(mockRepository.findByEmail).not.toHaveBeenCalled();
    });
  });
});
