import type { SQLiteDatabase } from 'expo-sqlite';

import { createSyncRepository } from '@/db/sync-repository';
import { syncFailure } from '@/features/sincronizacao/error-codes';
import {
  createNearbySession,
  tabletName,
  type NearbySession,
  type NearbyState,
} from '@/features/sincronizacao/nearby-session';
import { createSyncService } from '@/features/sincronizacao/sync-service';

import { FakeAir, type FakeNearby, until } from '../test-support/fake-nearby';
import { abrirTablet, protetorComChave, type TabletDeTeste } from '../test-support/tablet';

// Troca pelo Nearby de ponta a ponta. Só o Nearby é simulado.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual('node:crypto');
  return {
    getRandomBytesAsync: async (size: number) => new Uint8Array(crypto.randomBytes(size)),
  };
});

type Tablet = {
  database: SQLiteDatabase;
  device: TabletDeTeste;
  radio: FakeNearby;
  session: NearbySession;
  service: ReturnType<typeof createSyncService>;
  states: NearbyState[];
};

const opened: TabletDeTeste[] = [];
let nextKey = 1;

async function createTablet(
  air: FakeAir,
  id: string,
  password: string,
  batchMaxBytes?: number,
): Promise<Tablet> {
  const device = await abrirTablet(protetorComChave(nextKey++));
  opened.push(device);
  const { database } = device;
  const radio = air.device(id);
  const service = createSyncService({
    repository: createSyncRepository(async () => database, device.protector),
    batchMaxBytes,
  });
  const session = createNearbySession({
    api: radio,
    sync: service,
    confirmPassword: async (typed) => typed === password,
    wait: async () => undefined,
  });
  const states: NearbyState[] = [];
  session.subscribe((state) => states.push(state));
  return { database, device, radio, session, service, states };
}

async function register(tablet: Tablet, name: string, crm: string, cpf: string) {
  await tablet.device.repository.insert({
    name,
    email: `${crm}@unieuro.com.br`,
    crmNumber: crm,
    crmState: 'DF',
    cpf,
    passwordHash: 'hash',
    createdAt: new Date().toISOString(),
  });
}

// Sem a cifra e o índice do CPF, que são de cada tablet.
const professionals = (tablet: Tablet) =>
  tablet.database.getAllAsync(
    `SELECT uuid, nome, email, crm_numero, uf_crm, senha_hash, criacao, last_update, ativo, desativacao,
       versao_hlc, origem_id, origem_seq
     FROM profissional ORDER BY uuid`,
  );

const phase = (tablet: Tablet) => tablet.session.getState().phase;

async function connect(a: Tablet, b: Tablet) {
  await a.session.start();
  await b.session.start();
  await until(() => {
    const state = a.session.getState();
    return state.phase === 'searching' && state.endpoints.length === 1;
  });
  const state = a.session.getState();
  if (state.phase !== 'searching') throw new Error('o tablet A não está procurando');
  await a.session.connect(state.endpoints[0].endpointId);
  await until(() => phase(a) === 'confirming' && phase(b) === 'confirming');
}

let air: FakeAir;
let anaTablet: Tablet;
let brunoTablet: Tablet;

beforeEach(async () => {
  air = new FakeAir();
  anaTablet = await createTablet(air, 'tablet-a', 'senha-da-ana');
  brunoTablet = await createTablet(air, 'tablet-b', 'senha-do-bruno');
  await register(anaTablet, 'Ana Souza', '11111', '11144477735');
  await register(brunoTablet, 'Bruno Lima', '22222', '22233344405');
});

afterEach(async () => {
  anaTablet.session.stop();
  brunoTablet.session.stop();
  // Espera os eventos simulados antes de fechar os bancos.
  await new Promise((resolve) => setTimeout(resolve, 10));
  for (const device of opened.splice(0)) await device.fechar();
});

