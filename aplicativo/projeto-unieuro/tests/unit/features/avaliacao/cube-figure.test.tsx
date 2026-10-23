import { Skia } from '@shopify/react-native-skia';
import { render, screen } from '@testing-library/react-native';

import {
  ALTURA_FIGURA,
  CubeFigure,
  LARGURA_FIGURA,
  arestasDoCubo,
  caminhoDoCubo,
} from '@/features/avaliacao/cube-figure';

const comprimento = ([[x1, y1], [x2, y2]]: ReturnType<typeof arestasDoCubo>[number]) =>
  Math.hypot(x2 - x1, y2 - y1);

describe('figura de modelo do cubo', () => {
  const arestas = arestasDoCubo();

  it('tem as 12 arestas do cubo, todas à vista, como o cubo de Necker do MoCA', () => {
    expect(arestas).toHaveLength(12);
    const distintas = new Set(arestas.map((a) => JSON.stringify([...a].sort())));
    expect(distintas.size).toBe(12);
  });

  it('liga 8 vértices, cada um a outros 3', () => {
    const grau = new Map<string, number>();
    for (const aresta of arestas) {
      for (const ponto of aresta) grau.set(String(ponto), (grau.get(String(ponto)) ?? 0) + 1);
    }
    expect(grau.size).toBe(8);
    expect([...grau.values()].every((n) => n === 3)).toBe(true);
  });

  it('tem as duas faces quadradas do mesmo tamanho e as quatro ligações paralelas', () => {
    const faces = arestas.slice(0, 8).map(comprimento);
    expect(new Set(faces)).toEqual(new Set([99]));

    const ligacoes = arestas.slice(8).map(([[x1, y1], [x2, y2]]) => [x2 - x1, y2 - y1]);
    expect(new Set(ligacoes.map(String)).size).toBe(1);
  });

  it('põe a face de trás acima e à direita da da frente, como no protótipo', () => {
    const [[[x1, y1], [x2, y2]]] = arestas.slice(8);
    expect(x2).toBeGreaterThan(x1);
    expect(y2).toBeLessThan(y1);
  });

  it('cabe inteira na figura, sem encostar na borda', () => {
    const pontos = arestas.flat();
    for (const [x, y] of pontos) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(LARGURA_FIGURA);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(ALTURA_FIGURA);
    }
  });

  it('monta um segmento do caminho SVG por aresta', () => {
    const caminho = caminhoDoCubo([
      [
        [0, 0],
        [10, 5],
      ],
    ]);
    expect(caminho).toBe('M 0 0 L 10 5');
    expect(caminhoDoCubo().match(/M /g)).toHaveLength(12);
  });

  it('aparece para o leitor de tela como a imagem do cubo a copiar', () => {
    render(<CubeFigure />);

    expect(screen.getByRole('image', { name: 'Cubo para copiar' })).toBeOnTheScreen();
    expect(Skia.Path.MakeFromSVGString).toHaveBeenCalledWith(caminhoDoCubo());
  });

  it('não desenha nada se o Skia não montar o caminho', () => {
    jest.mocked(Skia.Path.MakeFromSVGString).mockReturnValueOnce(null);
    const { toJSON } = render(<CubeFigure />);

    expect(JSON.stringify(toJSON())).not.toContain('"Path"');
  });
});
