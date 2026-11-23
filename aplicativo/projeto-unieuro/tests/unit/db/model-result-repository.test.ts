import { createAttendanceRepository } from '@/db/attendance-repository';
import {
  createDrawingRepository,
  type TaskType,
  type TracingEventRecord,
} from '@/db/drawing-repository';
import {
  createModelResultRepository,
  type ModelResultRecord,
  type SqliteModelResultRepository,
} from '@/db/model-result-repository';

import {
  abrirTabletComAnaEBruno,
  BRUNO,
  cpfProtector,
  hashDaSenhaDeTeste,
  type TabletComAnaEBruno,
} from '../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const INICIO = '2026-11-03T14:00:00.000Z';
const CALCULADO_EM = '2026-11-03T14:05:00.000Z';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TAREFAS: { ordem: number; tipo: TaskType }[] = [
  { ordem: 1, tipo: 'relogio' },
  { ordem: 2, tipo: 'cubo' },
  { ordem: 3, tipo: 'trilhas' },
];

// Um traço com dois pontos, um desfazer e outro traço: o repositório devolve tudo, na ordem.
const eventosDa = (ordem: number): TracingEventRecord[] => [
  { tipo: 'inicio', ordem: 1, instante: 0, x: ordem, y: 1, ponteiro: 'caneta', pressao: 0.4 },
  { tipo: 'ponto', ordem: 2, instante: 16, x: ordem + 1, y: 2, ponteiro: 'caneta' },
  { tipo: 'desfazer', ordem: 3, instante: 30 },
  {
    tipo: 'inicio',
    ordem: 4,
    instante: 40,
    x: 5,
    y: 6,
    ponteiro: 'dedo',
    inclinacaoX: 10,
    inclinacaoY: -5,
  },
];

const mapa = (base: number) =>
  Float32Array.from({ length: 64 }, (_, indice) => (indice === 0 ? 1 : (base + indice) / 200));

const RESULTADO: ModelResultRecord = {
  probability: 0.8125,
  contributions: { relogio: 0.75, cubo: -0.25, trilhas: 1.5 },
  maps: { relogio: mapa(1), cubo: mapa(2), trilhas: mapa(3) },
  modelVersion: 'vgg16-semente1-v1.6',
  durationMs: 2140,
  calculatedAt: CALCULADO_EM,
};

let tablet: TabletComAnaEBruno;
let repository: SqliteModelResultRepository;
let exameId: number;

async function gravarDesenhos(tarefas = TAREFAS) {
  const desenhos = createDrawingRepository(async () => tablet.database);
  for (const { ordem, tipo } of tarefas) {
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
      encerraExame: false,
    });
  }
}

const mudarEstado = (estado: string) =>
  tablet.database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [estado, exameId]);

const estadoDoExame = async () =>
  (await tablet.database.getFirstAsync<{ estado: string }>(
    'SELECT estado FROM avaliacao WHERE id = ?',
    [exameId],
  ))!.estado;

async function criarSuperusuario(ativo = true): Promise<number> {
  await tablet.repository.insertSuperuser(
    {
      name: 'Carlos Bernardo Tauil',
      email: 'carlos.tauil@unieuro.com.br',
      crmNumber: '12771',
      crmState: 'DF',
      cpf: '39053344705',
      passwordHash: await hashDaSenhaDeTeste(),
      createdAt: '2026-09-26T13:00:00.000Z',
    },
    null,
  );
  const id = (await tablet.repository.findByEmail('carlos.tauil@unieuro.com.br'))!.id;
  if (!ativo)
    await tablet.database.runAsync('UPDATE profissional SET ativo = 0 WHERE id = ?', [id]);
  return id;
}

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
  repository = createModelResultRepository(async () => tablet.database);
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
  await mudarEstado('em_andamento');
  await gravarDesenhos();
  await mudarEstado('processando_resultado');
});

afterEach(async () => {
  await tablet.fechar();
});

describe('findExamForAnalysis', () => {
  it('traz o exame, o paciente e o traçado de cada tarefa, com os desfeitos, na ordem', async () => {
    const exame = await repository.findExamForAnalysis(tablet.anaId, exameId);

    expect(exame).toEqual({
      id: exameId,
      state: 'processando_resultado',
      patientName: 'José Alves Martins',
      recordNumber: expect.any(String),
      events: { relogio: eventosDa(1), cubo: eventosDa(2), trilhas: eventosDa(3) },
    });
  });

  it('um médico não analisa o exame que outro aplicou', async () => {
    const brunoId = (await tablet.repository.findByEmail(BRUNO.email))!.id;

    await expect(repository.findExamForAnalysis(brunoId, exameId)).resolves.toBeNull();
  });

  it('o superusuário ativo analisa o exame de qualquer médico; o desativado, não', async () => {
    const superusuario = await criarSuperusuario();

    await expect(repository.findExamForAnalysis(superusuario, exameId)).resolves.not.toBeNull();
    await tablet.database.runAsync('UPDATE profissional SET ativo = 0 WHERE id = ?', [
      superusuario,
    ]);
    await expect(repository.findExamForAnalysis(superusuario, exameId)).resolves.toBeNull();
  });

  it('não traz o exame que não existe', async () => {
    await expect(repository.findExamForAnalysis(tablet.anaId, exameId + 99)).resolves.toBeNull();
  });
});

