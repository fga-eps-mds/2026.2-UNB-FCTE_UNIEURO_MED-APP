/**
 * Limite do nome completo do paciente e do profissional (#97). O nome aparece na
 * lista de pacientes, no termo e nas telas do profissional, e sem limite um nome
 * colado por engano quebraria esses lugares.
 */
export const MAX_NAME_LENGTH = 100;

export const NAME_TOO_LONG = `O nome pode ter no máximo ${MAX_NAME_LENGTH} caracteres.`;

export function isNameTooLong(name: string): boolean {
  return name.trim().length > MAX_NAME_LENGTH;
}
