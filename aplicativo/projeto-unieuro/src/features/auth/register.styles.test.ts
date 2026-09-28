import { getRegisterLayout } from '@/features/auth/register.styles';
import { getLoginLayout } from '@/features/auth/login.styles';

describe('getRegisterLayout', () => {
  describe('corte entre telefone e tablet', () => {
    it('trata 679 pontos de largura como telefone', () => {
      expect(getRegisterLayout(679, 1000).isTablet).toBe(false);
    });

    it('trata 680 pontos de largura como tablet', () => {
      expect(getRegisterLayout(680, 1000).isTablet).toBe(true);
    });

    /**
     * O cadastro vira tablet em 680 pontos e o acesso só em 700. Entre as duas
     * larguras as telas usam disposições diferentes. Este teste registra a
     * diferença para que ela não passe despercebida: se for intencional, o
     * teste documenta; se não for, ele quebra quando alguém unificar o valor.
     */
    it('usa um corte menor que a tela de acesso', () => {
      expect(getRegisterLayout(690, 1000).isTablet).toBe(true);
      expect(getLoginLayout(690, 1000).isTablet).toBe(false);
    });
  });

  describe('em telefone', () => {
    it('reduz a inserção abaixo de 360 pontos', () => {
      expect(getRegisterLayout(320, 568).horizontalInset).toBe(16);
      expect(getRegisterLayout(390, 844).horizontalInset).toBe(20);
    });

    it('reduz a fonte do título abaixo de 360 pontos', () => {
      expect(getRegisterLayout(359, 568).titleFontSize).toBe(28);
      expect(getRegisterLayout(360, 568).titleFontSize).toBe(30);
    });

    it('limita a largura do cartão a 506 pontos', () => {
      expect(getRegisterLayout(679, 1000).cardWidth).toBe(506);
    });
  });

  describe('em tablet', () => {
    it('permite um cartão mais largo que o da tela de acesso', () => {
      expect(getRegisterLayout(900, 1280).cardWidth).toBe(720);
      expect(getLoginLayout(900, 1280).cardWidth).toBe(560);
    });

    it('limita a inserção a 40 pontos em telas largas', () => {
      expect(getRegisterLayout(1024, 768).horizontalInset).toBe(40);
    });

    it('limita o preenchimento horizontal a 44 pontos', () => {
      expect(getRegisterLayout(800, 1280).cardHorizontalPadding).toBe(44);
    });

    /**
     * O formulário de cadastro tem seis campos. O logo diminui no tablet para
     * abrir espaço, ao contrário do que acontece na tela de acesso.
     */
    it('usa um logo menor que o da tela de acesso', () => {
      expect(getRegisterLayout(800, 1280).logoSize).toBe(64);
      expect(getLoginLayout(800, 1280).logoSize).toBe(92);
    });
  });

  describe('preenchimento do cartão', () => {
    it('limita o preenchimento vertical a 48 pontos em telas altas', () => {
      expect(getRegisterLayout(390, 1200).cardVerticalPadding).toBe(48);
    });

    it('acompanha a altura em telas intermediárias', () => {
      expect(getRegisterLayout(390, 568).cardVerticalPadding).toBeCloseTo(31.24, 2);
    });

    it('garante o mínimo de 28 pontos em telas muito baixas', () => {
      expect(getRegisterLayout(390, 200).cardVerticalPadding).toBe(28);
    });
  });

  it('nunca devolve largura de cartão negativa', () => {
    expect(getRegisterLayout(0, 0).cardWidth).toBe(0);
  });
});
