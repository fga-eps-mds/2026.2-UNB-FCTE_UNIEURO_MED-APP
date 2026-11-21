import { act, render, screen, userEvent } from '@testing-library/react-native';

import {
  ESCOLHA_O_TIPO,
  SENHA_NAO_CONFERE_MARCAR,
  type ResultadoMarcacao,
} from '@/features/avaliacao/marcacao';
import {
  FALHA_AO_MARCAR,
  MarcarExameDialog,
  type MarcacaoPedida,
} from '@/features/home/marcar-exame-dialog';

type Confirmar = jest.Mock<Promise<ResultadoMarcacao>, [string | null, string]>;

function renderDialog(
  pedido: MarcacaoPedida = { acao: 'marcar' },
  onConfirm: Confirmar = jest.fn(async () => ({ feito: true as const })),
) {
  const onCancel = jest.fn();
  const onDone = jest.fn();
  render(
    <MarcarExameDialog
      visible
      pedido={pedido}
      quando="05/10/2026 · 14:32"
      onConfirm={onConfirm}
      onCancel={onCancel}
      onDone={onDone}
    />,
  );
  return { onConfirm, onCancel, onDone };
}

describe('MarcarExameDialog (#58)', () => {
  it('diz que nada é apagado e oferece os dois tipos, nenhum escolhido', () => {
    renderDialog();

    expect(screen.getByRole('header', { name: 'Marcar este exame?' })).toBeOnTheScreen();
    expect(
      screen.getByText(/Nada é apagado: na exportação, ele sai com a marcação/),
    ).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Teste' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Material de ensino' })).not.toBeChecked();
    expect(
      screen.getByText('A marcação fica registrada com o tipo, a data, a hora e o profissional.'),
    ).toBeOnTheScreen();
  });

  it('Cenário: marcar um exame: grava o tipo escolhido com a senha e avisa a tela', async () => {
    const user = userEvent.setup();
    const { onConfirm, onDone } = renderDialog();

    await user.press(screen.getByRole('radio', { name: 'Material de ensino' }));
    expect(screen.getByRole('radio', { name: 'Material de ensino' })).toBeChecked();
    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), 'senhaForte123');
    await user.press(screen.getByRole('button', { name: 'Marcar exame' }));

    expect(onConfirm).toHaveBeenCalledWith('ensino', 'senhaForte123');
    expect(onDone).toHaveBeenCalled();
  });

  it('mostra o aviso da regra quando a marcação é recusada', async () => {
    const user = userEvent.setup();
    const onConfirm: Confirmar = jest.fn(async () => ({
      feito: false as const,
      mensagem: ESCOLHA_O_TIPO,
    }));
    const { onDone } = renderDialog({ acao: 'marcar' }, onConfirm);

    await user.press(screen.getByRole('button', { name: 'Marcar exame' }));

    expect(onConfirm).toHaveBeenCalledWith(null, '');
    expect(screen.getByText(ESCOLHA_O_TIPO)).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('Cenário: senha incorreta: avisa, e o aviso sai quando a senha muda', async () => {
    const user = userEvent.setup();
    const onConfirm: Confirmar = jest.fn(async () => ({
      feito: false as const,
      mensagem: SENHA_NAO_CONFERE_MARCAR,
    }));
    renderDialog({ acao: 'marcar' }, onConfirm);

    await user.press(screen.getByRole('radio', { name: 'Teste' }));
    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), 'errada');
    await user.press(screen.getByRole('button', { name: 'Marcar exame' }));
    expect(screen.getByText(SENHA_NAO_CONFERE_MARCAR)).toBeOnTheScreen();

    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), 'x');
    expect(screen.queryByText(SENHA_NAO_CONFERE_MARCAR)).toBeNull();
  });

  it('avisa quando a gravação falha, sem fechar', async () => {
    const user = userEvent.setup();
    const onConfirm: Confirmar = jest.fn(async () => {
      throw new Error('banco indisponível');
    });
    const { onDone } = renderDialog({ acao: 'marcar' }, onConfirm);

    await user.press(screen.getByRole('button', { name: 'Marcar exame' }));

    expect(screen.getByText(FALHA_AO_MARCAR)).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('Cenário: marcação cancelada: fecha sem gravar nada', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.press(screen.getByRole('radio', { name: 'Teste' }));
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('para desfazer, diz qual marcação sai, não pede o tipo e registra quem desfez', async () => {
    const user = userEvent.setup();
    const { onConfirm, onDone } = renderDialog({ acao: 'desmarcar', marcacao: 'teste' });

    expect(screen.getByRole('header', { name: 'Desfazer a marcação?' })).toBeOnTheScreen();
    expect(
      screen.getByText(/deixa de ser Teste e volta a contar como exame da pesquisa/),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText(/registra quem desfez a marcação/)).toBeOnTheScreen();

    await user.type(screen.getByLabelText('CONFIRME COM A SUA SENHA'), 'senhaForte123');
    await user.press(screen.getByRole('button', { name: 'Desfazer marcação' }));

    expect(onConfirm).toHaveBeenCalledWith(null, 'senhaForte123');
    expect(onDone).toHaveBeenCalled();
  });

  it('não envia de novo enquanto grava', async () => {
    const user = userEvent.setup();
    let terminar: (resultado: ResultadoMarcacao) => void = () => undefined;
    const onConfirm: Confirmar = jest.fn(
      () => new Promise<ResultadoMarcacao>((resolve) => (terminar = resolve)),
    );
    renderDialog({ acao: 'marcar' }, onConfirm);

    await user.press(screen.getByRole('button', { name: 'Marcar exame' }));
    expect(screen.getByRole('button', { name: 'Marcar exame' })).toBeDisabled();
    await user.press(screen.getByRole('button', { name: 'Marcar exame' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => terminar({ feito: true }));
  });
});
