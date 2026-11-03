import {
  confirmarDesenho,
  type DrawingRepository,
  type RegistroConfirmado,
} from '@/features/captura/drawing';
import type { EventoTracado } from '@/features/captura/eventos-tracado';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';

// O Skia não roda no Jest: a geração do PNG tem teste próprio.
jest.mock('@/features/captura/imagem-desenho', () => ({ gerarImagemDesenho: jest.fn() }));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const INICIO = Date.UTC(2026, 10, 3, 14, 0, 0);
const AGORA = new Date(Date.UTC(2026, 10, 3, 14, 3, 10));

const EVENTOS: EventoTracado[] = [
  { tipo: 'inicio', ordem: 1, instante: 100, x: 10, y: 20, ponteiro: 'caneta' },
  { tipo: 'ponto', ordem: 2, instante: 116, x: 12, y: 21, ponteiro: 'caneta' },
  { tipo: 'desfazer', ordem: 3, instante: 400 },
  { tipo: 'inicio', ordem: 4, instante: 900, x: 50, y: 60, ponteiro: 'caneta' },
];
const TRACOS = [[{ x: 50, y: 60, instante: 900 }]];

const registro = (extra: Partial<RegistroConfirmado> = {}): RegistroConfirmado => ({
  iniciadoEm: INICIO,
  eventos: EVENTOS,
  tracos: TRACOS,
  dimensoes: { largura: 960, altura: 600 },
  ...extra,
});

let repository: jest.Mocked<DrawingRepository>;

beforeEach(() => {
  repository = { salvarDesenho: jest.fn(async () => undefined) };
  jest.mocked(gerarImagemDesenho).mockReturnValue(PNG);
});

describe('confirmarDesenho', () => {
  it.each([
    [1, 'relogio'],
    [2, 'cubo'],
    [3, 'trilhas'],
  ] as const)('grava a tarefa %i como %s', async (ordem, tipo) => {
    await confirmarDesenho({ atendimentoId: 7, ordem, registro: registro() }, repository);

    expect(repository.salvarDesenho).toHaveBeenCalledWith(expect.objectContaining({ ordem, tipo }));
  });

  it('grava o traçado completo, o tamanho do quadro, as datas e o PNG dos traços que valem', async () => {
    await confirmarDesenho(
      { atendimentoId: 7, ordem: 1, registro: registro() },
      repository,
      () => AGORA,
    );

    expect(gerarImagemDesenho).toHaveBeenCalledWith(TRACOS, { largura: 960, altura: 600 });
    expect(repository.salvarDesenho).toHaveBeenCalledWith({
      atendimentoId: 7,
      ordem: 1,
      tipo: 'relogio',
      largura: 960,
      altura: 600,
      iniciadoEm: '2026-11-03T14:00:00.000Z',
      confirmadoEm: '2026-11-03T14:03:10.000Z',
      eventos: EVENTOS,
      imagemPng: PNG,
    });
  });

  it('usa o relógio do tablet quando nenhum é passado', async () => {
    await confirmarDesenho({ atendimentoId: 7, ordem: 1, registro: registro() }, repository);

    const { confirmadoEm } = repository.salvarDesenho.mock.calls[0][0];
    expect(Number.isNaN(Date.parse(confirmadoEm))).toBe(false);
  });

  it.each([0, -1, 1.5, Number.NaN])('recusa o atendimento %p sem gravar', async (atendimentoId) => {
    await expect(
      confirmarDesenho({ atendimentoId, ordem: 1, registro: registro() }, repository),
    ).rejects.toThrow('Atendimento inválido');
    expect(repository.salvarDesenho).not.toHaveBeenCalled();
  });

  it.each([0, 4, 1.5])('recusa a tarefa %p sem gravar', async (ordem) => {
    await expect(
      confirmarDesenho({ atendimentoId: 7, ordem, registro: registro() }, repository),
    ).rejects.toThrow('Tarefa inválida');
    expect(repository.salvarDesenho).not.toHaveBeenCalled();
  });

  it('recusa gravar antes de o quadro ter tamanho', async () => {
    await expect(
      confirmarDesenho(
        { atendimentoId: 7, ordem: 1, registro: registro({ dimensoes: null }) },
        repository,
      ),
    ).rejects.toThrow('Quadro sem tamanho');
    expect(repository.salvarDesenho).not.toHaveBeenCalled();
  });

  it('não grava quando a imagem não pode ser gerada', async () => {
    jest.mocked(gerarImagemDesenho).mockImplementation(() => {
      throw new Error('Não foi possível gravar a imagem do desenho em PNG.');
    });

    await expect(
      confirmarDesenho({ atendimentoId: 7, ordem: 1, registro: registro() }, repository),
    ).rejects.toThrow('PNG');
    expect(repository.salvarDesenho).not.toHaveBeenCalled();
  });

  it('repassa a falha da gravação para a tela', async () => {
    repository.salvarDesenho.mockRejectedValue(new Error('disco cheio'));

    await expect(
      confirmarDesenho({ atendimentoId: 7, ordem: 1, registro: registro() }, repository),
    ).rejects.toThrow('disco cheio');
  });
});
