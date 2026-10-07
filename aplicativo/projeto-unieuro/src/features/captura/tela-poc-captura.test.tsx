import 'react-native-gesture-handler/jestSetup';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PointerType, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';
import TelaPocCaptura from '@/features/captura/tela-poc-captura';

// O Reanimated e o Worklets dependem de módulos nativos. Os substitutos que os
// próprios pacotes oferecem rodam os worklets na mesma thread do teste, então o
// descompasso entre as threads do aparelho não aparece aqui.
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));

// O Skia desenha em código nativo, que não existe no Jest. O substituto
// renderiza o quadro sem pixels. Ele só chama a montagem do caminho na
// renderização, quando ainda não há ponto em andamento: o desenho do traço em
// andamento só é verificado no aparelho.
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Path: 'Path',
  Skia: { Path: { MakeFromSVGString: (svg: string) => ({ svg }) } },
  usePathValue: (montar: (construtor: unknown) => void) => {
    const construtor = { moveTo: jest.fn(), lineTo: jest.fn() };
    montar(construtor);
    return { value: construtor };
  },
}));

jest.mock('@/features/captura/imagem-desenho', () => ({
  ...jest.requireActual('@/features/captura/imagem-desenho'),
  gerarImagemDesenho: jest.fn(() => ({
    pngQuadro: 'quadro',
    pngModelo: 'modelo',
    cinza: new Float32Array(224 * 224),
    lado: 224,
  })),
}));

const dadosDaCaneta = { pressure: 0.6, tiltX: 12, tiltY: -3, azimuthAngle: 0, altitudeAngle: 1 };

// Cada leitura do relógio avança 10 ms, então os pontos chegam a 100 por segundo.
let relogio = 0;
let tracosDesenhados = 0;
beforeEach(() => {
  relogio = 1_000;
  tracosDesenhados = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => (relogio += 10));
});

afterEach(() => {
  jest.restoreAllMocks();
});

function medirQuadro() {
  fireEvent(screen.getByLabelText('Quadro de desenho'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 600 } },
  });
}

function desenhar(pontos: [number, number][], ponteiro = PointerType.STYLUS) {
  const caneta = ponteiro === PointerType.STYLUS ? { stylusData: dadosDaCaneta } : {};
  const [primeiro, ...resto] = pontos;
  fireGestureHandler(getByGestureTestId('quadro-desenho'), [
    { state: State.BEGAN, x: primeiro[0], y: primeiro[1], pointerType: ponteiro, ...caneta },
    ...resto.map(([x, y]) => ({ state: State.ACTIVE, x, y, pointerType: ponteiro, ...caneta })),
    { state: State.END, x: pontos.at(-1)![0], y: pontos.at(-1)![1], pointerType: ponteiro },
  ]);
}

/** Desenha e espera o traço chegar ao registro, que é atualizado fora do gesto. */
async function desenharEAguardar(pontos: [number, number][], ponteiro?: PointerType) {
  desenhar(pontos, ponteiro);
  tracosDesenhados += 1;
  await waitFor(() =>
    expect(screen.getByText(new RegExp(`em ${tracosDesenhados} traços registrados$`))).toBeTruthy(),
  );
}

function botao(nome: string) {
  return screen.getByRole('button', { name: nome });
}

