import { Colors } from '@/constants/theme';
import {
  MAX_CONTENT_WIDTH,
  createNewAttendanceStyles,
  getNewAttendanceLayout,
} from '@/features/avaliacao/new-attendance.styles';

describe('getNewAttendanceLayout', () => {
  describe('corte entre tela estreita e tablet', () => {
    it('trata 759 pontos de largura como tela estreita', () => {
      expect(getNewAttendanceLayout(759, 1000).isWide).toBe(false);
    });

    it('trata 760 pontos de largura como tablet', () => {
      expect(getNewAttendanceLayout(760, 1000).isWide).toBe(true);
    });
  });

  describe('em tela estreita', () => {
    it('reduz a inserção abaixo de 360 pontos', () => {
      expect(getNewAttendanceLayout(320, 568).horizontalInset).toBe(16);
      expect(getNewAttendanceLayout(390, 844).horizontalInset).toBe(20);
    });

    it('usa título e preenchimento do cartão menores', () => {
      const layout = getNewAttendanceLayout(390, 844);

      expect(layout.titleFontSize).toBe(28);
      expect(layout.cardPadding).toBe(20);
    });

    it('ocupa a largura toda, descontada a inserção', () => {
      expect(getNewAttendanceLayout(390, 844).contentWidth).toBe(350);
    });
  });

  describe('em tablet', () => {
    it('acompanha a largura e limita a inserção a 40 pontos', () => {
      expect(getNewAttendanceLayout(800, 1280).horizontalInset).toBe(32);
      expect(getNewAttendanceLayout(1280, 800).horizontalInset).toBe(40);
    });

    it('limita a largura do conteúdo no tablet deitado', () => {
      expect(getNewAttendanceLayout(1280, 800).contentWidth).toBe(MAX_CONTENT_WIDTH);
    });

    it('usa título e preenchimento do cartão maiores', () => {
      const layout = getNewAttendanceLayout(1280, 800);

      expect(layout.titleFontSize).toBe(34);
      expect(layout.cardPadding).toBe(32);
    });
  });

  it('aperta o espaço vertical em telas baixas', () => {
    expect(getNewAttendanceLayout(1280, 699).verticalInset).toBe(16);
    expect(getNewAttendanceLayout(1280, 700).verticalInset).toBe(32);
  });

  it('nunca devolve largura de conteúdo negativa', () => {
    expect(getNewAttendanceLayout(0, 0).contentWidth).toBe(0);
  });
});

describe('createNewAttendanceStyles', () => {
  const styles = createNewAttendanceStyles(Colors.light);

  it('põe os campos lado a lado no tablet e um embaixo do outro em tela estreita', () => {
    expect(styles.fieldRowWide.flexDirection).toBe('row');
    expect(styles.fieldRowNarrow.flexDirection).toBe('column');
  });

  it('dá ao nome mais espaço que aos outros campos da linha', () => {
    expect(styles.fieldWideName.flex).toBeGreaterThan(styles.fieldWide.flex);
  });

  it('não usa texto menor que 16 pontos', () => {
    const tamanhos = Object.values(styles)
      .map((estilo) => ('fontSize' in estilo ? estilo.fontSize : undefined))
      .filter((tamanho): tamanho is number => typeof tamanho === 'number');

    expect(tamanhos.length).toBeGreaterThan(0);
    expect(Math.min(...tamanhos)).toBeGreaterThanOrEqual(16);
  });

  it('usa controles com pelo menos 60 pontos de altura', () => {
    expect(styles.input.minHeight).toBeGreaterThanOrEqual(60);
    expect(styles.select.minHeight).toBeGreaterThanOrEqual(60);
    expect(styles.submitButton.minHeight).toBe(64);
    expect(styles.option.minHeight).toBe(64);
  });

  it('usa as cores do tema recebido', () => {
    const escuro = createNewAttendanceStyles(Colors.dark);

    expect(styles.safeArea.backgroundColor).toBe(Colors.light.background);
    expect(escuro.safeArea.backgroundColor).toBe(Colors.dark.background);
    expect(escuro.input.color).toBe(Colors.dark.text);
    expect(escuro.submitButton.backgroundColor).toBe(Colors.dark.primary);
  });

  it('destaca o campo com erro com uma borda diferente da de foco', () => {
    expect(styles.inputInvalid.borderColor).not.toBe(styles.inputFocused.borderColor);
  });
});
