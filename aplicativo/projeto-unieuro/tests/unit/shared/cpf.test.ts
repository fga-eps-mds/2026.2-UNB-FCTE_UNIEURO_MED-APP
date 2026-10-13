import { formatCpfInput, parseCpf } from '@/features/shared/cpf';

describe('parseCpf', () => {
  it.each([
    ['111.444.777-35', '11144477735'],
    ['11144477735', '11144477735'],
    ['  111.444.777-35  ', '11144477735'],
    ['123.456.789-09', '12345678909'],
  ])('aceita "%s"', (input, expected) => {
    expect(parseCpf(input)).toBe(expected);
  });

  it.each([
    ['111.444.777-30', 'segundo dígito verificador errado'],
    ['111.444.777-45', 'primeiro dígito verificador errado'],
    ['111.444.777', 'quantidade de dígitos errada'],
    ['111.444.777-350', 'dígito a mais'],
    ['000.000.000-00', 'todos os dígitos iguais'],
    ['', 'vazio'],
  ])('recusa "%s" (%s)', (input) => {
    expect(parseCpf(input)).toBeNull();
  });
});

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
  ])('formata "%s" enquanto é digitado', (input, expected) => {
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
