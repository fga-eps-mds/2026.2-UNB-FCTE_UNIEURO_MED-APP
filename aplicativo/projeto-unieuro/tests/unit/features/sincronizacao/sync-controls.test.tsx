import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';
import { ActionButton, LabeledInput } from '@/features/sincronizacao/sync-controls';
import { createSyncStyles } from '@/features/sincronizacao/sync.styles';

const styles = createSyncStyles(Colors.light);

describe('ActionButton', () => {
  it('é um botão com o rótulo como nome e responde ao toque', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(<ActionButton label="Gerar e enviar pacote" onPress={onPress} styles={styles} />);

    await user.press(screen.getByRole('button', { name: 'Gerar e enviar pacote' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ocupado, fica desabilitado, avisa o leitor de tela e não responde', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(<ActionButton label="Gerando..." onPress={onPress} styles={styles} busy />);

    const button = screen.getByRole('button', { name: 'Gerando...' });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('na variante com contorno, usa o estilo da ação secundária', () => {
    render(<ActionButton label="Cancelar" onPress={jest.fn()} styles={styles} variant="outline" />);

    const style = StyleSheet.flatten(screen.getByRole('button', { name: 'Cancelar' }).props.style);
    expect(style.borderColor).toBe(Colors.light.primary);
  });
});

describe('LabeledInput', () => {
  it('mostra o rótulo e tem nome acessível próprio, para distinguir campos parecidos', async () => {
    const user = userEvent.setup();
    const onChangeText = jest.fn();
    render(
      <>
        <LabeledInput
          label="CONFIRME COM A SUA SENHA"
          accessibilityLabel="Senha para gerar o pacote"
          placeholderColor={Colors.light.placeholder}
          styles={styles}
          value=""
          onChangeText={onChangeText}
          secureTextEntry
        />
        <LabeledInput
          label="CONFIRME COM A SUA SENHA"
          accessibilityLabel="Senha para importar o pacote"
          placeholderColor={Colors.light.placeholder}
          styles={styles}
          value=""
          onChangeText={jest.fn()}
        />
      </>,
    );

    expect(screen.getAllByText('CONFIRME COM A SUA SENHA')).toHaveLength(2);
    const input = screen.getByLabelText('Senha para gerar o pacote');
    await user.type(input, 'abc');

    // Campo controlado com valor fixo: cada tecla chega sozinha.
    expect(onChangeText.mock.calls).toEqual([['a'], ['b'], ['c']]);
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.autoCorrect).toBe(false);
  });
});