describe('sincronização com tablet próximo', () => {
  it('dois tablets próximos trocam os dados nos dois sentidos depois de confirmar dígitos e senha', async () => {
    await connect(anaTablet, brunoTablet);

    for (const tablet of [anaTablet, brunoTablet]) {
      expect(tablet.session.getState()).toMatchObject({ phase: 'confirming', digits: '4821' });
    }
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'done' && phase(brunoTablet) === 'done');

    const stateA = await professionals(anaTablet);
    expect(stateA).toHaveLength(2);
    expect(await professionals(brunoTablet)).toEqual(stateA);
    for (const tablet of [anaTablet, brunoTablet]) {
      expect(tablet.session.getState()).toMatchObject({
        phase: 'done',
        peerConfirmed: true,
        summary: { professionals: { inserted: 1 } },
      });
    }
  });

  it('mostra aos outros tablets só um nome técnico, sem dado de pessoa', async () => {
    await anaTablet.session.start();

    const state = anaTablet.session.getState();
    const { deviceId } = await anaTablet.service.describeLocal();
    expect(state).toMatchObject({ phase: 'searching', localName: tabletName(deviceId) });
    expect(anaTablet.radio.name).toMatch(/^Tablet [0-9A-F]{4}$/);
  });

  it('não aceita a conexão com a senha errada', async () => {
    await connect(anaTablet, brunoTablet);

    await anaTablet.session.confirm('senha-errada');

    expect(anaTablet.session.getState()).toMatchObject({
      phase: 'confirming',
      checking: false,
      error: syncFailure(202),
    });
    expect(anaTablet.radio.accepted.size).toBe(0);
  });

  it('o outro tablet cancelar a confirmação encerra a tentativa sem gravar nada', async () => {
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');

    await brunoTablet.session.cancel();
    await until(() => phase(anaTablet) === 'failed');

    // 8004: o Nearby avisa que o outro lado recusou.
    expect(anaTablet.session.getState()).toMatchObject({
      failure: syncFailure(204, { nearby: 8004 }),
    });
    expect(brunoTablet.session.getState()).toMatchObject({ phase: 'searching' });
    expect(await professionals(anaTablet)).toHaveLength(1);
  });

  it('quem cancela continua vendo o outro tablet na lista', async () => {
    await connect(anaTablet, brunoTablet);

    await anaTablet.session.cancel();

    expect(anaTablet.session.getState()).toMatchObject({
      phase: 'searching',
      endpoints: [{ endpointId: 'tablet-b' }],
    });
  });

  it('na segunda sincronização manda só o que o outro tablet ainda não tem', async () => {
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'done' && phase(brunoTablet) === 'done');
    air.sent.length = 0;

    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'done' && phase(brunoTablet) === 'done');

    const packages = air.sent
      .map(({ text }) => text)
      .filter((text) => text.includes('"tipo":"lote"'));
    expect(packages).toHaveLength(2);
    for (const text of packages) expect(text).toContain('\\"profissionais\\":[]');
    expect(anaTablet.session.getState()).toMatchObject({
      summary: { professionals: { inserted: 0, updated: 0 } },
    });
  });

  it('se a conexão cai antes do primeiro lote chegar, nada é gravado no tablet que não recebeu', async () => {
    // O lote do tablet A nunca chega ao B.
    air.dropWhen = (text) => text.includes('"tipo":"lote"') && text.includes('Ana Souza');
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(brunoTablet) !== 'syncing' && phase(brunoTablet) !== 'waiting');

    expect(brunoTablet.session.getState()).toMatchObject({
      phase: 'failed',
      failure: syncFailure(206),
    });
    expect(await professionals(brunoTablet)).toHaveLength(1);
  });

  it('se a conexão cai depois de receber, o que chegou fica salvo e a tela avisa para conferir o outro tablet', async () => {
    // A confirmação do tablet B nunca chega ao A.
    air.dropWhen = (text, from) => from === 'tablet-b' && text.includes('"tipo":"lote_ok"');
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'done' && phase(brunoTablet) === 'done');

    expect(anaTablet.session.getState()).toMatchObject({
      phase: 'done',
      peerConfirmed: false,
      partial: false,
    });
    expect(await professionals(anaTablet)).toHaveLength(2);
    expect(await professionals(brunoTablet)).toHaveLength(2);
    // Nenhum lote do A foi confirmado.
    expect(await logReasons(anaTablet, 'envio')).toEqual([{ resultado: 'erro', motivo: '341' }]);
  });

  it('tablets com versões diferentes do aplicativo não trocam dados', async () => {
    const describe = brunoTablet.service.describeLocal;
    brunoTablet.service.describeLocal = async () => ({ ...(await describe()), schemaVersion: 99 });
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'failed' && phase(brunoTablet) === 'failed');

    // Cada um detecta a diferença ao ler a apresentação do outro.
    for (const tablet of [anaTablet, brunoTablet]) {
      expect(tablet.session.getState()).toMatchObject({ failure: { code: 301 } });
      expect(await professionals(tablet)).toHaveLength(1);
    }
  });

  it('para quando o outro tablet manda dados que este não reconhece', async () => {
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');

    // Chega antes de qualquer mensagem de verdade.
    anaTablet.radio.emit('onMessage', { endpointId: 'tablet-b', text: 'lixo sem cabeçalho' });
    await until(() => phase(anaTablet) === 'failed');

    expect(anaTablet.session.getState()).toMatchObject({ failure: syncFailure(304) });
    expect(await professionals(anaTablet)).toHaveLength(1);
  });

  it('avisa quando o outro tablet não consegue gravar', async () => {
    const receive = brunoTablet.service.receiveBatches;
    brunoTablet.service.receiveBatches = () => ({
      ...receive(),
      apply: async () => ({ ok: false, reason: 'erro', failure: syncFailure(313) }),
    });
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'failed' && phase(brunoTablet) === 'failed');

    // O A recebeu o lote do B antes da falha, por isso avisa que ele ficou.
    expect(anaTablet.session.getState()).toMatchObject({
      failure: syncFailure(320, { kept: true }),
    });
    expect(brunoTablet.session.getState()).toMatchObject({ failure: syncFailure(313) });
    expect(await professionals(brunoTablet)).toHaveLength(1);
    brunoTablet.service.receiveBatches = receive;
  });

  it('recusa um terceiro tablet enquanto já está conectado a outro', async () => {
    const carla = await createTablet(air, 'tablet-c', 'senha-da-carla');
    await connect(anaTablet, brunoTablet);
    await carla.session.start();

    await carla.session.connect('tablet-a');
    await until(() => carla.states.some((state) => state.phase === 'failed'));

    expect(anaTablet.session.getState()).toMatchObject({
      phase: 'confirming',
      peerName: brunoTablet.radio.name,
    });
    carla.session.stop();
  });
});

