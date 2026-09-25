import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import RegisterScreen from '@/features/auth/register-screen';

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

      expect(alerta).toHaveBeenCalledWith('Cadastro incompleto', expect.any(String));
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

      expect(alerta).toHaveBeenCalledWith('Cadastro incompleto', expect.any(String));
    });

    it('trata campo só com espaços como campo em branco', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen />);

      await preencherFormulario(user);
      await user.clear(screen.getByLabelText('CRM'));
      await user.type(screen.getByLabelText('CRM'), '   ');
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith('Cadastro incompleto', expect.any(String));
    });

    it('recusa o envio quando a confirmação não bate com a senha', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen />);

      await preencherFormulario(user, 'senha-forte', 'senha-errada');
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith('Senhas diferentes', expect.any(String));
    });

    it('aceita o envio com todos os campos preenchidos e senhas iguais', async () => {
      const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const user = userEvent.setup();
      render(<RegisterScreen />);

      await preencherFormulario(user);
      await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));

      expect(alerta).toHaveBeenCalledWith('Cadastro', expect.any(String));
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