describe('saveResult', () => {
  it('grava o resultado e conclui o exame na mesma operação', async () => {
    await expect(repository.saveResult(exameId, RESULTADO)).resolves.toBe(true);

    await expect(estadoDoExame()).resolves.toBe('concluida');
    await expect(repository.findResult(exameId)).resolves.toEqual(RESULTADO);
  });

  it('guarda os mapas sem perder nenhuma casa do float32', async () => {
    await repository.saveResult(exameId, RESULTADO);

    const gravado = await repository.findResult(exameId);
    expect(Array.from(gravado!.maps.trilhas)).toEqual(Array.from(RESULTADO.maps.trilhas));
  });

  it('aceita um novo cálculo depois do erro na tentativa anterior', async () => {
    await mudarEstado('erro_inferencia');

    await expect(repository.saveResult(exameId, RESULTADO)).resolves.toBe(true);
    await expect(estadoDoExame()).resolves.toBe('concluida');
  });

  it.each(['em_andamento', 'interrompida', 'concluida'])(
    'não grava resultado para exame em "%s"',
    async (estado) => {
      await mudarEstado(estado);

      await expect(repository.saveResult(exameId, RESULTADO)).resolves.toBe(false);
      await expect(repository.findResult(exameId)).resolves.toBeNull();
    },
  );

  it('não grava um segundo resultado para o mesmo exame', async () => {
    await repository.saveResult(exameId, RESULTADO);

    await expect(repository.saveResult(exameId, { ...RESULTADO, probability: 0.1 })).resolves.toBe(
      false,
    );
    await expect(repository.findResult(exameId)).resolves.toMatchObject({ probability: 0.8125 });
  });

  it('se a gravação falha, o exame continua esperando o modelo', async () => {
    await expect(
      repository.saveResult(exameId, { ...RESULTADO, probability: 1.5 }),
    ).rejects.toThrow(/CHECK/);

    await expect(estadoDoExame()).resolves.toBe('processando_resultado');
    await expect(repository.findResult(exameId)).resolves.toBeNull();
  });
});

describe('travas do banco no resultado do modelo', () => {
  const inserirDireto = () =>
    tablet.database.runAsync(
      `INSERT INTO resultado_modelo (id_avaliacao, probabilidade, contribuicao_relogio,
         contribuicao_cubo, contribuicao_trilhas, mapa_relogio, mapa_cubo, mapa_trilhas,
         versao_modelo, duracao_ms, data_hora)
       VALUES (?, 0.5, 0, 0, 0, zeroblob(256), zeroblob(256), zeroblob(256), 'v1', 1, ?)`,
      [exameId, CALCULADO_EM],
    );

  it('recusa resultado para exame que não espera o modelo, por qualquer caminho', async () => {
    await mudarEstado('em_andamento');

    await expect(inserirDireto()).rejects.toThrow('resultado so para exame que espera o modelo');
  });

  it('o resultado gravado não muda nem é apagado', async () => {
    await repository.saveResult(exameId, RESULTADO);

    await expect(
      tablet.database.runAsync('UPDATE resultado_modelo SET probabilidade = 0.1'),
    ).rejects.toThrow('nao pode ser alterado');
    await expect(tablet.database.runAsync('DELETE FROM resultado_modelo')).rejects.toThrow(
      'nao pode ser apagado',
    );
  });

  it('recusa mapa com outro tamanho', async () => {
    await expect(
      repository.saveResult(exameId, {
        ...RESULTADO,
        maps: { ...RESULTADO.maps, cubo: new Float32Array(10) },
      }),
    ).rejects.toThrow(/CHECK/);
  });
});

describe('markError', () => {
  it('marca o erro do exame que estava sendo processado', async () => {
    await repository.markError(exameId, CALCULADO_EM);

    await expect(estadoDoExame()).resolves.toBe('erro_inferencia');
  });

  it('não muda o exame que já foi concluído', async () => {
    await repository.saveResult(exameId, RESULTADO);

    await repository.markError(exameId, CALCULADO_EM);

    await expect(estadoDoExame()).resolves.toBe('concluida');
  });
});

describe('findResult', () => {
  it('não há resultado antes do cálculo', async () => {
    await expect(repository.findResult(exameId)).resolves.toBeNull();
  });
});

describe('findTraces', () => {
  it('traz o quadro e o traçado de cada tarefa gravada, para pôr o mapa sobre o desenho', async () => {
    await expect(repository.findTraces(exameId)).resolves.toEqual({
      relogio: { largura: 960, altura: 600, eventos: eventosDa(1) },
      cubo: { largura: 960, altura: 600, eventos: eventosDa(2) },
      trilhas: { largura: 960, altura: 600, eventos: eventosDa(3) },
    });
  });

  it('exame sem desenho gravado não traz nenhuma tarefa', async () => {
    await expect(repository.findTraces(exameId + 99)).resolves.toEqual({});
  });
});

describe('superusuário desativado', () => {
  it('não vê o exame mesmo tendo sido superusuário', async () => {
    const desativado = await criarSuperusuario(false);

    await expect(repository.findExamForAnalysis(desativado, exameId)).resolves.toBeNull();
  });
});
