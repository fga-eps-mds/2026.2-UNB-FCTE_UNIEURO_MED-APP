import {
  obterTarefa,
  TAREFAS,
  TOTAL_TAREFAS,
  valorDoParametro,
} from '@/features/avaliacao/tarefas';

describe('TAREFAS', () => {
  it('são três, na ordem da avaliação', () => {
    expect(TOTAL_TAREFAS).toBe(3);
    expect(TAREFAS.map((tarefa) => tarefa.numero)).toEqual([1, 2, 3]);
  });

  it.each([
    [
      1,
      'Desenhe um relógio',
      'Desenhe o círculo, coloque todos os números e marque onze horas e dez minutos.',
    ],
    [
      2,
      'Copie este cubo',
      'Olhe a figura que aparece ao lado e desenhe igual, do jeito que você consegue.',
    ],
    [3, 'Ligue números e letras', 'Alterne número e letra, em ordem: 1, A, 2, B… até o E.'],
  ])('a tarefa %i tem o texto combinado com o parceiro', (numero, titulo, instrucao) => {
    expect(TAREFAS[numero - 1]).toMatchObject({ numero, titulo, instrucao });
  });
});

describe('valorDoParametro', () => {
  it.each([
    ['um texto', '2', '2'],
    ['uma lista, pega o primeiro', ['3', '1'], '3'],
    ['uma lista vazia', [], undefined],
    ['ausente', undefined, undefined],
  ])('lê %s', (_caso, valor, esperado) => {
    expect(valorDoParametro(valor)).toBe(esperado);
  });
});

describe('obterTarefa', () => {
  it.each([1, 2, 3])('encontra a tarefa %i pelo texto do parâmetro', (numero) => {
    expect(obterTarefa(String(numero))).toBe(TAREFAS[numero - 1]);
  });

  it('usa o primeiro valor quando o parâmetro vem repetido', () => {
    expect(obterTarefa(['2', '3'])).toBe(TAREFAS[1]);
  });

  it.each(['0', '4', '-1', '1.5', '01', ' 1', 'um', '', 'NaN'])(
    'não aceita "%s" como tarefa',
    (valor) => {
      expect(obterTarefa(valor)).toBeNull();
    },
  );

  it('devolve null quando o parâmetro não veio', () => {
    expect(obterTarefa(undefined)).toBeNull();
  });
});
