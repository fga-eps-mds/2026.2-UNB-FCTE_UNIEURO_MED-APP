import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Modal, Text } from 'react-native';

import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import {
  AreaAssinatura,
  BotoesDecisao,
  DecisaoTermo,
  DecisaoTermoProvider,
} from '@/features/avaliacao/consent-decision';
import TermoConsentimentoScreen from '@/features/avaliacao/termo-consentimento-screen';
import { TERMO_TCLE } from '@/features/avaliacao/termo-tcle';

import { PointerType, desenharNoQuadro, medirQuadro } from '../../../test-support/desenho';

const ROTULO_QUADRO = 'Área de assinatura';
const LARGURA = 520;
const ALTURA = 160;
const ASSINATURA = [
  [20, 80],
  [90, 40],
  [160, 100],
  [240, 50],
] as const;

const botaoAssinar = () => screen.getByRole('button', { name: 'Assinar e iniciar' });
const botaoRecusar = () => screen.getByRole('button', { name: 'Recusar' });

async function assinar() {
  medirQuadro(LARGURA, ALTURA, ROTULO_QUADRO);
  await desenharNoQuadro(ASSINATURA);
}

function renderizar(
  props: Partial<React.ComponentProps<typeof DecisaoTermo>> = {},
  user = userEvent.setup(),
) {
  const onAssinar = jest.fn();
  const onRecusar = jest.fn();
  render(<DecisaoTermo onAssinar={onAssinar} onRecusar={onRecusar} {...props} />);
  return { user, onAssinar, onRecusar };
}

describe('Cenário: assinar sem ter assinado', () => {
  it('deixa o "Assinar e iniciar" desabilitado enquanto a área está em branco', async () => {
    const { user, onAssinar } = renderizar();
    medirQuadro(LARGURA, ALTURA, ROTULO_QUADRO);

    expect(botaoAssinar()).toBeDisabled();
    await user.press(botaoAssinar());

    expect(onAssinar).not.toHaveBeenCalled();
  });

  it('explica ao leitor de tela o que falta para assinar', () => {
    renderizar();

    expect(botaoAssinar()).toHaveProp('accessibilityHint', 'Assine na área acima para continuar');
  });

  it('tira a explicação depois que a pessoa assina', async () => {
    renderizar();

    await assinar();

    expect(botaoAssinar().props.accessibilityHint).toBeUndefined();
  });

  it('mostra o convite "Assine aqui com a caneta" até o primeiro traço', async () => {
    renderizar();
    expect(screen.getByText('Assine aqui com a caneta')).toBeOnTheScreen();

    await assinar();

    expect(screen.queryByText('Assine aqui com a caneta')).toBeNull();
  });

  it('deixa o "Recusar" disponível sem assinatura', () => {
    renderizar();

    expect(botaoRecusar()).toBeEnabled();
  });
});

describe('Cenário: assinar e iniciar', () => {
  it('habilita o "Assinar e iniciar" depois do primeiro traço', async () => {
    renderizar();

    await assinar();

    expect(botaoAssinar()).toBeEnabled();
  });

  it('entrega à ação os traços e o tamanho da área de assinatura', async () => {
    const { user, onAssinar } = renderizar();
    await assinar();

    await user.press(botaoAssinar());

    expect(onAssinar).toHaveBeenCalledTimes(1);
    const { tracos, dimensoes } = onAssinar.mock.calls[0][0];
    expect(dimensoes).toEqual({ largura: LARGURA, altura: ALTURA });
    expect(tracos).toHaveLength(1);
    expect(tracos[0].map(({ x, y }: { x: number; y: number }) => [x, y])).toEqual(
      expect.arrayContaining([
        [20, 80],
        [240, 50],
      ]),
    );
  });

  it('aceita a assinatura feita com o dedo', async () => {
    const { user, onAssinar } = renderizar();
    medirQuadro(LARGURA, ALTURA, ROTULO_QUADRO);
    await desenharNoQuadro(ASSINATURA, PointerType.TOUCH);

    await user.press(botaoAssinar());

    expect(onAssinar).toHaveBeenCalledTimes(1);
  });

  it('não entrega a assinatura duas vezes quando o botão é tocado em seguida', async () => {
    const { user, onAssinar } = renderizar();
    await assinar();

    await user.press(botaoAssinar());
    await user.press(botaoAssinar());

    expect(onAssinar).toHaveBeenCalledTimes(1);
  });

  it('não entrega a assinatura duas vezes quando dois toques chegam antes de a tela mudar', async () => {
    const { onAssinar } = renderizar();
    await assinar();

    await act(async () => {
      fireEvent.press(botaoAssinar());
      fireEvent.press(botaoAssinar());
    });

    expect(onAssinar).toHaveBeenCalledTimes(1);
  });

  it('deixa a tela parada enquanto a assinatura é registrada', async () => {
    let concluir = () => {};
    const onAssinar = jest.fn(() => new Promise<void>((resolver) => (concluir = resolver)));
    const { user } = renderizar({ onAssinar });
    await assinar();

    await user.press(botaoAssinar());

    expect(botaoAssinar()).toBeDisabled();
    expect(botaoRecusar()).toBeDisabled();
    expect(screen.getByLabelText(ROTULO_QUADRO)).toBeDisabled();
    concluir();
  });

  it('libera a tela para outra tentativa quando o registro da assinatura falha', async () => {
    const onAssinar = jest.fn().mockRejectedValueOnce(new Error('banco indisponível'));
    const { user } = renderizar({ onAssinar });
    await assinar();

    await user.press(botaoAssinar());
    expect(botaoAssinar()).toBeEnabled();
    await user.press(botaoAssinar());

    expect(onAssinar).toHaveBeenCalledTimes(2);
  });
});

