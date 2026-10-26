import { Skia } from '@shopify/react-native-skia';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import {
  QuadroDesenho,
  montarCaminho,
  type QuadroDesenhoProps,
} from '@/features/captura/quadro-desenho';

import {
  DADOS_DA_CANETA,
  PointerType,
  desenharNoQuadro,
  medirQuadro,
} from '../../../test-support/desenho';

// Cada leitura do relógio avança 10 ms, então os pontos chegam a 100 por segundo.
let relogio: jest.SpyInstance<number, []>;
let agora = 0;

beforeEach(() => {
  agora = 1_000;
  relogio = jest.spyOn(Date, 'now').mockImplementation(() => (agora += 10));
});

afterEach(() => {
  relogio.mockRestore();
});

function renderQuadro(props: Partial<QuadroDesenhoProps> = {}) {
  const onTracoConcluido = jest.fn();
  const onDimensoes = jest.fn();
  render(
    <QuadroDesenho
      tracos={[]}
      onTracoConcluido={onTracoConcluido}
      onDimensoes={onDimensoes}
      {...props}
    />,
  );
  return { onTracoConcluido, onDimensoes };
}

const coordenadas = (pontos: { x: number; y: number }[]) => pontos.map(({ x, y }) => [x, y]);

describe('QuadroDesenho', () => {
  // O traço em andamento é montado na thread de UI a cada ponto, sem passar pelo
  // JavaScript. O que o teste confere é esse desenho: a tela só recebe o traço
  // quando ele termina. O atraso percebido só se mede no aparelho.
  it('traço na hora: entrega o traço inteiro de uma vez, só quando ele termina', async () => {
    const { onTracoConcluido } = renderQuadro();

    await desenharNoQuadro([
      [10, 10],
      [20, 20],
      [30, 30],
    ]);

    expect(onTracoConcluido).toHaveBeenCalledTimes(1);
    const [pontos, ponteiro] = onTracoConcluido.mock.calls[0];
    expect(ponteiro).toBe('caneta');
    expect(coordenadas(pontos)).toEqual([
      [10, 10],
      [20, 20],
      [30, 30],
    ]);
  });

  it('guarda a pressão e a inclinação da caneta em cada ponto, no relógio do aparelho', async () => {
    const { onTracoConcluido } = renderQuadro();

    await desenharNoQuadro([
      [10, 10],
      [20, 20],
    ]);

    const [pontos] = onTracoConcluido.mock.calls[0];
    for (const ponto of pontos) {
      expect(ponto).toMatchObject({
        pressao: DADOS_DA_CANETA.pressure,
        inclinacaoX: DADOS_DA_CANETA.tiltX,
        inclinacaoY: DADOS_DA_CANETA.tiltY,
      });
      expect(ponto.instante).toBeGreaterThan(1_000);
    }
    expect(pontos[1].instante).toBeGreaterThan(pontos[0].instante);
  });

  it('com o dedo, registra o ponteiro sem inventar pressão nem inclinação', async () => {
    const { onTracoConcluido } = renderQuadro();

    await desenharNoQuadro(
      [
        [5, 5],
        [6, 6],
      ],
      PointerType.TOUCH,
    );

    const [pontos, ponteiro] = onTracoConcluido.mock.calls[0];
    expect(ponteiro).toBe('dedo');
    expect(pontos[0]).not.toHaveProperty('pressao');
    expect(pontos[0]).not.toHaveProperty('inclinacaoX');
  });

  it('dois traços seguidos: cada um começa no próprio primeiro ponto', async () => {
    const { onTracoConcluido } = renderQuadro();

    await desenharNoQuadro([
      [10, 10],
      [20, 20],
    ]);
    await desenharNoQuadro([
      [50, 50],
      [60, 60],
    ]);

    expect(onTracoConcluido).toHaveBeenCalledTimes(2);
    expect(coordenadas(onTracoConcluido.mock.calls[1][0])).toEqual([
      [50, 50],
      [60, 60],
    ]);
  });

  it('informa o tamanho do quadro quando ele aparece na tela', () => {
    const { onDimensoes } = renderQuadro();

    medirQuadro(800, 600);

    expect(onDimensoes).toHaveBeenCalledWith({ largura: 800, altura: 600 });
  });

  it('desenha os traços recebidos e não manda traço vazio ao Skia', () => {
    renderQuadro({
      tracos: [
        [
          { x: 1, y: 1, instante: 0 },
          { x: 2, y: 2, instante: 10 },
        ],
        [],
      ],
    });

    expect(Skia.Path.MakeFromSVGString).toHaveBeenCalledTimes(1);
    expect(Skia.Path.MakeFromSVGString).toHaveBeenCalledWith('M1 1 L2 2');
  });

  it('desabilitado: continua na tela, mas não aceita traço novo', async () => {
    const { onTracoConcluido } = renderQuadro({ desabilitado: true });

    await desenharNoQuadro([
      [10, 10],
      [20, 20],
    ]);

    expect(onTracoConcluido).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Quadro de desenho')).toBeDisabled();
  });

  it('na assinatura do TCLE, usa o nome e a dica informados para o leitor de tela', () => {
    renderQuadro({ rotulo: 'Área de assinatura', dica: 'Assine com a caneta' });

    expect(screen.getByLabelText('Área de assinatura')).toBeOnTheScreen();
    expect(screen.getByHintText('Assine com a caneta')).toBeOnTheScreen();
  });

  it('trilhas: desenha o fundo dentro da área, por baixo dos traços', () => {
    // No aparelho o fundo são elementos do Skia, como os círculos numerados; aqui
    // qualquer elemento serve para conferir onde ele entra.
    renderQuadro({
      fundo: <View testID="circulos-das-trilhas" />,
      tracos: [
        [
          { x: 1, y: 1, instante: 0 },
          { x: 2, y: 2, instante: 10 },
        ],
      ],
    });

    const [primeiro] = screen.UNSAFE_getByType('Canvas' as never).props.children;
    expect(primeiro.props.testID).toBe('circulos-das-trilhas');
  });

  it('segue a área de desenho do guia de identidade visual', () => {
    renderQuadro();

    expect(screen.getByTestId('moldura-quadro-desenho')).toHaveStyle({
      backgroundColor: '#FFFFFF',
      borderColor: '#CBD5E1',
      borderRadius: 24,
      boxShadow: '0px 4px 16px rgba(15, 23, 41, 0.06)',
    });
  });

  it.each([
    [PointerType.MOUSE, 'mouse'],
    [PointerType.OTHER, 'desconhecido'],
  ])('identifica o ponteiro %s', async (tipo, esperado) => {
    const { onTracoConcluido } = renderQuadro();

    await desenharNoQuadro(
      [
        [1, 1],
        [2, 2],
      ],
      tipo,
    );

    expect(onTracoConcluido.mock.calls[0][1]).toBe(esperado);
  });
});

describe('traço em andamento', () => {
  const construtor = () => ({ moveTo: jest.fn(), lineTo: jest.fn() });

  it('liga os pontos em ordem a partir do primeiro', () => {
    const caminho = construtor();

    montarCaminho(caminho, [
      { x: 1, y: 1, instante: 0 },
      { x: 2, y: 3, instante: 10 },
      { x: 4, y: 5, instante: 20 },
    ]);

    expect(caminho.moveTo).toHaveBeenCalledWith(1, 1);
    expect(caminho.lineTo.mock.calls).toEqual([
      [2, 3],
      [4, 5],
    ]);
  });

  it('um toque sem arrasto vira um ponto, como segmento de comprimento zero', () => {
    const caminho = construtor();

    montarCaminho(caminho, [{ x: 7, y: 8, instante: 0 }]);

    expect(caminho.moveTo).toHaveBeenCalledWith(7, 8);
    expect(caminho.lineTo).toHaveBeenCalledWith(7, 8);
  });

  it('não desenha nada sem ponto', () => {
    const caminho = construtor();

    montarCaminho(caminho, []);

    expect(caminho.moveTo).not.toHaveBeenCalled();
  });
});
