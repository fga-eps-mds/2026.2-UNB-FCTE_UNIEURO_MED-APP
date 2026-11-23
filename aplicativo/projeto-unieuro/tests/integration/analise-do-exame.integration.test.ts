import { createAttendanceRepository } from '@/db/attendance-repository';
import { createDrawingRepository, type TracingEventRecord } from '@/db/drawing-repository';
import { createModelResultRepository } from '@/db/model-result-repository';
import {
  analisarExame,
  FALHA_NO_CALCULO,
  type DependenciasDaAnalise,
} from '@/features/inferencia/analise';
import { ModeloAusenteError } from '@/features/inferencia/arquivo-do-modelo';
import { LADO_DO_MAPA, type SaidasDoModelo } from '@/features/inferencia/escore';
import type { ModeloCarregado } from '@/features/inferencia/modelo-onnx';

import {
  abrirTabletComAnaEBruno,
  BRUNO,
  cpfProtector,
  type TabletComAnaEBruno,
} from '../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));
// O preparo pelo Skia tem teste próprio, com o Skia de verdade. Aqui cada desenho vira uma
// entrada que mostra de qual tarefa ele veio e quantos traços valeram.
jest.mock('@/features/inferencia/preparo-desenho', () => ({
  prepararDesenho: jest.fn((tracos: { x: number }[][]) =>
    Float32Array.of(tracos[0][0].x, tracos.length),
  ),
}));

const INICIO = '2026-11-03T14:00:00.000Z';
const AGORA = new Date('2026-11-03T14:06:00.000Z');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TAREFAS = [
  { ordem: 1, tipo: 'relogio' },
  { ordem: 2, tipo: 'cubo' },
  { ordem: 3, tipo: 'trilhas' },
] as const;

// Dois traços e um desfazer: só o primeiro traço vale para o modelo.
const eventosDa = (ordem: number): TracingEventRecord[] => [
  { tipo: 'inicio', ordem: 1, instante: 0, x: ordem * 10, y: 1, ponteiro: 'caneta' },
  { tipo: 'ponto', ordem: 2, instante: 16, x: ordem * 10 + 1, y: 2, ponteiro: 'caneta' },
  { tipo: 'inicio', ordem: 3, instante: 40, x: 99, y: 99, ponteiro: 'caneta' },
  { tipo: 'desfazer', ordem: 4, instante: 50 },
];

const mapa = () => new Float32Array(LADO_DO_MAPA * LADO_DO_MAPA).fill(0.25);
const SAIDAS: SaidasDoModelo = {
  probabilidade: 0.67,
  contribuicoes: { relogio: 0.8, cubo: -0.1, trilhas: 0.4 },
  mapas: { relogio: mapa(), cubo: mapa(), trilhas: mapa() },
};

let tablet: TabletComAnaEBruno;
let exameId: number;
let avaliar: jest.Mock;

function dependencias(extra: Partial<DependenciasDaAnalise> = {}): DependenciasDaAnalise {
  avaliar = jest.fn(async () => SAIDAS);
  const modelo: ModeloCarregado = { versao: 'vgg16-semente1-v1.6', modelo: { avaliar } };
  let relogio = 1000;
  return {
    repository: createModelResultRepository(async () => tablet.database),
    carregarModelo: async () => modelo,
    // Cada leitura do relógio avança 1,5 s: o cálculo medido leva 1,5 s.
    agoraMs: () => (relogio += 1500),
    agora: () => AGORA,
    ...extra,
  };
}

const estado = async () =>
  (await tablet.database.getFirstAsync<{ estado: string }>(
    'SELECT estado FROM avaliacao WHERE id = ?',
    [exameId],
  ))!.estado;

async function terminarExame() {
  await tablet.database.runAsync("UPDATE avaliacao SET estado = 'em_andamento' WHERE id = ?", [
    exameId,
  ]);
  const desenhos = createDrawingRepository(async () => tablet.database);
  for (const { ordem, tipo } of TAREFAS) {
    await desenhos.salvarDesenho({
      atendimentoId: exameId,
      ordem,
      tipo,
      largura: 960,
      altura: 600,
      iniciadoEm: INICIO,
      confirmadoEm: INICIO,
      eventos: eventosDa(ordem),
      imagemPng: PNG,
      encerraExame: ordem === 3,
    });
  }
}

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  ({ attendanceId: exameId } = await createAttendanceRepository(
    async () => tablet.database,
    cpfProtector,
  ).createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: '52998224725',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: tablet.anaId,
    startedAt: INICIO,
  }));
  await terminarExame();
});

afterEach(async () => {
  await tablet.fechar();
});

