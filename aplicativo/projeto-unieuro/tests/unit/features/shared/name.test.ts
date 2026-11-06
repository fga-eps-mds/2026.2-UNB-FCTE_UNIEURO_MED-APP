import { MAX_NAME_LENGTH, NAME_TOO_LONG, isNameTooLong } from '@/features/shared/name';

describe('limite do nome', () => {
  it('aceita um nome com o tamanho máximo', () => {
    expect(isNameTooLong('a'.repeat(MAX_NAME_LENGTH))).toBe(false);
  });

  it('recusa um nome acima do limite', () => {
    expect(isNameTooLong('a'.repeat(MAX_NAME_LENGTH + 1))).toBe(true);
  });

  it('não conta os espaços das pontas, que a validação já descarta', () => {
    expect(isNameTooLong(`  ${'a'.repeat(MAX_NAME_LENGTH)}  `)).toBe(false);
  });

  it('diz o limite na mensagem', () => {
    expect(NAME_TOO_LONG).toBe('O nome pode ter no máximo 100 caracteres.');
  });
});
