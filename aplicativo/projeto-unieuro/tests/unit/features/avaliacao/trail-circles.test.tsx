import { matchFont } from '@shopify/react-native-skia';
import { render } from '@testing-library/react-native';

import { TAMANHO_ROTULO, TrailCircles } from '@/features/avaliacao/trail-circles';
import { RAIO_CIRCULO } from '@/features/avaliacao/trilhas';

const QUADRO = { largura: 1000, altura: 500 };

function elementos(tipo: string) {
  const { UNSAFE_root } = render(<TrailCircles dimensoes={QUADRO} />);
  return UNSAFE_root.findAll((no) => no.type === tipo, { deep: true });
}

describe('círculos das trilhas no quadro', () => {
  it('desenha os dez círculos, cada um com o fundo e o contorno', () => {
    const circulos = elementos('Circle');

    expect(circulos).toHaveLength(20);
    expect(circulos.every(({ props }) => props.r === RAIO_CIRCULO)).toBe(true);
  });

  it('escreve o rótulo de cada círculo, na ordem da sequência', () => {
    const rotulos = elementos('SkiaText').map(({ props }) => props.text);

    expect(rotulos).toEqual(['1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E']);
  });

  it('centraliza o rótulo no círculo', () => {
    const [circulo] = elementos('Circle');
    const [rotulo] = elementos('SkiaText');

    // O substituto do Skia mede todo rótulo com 12 de largura e 14 de altura.
    expect(rotulo.props.x).toBe(circulo.props.cx - 6);
    expect(rotulo.props.y).toBe(circulo.props.cy + 7);
  });

  it('usa a fonte do sistema com letra de tela do paciente', () => {
    render(<TrailCircles dimensoes={QUADRO} />);

    expect(matchFont).toHaveBeenCalledWith(expect.objectContaining({ fontSize: TAMANHO_ROTULO }));
    expect(TAMANHO_ROTULO).toBeGreaterThanOrEqual(20);
  });

  it('todos os círculos têm a mesma aparência', () => {
    const contornos = elementos('Circle').filter(({ props }) => props.style === 'stroke');

    expect(new Set(contornos.map(({ props }) => props.color)).size).toBe(1);
  });

  it('não desenha nada antes do quadro ser medido', () => {
    const { toJSON } = render(<TrailCircles dimensoes={null} />);

    expect(toJSON()).toBeNull();
  });
});
