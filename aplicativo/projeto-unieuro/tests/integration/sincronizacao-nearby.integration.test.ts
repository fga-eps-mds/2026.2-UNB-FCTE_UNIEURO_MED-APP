import type { SQLiteDatabase } from 'expo-sqlite';

import { createSyncRepository } from '@/db/sync-repository';
import {
  createNearbySession,
  NEARBY_MESSAGES,
  tabletName,
  type NearbySession,
  type NearbyState,
} from '@/features/sincronizacao/nearby-session';
import { REFUSAL_MESSAGES, createSyncService } from '@/features/sincronizacao/sync-service';

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

async function createTablet(air: FakeAir, id: string, password: string): Promise<Tablet> {
  const device = await abrirTablet(protetorComChave(nextKey++));
  opened.push(device);
  const { database } = device;
  const radio = air.device(id);
  const service = createSyncService({
    repository: createSyncRepository(async () => database, device.protector),
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
    `SELECT uuid, nome, email, crm_numero, uf_crm, senha_hash, criacao, last_update, ativo,
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
      error: NEARBY_MESSAGES.wrongPassword,
    });
    expect(anaTablet.radio.accepted.size).toBe(0);
  });

  it('o outro tablet cancelar a confirmação encerra a tentativa sem gravar nada', async () => {
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');

    await brunoTablet.session.cancel();
    await until(() => phase(anaTablet) === 'failed');

    expect(anaTablet.session.getState()).toMatchObject({ message: NEARBY_MESSAGES.rejected });
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
      .filter((text) => text.includes('"tipo":"pacote"'));
    expect(packages).toHaveLength(2);
    for (const text of packages) expect(text).toContain('\\"profissionais\\":[]');
    expect(anaTablet.session.getState()).toMatchObject({
      summary: { professionals: { inserted: 0, updated: 0 } },
    });
  });

  it('se a conexão cai antes do pacote chegar, nada é gravado no tablet que não recebeu', async () => {
    // O pacote do tablet A nunca chega ao B.
    air.dropWhen = (text) => text.includes('"tipo":"pacote"') && text.includes('Ana Souza');
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(brunoTablet) !== 'syncing' && phase(brunoTablet) !== 'waiting');

    expect(brunoTablet.session.getState()).toMatchObject({
      phase: 'failed',
      message: NEARBY_MESSAGES.droppedBefore,
    });
    expect(await professionals(brunoTablet)).toHaveLength(1);
  });

  it('se a conexão cai depois de receber, o que chegou fica salvo e a tela avisa para conferir o outro tablet', async () => {
    // A confirmação do tablet B nunca chega ao A.
    air.dropWhen = (text, from) => from === 'tablet-b' && text.includes('"tipo":"concluido"');
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'done' && phase(brunoTablet) === 'done');

    expect(anaTablet.session.getState()).toMatchObject({ phase: 'done', peerConfirmed: false });
    expect(await professionals(anaTablet)).toHaveLength(2);
    expect(await professionals(brunoTablet)).toHaveLength(2);
  });

  it('tablets com versões diferentes do aplicativo não trocam dados', async () => {
    const describe = brunoTablet.service.describeLocal;
    brunoTablet.service.describeLocal = async () => ({ ...(await describe()), schemaVersion: 99 });
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'failed' && phase(brunoTablet) === 'failed');

    for (const tablet of [anaTablet, brunoTablet]) {
      expect(tablet.session.getState()).toMatchObject({
        message: REFUSAL_MESSAGES.versao_incompativel,
      });
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

    expect(anaTablet.session.getState()).toMatchObject({ message: NEARBY_MESSAGES.protocol });
    expect(await professionals(anaTablet)).toHaveLength(1);
  });

  it('avisa quando o outro tablet não consegue importar', async () => {
    const apply = brunoTablet.service.applyPackageJson;
    brunoTablet.service.applyPackageJson = async () => ({
      ok: false,
      reason: 'erro',
      message: REFUSAL_MESSAGES.erro,
    });
    await connect(anaTablet, brunoTablet);
    await anaTablet.session.confirm('senha-da-ana');
    await brunoTablet.session.confirm('senha-do-bruno');
    await until(() => phase(anaTablet) === 'failed' && phase(brunoTablet) === 'failed');

    expect(anaTablet.session.getState()).toMatchObject({ message: NEARBY_MESSAGES.peerFailed });
    expect(brunoTablet.session.getState()).toMatchObject({ message: REFUSAL_MESSAGES.erro });
    brunoTablet.service.applyPackageJson = apply;
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

describe('antes de procurar', () => {
  it('pede as permissões e para se forem negadas', async () => {
    anaTablet.radio.permissionsGranted = false;

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({
      phase: 'blocked',
      reason: 'permissions',
      message: NEARBY_MESSAGES.permissions,
    });
    expect(anaTablet.radio.advertising).toBe(false);
  });

  it('pede para ligar o Bluetooth', async () => {
    anaTablet.radio.radio = { ...anaTablet.radio.radio, bluetooth: false };

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({
      phase: 'blocked',
      reason: 'bluetooth',
      message: NEARBY_MESSAGES.bluetooth,
    });
  });

  it.each([30, 34, 36])(
    'pede a localização ligada também no Android de API %i, que o Nearby 19.3.0 exige',
    async (sdkVersion) => {
      anaTablet.radio.radio = { bluetooth: true, wifi: true, location: false, sdkVersion };

      await anaTablet.session.start();

      expect(anaTablet.session.getState()).toEqual({
        phase: 'blocked',
        reason: 'location',
        message: NEARBY_MESSAGES.location,
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

    expect(anaTablet.session.getState()).toEqual({
      phase: 'failed',
      message: NEARBY_MESSAGES.start,
    });
    expect(consoleErro).toHaveBeenCalledWith(
      'Falha ao começar a procurar tablets',
      expect.any(Error),
    );
    consoleErro.mockRestore();
  });

  it.each([
    [8037, 'Dispositivos próximos'],
    [8029, 'Dispositivos próximos'],
    [8036, 'permissão de localização'],
    [8025, 'Ative a localização'],
    [8007, 'Desligue e ligue os dois'],
    [8032, 'permissão de Wi-Fi'],
    [8050, 'Outro aplicativo'],
    [2, 'desatualizado'],
    [3, 'desativado'],
  ])('explica a causa quando o Nearby recusa com o código %i', async (status, trecho) => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    anaTablet.radio.startErrors = [status];

    await anaTablet.session.start();

    const state = anaTablet.session.getState();
    expect(state.phase).toBe('failed');
    if (state.phase !== 'failed') return;
    expect(state.message).toContain(trecho);
    expect(state.message.endsWith(`(código ${status})`)).toBe(true);
    consoleErro.mockRestore();
  });

  it('mostra o código também quando a causa não é conhecida', async () => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    anaTablet.radio.startErrors = [9999];

    await anaTablet.session.start();

    expect(anaTablet.session.getState()).toEqual({
      phase: 'failed',
      message: `${NEARBY_MESSAGES.start} (código 9999)`,
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
      message: `${NEARBY_MESSAGES.start} (código 8002)`,
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
      notice: NEARBY_MESSAGES.connect,
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
