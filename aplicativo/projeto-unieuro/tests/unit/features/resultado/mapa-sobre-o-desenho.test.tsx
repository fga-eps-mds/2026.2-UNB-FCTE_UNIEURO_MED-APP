import { fireEvent, render, screen } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import type { MapaDoDesenho } from '@/features/resultado/mapa-do-desenho';
import {
  COMO_LER_O_MAPA,
  LEGENDA_CCL,
  LEGENDA_SEM_CCL,
  MapaSobreODesenho,
  ONDE_PESOU,
} from '@/features/resultado/mapa-sobre-o-desenho';
import {
  COR_PUXA_CCL,
  COR_PUXA_SEM_CCL,
  createResultadoStyles,
} from '@/features/resultado/resultado.styles';

const styles = createResultadoStyles(Colors.light);
const DESTAQUE =
  'O trecho que mais puxou o escore para CCL fica na parte de cima, à esquerda do desenho.';

// Imagem duas vezes mais larga que alta.
const MAPA: MapaDoDesenho = {
  proporcao: 2,
  destaque: DESTAQUE,
  regioes: [
    { esquerda: 0.25, topo: 0.5, largura: 0.1, altura: 0.2, intensidade: 1, puxaPara: 'ccl' },
    { esquerda: 0, topo: 0, largura: 0.1, altura: 0.1, intensidade: 0, puxaPara: 'sem-ccl' },
  ],
};

function renderizar() {
  render(
    <MapaSobreODesenho
      titulo="Relógio"
      imagem="data:image/png;base64,AA=="
      mapa={MAPA}
      styles={styles}
    />,
  );
  return screen.getByLabelText(`Desenho: Relógio. ${DESTAQUE}`);
}

// O Skia é um dublê no Jest (jest.setup.ts), e cada mancha aparece como um elemento `Oval`.
const manchas = () =>
  screen.UNSAFE_root.findAll((no) => (no.type as string) === 'Oval', { deep: true });

const medir = (largura: number, altura: number) =>
  fireEvent(screen.getByTestId('mapa-do-desenho'), 'layout', {
    nativeEvent: { layout: { width: largura, height: altura } },
  });

describe('mapa sobre o desenho na tela do resultado (#14)', () => {
  it('descreve em texto onde o desenho pesou, também para o leitor de tela', () => {
    renderizar();

    expect(screen.getByText(ONDE_PESOU)).toBeOnTheScreen();
    expect(screen.getByText(DESTAQUE)).toBeOnTheScreen();
    expect(screen.getByText(LEGENDA_CCL)).toBeOnTheScreen();
    expect(screen.getByText(LEGENDA_SEM_CCL)).toBeOnTheScreen();
    expect(screen.getByText(COMO_LER_O_MAPA)).toBeOnTheScreen();
  });

  it('só põe as regiões depois de medir a área da imagem', () => {
    renderizar();

    expect(manchas()).toHaveLength(0);
  });

  it('centra cada mancha na sua região da imagem, que sobra na altura da caixa', () => {
    renderizar();

    // Caixa de 400 × 300: a imagem ocupa 400 × 200, com 50 px livres em cima e embaixo. A região
    // para CCL ocupa 40 × 40 px a partir de (100, 150), e a mancha é 1,6 vez maior, no mesmo centro.
    medir(400, 300);

    const [paraCcl, paraSemCcl] = manchas();
    expect(paraCcl.props).toMatchObject({
      x: 88,
      y: 138,
      width: 64,
      height: 64,
      opacity: 0.7,
      color: COR_PUXA_CCL,
    });
    // A região sem CCL tem 40 × 20 px a partir de (0, 50).
    expect(paraSemCcl.props).toMatchObject({
      x: -12,
      y: 44,
      width: 64,
      height: 32,
      opacity: 0.25,
      color: COR_PUXA_SEM_CCL,
    });
  });

  it('centra cada mancha na sua região da imagem, que sobra na largura da caixa', () => {
    renderizar();

    // Caixa de 400 × 100: a imagem ocupa 200 × 100, com 100 px livres de cada lado. A região para
    // CCL tem 20 × 20 px a partir de (150, 50).
    medir(400, 100);

    const [paraCcl] = manchas();
    expect(paraCcl.props).toMatchObject({ x: 144, y: 44, width: 32, height: 32 });
  });
});
