/**
 * As três tarefas da avaliação, na ordem em que o paciente as faz (história #8).
 * Os textos são os combinados com o parceiro para cada tarefa.
 */

export const TOTAL_TAREFAS = 3;

export type IconeTarefa = 'clock-outline' | 'cube-outline' | 'vector-polyline';

export type Tarefa = {
  /** Posição da tarefa na avaliação, de 1 a 3. */
  numero: number;
  titulo: string;
  instrucao: string;
  icone: IconeTarefa;
};

export const TAREFAS: readonly Tarefa[] = [
  {
    numero: 1,
    titulo: 'Desenhe um relógio',
    instrucao: 'Desenhe o círculo, coloque todos os números e marque onze horas e dez minutos.',
    icone: 'clock-outline',
  },
  {
    numero: 2,
    titulo: 'Copie este cubo',
    instrucao: 'Olhe a figura que aparece ao lado e desenhe igual, do jeito que você consegue.',
    icone: 'cube-outline',
  },
  {
    numero: 3,
    titulo: 'Ligue números e letras',
    instrucao: 'Alterne número e letra, em ordem: 1, A, 2, B… até o E.',
    icone: 'vector-polyline',
  },
];

/** Parâmetro de rota como o Expo Router o entrega: texto, lista (se repetido) ou ausente. */
export type ParametroDeRota = string | readonly string[] | undefined;

/** Primeiro valor do parâmetro, ou `undefined` quando ele não veio. */
export function valorDoParametro(valor: ParametroDeRota): string | undefined {
  return typeof valor === 'string' ? valor : valor?.[0];
}

/**
 * Tarefa indicada pelo parâmetro `tarefa` da rota, ou `null` quando o valor não é
 * exatamente 1, 2 ou 3. Formas como "01", "1.5" ou " 1" não valem.
 */
export function obterTarefa(valor: ParametroDeRota): Tarefa | null {
  const texto = valorDoParametro(valor);
  return TAREFAS.find((tarefa) => String(tarefa.numero) === texto) ?? null;
}
