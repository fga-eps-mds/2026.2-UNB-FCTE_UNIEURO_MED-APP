const DATE_DIGITS = 8;

const onlyDigits = (text: string, limit: number) => text.replace(/\D/g, '').slice(0, limit);

export function formatDateInput(text: string): string {
  const digits = onlyDigits(text, DATE_DIGITS);

  let formatted = digits.slice(0, 2);
  if (digits.length > 2) formatted += `/${digits.slice(2, 4)}`;
  if (digits.length > 4) formatted += `/${digits.slice(4)}`;
  return formatted;
}
