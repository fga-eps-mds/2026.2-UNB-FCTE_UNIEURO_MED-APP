/**
 * Busca ignora acentuação, além de não diferir letras em minúsculo
 * de letras em maiúsculo.
 */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
