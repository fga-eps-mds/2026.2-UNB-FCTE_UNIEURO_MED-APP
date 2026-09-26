import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import type { ProfessionalRepository } from '@/features/auth/registration';
import RegisterScreen from '@/features/auth/register-screen';

jest.mock('@/features/auth/password', () => ({
  hashPassword: jest.fn(async () => 'hash-da-senha'),
}));

function criarRepositorio(
  sobrescritas: Partial<ProfessionalRepository> = {},
): ProfessionalRepository {
  return {
    emailExists: jest.fn(async () => false),
    crmExists: jest.fn(async () => false),
    insert: jest.fn(async () => undefined),
    ...sobrescritas,
  };
}

/** Preenche todos os campos do formulário com dados válidos. */
async function preencherFormulario(
  user: ReturnType<typeof userEvent.setup>,
  senha = 'senha-forte',
  confirmacao = 'senha-forte',
) {
  await user.type(screen.getByLabelText('NOME COMPLETO'), 'Ana Carolina Souza');
  await user.type(screen.getByLabelText('E-MAIL'), 'ana.souza@unieuro.com.br');
  await user.type(screen.getByLabelText('CRM'), '12345/DF');
  await user.type(screen.getByLabelText('CPF'), '000.000.000-00');
  await user.type(screen.getByLabelText('SENHA'), senha);
  await user.type(screen.getByLabelText('CONFIRMAR SENHA'), confirmacao);
}

describe('RegisterScreen', () => {
  it('identifica os seis campos para leitores de tela', () => {
    render(<RegisterScreen />);

    for (const rotulo of [
      'NOME COMPLETO',
      'E-MAIL',
      'CRM',
      'CPF',
      'SENHA',
      'CONFIRMAR SENHA',
    ]) {
      expect(screen.getByLabelText(rotulo)).toBeOnTheScreen();
    }
  });

  it('esconde o conteúdo dos dois campos de senha', () => {
    render(<RegisterScreen />);

    expect(screen.getByLabelText('SENHA')).toHaveProp('secureTextEntry', true);
    expect(screen.getByLabelText('CONFIRMAR SENHA')).toHaveProp('secureTextEntry', true);
  });

  it('apresenta o título como cabeçalho', () => {
    render(<RegisterScreen />);

    expect(screen.getByRole('header', { name: 'CRIAR CONTA' })).toBeOnTheScreen();
  });

  describe('validação', () => {
    it('recusa o envio com campos em branco', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen />);

      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith(
        'Cadastro não concluído',
        'Preencha todos os campos para continuar.',
      );
    });

    it('recusa o envio quando falta apenas um campo', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen />);

      await user.type(screen.getByLabelText('NOME COMPLETO'), 'Ana Carolina Souza');
      await user.type(screen.getByLabelText('E-MAIL'), 'ana.souza@unieuro.com.br');
      await user.type(screen.getByLabelText('CRM'), '12345/DF');
      await user.type(screen.getByLabelText('SENHA'), 'senha-forte');
      await user.type(screen.getByLabelText('CONFIRMAR SENHA'), 'senha-forte');
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith(
        'Cadastro não concluído',
        'Preencha todos os campos para continuar.',
      );
    });

    it('trata campo só com espaços como campo em branco', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen />);

      await preencherFormulario(user);
      await user.clear(screen.getByLabelText('CRM'));
      await user.type(screen.getByLabelText('CRM'), '   ');
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith(
        'Cadastro não concluído',
        'Preencha todos os campos para continuar.',
      );
    });

    it('recusa o envio quando a confirmação não bate com a senha', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen />);

      await preencherFormulario(user, 'senha-forte', 'senha-errada');
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith(
        'Cadastro não concluído',
        'Confira a senha e a confirmação.',
      );
    });

    it('avisa que o banco ainda não está conectado quando a tela não recebe repositório', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen />);

      await preencherFormulario(user);
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith('Cadastro', expect.any(String));
    });
  });

  describe('com o banco conectado', () => {
    it('salva o profissional e volta para a tela de acesso', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const repositorio = criarRepositorio();
      const user = userEvent.setup();
      render(<RegisterScreen repository={repositorio} />);

      await preencherFormulario(user);
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(repositorio.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ana.souza@unieuro.com.br',
          crmNumber: '12345',
          crmState: 'DF',
          passwordHash: 'hash-da-senha',
        }),
      );
      expect(alerta).toHaveBeenCalledWith('Cadastro concluído', expect.any(String));
      expect(useRouter().replace).toHaveBeenCalledWith('/');
    });

    it.each([
      [
        'o e-mail já está cadastrado',
        { emailExists: jest.fn(async () => true) },
        'Já existe um profissional cadastrado com este e-mail.',
      ],
      [
        'o banco falha ao salvar',
        { insert: jest.fn(async () => Promise.reject(new Error('falha no banco'))) },
        'Não foi possível salvar o cadastro. Tente novamente.',
      ],
    ])('mostra o motivo e continua no cadastro quando %s', async (_caso, sobrescritas, mensagem) => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen repository={criarRepositorio(sobrescritas)} />);

      await preencherFormulario(user);
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith('Cadastro não concluído', mensagem);
      expect(useRouter().replace).not.toHaveBeenCalled();
    });

    it('não envia de novo enquanto o cadastro está sendo salvo', async () => {
      const repositorio = criarRepositorio({
        emailExists: jest.fn(() => new Promise<boolean>(() => undefined)),
      });
      const user = userEvent.setup();
      render(<RegisterScreen repository={repositorio} />);

      await preencherFormulario(user);
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(repositorio.emailExists).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'CRIAR CONTA' })).toBeDisabled();
    });
  });

  it('volta para a tela de acesso ao tocar em "Já tenho conta"', async () => {
    const user = userEvent.setup();
    render(<RegisterScreen />);

    await user.press(screen.getByRole('button', { name: 'Já tenho conta? ENTRAR' }));

    expect(useRouter().replace).toHaveBeenCalledWith('/');
  });

  /** Mesma medição por `onLayout` da tela de acesso. */
  it('passa para a disposição de tablet quando a área medida é larga', () => {
    render(<RegisterScreen />);

    fireEvent(screen.UNSAFE_getByType(ScrollView), 'layout', {
      nativeEvent: { layout: { width: 800, height: 1280 } },
    });

    expect(screen.getByRole('header', { name: 'CRIAR CONTA' })).toHaveStyle({ fontSize: 32 });
  });
});
