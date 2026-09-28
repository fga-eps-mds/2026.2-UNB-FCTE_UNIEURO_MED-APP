import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import LoginScreen  from '@/features/auth/login-screen';

jest.mock('@/features/auth/password', () => ({
  verifyPassword: jest.fn().mockImplementation(async (senha) => senha !== 'senhaerrada'),
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
    expect(screen.getByLabelText('SENHA')).toHaveProp(
      'accessibilityLabelledBy',
      'password-label',
    );
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
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

    expect(alerta).toHaveBeenCalledWith('Entrar', expect.any(String));
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it('avisa que a recuperação de senha ainda não está conectada', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.press(screen.getByRole('button', { name: 'ESQUECI MINHA SENHA' }));

    expect(alerta).toHaveBeenCalledWith('Esqueci minha senha', expect.any(String));
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
    it('alerta se tentar entrar com campos em branco', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<LoginScreen />);

      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));
      expect(alerta).toHaveBeenCalledWith('Entrar', expect.any(String));
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

    it('alerta quando o e-mail não é encontrado no repositório', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const mockRepository = {
        findByEmail: jest.fn().mockResolvedValue(null),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.type(screen.getByLabelText('E-MAIL'), 'naoexiste@unieuro.com.br');
      await user.type(screen.getByLabelText('SENHA'), 'senha1234');
      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

      expect(alerta).toHaveBeenCalledWith('Login', 'E-mail não cadastrado.');
    });

    it('alerta quando a senha está incorreta', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
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

      expect(alerta).toHaveBeenCalledWith('Login', 'E-mail ou senha inválidos.');
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
    it('alerta se ocorrer um erro inesperado no repositório', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      
      const mockRepository = {
        findByEmail: jest.fn().mockRejectedValue(new Error('Erro de base de dados')),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.type(screen.getByLabelText('E-MAIL'), 'teste@unieuro.com.br');
      await user.type(screen.getByLabelText('SENHA'), 'senha1234');
      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

      expect(alerta).toHaveBeenCalledWith('Erro', 'Erro ao tentar efetuar o login. Tente novamente.');
      
      consoleErro.mockRestore(); 
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
    it('alerta se tentar entrar com campos em branco mesmo com repositório fornecido', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const mockRepository = {
        findByEmail: jest.fn(),
      };

      const user = userEvent.setup();
      render(<LoginScreen repository={mockRepository as any} />);

      await user.press(screen.getByRole('button', { name: 'ENTRAR' }));

      expect(alerta).toHaveBeenCalledWith('Login', 'Preencha e-mail e senha para continuar.');
      expect(mockRepository.findByEmail).not.toHaveBeenCalled();
    });
  });
}); 