/** CPF com os dígitos verificadores certos, a partir de 9 dígitos. */
function validCpf(base: string): string {
  const digit = (digits: string) => {
    const sum = [...digits].reduce(
      (total, char, i) => total + Number(char) * (digits.length + 1 - i),
      0,
    );
    const rest = (sum * 10) % 11;
    return rest === 10 ? '0' : String(rest);
  };
  const first = digit(base);
  return base + first + digit(base + first);
}

const logReasons = (tablet: Tablet, direction: string) =>
  tablet.database.getAllAsync<{ resultado: string; motivo: string | null }>(
    'SELECT resultado, motivo FROM sync_log WHERE direcao = ? ORDER BY id',
    [direction],
  );

const logResults = (tablet: Tablet, direction: string) =>
  tablet.database.getAllAsync<{ resultado: string }>(
    'SELECT resultado FROM sync_log WHERE direcao = ? ORDER BY id',
    [direction],
  );

/** "tablet-a:lote 0", "tablet-b:lote_ok 0"... na ordem em que saíram. */
const batchSteps = () =>
  air.sent.flatMap(({ from, text }) => {
    const match = /"tipo":"(lote_ok|lote)","indice":(\d+)/.exec(text);
    return match ? [`${from}:${match[1]} ${match[2]}`] : [];
  });

