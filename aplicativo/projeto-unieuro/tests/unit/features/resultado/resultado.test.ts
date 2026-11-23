import {
  carregarResultado,
  CORTE_DA_CLASSE,
  esperaOModelo,
  montarResultado,
  pngParaDataUri,
  temResultado,
  type ExameComDesenhos,
  type ResultadoRepository,
} from '@/features/resultado/resultado';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 255]);

const exame = (drawings: ExameComDesenhos['drawings']): ExameComDesenhos => ({
  id: 12,
  startedAt: '2026-11-03T14:00:00.000Z',
  state: 'concluida',
  patientName: 'José Alves Martins',
  recordNumber: '2026-0184',
  appliedBy: 'Ana Carolina Souza',
  drawings,
});

describe('temResultado', () => {
  it.each(['processando_resultado', 'erro_inferencia', 'concluida'])(
    'o exame %s já tem os três desenhos',
    (estado) => {
      expect(temResultado(estado)).toBe(true);
    },
  );

  it.each(['aguardando_consentimento', 'em_andamento', 'interrompida', 'cancelada'])(
    'o exame %s não tem resultado',
    (estado) => {
      expect(temResultado(estado)).toBe(false);
    },
  );
});

describe('pngParaDataUri', () => {
  it('converte o PNG do banco em data URI, sem perder bytes', () => {
    const uri = pngParaDataUri(PNG);

    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    const bytes = Uint8Array.from(atob(uri.split(',')[1]), (letra) => letra.charCodeAt(0));
    expect(Array.from(bytes)).toEqual(Array.from(PNG));
  });

  it('aguenta uma imagem maior que um pedaço da conversão', () => {
    const grande = new Uint8Array(0x8000 * 2 + 5).map((_, indice) => indice % 256);

    const base64 = pngParaDataUri(grande).split(',')[1];

    expect(atob(base64)).toHaveLength(grande.length);
  });
});

describe('montarResultado', () => {
  it('põe os três desenhos na ordem das tarefas, com o título de cada um', () => {
    const resultado = montarResultado(
      exame([
        { tipo: 'trilhas', ordem: 3, imagemPng: PNG },
        { tipo: 'relogio', ordem: 1, imagemPng: PNG },
        { tipo: 'cubo', ordem: 2, imagemPng: PNG },
      ]),
    );

    expect(resultado.desenhos.map(({ tipo, titulo }) => [tipo, titulo])).toEqual([
      ['relogio', 'Relógio'],
      ['cubo', 'Cubo'],
      ['trilhas', 'Trilhas'],
    ]);
    expect(resultado.desenhos.every(({ imagem }) => imagem?.startsWith('data:image/png'))).toBe(
      true,
    );
    expect(resultado).toMatchObject({
      patientName: 'José Alves Martins',
      appliedBy: 'Ana Carolina Souza',
    });
    expect(resultado).not.toHaveProperty('drawings');
  });

  it('marca o desenho que não foi gravado, em vez de sumir com ele', () => {
    const resultado = montarResultado(exame([{ tipo: 'relogio', ordem: 1, imagemPng: PNG }]));

    expect(resultado.desenhos.map(({ imagem }) => imagem !== null)).toEqual([true, false, false]);
  });

  it('antes do cálculo, o exame vem sem resultado do modelo e sem peso nos desenhos', () => {
    const resultado = montarResultado(exame([{ tipo: 'relogio', ordem: 1, imagemPng: PNG }]));

    expect(resultado.modelo).toBeNull();
    expect(resultado.desenhos.every(({ influencia }) => influencia === null)).toBe(true);
    expect(resultado).not.toHaveProperty('model');
  });
});

describe('montarResultado com o resultado do modelo (#12)', () => {
  const mapa = new Float32Array(64);
  const comModelo = (
    probability: number,
    contributions = { relogio: 1, cubo: -0.5, trilhas: 2.5 },
  ) =>
    montarResultado({
      ...exame([]),
      model: {
        probability,
        contributions,
        maps: { relogio: mapa, cubo: mapa, trilhas: mapa },
        modelVersion: 'vgg16-semente1-v1.6',
        durationMs: 2140,
        calculatedAt: '2026-11-03T14:05:00.000Z',
      },
    });

  it('traz a probabilidade, a versão e o tempo do cálculo no tablet', () => {
    expect(comModelo(0.91).modelo).toEqual({
      probabilidade: 0.91,
      classe: 'ccl',
      calculadoEm: '2026-11-03T14:05:00.000Z',
    });
  });

  it.each([
    [CORTE_DA_CLASSE, 'ccl'],
    [0.4999, 'sem-ccl'],
    [0.05, 'sem-ccl'],
  ])('com probabilidade %d, a classe prevista é %s', (probabilidade, classe) => {
    expect(comModelo(probabilidade).modelo?.classe).toBe(classe);
  });

  it('divide o peso do escore entre os desenhos e diz para que lado cada um puxou', () => {
    const [relogio, cubo, trilhas] = comModelo(0.7).desenhos.map(({ influencia }) => influencia);

    expect(relogio).toEqual({ parteDoPeso: 0.25, puxaPara: 'ccl' });
    expect(cubo).toEqual({ parteDoPeso: 0.125, puxaPara: 'sem-ccl' });
    expect(trilhas).toEqual({ parteDoPeso: 0.625, puxaPara: 'ccl' });
  });

  it('sem nenhum peso, nenhum desenho fica com parte do escore', () => {
    const resultado = comModelo(0.5, { relogio: 0, cubo: 0, trilhas: 0 });

    expect(resultado.desenhos.map(({ influencia }) => influencia?.parteDoPeso)).toEqual([0, 0, 0]);
  });
});

describe('esperaOModelo', () => {
  it.each([
    ['processando_resultado', true],
    ['erro_inferencia', true],
    ['concluida', false],
    ['em_andamento', false],
  ])('o exame %s espera o modelo: %s', (estado, espera) => {
    expect(esperaOModelo(estado)).toBe(espera);
  });
});

describe('carregarResultado', () => {
  it('monta o resultado do exame que o repositório devolve', async () => {
    const repository: ResultadoRepository = {
      findExamResult: jest.fn(async () => exame([])),
    };

    const resultado = await carregarResultado(7, 12, repository);

    expect(repository.findExamResult).toHaveBeenCalledWith(7, 12);
    expect(resultado?.desenhos).toHaveLength(3);
  });

  it('devolve null quando o profissional não pode ver o exame', async () => {
    const repository: ResultadoRepository = { findExamResult: jest.fn(async () => null) };

    await expect(carregarResultado(7, 12, repository)).resolves.toBeNull();
  });
});