describe('Cenário: recusar o termo', () => {
  it('pede confirmação, avisa que o exame será cancelado e que a recusa fica registrada', async () => {
    const { user, onRecusar } = renderizar();

    await user.press(botaoRecusar());

    expect(screen.getByRole('header', { name: 'Recusar a participação?' })).toBeOnTheScreen();
    expect(screen.getByText(/O exame será cancelado antes de qualquer desenho/)).toBeOnTheScreen();
    expect(screen.getByText('A recusa fica registrada com data e horário.')).toBeOnTheScreen();
    expect(onRecusar).not.toHaveBeenCalled();
  });

  it('volta ao termo sem registrar nada quando a pessoa muda de ideia', async () => {
    const { user, onRecusar } = renderizar();
    await user.press(botaoRecusar());

    await user.press(screen.getByRole('button', { name: 'Voltar' }));

    expect(screen.queryByText('Recusar a participação?')).toBeNull();
    expect(onRecusar).not.toHaveBeenCalled();
    expect(botaoRecusar()).toBeEnabled();
  });

  it('registra a recusa ao confirmar, sem entregar nenhuma assinatura', async () => {
    const { user, onRecusar, onAssinar } = renderizar();
    await user.press(botaoRecusar());

    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(onRecusar).toHaveBeenCalledTimes(1);
    expect(onAssinar).not.toHaveBeenCalled();
  });

  it('recusa mesmo depois de a pessoa ter começado a assinar', async () => {
    const { user, onRecusar, onAssinar } = renderizar();
    await assinar();

    await user.press(botaoRecusar());
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(onRecusar).toHaveBeenCalledTimes(1);
    expect(onAssinar).not.toHaveBeenCalled();
  });

  it('não registra a recusa duas vezes quando a confirmação é tocada em seguida', async () => {
    const { user, onRecusar } = renderizar();
    await user.press(botaoRecusar());

    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(onRecusar).toHaveBeenCalledTimes(1);
  });

  it('não registra a recusa duas vezes quando dois toques chegam antes de a tela mudar', async () => {
    const { user, onRecusar } = renderizar();
    await user.press(botaoRecusar());

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Confirmar recusa' }));
      fireEvent.press(screen.getByRole('button', { name: 'Confirmar recusa' }));
    });

    expect(onRecusar).toHaveBeenCalledTimes(1);
  });

  it('deixa a confirmação parada enquanto a recusa é registrada', async () => {
    let concluir = () => {};
    const onRecusar = jest.fn(() => new Promise<void>((resolver) => (concluir = resolver)));
    const { user } = renderizar({ onRecusar });
    await user.press(botaoRecusar());

    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(screen.getByRole('button', { name: 'Confirmar recusa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled();
    concluir();
  });

  it('o voltar do Android fecha a confirmação sem registrar nada', async () => {
    const { user, onRecusar } = renderizar();
    await user.press(botaoRecusar());

    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());

    expect(screen.queryByRole('button', { name: 'Confirmar recusa' })).toBeNull();
    expect(onRecusar).not.toHaveBeenCalled();
  });

  it('enquanto a recusa é registrada, o voltar do Android não fecha a confirmação', async () => {
    let concluir = () => {};
    const onRecusar = jest.fn(() => new Promise<void>((resolver) => (concluir = resolver)));
    const { user } = renderizar({ onRecusar });
    await user.press(botaoRecusar());
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());

    expect(screen.getByRole('button', { name: 'Confirmar recusa' })).toBeOnTheScreen();
    concluir();
  });

  it('libera a confirmação para outra tentativa quando o registro da recusa falha', async () => {
    const onRecusar = jest.fn().mockRejectedValueOnce(new Error('banco indisponível'));
    const { user } = renderizar({ onRecusar });
    await user.press(botaoRecusar());

    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));
    expect(screen.getByRole('button', { name: 'Confirmar recusa' })).toBeEnabled();
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(onRecusar).toHaveBeenCalledTimes(2);
  });
});

