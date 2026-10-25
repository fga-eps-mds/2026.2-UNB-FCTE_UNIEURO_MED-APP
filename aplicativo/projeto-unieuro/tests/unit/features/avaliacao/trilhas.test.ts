import {
  CIRCULOS_DAS_TRILHAS,
  RAIO_CIRCULO,
  posicionarCirculos,
} from '@/features/avaliacao/trilhas';

// Tamanho do quadro no protótipo das trilhas, em 1280 × 800.
const QUADRO_DO_PROTOTIPO = { largura: 1196, altura: 540 };

describe('Cenário: trilhas', () => {
  it('tem os círculos de 1 a 5 e de A a E, na ordem em que o paciente os liga', () => {
    expect(CIRCULOS_DAS_TRILHAS.map(({ rotulo }) => rotulo)).toEqual([
      '1',
      'A',
      '2',
      'B',
      '3',
      'C',
      '4',
      'D',
      '5',
      'E',
    ]);
  });

  it('guarda as posições de 0 a 1, relativas ao quadro', () => {
    for (const { x, y } of CIRCULOS_DAS_TRILHAS) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
  });

  it('põe cada círculo na escala do quadro, a mesma dos traços', () => {
    const [primeiro] = posicionarCirculos({ largura: 1000, altura: 500 });

    expect(primeiro).toEqual({ rotulo: '1', x: 420, y: 225 });
  });

  it('cabe inteiro no quadro do protótipo, sem encostar na borda', () => {
    for (const { x, y } of posicionarCirculos(QUADRO_DO_PROTOTIPO)) {
      expect(x - RAIO_CIRCULO).toBeGreaterThan(0);
      expect(x + RAIO_CIRCULO).toBeLessThan(QUADRO_DO_PROTOTIPO.largura);
      expect(y - RAIO_CIRCULO).toBeGreaterThan(0);
      expect(y + RAIO_CIRCULO).toBeLessThan(QUADRO_DO_PROTOTIPO.altura);
    }
  });

  it('não sobrepõe dois círculos no quadro do protótipo', () => {
    const circulos = posicionarCirculos(QUADRO_DO_PROTOTIPO);

    for (const [i, a] of circulos.entries()) {
      for (const b of circulos.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * RAIO_CIRCULO);
      }
    }
  });
});
