import { render, screen, userEvent } from '@testing-library/react-native';

import {
  ConfirmarApagarDesenho,
  REGISTRO_APAGAR,
  TEXTO_APAGAR,
  TITULO_APAGAR,
} from '@/features/avaliacao/apagar-desenho-dialog';
import { createDrawingTaskStyles } from '@/features/avaliacao/drawing-task.styles';

function renderizar(visible = true) {
  const onCancelar = jest.fn();
  const onApagar = jest.fn();
  render(
    <ConfirmarApagarDesenho
      visible={visible}
      onCancelar={onCancelar}
      onApagar={onApagar}
      styles={createDrawingTaskStyles()}
    />,
  );
  return { onCancelar, onApagar };
}

describe('ConfirmarApagarDesenho', () => {
  it('mostra a pergunta, o que acontece e que o apagamento fica registrado', () => {
    renderizar();

    expect(screen.getByRole('header', { name: TITULO_APAGAR })).toBeOnTheScreen();
    expect(screen.getByText(TEXTO_APAGAR)).toBeOnTheScreen();
    expect(screen.getByText('REGISTRADO')).toBeOnTheScreen();
    expect(screen.getByText(REGISTRO_APAGAR)).toBeOnTheScreen();
  });

  it('chama o cancelar e o apagar pelos botões', async () => {
    const user = userEvent.setup();
    const { onCancelar, onApagar } = renderizar();

    await user.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onApagar).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Apagar' }));
    expect(onApagar).toHaveBeenCalledTimes(1);
  });

  it('não aparece enquanto não é pedido', () => {
    renderizar(false);

    expect(screen.queryByRole('header', { name: TITULO_APAGAR })).toBeNull();
  });
});