describe('Encaixe na tela do termo', () => {
  const profissional: SessionProfessional = {
    id: 7,
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
  };

  function renderizarTela() {
    const aoAssinar = jest.fn();
    const aoRecusar = jest.fn();
    render(
      <SessionProvider initialProfessional={profissional}>
        <TermoConsentimentoScreen
          paciente={{ nome: 'José Alves Martins', ficha: '2026-0184' }}
          acoes={(contexto) => (
            <>
              <DecisaoTermo
                onAssinar={(assinatura) => aoAssinar(contexto, assinatura)}
                onRecusar={() => aoRecusar(contexto)}
              />
              <Text>{`Contexto: ${contexto.quemAssina}`}</Text>
            </>
          )}
        />
      </SessionProvider>,
    );
    return { aoAssinar, aoRecusar };
  }

  it('aceite pelo responsável legal: a assinatura chega com quem assinou e a versão do termo', async () => {
    const user = userEvent.setup();
    const { aoAssinar } = renderizarTela();

    await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));
    await assinar();
    await user.press(botaoAssinar());

    expect(aoAssinar).toHaveBeenCalledTimes(1);
    const [contexto, assinatura] = aoAssinar.mock.calls[0];
    expect(contexto).toEqual({ quemAssina: 'responsavel_legal', versaoTermo: TERMO_TCLE.versao });
    expect(assinatura.dimensoes).toEqual({ largura: LARGURA, altura: ALTURA });
    expect(assinatura.tracos).toHaveLength(1);
  });

  it('aceite pelo paciente: é o padrão quando ninguém muda a escolha', async () => {
    const user = userEvent.setup();
    const { aoAssinar } = renderizarTela();

    await assinar();
    await user.press(botaoAssinar());

    expect(aoAssinar.mock.calls[0][0]).toEqual({
      quemAssina: 'paciente',
      versaoTermo: TERMO_TCLE.versao,
    });
  });

  it('recusa: a ação recebe a versão do termo a que o paciente disse não', async () => {
    const user = userEvent.setup();
    const { aoRecusar } = renderizarTela();

    await user.press(botaoRecusar());
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(aoRecusar).toHaveBeenCalledWith({
      quemAssina: 'paciente',
      versaoTermo: TERMO_TCLE.versao,
    });
  });
});

describe('Área de assinatura dentro do cartão da declaração', () => {
  const profissional: SessionProfessional = {
    id: 7,
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
  };

  function renderizarTela() {
    const aoAssinar = jest.fn();
    const aoRecusar = jest.fn();
    render(
      <SessionProvider initialProfessional={profissional}>
        <DecisaoTermoProvider onAssinar={aoAssinar} onRecusar={aoRecusar}>
          <TermoConsentimentoScreen
            assinatura={<AreaAssinatura />}
            acoes={(contexto) => <BotoesDecisao contexto={contexto} />}
          />
        </DecisaoTermoProvider>
      </SessionProvider>,
    );
    return { aoAssinar, aoRecusar };
  }

  it('mostra a área de assinatura na tela do termo, com os botões', () => {
    renderizarTela();

    expect(screen.getByLabelText(ROTULO_QUADRO)).toBeOnTheScreen();
    expect(screen.getByText('Assine aqui com a caneta')).toBeOnTheScreen();
    expect(botaoRecusar()).toBeOnTheScreen();
    expect(botaoAssinar()).toBeDisabled();
  });

  it('entrega a assinatura com quem assina e a versão do termo', async () => {
    const user = userEvent.setup();
    const { aoAssinar } = renderizarTela();

    await user.press(screen.getByRole('radio', { name: 'Responsável legal' }));
    await assinar();
    await user.press(botaoAssinar());

    expect(aoAssinar).toHaveBeenCalledTimes(1);
    const [assinatura, contexto] = aoAssinar.mock.calls[0];
    expect(assinatura.tracos).toHaveLength(1);
    expect(contexto).toEqual({ quemAssina: 'responsavel_legal', versaoTermo: TERMO_TCLE.versao });
  });

  it('entrega a recusa com quem assina e a versão do termo', async () => {
    const user = userEvent.setup();
    const { aoRecusar } = renderizarTela();

    await user.press(botaoRecusar());
    await user.press(screen.getByRole('button', { name: 'Confirmar recusa' }));

    expect(aoRecusar).toHaveBeenCalledWith({
      quemAssina: 'paciente',
      versaoTermo: TERMO_TCLE.versao,
    });
  });

  it('exige o DecisaoTermoProvider em volta da área de assinatura', () => {
    const erro = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<AreaAssinatura />)).toThrow('DecisaoTermoProvider');

    erro.mockRestore();
  });
});
