import { drawingRepository } from '@/db/drawing-repository';
import {
  confirmarDesenho,
  type ConfirmarDesenhoInput,
  type DrawingRepository,
} from '@/features/captura/drawing';

/**
 * Liga a gravação do desenho ao SQLite. As rotas importam daqui, e não de
 * `@/db`, para respeitar a regra de camadas (o lint barra o import direto).
 *
 * A anotação de tipo confere que o repositório do banco, que tem tipos próprios,
 * atende ao contrato da captura: se os formatos divergirem, o `tsc` acusa aqui.
 */
const repositorio: DrawingRepository = drawingRepository;

export const confirmDrawing = (input: ConfirmarDesenhoInput) =>
  confirmarDesenho(input, repositorio);
