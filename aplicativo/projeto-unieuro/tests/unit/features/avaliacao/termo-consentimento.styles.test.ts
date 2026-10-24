import { Colors } from '@/constants/theme';
import {
  DUAS_COLUNAS_MIN_LARGURA,
  createTermoStyles,
  getTermoLayout,
} from '@/features/avaliacao/termo-consentimento.styles';

describe('layout da tela do termo', () => {
  it('põe o termo e a decisão lado a lado no tablet deitado, como no protótipo', () => {
    expect(getTermoLayout(1280)).toEqual({ duasColunas: true, margem: 40 });
  });

  it('empilha as colunas abaixo da largura mínima', () => {
    expect(getTermoLayout(DUAS_COLUNAS_MIN_LARGURA - 1).duasColunas).toBe(false);
    expect(getTermoLayout(600).margem).toBe(20);
    expect(getTermoLayout(320).margem).toBe(16);
  });

  it('usa letra de pelo menos 16 e corpo do termo de 20', () => {
    const styles = createTermoStyles(Colors.dark);

    expect(styles.paragrafo.fontSize).toBe(20);
    expect(styles.avisoRolagem.fontSize).toBeGreaterThanOrEqual(16);
    expect(styles.versao.fontSize).toBeGreaterThanOrEqual(16);
  });
});
