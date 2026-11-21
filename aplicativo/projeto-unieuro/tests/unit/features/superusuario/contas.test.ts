import {
  filtrarContas,
  situacaoDa,
  SITUACAO_LABEL,
  SITUACAO_TONE,
  toLinhaConta,
  type ContaProfissional,
} from '@/features/superusuario/contas';

const conta = (dados: Partial<ContaProfissional> = {}): ContaProfissional => ({
  id: 7,
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
  active: true,
  superuser: false,
  examCount: 12,
  ...dados,
});

describe('linha da tabela de contas', () => {
  it('mostra o nome, o CRM com a UF, a situação e os exames do médico', () => {
    expect(toLinhaConta(conta())).toEqual({
      id: 7,
      nome: 'Ana Carolina Souza',
      email: 'ana.souza@unieuro.com.br',
      crm: '12345/DF',
      situacao: 'ativa',
      exames: 12,
      podeExcluir: true,
    });
  });

  it.each([
    ['médico ativo', conta(), 'ativa'],
    ['médico desativado', conta({ active: false }), 'desativada'],
    ['superusuário', conta({ superuser: true }), 'superusuario'],
    ['superusuário desativado', conta({ superuser: true, active: false }), 'desativada'],
  ])('situação de %s', (_caso, dados, esperada) => {
    expect(situacaoDa(dados)).toBe(esperada);
  });

  it.each([
    ['médico ativo', conta(), true],
    ['médico desativado', conta({ active: false }), false],
    ['superusuário', conta({ superuser: true }), false],
  ])('"Excluir conta" para %s: %s', (_caso, dados, esperado) => {
    expect(toLinhaConta(dados).podeExcluir).toBe(esperado);
  });

  it('cada situação tem o texto e a cor do selo', () => {
    expect(SITUACAO_LABEL).toEqual({
      ativa: 'Ativa',
      desativada: 'Desativada',
      superusuario: 'Superusuário',
    });
    expect(SITUACAO_TONE).toEqual({
      ativa: 'success',
      desativada: 'warning',
      superusuario: 'info',
    });
  });
});

describe('Buscar médico', () => {
  const linhas = [
    toLinhaConta(conta()),
    toLinhaConta(
      conta({
        id: 8,
        name: 'Paulo Henrique Rocha',
        email: 'paulo.rocha@unieuro.com.br',
        crmNumber: '23456',
        crmState: 'GO',
      }),
    ),
    toLinhaConta(
      conta({
        id: 9,
        name: 'João Mendes',
        email: 'joao.mendes@unieuro.com.br',
        crmNumber: '34567',
      }),
    ),
  ];
  const nomes = (busca: string) => filtrarContas(linhas, busca).map((linha) => linha.nome);

  it('sem texto, mostra todas as contas', () => {
    expect(nomes('')).toEqual(['Ana Carolina Souza', 'Paulo Henrique Rocha', 'João Mendes']);
    expect(nomes('   ')).toHaveLength(3);
  });

  it('encontra por parte do nome, sem diferenciar acentos nem maiúsculas', () => {
    expect(nomes('JOAO')).toEqual(['João Mendes']);
    expect(nomes('henrique')).toEqual(['Paulo Henrique Rocha']);
  });

  it('encontra pelo CRM, com ou sem a UF', () => {
    expect(nomes('23456')).toEqual(['Paulo Henrique Rocha']);
    expect(nomes('12345/df')).toEqual(['Ana Carolina Souza']);
    expect(nomes('/GO')).toEqual(['Paulo Henrique Rocha']);
  });

  it('encontra pelo e-mail', () => {
    expect(nomes('ana.souza@')).toEqual(['Ana Carolina Souza']);
  });

  it('não encontra ninguém quando nada bate', () => {
    expect(nomes('Marcos')).toEqual([]);
  });
});
