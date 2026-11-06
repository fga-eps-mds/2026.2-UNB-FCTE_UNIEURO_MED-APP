/**
 * Gravação do desenho confirmado (#10): a tarefa, o traçado completo e a imagem
 * final, juntos ou nada (cenário "tudo ou nada").
 *
 * A regra monta o que vai para o banco a partir do registro do quadro
 * (`useRegistroTracado`) e gera o PNG com `gerarImagemDesenho`. Quem grava é o
 * repositório, ligado em `composition.ts`.
 */
import type { EventoTracado, Traco } from '@/features/captura/eventos-tracado';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';
import type { Dimensoes } from '@/features/captura/quadro-desenho';

/** Identificador de cada tarefa no banco, na ordem de `features/avaliacao/tarefas.ts`. */
export type TipoTarefa = 'relogio' | 'cubo' | 'trilhas';

const TIPO_POR_ORDEM: Readonly<Record<number, TipoTarefa>> = {
  1: 'relogio',
  2: 'cubo',
  3: 'trilhas',
};

export type DesenhoConfirmado = {
  atendimentoId: number;
  /** O `numero` da tarefa, de 1 a 3. */
  ordem: number;
  tipo: TipoTarefa;
  /** Tamanho do quadro, que dá a escala das coordenadas. */
  largura: number;
  altura: number;
  /** Data e hora em ISO 8601, pelo relógio do tablet. */
  iniciadoEm: string;
  confirmadoEm: string;
  /** Inclui os traços desfeitos e apagados. */
  eventos: readonly EventoTracado[];
  imagemPng: Uint8Array;
};

export type DrawingRepository = {
  /** Grava a tarefa, o traçado e o desenho numa transação só. */
  salvarDesenho(desenho: DesenhoConfirmado): Promise<void>;
};

/** O que a regra lê do registro do quadro. */
export type RegistroConfirmado = {
  iniciadoEm: number;
  eventos: readonly EventoTracado[];
  tracos: readonly Traco[];
  dimensoes: Dimensoes | null;
};

export type ConfirmarDesenhoInput = {
  atendimentoId: number;
  ordem: number;
  registro: RegistroConfirmado;
};

/**
 * Monta e grava o desenho confirmado. Lança erro se faltar algum dado ou se a
 * gravação falhar; nesse caso nada fica no banco, e a tela mantém o desenho.
 */
export async function confirmarDesenho(
  { atendimentoId, ordem, registro }: ConfirmarDesenhoInput,
  repository: DrawingRepository,
  agora: () => Date = () => new Date(),
): Promise<void> {
  if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
    throw new Error('Atendimento inválido ao gravar o desenho.');
  }
  const tipo = TIPO_POR_ORDEM[ordem];
  if (!tipo) throw new Error('Tarefa inválida ao gravar o desenho.');
  const { dimensoes } = registro;
  if (!dimensoes) throw new Error('Quadro sem tamanho ao gravar o desenho.');

  await repository.salvarDesenho({
    atendimentoId,
    ordem,
    tipo,
    largura: dimensoes.largura,
    altura: dimensoes.altura,
    iniciadoEm: new Date(registro.iniciadoEm).toISOString(),
    confirmadoEm: agora().toISOString(),
    eventos: registro.eventos,
    imagemPng: gerarImagemDesenho(registro.tracos, dimensoes),
  });
}