describe('Cenário: escore sem internet', () => {
  it('depois das trilhas, calcula o escore no tablet, grava o resultado e conclui o exame', async () => {
    await expect(estado()).resolves.toBe('processando_resultado');

    const resultado = await analisarExame(tablet.anaId, exameId, dependencias());

    expect(resultado).toEqual({ situacao: 'concluida' });
    await expect(estado()).resolves.toBe('concluida');
    const gravado = await createModelResultRepository(async () => tablet.database).findResult(
      exameId,
    );
    expect(gravado).toMatchObject({
      probability: 0.67,
      contributions: SAIDAS.contribuicoes,
      modelVersion: 'vgg16-semente1-v1.6',
      durationMs: 1500,
      calculatedAt: AGORA.toISOString(),
    });
  });

  it('o modelo recebe só os traços que valem de cada tarefa, sem os desfeitos', async () => {
    await analisarExame(tablet.anaId, exameId, dependencias());

    expect(avaliar).toHaveBeenCalledWith({
      relogio: Float32Array.of(10, 1),
      cubo: Float32Array.of(20, 1),
      trilhas: Float32Array.of(30, 1),
    });
  });

  it('avisa a tela de cada etapa, com o paciente do exame', async () => {
    const aoAvancar = jest.fn();

    await analisarExame(tablet.anaId, exameId, dependencias({ aoAvancar }));

    expect(aoAvancar.mock.calls.map(([etapa]) => etapa)).toEqual([
      'abrindo-modelo',
      'calculando',
      'gravando',
    ]);
    expect(aoAvancar.mock.calls[0][1]).toMatchObject({ patientName: 'José Alves Martins' });
  });
});

describe('falhas do cálculo', () => {
  it('marca o erro e mantém os desenhos quando o modelo falha', async () => {
    const deps = dependencias();
    avaliar.mockRejectedValueOnce(new Error('sessão fechada'));

    await expect(analisarExame(tablet.anaId, exameId, deps)).resolves.toEqual({
      situacao: 'erro',
      mensagem: FALHA_NO_CALCULO,
    });
    await expect(estado()).resolves.toBe('erro_inferencia');
    await expect(
      tablet.database.getFirstAsync('SELECT * FROM resultado_modelo'),
    ).resolves.toBeNull();
  });

  it('calcula de novo depois do erro', async () => {
    const deps = dependencias();
    avaliar.mockRejectedValueOnce(new Error('sessão fechada'));
    await analisarExame(tablet.anaId, exameId, deps);

    await expect(analisarExame(tablet.anaId, exameId, deps)).resolves.toEqual({
      situacao: 'concluida',
    });
  });

  it('avisa quando o APK não tem o modelo', async () => {
    const deps = dependencias({
      carregarModelo: async () => {
        throw new ModeloAusenteError();
      },
    });

    await expect(analisarExame(tablet.anaId, exameId, deps)).resolves.toEqual({
      situacao: 'sem-modelo',
    });
    await expect(estado()).resolves.toBe('erro_inferencia');
  });

  it('recusa um resultado fora do contrato sem gravar nada', async () => {
    const deps = dependencias();
    avaliar.mockResolvedValueOnce({ ...SAIDAS, probabilidade: 1.4 });

    await expect(analisarExame(tablet.anaId, exameId, deps)).resolves.toMatchObject({
      situacao: 'erro',
    });
    await expect(estado()).resolves.toBe('erro_inferencia');
  });
});

describe('quem e o que vai para o modelo', () => {
  it('um exame já concluído não é calculado de novo', async () => {
    await analisarExame(tablet.anaId, exameId, dependencias());
    const deps = dependencias();

    await expect(analisarExame(tablet.anaId, exameId, deps)).resolves.toEqual({
      situacao: 'ja-concluida',
    });
    expect(avaliar).not.toHaveBeenCalled();
  });

  it('um médico não calcula o exame que outro aplicou', async () => {
    const brunoId = (await tablet.repository.findByEmail(BRUNO.email))!.id;
    const deps = dependencias();

    await expect(analisarExame(brunoId, exameId, deps)).resolves.toEqual({
      situacao: 'nao-encontrado',
    });
    expect(avaliar).not.toHaveBeenCalled();
  });

  it('um exame interrompido não vai para o modelo', async () => {
    await tablet.database.runAsync("UPDATE avaliacao SET estado = 'interrompida' WHERE id = ?", [
      exameId,
    ]);
    const deps = dependencias();

    await expect(analisarExame(tablet.anaId, exameId, deps)).resolves.toEqual({
      situacao: 'nao-encontrado',
    });
    expect(avaliar).not.toHaveBeenCalled();
  });
});
