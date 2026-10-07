import { Skia } from '@shopify/react-native-skia';

import type { Traco } from '@/features/captura/eventos-tracado';
import {
  calcularEnquadramento,
  gerarImagemDesenho,
  LADO_IMAGEM_MODELO,
  rgbaParaCinza,
} from '@/features/captura/imagem-desenho';

// O Skia desenha em código nativo, que não existe no Jest. O substituto
// registra o que seria desenhado e devolve pixels brancos na leitura.
jest.mock('@shopify/react-native-skia', () => {
  const criarSuperficie = jest.fn((largura: number, altura: number) => {
    const tela = {
      clear: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      drawPath: jest.fn(),
    };
    return {
      largura,
      altura,
      tela,
      getCanvas: () => tela,
      flush: jest.fn(),
      makeImageSnapshot: () => ({
        encodeToBase64: () => `png-${largura}x${altura}`,
        readPixels: jest.fn(() => new Uint8Array(largura * altura * 4).fill(255)),
      }),
    };
  });
  return {
    AlphaType: { Unpremul: 3 },
    ColorType: { RGBA_8888: 4 },
    ImageFormat: { PNG: 4 },
    PaintStyle: { Stroke: 1 },
    StrokeCap: { Round: 1 },
    StrokeJoin: { Round: 1 },
    Skia: {
      Surface: { MakeOffscreen: criarSuperficie },
      Color: (cor: string) => cor,
      Paint: () => ({
        setColor: jest.fn(),
        setStyle: jest.fn(),
        setStrokeWidth: jest.fn(),
        setStrokeCap: jest.fn(),
        setStrokeJoin: jest.fn(),
        setAntiAlias: jest.fn(),
      }),
      Path: { MakeFromSVGString: jest.fn((svg: string) => (svg ? { svg } : null)) },
    },
  };
});

const criarSuperficie = Skia.Surface.MakeOffscreen as unknown as jest.Mock;

function superficiesCriadas() {
  return criarSuperficie.mock.results.map((resultado) => resultado.value);
}

const tracos: Traco[] = [
  [
    { x: 10, y: 10, instante: 0 },
    { x: 50, y: 10, instante: 16 },
  ],
  [{ x: 30, y: 40, instante: 400 }],
];

describe('enquadramento da imagem do modelo', () => {
  it('quadro deitado: ocupa toda a largura e centraliza na altura, sem cortar', () => {
    const { escala, deslocamentoX, deslocamentoY } = calcularEnquadramento(
      { largura: 1280, altura: 800 },
      224,
    );

    expect(escala).toBeCloseTo(0.175);
    expect(deslocamentoX).toBeCloseTo(0);
    expect(deslocamentoY).toBeCloseTo((224 - 800 * 0.175) / 2);
  });

  it('quadro em pé: ocupa toda a altura e centraliza na largura, sem cortar', () => {
    const { escala, deslocamentoX, deslocamentoY } = calcularEnquadramento(
      { largura: 800, altura: 1280 },
      224,
    );

    expect(escala).toBeCloseTo(0.175);
    expect(deslocamentoX).toBeCloseTo((224 - 800 * 0.175) / 2);
    expect(deslocamentoY).toBeCloseTo(0);
  });

  it('recusa dimensões vazias', () => {
    expect(() => calcularEnquadramento({ largura: 0, altura: 800 }, 224)).toThrow(
      'precisam ser positivas',
    );
  });
});

describe('conversão para tons de cinza', () => {
  it('converte branco em 1, preto em 0 e cores pela luminância', () => {
    const pixels = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]);

    const cinza = rgbaParaCinza(pixels);

    expect(cinza).toHaveLength(3);
    expect(cinza[0]).toBeCloseTo(1);
    expect(cinza[1]).toBeCloseTo(0);
    expect(cinza[2]).toBeCloseTo(0.299);
  });

  it('recusa lista que não tem quatro canais por pixel', () => {
    expect(() => rgbaParaCinza(new Uint8Array(5))).toThrow('quatro canais');
  });
});

describe('geração da imagem do desenho', () => {
  it('gera a imagem do quadro no tamanho desenhado e a do modelo no lado padrão', () => {
    const imagem = gerarImagemDesenho(tracos, { largura: 1280, altura: 800 });

    expect(criarSuperficie).toHaveBeenNthCalledWith(1, 1280, 800);
    expect(criarSuperficie).toHaveBeenNthCalledWith(2, LADO_IMAGEM_MODELO, LADO_IMAGEM_MODELO);
    expect(imagem.pngQuadro).toBe('png-1280x800');
    expect(imagem.pngModelo).toBe(`png-${LADO_IMAGEM_MODELO}x${LADO_IMAGEM_MODELO}`);
    expect(imagem.lado).toBe(LADO_IMAGEM_MODELO);
  });

  it('desenha cada traço que vale nas duas imagens, com o enquadramento sem corte', () => {
    gerarImagemDesenho(tracos, { largura: 1280, altura: 800 });
    const [quadro, modelo] = superficiesCriadas();

    expect(quadro.tela.drawPath).toHaveBeenCalledTimes(2);
    expect(quadro.tela.scale).toHaveBeenCalledWith(1, 1);
    expect(modelo.tela.drawPath).toHaveBeenCalledTimes(2);
    expect(modelo.tela.scale).toHaveBeenCalledWith(0.175, 0.175);
    expect(modelo.tela.translate).toHaveBeenCalledWith(0, (224 - 140) / 2);
  });

  it('devolve os tons de cinza do modelo, um valor por pixel', () => {
    const imagem = gerarImagemDesenho(tracos, { largura: 640, altura: 400 }, 8);

    expect(imagem.cinza).toHaveLength(64);
    expect(Array.from(imagem.cinza).every((valor) => Math.abs(valor - 1) < 1e-6)).toBe(true);
  });

  it('avisa quando o aparelho não cria a superfície de desenho', () => {
    criarSuperficie.mockReturnValueOnce(null);

    expect(() => gerarImagemDesenho(tracos, { largura: 1280, altura: 800 })).toThrow(
      'Não foi possível criar a superfície',
    );
  });

  it('avisa quando os pixels da imagem do modelo não podem ser lidos', () => {
    const original = criarSuperficie.getMockImplementation()!;
    criarSuperficie
      .mockImplementationOnce(original)
      .mockImplementationOnce((largura: number, altura: number) => {
        const superficie = original(largura, altura);
        return {
          ...superficie,
          makeImageSnapshot: () => ({ encodeToBase64: () => '', readPixels: () => null }),
        };
      });

    expect(() => gerarImagemDesenho(tracos, { largura: 1280, altura: 800 })).toThrow(
      'Não foi possível ler os pixels',
    );
  });
});
