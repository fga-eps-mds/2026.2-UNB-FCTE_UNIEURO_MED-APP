import { Skia } from '@shopify/react-native-skia';
import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';

import { QuadroDesenho } from '@/features/captura/quadro-desenho';
import { useRegistroTracado, type RegistroTracado } from '@/features/captura/use-registro-tracado';

import { desenharNoQuadro, medirQuadro } from '../../../test-support/desenho';

// O relógio só anda quando o teste manda, para conferir o instante de cada evento.
let relogio: jest.SpyInstance<number, []>;
let agora = 0;

beforeEach(() => {
  agora = 5_000;
  relogio = jest.spyOn(Date, 'now').mockImplementation(() => agora);
});

afterEach(() => {
  relogio.mockRestore();
});

/** Uma tela de tarefa mínima, do jeito que as telas das tarefas e do TCLE usam o registro. */
function TarefaDeTeste({ aoMudar }: { aoMudar: (registro: RegistroTracado) => void }) {
  const registro = useRegistroTracado();
  useEffect(() => {
    aoMudar(registro);
  });
  return <QuadroDesenho {...registro.quadro} />;
}

function abrirTarefa() {
  const aoMudar = jest.fn<void, [RegistroTracado]>();
  render(<TarefaDeTeste aoMudar={aoMudar} />);
  return () => aoMudar.mock.lastCall![0];
}

const TRACO_1: [number, number][] = [
  [10, 10],
  [20, 20],
];
const TRACO_2: [number, number][] = [
  [50, 50],
  [60, 60],
];

describe('useRegistroTracado', () => {
  it('começa sem traços, com o relógio da tarefa e sem o tamanho do quadro', () => {
    const registro = abrirTarefa();

    expect(registro()).toMatchObject({
      iniciadoEm: 5_000,
      eventos: [],
      tracos: [],
      temTraco: false,
      dimensoes: null,
    });
  });

  it('traço na hora: o traço continua igual quando a caneta é levantada', async () => {
    const registro = abrirTarefa();

    await desenharNoQuadro([
      [10, 10],
      [20, 20],
      [30, 30],
    ]);

    // O traço que fica na tela depois de levantar a caneta é o que foi desenhado,
    // ponto a ponto, sem suavizar nem cortar o começo ou o fim.
    expect(registro().tracos[0].map(({ x, y }) => [x, y])).toEqual([
      [10, 10],
      [20, 20],
      [30, 30],
    ]);
    expect(Skia.Path.MakeFromSVGString).toHaveBeenLastCalledWith('M10 10 L20 20 L30 30');
  });

  it('conta o instante de cada ponto desde o início da tarefa', async () => {
    const registro = abrirTarefa();
    agora = 5_250;

    await desenharNoQuadro(TRACO_1);

    expect(registro().eventos).toEqual([
      expect.objectContaining({ tipo: 'inicio', ordem: 1, x: 10, y: 10, instante: 250 }),
      expect.objectContaining({ tipo: 'ponto', ordem: 2, x: 20, y: 20, instante: 250 }),
    ]);
    expect(registro().tracos).toHaveLength(1);
    expect(registro().temTraco).toBe(true);
  });

  it('guarda o tamanho do quadro, que dá a escala das coordenadas', () => {
    const registro = abrirTarefa();

    medirQuadro(800, 600);

    expect(registro().dimensoes).toEqual({ largura: 800, altura: 600 });
  });

  it('desfazer o último traço: sai do desenho, e o desfazer fica registrado', async () => {
    const registro = abrirTarefa();
    await desenharNoQuadro(TRACO_1);
    await desenharNoQuadro(TRACO_2);
    agora = 5_400;

    act(() => registro().desfazer());

    expect(registro().tracos.map((traco) => traco.map(({ x, y }) => [x, y]))).toEqual([TRACO_1]);
    expect(registro().eventos).toHaveLength(5);
    expect(registro().eventos.at(-1)).toEqual({ tipo: 'desfazer', ordem: 5, instante: 400 });
  });

  it('limpar o desenho: todos os traços saem, e o limpar fica registrado', async () => {
    const registro = abrirTarefa();
    await desenharNoQuadro(TRACO_1);
    agora = 5_700;

    act(() => registro().limpar());

    expect(registro().tracos).toEqual([]);
    expect(registro().temTraco).toBe(false);
    expect(registro().eventos.at(-1)).toEqual({ tipo: 'limpar', ordem: 3, instante: 700 });
  });

  it('desfazer ou limpar sem traço no desenho não registra nada', () => {
    const registro = abrirTarefa();

    act(() => registro().desfazer());
    act(() => registro().limpar());

    expect(registro().eventos).toEqual([]);
  });

  it('próxima tarefa: reiniciar zera o registro e o relógio, e mantém o tamanho do quadro', async () => {
    const registro = abrirTarefa();
    medirQuadro(800, 600);
    await desenharNoQuadro(TRACO_1);
    agora = 9_000;

    act(() => registro().reiniciar());

    expect(registro()).toMatchObject({
      iniciadoEm: 9_000,
      eventos: [],
      tracos: [],
      temTraco: false,
      dimensoes: { largura: 800, altura: 600 },
    });
  });
});
