import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import LoginScreen from '@/features/auth/login-screen';

describe('LoginScreen', () => {
  it('apresenta o nome do produto como cabeçalho', () => {
    render(<LoginScreen />);

    expect(screen.getByRole('header', { name: 'MNEMA' })).toBeOnTheScreen();
  });

  /**
   * Os campos declaram `accessibilityLabel` e, no Android, também
   * `accessibilityLabelledBy`. Quando os dois existem, o Android usa o segundo,
   * então o nome anunciado é o do rótulo visível, em maiúsculas, e não o texto
   * de `accessibilityLabel`. Como o produto roda só em Android, é esse o nome
   * que os testes verificam.
   */
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

  /**
   * A autenticação ainda não existe. Enquanto não existir, o botão avisa que a
   * funcionalidade está pendente, e nenhuma navegação pode acontecer.
   */
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

  /**
   * A tela mede a própria área com `onLayout` em vez de confiar apenas nas
   * dimensões da janela, porque em tablet a janela pode não refletir o espaço
   * disponível. Não há `testID` no `ScrollView`, por isso a busca por tipo.
   */
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

    /**
     * Sem a comparação com o estado anterior, cada `onLayout` gravaria um novo
     * objeto, o que dispara nova renderização e novo `onLayout`, em laço.
     */
    it('mantém a disposição quando a mesma medida chega de novo', () => {
      render(<LoginScreen />);

      dispararLayout(800, 1280);
      dispararLayout(800, 1280);

      expect(screen.getByRole('header', { name: 'MNEMA' })).toHaveStyle({ fontSize: 42 });
    });
  });
});
