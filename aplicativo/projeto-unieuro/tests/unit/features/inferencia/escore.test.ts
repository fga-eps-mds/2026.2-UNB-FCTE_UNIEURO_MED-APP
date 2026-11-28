import type { Traco } from '@/features/captura/eventos-tracado';
import {
  avaliarExame,
  LADO_DO_MAPA,
  type DesenhosDoExame,
  type EntradasDoModelo,
  type SaidasDoModelo,
} from '@/features/inferencia/escore';

jest.mock('@/features/inferencia/preparo-desenho', () => ({ prepararDesenho: jest.fn() }));

const tracoEm = (x: number): Traco[] => [[{ x, y: 0, instante: 0 }]];

const DESENHOS: DesenhosDoExame = {
  relogio: tracoEm(1),
  cubo: tracoEm(2),
  trilhas: tracoEm(3),
};

const prepararFalso = (tracos: readonly Traco[]) => new Float32Array([tracos[0][0].x / 10]);

const mapa = (valor = 0.5) => new Float32Array(LADO_DO_MAPA * LADO_DO_MAPA).fill(valor);

function saidas(extra: Partial<SaidasDoModelo> = {}): SaidasDoModelo {
  return {
    probabilidade: 0.73,
    contribuicoes: { relogio: 0.4, cubo: -0.2, trilhas: 1.1 },
    mapas: { relogio: mapa(), cubo: mapa(), trilhas: mapa() },
    ...extra,
  };
}

function modeloQueDevolve(resultado: SaidasDoModelo) {
  return { avaliar: jest.fn(async (_entradas: EntradasDoModelo) => resultado) };
}

describe('escore do exame', () => {
  it('escore sem internet: calcula a probabilidade de CCL a partir dos três desenhos', async () => {
    const modelo = modeloQueDevolve(saidas());

    const resultado = await avaliarExame(DESENHOS, modelo, prepararFalso);

    expect(resultado.probabilidade).toBe(0.73);
    expect(modelo.avaliar).toHaveBeenCalledTimes(1);
    expect(modelo.avaliar).toHaveBeenCalledWith({
      relogio: new Float32Array([0.1]),
      cubo: new Float32Array([0.2]),
      trilhas: new Float32Array([0.3]),
    });
  });

  it('devolve a contribuição e o mapa de cada desenho junto com o escore', async () => {
    const esperado = saidas();

    await expect(avaliarExame(DESENHOS, modeloQueDevolve(esperado), prepararFalso)).resolves.toBe(
      esperado,
    );
  });

  it('mesmo exame, mesmo escore: o modelo recebe as mesmas entradas a cada cálculo', async () => {
    const modelo = modeloQueDevolve(saidas({ probabilidade: 0.41 }));

    const primeiro = await avaliarExame(DESENHOS, modelo, prepararFalso);
    const segundo = await avaliarExame(DESENHOS, modelo, prepararFalso);

    expect(segundo.probabilidade).toBe(primeiro.probabilidade);
    const [[entradasDoPrimeiro], [entradasDoSegundo]] = modelo.avaliar.mock.calls;
    expect(entradasDoSegundo).toEqual(entradasDoPrimeiro);
  });

  it.each([0, 1])('aceita o limite %d do intervalo', async (limite) => {
    const resultado = await avaliarExame(
      DESENHOS,
      modeloQueDevolve(saidas({ probabilidade: limite })),
      prepararFalso,
    );

    expect(resultado.probabilidade).toBe(limite);
  });

  it.each([
    ['negativo', -0.01],
    ['acima de 1', 1.2],
    ['indefinido', Number.NaN],
    ['infinito', Number.POSITIVE_INFINITY],
  ])('recusa escore %s', async (_caso, probabilidade) => {
    await expect(
      avaliarExame(DESENHOS, modeloQueDevolve(saidas({ probabilidade })), prepararFalso),
    ).rejects.toThrow('fora do intervalo');
  });

  it('recusa contribuição que não é um número', async () => {
    const contribuicoes = { relogio: 0.1, cubo: Number.NaN, trilhas: 0.2 };

    await expect(
      avaliarExame(DESENHOS, modeloQueDevolve(saidas({ contribuicoes })), prepararFalso),
    ).rejects.toThrow('contribuição inválida');
  });

  it.each([
    ['com células a menos', new Float32Array(10)],
    ['com valor indefinido', mapa(Number.NaN)],
    ['com valor infinito', mapa(Number.POSITIVE_INFINITY)],
  ])('recusa mapa %s', async (_caso, mapaInvalido) => {
    const mapas = { relogio: mapa(), cubo: mapaInvalido, trilhas: mapa() };

    await expect(
      avaliarExame(DESENHOS, modeloQueDevolve(saidas({ mapas })), prepararFalso),
    ).rejects.toThrow('mapa fora do formato');
  });

  it('aceita mapa com regiões que puxaram para os dois lados', async () => {
    const mapas = { relogio: mapa(-0.4), cubo: mapa(1.7), trilhas: mapa(0) };

    await expect(
      avaliarExame(DESENHOS, modeloQueDevolve(saidas({ mapas })), prepararFalso),
    ).resolves.toMatchObject({ probabilidade: 0.73 });
  });

  it.each([
    ['sem o relógio', { ...DESENHOS, relogio: undefined }],
    ['com o cubo sem traços', { ...DESENHOS, cubo: [] }],
    ['sem as trilhas', { ...DESENHOS, trilhas: undefined }],
  ])('não chama o modelo com o exame %s', async (_caso, desenhos) => {
    const modelo = modeloQueDevolve(saidas());

    await expect(
      avaliarExame(desenhos as unknown as DesenhosDoExame, modelo, prepararFalso),
    ).rejects.toThrow('três desenhos');
    expect(modelo.avaliar).not.toHaveBeenCalled();
  });

  it('repassa a falha do modelo sem devolver escore', async () => {
    const modelo = { avaliar: jest.fn().mockRejectedValue(new Error('sessão fechada')) };

    await expect(avaliarExame(DESENHOS, modelo, prepararFalso)).rejects.toThrow('sessão fechada');
  });
});
