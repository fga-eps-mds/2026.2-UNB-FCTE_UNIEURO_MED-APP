import {
  carregarResultado,
  montarResultado,
  pngParaDataUri,
  temResultado,
  type ExameComDesenhos,
  type ResultadoRepository,
} from '@/features/resultado/resultado';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 255]);

const exame = (drawings: ExameComDesenhos['drawings']): ExameComDesenhos => ({
  id: 12,
  professionalId: 7,
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
