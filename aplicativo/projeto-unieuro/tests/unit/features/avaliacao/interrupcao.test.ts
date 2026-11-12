import {
  MOTIVOS_DESISTENCIA,
  ROTULO_MOTIVO,
  desistirDoExame,
  proximaTarefa,
  retomarExame,
  type ExameInterrompido,
  type InterrupcaoRepository,
} from '@/features/avaliacao/interrupcao';

const AGORA = () => new Date('2026-11-12T14:06:00.000Z');

const exame = (tarefasGravadas: number[]): ExameInterrompido => ({
  atendimentoId: 7,
  nomePaciente: 'José Alves Martins',
  fichaPaciente: '2026-0001',
  tarefa: 2,
  motivo: 'cansaco',
  interrompidoEm: '2026-11-12T14:06:00.000Z',
  tarefasGravadas,
});

const repositorio = (extra: Partial<InterrupcaoRepository> = {}): InterrupcaoRepository => ({
  interromper: jest.fn(async () => true),
  buscarInterrompido: jest.fn(async () => exame([1])),
  retomar: jest.fn(async () => true),
  ...extra,
});

describe('desistência', () => {
  it('grava a tarefa atual, o motivo e a hora', async () => {
    const repository = repositorio();

    await desistirDoExame({ atendimentoId: 7, tarefa: 2, motivo: 'mal_estar' }, repository, AGORA);

    expect(repository.interromper).toHaveBeenCalledWith({
      atendimentoId: 7,
      tarefa: 2,
      motivo: 'mal_estar',
      interrompidoEm: '2026-11-12T14:06:00.000Z',
    });
  });

  it.each([
    ['atendimento inválido', { atendimentoId: 0, tarefa: 1 }, /Atendimento inválido/],
    ['tarefa fora de 1 a 3', { atendimentoId: 7, tarefa: 4 }, /Tarefa inválida/],
  ])('recusa %s sem chamar o banco', async (_caso, dados, erro) => {
    const repository = repositorio();

    await expect(desistirDoExame({ ...dados, motivo: null }, repository)).rejects.toThrow(erro);
    expect(repository.interromper).not.toHaveBeenCalled();
  });

  it('avisa quando o exame não estava em andamento', async () => {
    const repository = repositorio({ interromper: jest.fn(async () => false) });

    await expect(
      desistirDoExame({ atendimentoId: 7, tarefa: 1, motivo: null }, repository),
    ).rejects.toThrow(/não estava em andamento/);
  });

  it('tem os quatro motivos do protótipo, com rótulo', () => {
    expect(MOTIVOS_DESISTENCIA.map(({ rotulo }) => rotulo)).toEqual([
      'Cansaço',
      'Não quis continuar',
      'Mal-estar',
      'Outro',
    ]);
    expect(ROTULO_MOTIVO.nao_quis_continuar).toBe('Não quis continuar');
  });
});

describe('próxima tarefa da retomada', () => {
  it.each([
    [[], 1],
    [[1], 2],
    [[1, 2], 3],
    [[2], 1],
    [[1, 2, 3], null],
  ])('com as tarefas %j gravadas, continua na %s', (gravadas, esperada) => {
    expect(proximaTarefa(gravadas)).toBe(esperada);
  });
});

describe('retomada', () => {
  it('retoma na primeira tarefa sem desenho, sem repetir as gravadas', async () => {
    const repository = repositorio();

    await expect(retomarExame(7, 3, repository, AGORA)).resolves.toEqual({
      retomado: true,
      tarefa: 2,
    });
    expect(repository.retomar).toHaveBeenCalledWith(7, 3, '2026-11-12T14:06:00.000Z');
  });

  it('não retoma o exame que não está interrompido ou é de outro profissional', async () => {
    const repository = repositorio({ buscarInterrompido: jest.fn(async () => null) });

    await expect(retomarExame(7, 3, repository)).resolves.toEqual({ retomado: false });
    expect(repository.retomar).not.toHaveBeenCalled();
  });

  it('não retoma o exame com as três tarefas gravadas', async () => {
    const repository = repositorio({ buscarInterrompido: jest.fn(async () => exame([1, 2, 3])) });

    await expect(retomarExame(7, 3, repository)).resolves.toEqual({ retomado: false });
    expect(repository.retomar).not.toHaveBeenCalled();
  });

  it('não retoma quando o banco não muda o estado', async () => {
    const repository = repositorio({ retomar: jest.fn(async () => false) });

    await expect(retomarExame(7, 3, repository)).resolves.toEqual({ retomado: false });
  });
});
