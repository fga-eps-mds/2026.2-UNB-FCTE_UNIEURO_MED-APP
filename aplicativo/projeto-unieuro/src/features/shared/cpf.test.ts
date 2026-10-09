import { parseCpf } from '@/features/shared/cpf';

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
