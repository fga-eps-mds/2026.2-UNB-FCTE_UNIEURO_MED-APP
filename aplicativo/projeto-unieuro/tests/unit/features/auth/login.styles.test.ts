import { getLoginLayout } from '@/features/auth/login.styles';

/**
 * O aplicativo roda em tablet, mas precisa continuar legível em telas menores
 * durante o desenvolvimento. Estes testes fixam as faixas de tamanho.
 */
describe('getLoginLayout', () => {
  describe('corte entre telefone e tablet', () => {
    it('trata 699 pontos de largura como telefone', () => {
      expect(getLoginLayout(699, 1000).isTablet).toBe(false);
    });

    it('trata 700 pontos de largura como tablet', () => {
      expect(getLoginLayout(700, 1000).isTablet).toBe(true);
    });
  });

  describe('em telefone', () => {
    it('usa a inserção padrão a partir de 360 pontos', () => {
      expect(getLoginLayout(390, 844).horizontalInset).toBe(20);
    });

    it('reduz a inserção abaixo de 360 pontos', () => {
      expect(getLoginLayout(320, 568).horizontalInset).toBe(16);
    });

    it('reduz a fonte do título abaixo de 360 pontos', () => {
      expect(getLoginLayout(359, 568).titleFontSize).toBe(32);
      expect(getLoginLayout(360, 568).titleFontSize).toBe(36);
    });

    it('calcula o cartão descontando a inserção dos dois lados', () => {
      expect(getLoginLayout(390, 844).cardWidth).toBe(350);
    });

    it('limita a largura do cartão a 506 pontos', () => {
      expect(getLoginLayout(699, 1000).cardWidth).toBe(506);
    });
  });

  describe('em tablet', () => {
    it('limita a inserção a 40 pontos em telas largas', () => {
      expect(getLoginLayout(1024, 768).horizontalInset).toBe(40);
    });

    it('usa 5% da largura quando isso for menor que 40 pontos', () => {
      expect(getLoginLayout(700, 1000).horizontalInset).toBe(35);
    });

    it('limita a largura do cartão a 560 pontos', () => {
      expect(getLoginLayout(800, 1280).cardWidth).toBe(560);
    });

    it('aumenta logo e título', () => {
      const layout = getLoginLayout(800, 1280);

      expect(layout.logoSize).toBe(92);
      expect(layout.titleFontSize).toBe(42);
    });
  });

  describe('preenchimento do cartão', () => {
    it('limita o preenchimento vertical a 52 pontos em telas altas', () => {
      expect(getLoginLayout(390, 1200).cardVerticalPadding).toBe(52);
    });

    it('acompanha a altura em telas baixas', () => {
      expect(getLoginLayout(390, 568).cardVerticalPadding).toBeCloseTo(36.92, 2);
    });

    it('garante o mínimo de 28 pontos em telas muito baixas', () => {
      expect(getLoginLayout(390, 200).cardVerticalPadding).toBe(28);
    });
  });

  it('nunca devolve largura de cartão negativa', () => {
    expect(getLoginLayout(0, 0).cardWidth).toBe(0);
  });
});
