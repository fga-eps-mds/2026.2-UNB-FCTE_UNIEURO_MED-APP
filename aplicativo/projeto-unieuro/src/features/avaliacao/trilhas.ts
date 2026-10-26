import type { Dimensoes } from '@/features/captura/quadro-desenho';

export type CirculoDasTrilhas = { rotulo: string; x: number; y: number };

export const RAIO_CIRCULO = 24;

export const CIRCULOS_DAS_TRILHAS: readonly CirculoDasTrilhas[] = [
  { rotulo: '1', x: 0.42, y: 0.45 },
  { rotulo: 'A', x: 0.59, y: 0.1 },
  { rotulo: '2', x: 0.68, y: 0.38 },
  { rotulo: 'B', x: 0.56, y: 0.38 },
  { rotulo: '3', x: 0.67, y: 0.72 },
  { rotulo: 'C', x: 0.44, y: 0.88 },
  { rotulo: '4', x: 0.54, y: 0.67 },
  { rotulo: 'D', x: 0.36, y: 0.7 },
  { rotulo: '5', x: 0.33, y: 0.31 },
  { rotulo: 'E', x: 0.44, y: 0.12 },
];

/** Centro de cada círculo nas coordenadas do quadro, as mesmas dos traços. */
export function posicionarCirculos({ largura, altura }: Dimensoes): CirculoDasTrilhas[] {
  return CIRCULOS_DAS_TRILHAS.map(({ rotulo, x, y }) => ({
    rotulo,
    x: x * largura,
    y: y * altura,
  }));
}
