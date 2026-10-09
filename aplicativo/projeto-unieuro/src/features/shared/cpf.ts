function cpfCheckDigit(base: string): number {
  let sum = 0;
  let weight = base.length + 1;
  for (const digit of base) {
    sum += Number(digit) * weight;
    weight -= 1;
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const firstNine = digits.slice(0, 9);
  const firstCheck = cpfCheckDigit(firstNine);
  const secondCheck = cpfCheckDigit(firstNine + String(firstCheck));

  return digits === `${firstNine}${firstCheck}${secondCheck}`;
}

/** devolve o CPF só com dígitos, e devolve null se for inválido. */
export function parseCpf(fullCpf: string): string | null {
  const digits = fullCpf.replace(/\D/g, '');
  return isValidCpf(digits) ? digits : null;
}
