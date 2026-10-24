/**
 * O que a tela de desenho de cada tarefa mostra além do quadro (história #9): o
 * lembrete curto da tarefa e, na cópia do cubo, a figura de modelo.
 *
 * O lembrete repete a instrução (#8) em poucas palavras, porque o paciente já leu a
 * instrução completa antes de começar.
 */
import type { Tarefa } from '@/features/avaliacao/tarefas';

export type Lembrete = { titulo: string; frase: string };

export const LEMBRETES: Readonly<Record<number, Lembrete>> = {
  1: { titulo: 'Desenhe um relógio', frase: 'Com todos os números, marcando 11h10.' },
  2: { titulo: 'Copie o cubo', frase: 'Desenhe do jeito que você consegue.' },
  3: { titulo: 'Ligue números e letras', frase: 'Alterne em ordem: 1, A, 2, B… até o E.' },
};

/**
 * Tarefas que já têm a tela de desenho: o relógio e o cubo. As trilhas ainda usam a
 * área de desenho provisória da instrução (#8).
 */
export const TAREFAS_COM_DESENHO: readonly number[] = [1, 2];

export function temTelaDeDesenho(tarefa: Tarefa): boolean {
  return TAREFAS_COM_DESENHO.includes(tarefa.numero);
}

/** Só a cópia do cubo mostra uma figura de modelo ao lado do quadro. */
export function mostraFiguraDoCubo(tarefa: Tarefa): boolean {
  return tarefa.numero === 2;
}

export const DICA_CONFIRMAR = 'Desenhe pelo menos um traço para confirmar.';
