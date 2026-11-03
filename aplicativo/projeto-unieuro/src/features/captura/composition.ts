import { drawingRepository } from '@/db/drawing-repository';
import { confirmarDesenho, type ConfirmarDesenhoInput } from '@/features/captura/drawing';

/**
 * Liga a gravação do desenho ao SQLite. As rotas importam daqui, e não de
 * `@/db`, para respeitar a regra de camadas (o lint barra o import direto).
 */
export const confirmDrawing = (input: ConfirmarDesenhoInput) =>
  confirmarDesenho(input, drawingRepository);
