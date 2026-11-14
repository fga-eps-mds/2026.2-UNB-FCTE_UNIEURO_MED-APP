import { Colors } from '@/constants/theme';

describe('Colors', () => {
  it('define a borda decorativa do guia de identidade visual nos dois modos', () => {
    expect(Colors.light.borderDecorative).toBe('#CBD5E1');
    expect(Colors.dark.borderDecorative).toBe('#475569');
  });

  it('define as cores de aviso do guia de identidade visual nos dois modos', () => {
    expect(Colors.light.warning).toBe('#92400E');
    expect(Colors.light.warningBg).toBe('#FEF3C7');
    expect(Colors.dark.warning).toBe('#FCD34D');
  });
});
