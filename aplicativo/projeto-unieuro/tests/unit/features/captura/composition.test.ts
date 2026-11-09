import { drawingRepository } from '@/db/drawing-repository';
import { confirmDrawing } from '@/features/captura/composition';
import { confirmarDesenho } from '@/features/captura/drawing';

jest.mock('@/db/drawing-repository', () => ({ drawingRepository: { salvarDesenho: jest.fn() } }));
jest.mock('@/features/captura/drawing', () => ({ confirmarDesenho: jest.fn() }));

it('liga a gravação do desenho ao repositório do SQLite', async () => {
  const input = {
    atendimentoId: 7,
    ordem: 1,
    registro: { iniciadoEm: 0, eventos: [], tracos: [], dimensoes: null },
  };

  await confirmDrawing(input);

  expect(confirmarDesenho).toHaveBeenCalledWith(input, drawingRepository);
});
