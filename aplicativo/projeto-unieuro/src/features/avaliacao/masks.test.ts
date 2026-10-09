import { formatCpfInput, formatDateInput } from '@/features/avaliacao/masks';

describe('formatCpfInput', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['123', '123'],
    ['1234', '123.4'],
    ['123456', '123.456'],
    ['1234567', '123.456.7'],
    ['123456789', '123.456.789'],
    ['1234567890', '123.456.789-0'],
    ['12345678909', '123.456.789-09'],
  ])('formata "%s" enquanto o médico digita', (input, expected) => {
    expect(formatCpfInput(input)).toBe(expected);
  });

  it('mantém o CPF que já chega com a máscara', () => {
    expect(formatCpfInput('123.456.789-09')).toBe('123.456.789-09');
  });

  it('descarta letras e outros símbolos', () => {
    expect(formatCpfInput('12a.3b4 5/6')).toBe('123.456');
  });

  it('corta o que passa de 11 dígitos', () => {
    expect(formatCpfInput('123456789091234')).toBe('123.456.789-09');
  });
});

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