describe('envio em lotes', () => {
  // Cada profissional (uns 600 caracteres) vai num lote próprio.
  const SMALL_BATCH = 700;

  beforeEach(async () => {
    for (const device of opened.splice(0)) await device.fechar();
    air = new FakeAir();
    anaTablet = await createTablet(air, 'tablet-a', 'senha-da-ana', SMALL_BATCH);
    brunoTablet = await createTablet(air, 'tablet-b', 'senha-do-bruno', SMALL_BATCH);
    await register(anaTablet, 'Ana Souza', '11111', '11144477735');
    await register(brunoTablet, 'Bruno Lima', '22222', '22233344405');
    for (const [i, name] of ['Carla Dias', 'Davi Rocha', 'Elisa Melo'].entries()) {
      await register(anaTablet, name, `3333${i}`, validCpf(`30000000${i}`));
    }
  });

  async function synchronize() {
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
  }

  it('manda um lote por vez, cada um confirmado antes do próximo, e mostra o progresso', async () => {
    await synchronize();
    await until(() => phase(anaTablet) === 'done' && phase(brunoTablet) === 'done');

    expect(await professionals(brunoTablet)).toEqual(await professionals(anaTablet));
    expect(await professionals(brunoTablet)).toHaveLength(5);

    // O lote seguinte do A só sai depois do `lote_ok` do B.
    const steps = batchSteps().filter(
      (step) => step.startsWith('tablet-a:lote ') || step.startsWith('tablet-b:lote_ok'),
    );
    expect(steps).toEqual([
      'tablet-a:lote 0',
      'tablet-b:lote_ok 0',
      'tablet-a:lote 1',
      'tablet-b:lote_ok 1',
      'tablet-a:lote 2',
      'tablet-b:lote_ok 2',
      'tablet-a:lote 3',
      'tablet-b:lote_ok 3',
    ]);
    expect(brunoTablet.states).toContainEqual(
      expect.objectContaining({ phase: 'syncing', received: 2, toReceive: 4 }),
    );
    expect(anaTablet.states).toContainEqual(
      expect.objectContaining({ phase: 'syncing', sent: 2, toSend: 4 }),
    );
    expect(brunoTablet.session.getState()).toMatchObject({
      phase: 'done',
      partial: false,
      summary: { professionals: { inserted: 4 } },
    });
    expect(await logResults(brunoTablet, 'recebimento')).toEqual([{ resultado: 'sucesso' }]);
    expect(await logResults(anaTablet, 'envio')).toEqual([{ resultado: 'sucesso' }]);
  });

  it('se a conexão cai no meio, os lotes gravados ficam e a troca seguinte manda só o resto', async () => {
    // Cai quando o A tenta mandar o terceiro lote.
    air.dropWhen = (text, from) => from === 'tablet-a' && text.includes('"tipo":"lote","indice":2');
    await synchronize();
    await until(() => phase(brunoTablet) === 'done' && phase(anaTablet) === 'done');

    expect(brunoTablet.session.getState()).toMatchObject({
      phase: 'done',
      partial: true,
      summary: { professionals: { inserted: 2 } },
    });
    expect(await professionals(brunoTablet)).toHaveLength(3);
    expect(await logReasons(brunoTablet, 'recebimento')).toEqual([
      { resultado: 'parcial', motivo: '340' },
    ]);
    // O A recebeu tudo do B; só o B ficou sem o resto, então o A registra 341.
    expect(await logReasons(anaTablet, 'envio')).toEqual([{ resultado: 'parcial', motivo: '341' }]);

    air.dropWhen = () => false;
    air.sent.length = 0;
    await synchronize();
    await until(() => phase(anaTablet) === 'done' && phase(brunoTablet) === 'done');

    expect(await professionals(brunoTablet)).toEqual(await professionals(anaTablet));
    expect(brunoTablet.session.getState()).toMatchObject({
      partial: false,
      summary: { professionals: { inserted: 2 } },
    });
    expect(batchSteps().filter((step) => step.startsWith('tablet-a:lote '))).toEqual([
      'tablet-a:lote 0',
      'tablet-a:lote 1',
    ]);
    expect(await logResults(brunoTablet, 'recebimento')).toEqual([
      { resultado: 'parcial' },
      { resultado: 'sucesso' },
    ]);
  });

  it('um lote fora de ordem para a troca e guarda só o que já tinha sido gravado', async () => {
    // O segundo lote do A chega com o índice errado.
    const original = anaTablet.radio.sendMessage;
    anaTablet.radio.sendMessage = (endpointId, text) =>
      original(endpointId, text.replace('"tipo":"lote","indice":1', '"tipo":"lote","indice":3'));
    await synchronize();
    await until(() => phase(brunoTablet) === 'failed');

    expect(brunoTablet.session.getState()).toMatchObject({
      failure: syncFailure(305, { kept: true }),
    });
    // Só o lote 0 do A entrou: a Ana, além do próprio Bruno.
    expect(await professionals(brunoTablet)).toHaveLength(2);
    expect(await logReasons(brunoTablet, 'recebimento')).toEqual([
      { resultado: 'parcial', motivo: '305' },
    ]);
  });

  it('uma confirmação fora de ordem para a troca', async () => {
    const original = brunoTablet.radio.sendMessage;
    brunoTablet.radio.sendMessage = (endpointId, text) =>
      original(
        endpointId,
        text.replace('"tipo":"lote_ok","indice":0', '"tipo":"lote_ok","indice":2'),
      );
    await synchronize();
    await until(() => phase(anaTablet) === 'failed');

    expect(anaTablet.session.getState()).toMatchObject({ failure: { code: 306 } });
  });

  it('se gravar um lote falha depois de outros gravados, avisa que os anteriores ficaram', async () => {
    const receive = brunoTablet.service.receiveBatches;
    brunoTablet.service.receiveBatches = () => {
      const real = receive();
      return {
        ...real,
        apply: async (json, coverage) =>
          real.applied() === 0
            ? real.apply(json, coverage)
            : { ok: false, reason: 'erro', failure: syncFailure(313, { kept: true }) },
      };
    };
    await synchronize();
    await until(() => phase(brunoTablet) === 'failed');

    expect(brunoTablet.session.getState()).toMatchObject({
      failure: syncFailure(313, { kept: true }),
    });
    expect(await professionals(brunoTablet)).toHaveLength(2);
    brunoTablet.service.receiveBatches = receive;
  });

  it('um erro inesperado ao preparar os lotes para a troca com o código próprio', async () => {
    const prepare = anaTablet.service.prepareBatchesFor;
    anaTablet.service.prepareBatchesFor = async () => {
      throw new Error('disco cheio');
    };
    await synchronize();
    await until(() => phase(anaTablet) === 'failed');

    // Sem "Nenhum dado foi alterado": o A pode já ter gravado lotes do B.
    expect(anaTablet.session.getState()).toMatchObject({ failure: { code: 330 } });
    anaTablet.service.prepareBatchesFor = prepare;
  });

  it('uma segunda apresentação no meio da troca para a troca', async () => {
    const original = brunoTablet.radio.sendMessage;
    let hellos = 0;
    brunoTablet.radio.sendMessage = async (endpointId, text) => {
      await original(endpointId, text);
      // Repete a apresentação logo depois de mandar a primeira.
      if (text.includes('"tipo":"ola"') && hellos++ === 0) {
        await original(endpointId, text.replace(/^\d+\|/, '999|'));
      }
    };
    await synchronize();
    await until(() => phase(anaTablet) === 'failed');

    expect(anaTablet.session.getState()).toMatchObject({ failure: { code: 307 } });
  });
});

