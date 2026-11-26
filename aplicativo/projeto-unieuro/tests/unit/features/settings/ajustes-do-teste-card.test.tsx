import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import {
  AjustesDoTesteProvider,
  type AjustesDoTesteStore,
} from '@/features/acessibilidade/ajustes-do-teste';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import InstructionScreen from '@/features/avaliacao/instruction-screen';
import { createAjustesStore, type Armazenamento } from '@/features/acessibilidade/ajustes-store';
import { CORES_ALTO_CONTRASTE, useTemaDoPaciente } from '@/features/avaliacao/tema-do-paciente';
import {
  AjustesDoTesteCard,
  DESCRICAO_AJUSTES,
  TITULO_AJUSTES,
} from '@/features/settings/ajustes-do-teste-card';
import { createSettingsStyles } from '@/features/settings/settings.styles';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 1280, height: 800, scale: 1, fontScale: 1 })),
}));

const ana: SessionProfessional = {
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
};

const styles = createSettingsStyles(Colors.light);

/** Mostra o que as telas do paciente vão usar, para conferir o efeito do cartão. */
function TemaAtual() {
  const { cores, escala } = useTemaDoPaciente();
  return <Text>{`texto:${cores.text} escala:${escala}`}</Text>;
}

function renderizar(store?: AjustesDoTesteStore) {
  render(
    <AjustesDoTesteProvider store={store}>
      <AjustesDoTesteCard styles={styles} />
      <TemaAtual />
    </AjustesDoTesteProvider>,
  );
}

const interruptor = (nome: string) => screen.getByRole('switch', { name: nome });

describe('cartão "Ajustes do teste" das configurações (#24)', () => {
  it('mostra os dois ajustes, desligados por padrão, com o que cada um faz', () => {
    renderizar();

    expect(screen.getByRole('header', { name: TITULO_AJUSTES })).toBeOnTheScreen();
    expect(screen.getByText(DESCRICAO_AJUSTES)).toBeOnTheScreen();
    expect(interruptor('Alto contraste')).not.toBeChecked();
    expect(interruptor('Letras maiores')).not.toBeChecked();
    expect(interruptor('Alto contraste').props.accessibilityHint).toBe(
      'Cores mais fortes nas instruções e botões.',
    );
  });

  it('o leitor de tela encontra um interruptor por ajuste, sem repetir a explicação', () => {
    renderizar();

    // O Switch de dentro da linha fica escondido: só a linha é anunciada.
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(screen.getAllByHintText('Cores mais fortes nas instruções e botões.')).toHaveLength(1);
  });

  it('arrastar o próprio interruptor também liga o ajuste', () => {
    renderizar();

    fireEvent(
      screen.getByTestId('interruptor-altoContraste', { includeHiddenElements: true }),
      'valueChange',
      true,
    );

    expect(interruptor('Alto contraste')).toBeChecked();
  });

  it('Cenário: alto contraste: ligar nas configurações muda as cores das telas do paciente', () => {
    renderizar();

    fireEvent.press(interruptor('Alto contraste'));

    expect(interruptor('Alto contraste')).toBeChecked();
    expect(screen.getByText(`texto:${CORES_ALTO_CONTRASTE.text} escala:1`)).toBeOnTheScreen();
  });

  it('Cenário: fonte ampliada: ligar as letras maiores aumenta o texto, sem mexer nas cores', () => {
    renderizar();

    fireEvent.press(interruptor('Letras maiores'));

    expect(screen.getByText(`texto:${Colors.light.text} escala:1.25`)).toBeOnTheScreen();
  });

  it('desligar um ajuste não muda o outro', () => {
    renderizar();
    fireEvent.press(interruptor('Alto contraste'));
    fireEvent.press(interruptor('Letras maiores'));

    fireEvent.press(interruptor('Alto contraste'));

    expect(screen.getByText(`texto:${Colors.light.text} escala:1.25`)).toBeOnTheScreen();
  });

  it('a escolha vai para o armazenamento do tablet', () => {
    const store: AjustesDoTesteStore = {
      carregar: jest.fn(async () => null),
      salvar: jest.fn(async () => undefined),
    };
    renderizar(store);

    fireEvent.press(interruptor('Letras maiores'));

    expect(store.salvar).toHaveBeenCalledWith({ altoContraste: false, letrasMaiores: true });
  });

  it('a escolha volta depois de fechar e abrir o aplicativo', async () => {
    const guardado = new Map<string, string>();
    const tablet: Armazenamento = {
      get: async (chave) => guardado.get(chave) ?? null,
      set: async (chave, valor) => {
        guardado.set(chave, valor);
      },
    };
    renderizar(createAjustesStore(tablet));
    await act(async () => {});
    fireEvent.press(interruptor('Letras maiores'));
    await act(async () => {});
    screen.unmount();

    // Um provider novo, como na próxima abertura do aplicativo, lendo o mesmo tablet.
    renderizar(createAjustesStore(tablet));

    await waitFor(() => expect(interruptor('Letras maiores')).toBeChecked());
    expect(interruptor('Alto contraste')).not.toBeChecked();
  });
});

describe('Cenário: configuração durante o teste', () => {
  it('o que o profissional liga nas configurações aparece na instrução do paciente', () => {
    render(
      <SessionProvider initialProfessional={ana}>
        <AjustesDoTesteProvider>
          <AjustesDoTesteCard styles={styles} />
          <InstructionScreen tarefa="1" atendimento="12" onStart={jest.fn()} />
        </AjustesDoTesteProvider>
      </SessionProvider>,
    );

    fireEvent.press(interruptor('Alto contraste'));
    fireEvent.press(interruptor('Letras maiores'));

    const titulo = StyleSheet.flatten(
      screen.getByRole('header', { name: 'Desenhe um relógio' }).props.style,
    );
    expect(titulo.color).toBe(CORES_ALTO_CONTRASTE.text);
    expect(titulo.fontSize).toBe(60);
  });
});
