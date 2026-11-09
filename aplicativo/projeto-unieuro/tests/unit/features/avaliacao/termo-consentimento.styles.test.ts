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

  it('dá ao termo espaço mínimo e deixa as colunas encolherem em paisagem', () => {
    const styles = createTermoStyles(Colors.light);

    expect(styles.colunaTermo.minHeight).toBe(200);
    expect(styles.colunaTermoLateral.minWidth).toBe(0);
    expect(styles.painelLateral.minWidth).toBe(0);
    expect(styles.painel.maxHeight).toBe('60%');
  });

  it('mantém as duas opções de quem assina juntas, lado a lado', () => {
    const styles = createTermoStyles(Colors.light);

    expect(styles.quemAssinaOpcoes.flexDirection).toBe('row');
    expect(styles.opcaoQuemAssina.flexShrink).toBe(1);
  });

  it('usa letra de pelo menos 16 e corpo do termo de 20', () => {
    const styles = createTermoStyles(Colors.dark);

    expect(styles.paragrafo.fontSize).toBe(20);
    expect(styles.avisoRolagem.fontSize).toBeGreaterThanOrEqual(16);
    expect(styles.versao.fontSize).toBeGreaterThanOrEqual(16);
    expect(styles.ajudaEscolhaConsentimento.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('deixa o nome do paciente encolher no cabeçalho, sem passar da tela', () => {
    expect(createTermoStyles(Colors.light).paciente.flexShrink).toBe(1);
  });
});
