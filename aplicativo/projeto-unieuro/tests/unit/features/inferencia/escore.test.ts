import type { Traco } from '@/features/captura/eventos-tracado';
import {
  calcularEscoreDoExame,
  type DesenhosDoExame,
  type EntradasDoModelo,
} from '@/features/inferencia/escore';

jest.mock('@/features/inferencia/preparo-desenho', () => ({ prepararDesenho: jest.fn() }));

const tracoEm = (x: number): Traco[] => [[{ x, y: 0, instante: 0 }]];

const DESENHOS: DesenhosDoExame = {
  relogio: tracoEm(1),
  cubo: tracoEm(2),
  trilhas: tracoEm(3),
};

const prepararFalso = (tracos: readonly Traco[]) => new Float32Array([tracos[0][0].x / 10]);

function modeloQueDevolve(probabilidade: number) {
  return { calcularProbabilidade: jest.fn(async (_entradas: EntradasDoModelo) => probabilidade) };
}

describe('escore do exame', () => {
  it('escore sem internet: calcula a probabilidade de CCL a partir dos três desenhos', async () => {
    const modelo = modeloQueDevolve(0.73);

    const escore = await calcularEscoreDoExame(DESENHOS, modelo, prepararFalso);

    expect(escore).toBe(0.73);
    expect(modelo.calcularProbabilidade).toHaveBeenCalledTimes(1);
    expect(modelo.calcularProbabilidade).toHaveBeenCalledWith({
      relogio: new Float32Array([0.1]),
      cubo: new Float32Array([0.2]),
      trilhas: new Float32Array([0.3]),
    });
  });

  it('mesmo exame, mesmo escore: o modelo recebe as mesmas entradas a cada cálculo', async () => {
    const modelo = modeloQueDevolve(0.41);

    const primeiro = await calcularEscoreDoExame(DESENHOS, modelo, prepararFalso);
    const segundo = await calcularEscoreDoExame(DESENHOS, modelo, prepararFalso);

    expect(segundo).toBe(primeiro);
    const [[entradasDoPrimeiro], [entradasDoSegundo]] = modelo.calcularProbabilidade.mock.calls;
    expect(entradasDoSegundo).toEqual(entradasDoPrimeiro);
  });

  it.each([0, 1])('aceita o limite %d do intervalo', async (limite) => {
    await expect(
      calcularEscoreDoExame(DESENHOS, modeloQueDevolve(limite), prepararFalso),
    ).resolves.toBe(limite);
  });

  it.each([
    ['negativo', -0.01],
    ['acima de 1', 1.2],
    ['indefinido', Number.NaN],
    ['infinito', Number.POSITIVE_INFINITY],
  ])('recusa escore %s', async (_caso, probabilidade) => {
    await expect(
      calcularEscoreDoExame(DESENHOS, modeloQueDevolve(probabilidade), prepararFalso),
    ).rejects.toThrow('fora do intervalo');
  });

  it.each([
    ['sem o relógio', { ...DESENHOS, relogio: undefined }],
    ['com o cubo sem traços', { ...DESENHOS, cubo: [] }],
    ['sem as trilhas', { ...DESENHOS, trilhas: undefined }],
  ])('não chama o modelo com o exame %s', async (_caso, desenhos) => {
    const modelo = modeloQueDevolve(0.5);

    await expect(
      calcularEscoreDoExame(desenhos as unknown as DesenhosDoExame, modelo, prepararFalso),
    ).rejects.toThrow('três desenhos');
    expect(modelo.calcularProbabilidade).not.toHaveBeenCalled();
  });

  it('repassa a falha do modelo sem devolver escore', async () => {
    const modelo = {
      calcularProbabilidade: jest.fn().mockRejectedValue(new Error('sessão fechada')),
    };

    await expect(calcularEscoreDoExame(DESENHOS, modelo, prepararFalso)).rejects.toThrow(
      'sessão fechada',
    );
  });
});
