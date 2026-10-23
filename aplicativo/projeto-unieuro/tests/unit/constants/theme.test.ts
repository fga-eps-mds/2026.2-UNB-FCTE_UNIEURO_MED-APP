import { Colors } from '@/constants/theme';

describe('Colors', () => {
  it('define a borda decorativa do guia de identidade visual nos dois modos', () => {
    expect(Colors.light.borderDecorative).toBe('#CBD5E1');
    expect(Colors.dark.borderDecorative).toBe('#475569');
  });
});
