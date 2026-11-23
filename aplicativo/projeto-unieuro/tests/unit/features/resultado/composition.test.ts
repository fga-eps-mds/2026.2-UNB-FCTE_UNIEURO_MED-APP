import { examResultRepository } from '@/db/exam-result-repository';
import { modelResultRepository } from '@/db/model-result-repository';
import { resultadoRepository } from '@/features/resultado/composition';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const EXAME = {
  id: 7,
  startedAt: '2026-11-03T14:00:00.000Z',
  state: 'concluida',
  patientName: 'José Alves Martins',
  recordNumber: '2026-0001',
  appliedBy: 'Ana Carolina Souza',
  drawings: [],
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('composição da tela de resultado', () => {
  it('junta o exame, que já confere quem pode vê-lo, ao resultado do modelo e ao traçado', async () => {
    jest.spyOn(examResultRepository, 'findExamResult').mockResolvedValue(EXAME);
    const resultado = { probability: 0.7 } as Awaited<
      ReturnType<typeof modelResultRepository.findResult>
    >;
    const tracado = { relogio: { largura: 960, altura: 600, eventos: [] } };
    jest.spyOn(modelResultRepository, 'findResult').mockResolvedValue(resultado);
    jest.spyOn(modelResultRepository, 'findTraces').mockResolvedValue(tracado);

    await expect(resultadoRepository.findExamResult(3, 7)).resolves.toEqual({
      ...EXAME,
      model: resultado,
      traces: tracado,
    });
    expect(examResultRepository.findExamResult).toHaveBeenCalledWith(3, 7);
    expect(modelResultRepository.findTraces).toHaveBeenCalledWith(7);
  });

  it('sem resultado do modelo, não lê o traçado, que só serve para o mapa', async () => {
    jest.spyOn(examResultRepository, 'findExamResult').mockResolvedValue(EXAME);
    jest.spyOn(modelResultRepository, 'findResult').mockResolvedValue(null);
    const ler = jest.spyOn(modelResultRepository, 'findTraces');

    await expect(resultadoRepository.findExamResult(3, 7)).resolves.toEqual({
      ...EXAME,
      model: null,
    });
    expect(ler).not.toHaveBeenCalled();
  });

  it('não procura o resultado de um exame que o profissional não pode ver', async () => {
    jest.spyOn(examResultRepository, 'findExamResult').mockResolvedValue(null);
    const procurar = jest.spyOn(modelResultRepository, 'findResult');

    await expect(resultadoRepository.findExamResult(3, 7)).resolves.toBeNull();
    expect(procurar).not.toHaveBeenCalled();
  });
});