describe('antes de procurar', () => {
  it('pede as permissões e para se forem negadas', async () => {
    anaTablet.radio.permissionsGranted = false;

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({
      phase: 'blocked',
      reason: 'permissions',
      failure: syncFailure(101),
    });
    expect(anaTablet.radio.advertising).toBe(false);
  });

  it('quando a pessoa não liga o Bluetooth, pede para ligar', async () => {
    anaTablet.radio.radio = { ...anaTablet.radio.radio, bluetooth: false };
    anaTablet.radio.allowEnabling = false;

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({
      phase: 'blocked',
      reason: 'bluetooth',
      failure: syncFailure(102),
    });
  });

  it.each([30, 34, 36])(
    'sem a localização ligada, para também no Android de API %i, que o Nearby 19.3.0 exige',
    async (sdkVersion) => {
      anaTablet.radio.radio = { bluetooth: true, wifi: true, location: false, sdkVersion };
      anaTablet.radio.allowEnabling = false;

      await anaTablet.session.start();

      expect(anaTablet.session.getState()).toEqual({
        phase: 'blocked',
        reason: 'location',
        failure: syncFailure(103),
      });
      expect(anaTablet.radio.advertising).toBe(false);
    },
  );

  it('procura mesmo com o Wi-Fi desligado, mas avisa que fica mais lento', async () => {
    anaTablet.radio.radio = { ...anaTablet.radio.radio, wifi: false };

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toMatchObject({ phase: 'searching', wifiOff: true });
  });

  it('avisa quando não consegue começar a procurar', async () => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    anaTablet.radio.failStart = true;

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({ phase: 'failed', failure: syncFailure(119) });
    expect(consoleErro).toHaveBeenCalledWith(
      'Falha ao começar a procurar tablets',
      expect.any(Error),
    );
    consoleErro.mockRestore();
  });

  it.each([
    [8037, 110],
    [8029, 110],
    [8036, 111],
    [8025, 112],
    [8007, 113],
    [8032, 114],
    [8050, 115],
    [2, 116],
    [3, 117],
  ] as const)('o código %i do Nearby ao procurar vira o código %i', async (status, code) => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    anaTablet.radio.startErrors = [status];

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({
      phase: 'failed',
      failure: syncFailure(code, { nearby: status }),
    });
    consoleErro.mockRestore();
  });

  it('mostra o código também quando a causa não é conhecida', async () => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    anaTablet.radio.startErrors = [9999];

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({
      phase: 'failed',
      failure: syncFailure(119, { nearby: 9999 }),
    });
    consoleErro.mockRestore();
  });

  it('tenta de novo sozinho quando o Nearby ainda estava procurando de antes', async () => {
    anaTablet.radio.startErrors = [8001];

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toMatchObject({ phase: 'searching' });
    expect(anaTablet.radio.stopAll).toHaveBeenCalled();
    expect(anaTablet.radio.advertising).toBe(true);
  });

  it('desiste se a segunda tentativa também falhar', async () => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    anaTablet.radio.startErrors = [8002, 8002];

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({
      phase: 'failed',
      failure: syncFailure(119, { nearby: 8002 }),
    });
    consoleErro.mockRestore();
  });

  it('avisa quando não consegue pedir a conexão e continua procurando', async () => {
    await anaTablet.session.start();
    await brunoTablet.session.start();
    await until(() => {
      const state = anaTablet.session.getState();
      return state.phase === 'searching' && state.endpoints.length === 1;
    });
    anaTablet.radio.failRequest = true;

    await anaTablet.session.connect('tablet-b');

    expect(anaTablet.session.getState()).toMatchObject({
      phase: 'searching',
      connecting: null,
      notice: syncFailure(201, { nearby: 8012 }),
    });
  });

  it('tira da lista o tablet que se afastou', async () => {
    await anaTablet.session.start();
    await brunoTablet.session.start();
    await until(() => {
      const state = anaTablet.session.getState();
      return state.phase === 'searching' && state.endpoints.length === 1;
    });

    anaTablet.radio.emit('onEndpointLost', { endpointId: 'tablet-b' });

    expect(anaTablet.session.getState()).toMatchObject({ phase: 'searching', endpoints: [] });
  });

  it('encerra tudo ao sair da tela', async () => {
    await anaTablet.session.start();

    anaTablet.session.stop();

    expect(anaTablet.session.getState()).toEqual({ phase: 'idle' });
    expect(anaTablet.radio.stopAll).toHaveBeenCalled();
    expect(anaTablet.radio.advertising).toBe(false);
  });

  it('ignora um segundo início enquanto já está procurando', async () => {
    await anaTablet.session.start();
    const calls = anaTablet.radio.stopAll.mock.calls.length;

    await anaTablet.session.start();

    expect(anaTablet.radio.stopAll.mock.calls.length).toBe(calls);
  });
});