describe('prova de conceito da captura do traçado', () => {
  it('começa sem traços, com as ações desabilitadas', () => {
    render(<TelaPocCaptura />);

    expect(screen.getByText('0 pontos em 0 traços registrados')).toBeTruthy();
    expect(screen.getByText('Ponteiro: nenhum ainda')).toBeTruthy();
    expect(botao('Desfazer')).toBeDisabled();
    expect(botao('Apagar tudo')).toBeDisabled();
    expect(botao('Gerar imagem')).toBeDisabled();
  });

  it('registra um traço de caneta com os pontos, a frequência, a pressão e o ponteiro', async () => {
    render(<TelaPocCaptura />);

    await desenharEAguardar([
      [10, 10],
      [20, 20],
      [30, 30],
    ]);

    expect(screen.getByText('3 pontos em 1 traços registrados')).toBeTruthy();
    expect(screen.getByText('1 traços valem no desenho')).toBeTruthy();
    expect(screen.getByText('Amostragem: 100 pontos por segundo')).toBeTruthy();
    expect(screen.getByText('Pressão: informada pelo aparelho')).toBeTruthy();
    expect(screen.getByText('Ponteiro: caneta')).toBeTruthy();
    expect(botao('Desfazer')).toBeEnabled();
  });

  it('indica quando o aparelho não informa a pressão, como no traço com o dedo', async () => {
    render(<TelaPocCaptura />);

    await desenharEAguardar([[5, 5]], PointerType.TOUCH);

    expect(screen.getByText('Pressão: não informada')).toBeTruthy();
    expect(screen.getByText('Ponteiro: dedo')).toBeTruthy();
  });

  it('desfazer o último traço: só ele deixa de valer, e o registro continua com os pontos', async () => {
    render(<TelaPocCaptura />);
    await desenharEAguardar([
      [10, 10],
      [20, 20],
    ]);
    await desenharEAguardar([
      [50, 50],
      [60, 60],
    ]);

    fireEvent.press(botao('Desfazer'));

    expect(screen.getByText('1 traços valem no desenho')).toBeTruthy();
    expect(screen.getByText('4 pontos em 2 traços registrados')).toBeTruthy();
  });

  it('refazer o desenho: apagar tudo descarta os traços e desabilita as ações', async () => {
    render(<TelaPocCaptura />);
    await desenharEAguardar([
      [10, 10],
      [20, 20],
    ]);

    fireEvent.press(botao('Apagar tudo'));

    expect(screen.getByText('0 traços valem no desenho')).toBeTruthy();
    expect(botao('Apagar tudo')).toBeDisabled();
    expect(botao('Gerar imagem')).toBeDisabled();
  });

  it('gera a imagem com os pontos no tempo da tarefa e a inclinação da caneta', async () => {
    render(<TelaPocCaptura />);
    medirQuadro();
    await desenharEAguardar([
      [10, 10],
      [20, 20],
    ]);

    fireEvent.press(botao('Gerar imagem'));

    const [[tracos, quadro]] = jest.mocked(gerarImagemDesenho).mock.calls;
    expect(quadro).toEqual({ largura: 800, altura: 600 });
    expect(tracos).toHaveLength(1);
    const [primeiro] = tracos[0];
    expect(primeiro).toMatchObject({
      x: 10,
      y: 10,
      pressao: 0.6,
      inclinacaoX: 12,
      inclinacaoY: -3,
    });
    // O instante conta a partir da abertura da tarefa, e não do relógio do aparelho.
    expect(primeiro.instante).toBeGreaterThan(0);
    expect(primeiro.instante).toBeLessThan(1_000);
    expect(screen.getByLabelText('Imagem para o modelo, 224 por 224 pixels')).toBeTruthy();
  });

  it('desfazer antes de gerar: só os traços que valem vão para a imagem', async () => {
    render(<TelaPocCaptura />);
    medirQuadro();
    await desenharEAguardar([
      [10, 10],
      [20, 20],
    ]);
    await desenharEAguardar([
      [50, 50],
      [60, 60],
    ]);

    fireEvent.press(botao('Desfazer'));
    fireEvent.press(botao('Gerar imagem'));

    const [[tracos]] = jest.mocked(gerarImagemDesenho).mock.calls;
    expect(tracos).toHaveLength(1);
    expect(tracos[0].map(({ x, y }) => [x, y])).toEqual([
      [10, 10],
      [20, 20],
    ]);
  });

  it('não gera a imagem antes de saber o tamanho do quadro', async () => {
    render(<TelaPocCaptura />);
    await desenharEAguardar([[10, 10]]);

    expect(botao('Gerar imagem')).toBeDisabled();
  });

  it('mostra uma mensagem fixa, sem o motivo técnico, quando a imagem não pode ser gerada', async () => {
    jest.mocked(gerarImagemDesenho).mockImplementationOnce(() => {
      throw new Error('Não foi possível ler os pixels da imagem do desenho.');
    });
    render(<TelaPocCaptura />);
    medirQuadro();
    await desenharEAguardar([[10, 10]]);

    fireEvent.press(botao('Gerar imagem'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível gerar a imagem do desenho. Tente de novo.',
    );
    expect(screen.queryByText(/ler os pixels/)).toBeNull();
  });

  it('apaga a prévia quando o desenho muda depois de gerar a imagem', async () => {
    render(<TelaPocCaptura />);
    medirQuadro();
    await desenharEAguardar([[10, 10]]);
    fireEvent.press(botao('Gerar imagem'));

    fireEvent.press(botao('Desfazer'));

    expect(screen.queryByLabelText('Imagem para o modelo, 224 por 224 pixels')).toBeNull();
  });
});
