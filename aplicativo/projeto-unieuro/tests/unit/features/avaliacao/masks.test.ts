import { formatDateInput } from '@/features/avaliacao/masks';

describe('formatDateInput', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['14', '14'],
    ['140', '14/0'],
    ['1403', '14/03'],
    ['14031', '14/03/1'],
    ['14031948', '14/03/1948'],
  ])('formata "%s" enquanto o médico digita', (input, expected) => {
    expect(formatDateInput(input)).toBe(expected);
  });

  it('mantém a data que já chega com a máscara', () => {
    expect(formatDateInput('14/03/1948')).toBe('14/03/1948');
  });

  it('descarta letras e outros símbolos', () => {
    expect(formatDateInput('14-mar-03.1948')).toBe('14/03/1948');
  });

  it('corta o que passa de 8 dígitos', () => {
    expect(formatDateInput('140319489')).toBe('14/03/1948');
  });
});
