import { normalize } from '@/features/shared/busca';

describe('texto comparado na busca', () => {
  it('tira os acentos', () => {
    expect(normalize('João Antônio Conceição')).toBe('joao antonio conceicao');
  });

  it('deixa em minúsculas', () => {
    expect(normalize('ANA Carolina')).toBe('ana carolina');
  });

  it('tira os espaços das pontas', () => {
    expect(normalize('  ana  ')).toBe('ana');
  });

  it('só com espaços, fica vazio', () => {
    expect(normalize('   ')).toBe('');
  });
});
