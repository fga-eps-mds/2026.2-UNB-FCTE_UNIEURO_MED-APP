import { syncFailure } from '@/features/sincronizacao/error-codes';
import {
  CONNECTION_TIMEOUT_MS,
  createNearbySession,
  tabletName,
  type NearbySession,
} from '@/features/sincronizacao/nearby-session';
import {
  frameMessage,
  PROTOCOL_FORMAT,
  PROTOCOL_VERSION,
  type ProtocolMessage,
} from '@/features/sincronizacao/nearby-protocol';

import { FakeAir, type FakeNearby, until } from '../../../test-support/fake-nearby';

// Sem banco. A troca completa está em sincronizacao-nearby.integration.test.ts.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const DEVICE = 'a1b2c3d4-0000-4000-8000-000000000000';

function createSession(confirmPassword: (password: string) => Promise<boolean> = async () => true) {
  const radio = new FakeAir().device('tablet-a');
  const sync = {
    describeLocal: jest.fn(async () => ({ deviceId: DEVICE, schemaVersion: 4, vector: {} })),
    prepareBatchesFor: jest.fn(),
    receiveBatches: jest.fn(() => ({
      apply: jest.fn(),
      applied: () => 0,
      summary: () => ({}) as never,
      finish: jest.fn(async () => undefined),
    })),
  };
  const session = createNearbySession({
    api: radio,
    sync,
    confirmPassword,
    wait: async () => undefined,
  });
  return { radio, sync, session };
}

const PEER = 'tablet-x';

/** Leva a sessão até a conferência do código, com um tablet que só existe nos eventos. */
async function reachConfirming(session: NearbySession, radio: FakeNearby) {
  await session.start();
  radio.emit('onConnectionInitiated', {
    endpointId: PEER,
    name: 'Tablet X',
    digits: '1234',
    incoming: true,
  });
}

/** Entrega ao tablet uma mensagem do protocolo, como se viesse do outro. */
function deliver(radio: FakeNearby, message: ProtocolMessage) {
  for (const text of frameMessage(message, '1'))
    radio.emit('onMessage', { endpointId: PEER, text });
}

const hello = (overrides: Partial<Extract<ProtocolMessage, { tipo: 'ola' }>> = {}) =>
  ({
    tipo: 'ola',
    formato: PROTOCOL_FORMAT,
    versao: PROTOCOL_VERSION,
    dispositivo: 'bbbbbbbb-0000-4000-8000-000000000000',
    versao_esquema: 4,
    vetor: {},
    ...overrides,
  }) as ProtocolMessage;

/** Conecta sem mandar nada de verdade: o envio sempre dá certo. */
async function reachSyncing(session: NearbySession, radio: FakeNearby) {
  radio.sendMessage = jest.fn(async () => undefined);
  radio.acceptConnection = jest.fn(async () => undefined);
  await reachConfirming(session, radio);
  await session.confirm('senha');
  radio.emit('onConnectionResult', { endpointId: PEER, ok: true, statusCode: 0 });
}

describe('nome do tablet', () => {
  it('usa só o começo do identificador do tablet, sem dado de pessoa', () => {
    expect(tabletName(DEVICE)).toBe('Tablet A1B2');
  });
});

describe('antes de procurar', () => {
  it('começa parada', () => {
    expect(createSession().session.getState()).toEqual({ phase: 'idle' });
  });

  it.each([
    ['permissions', 101, { permissionsGranted: false }],
    [
      'bluetooth',
      102,
      {
        allowEnabling: false,
        radio: { bluetooth: false, wifi: true, location: true, sdkVersion: 34 },
      },
    ],
    [
      'location',
      103,
      {
        allowEnabling: false,
        radio: { bluetooth: true, wifi: true, location: false, sdkVersion: 36 },
      },
    ],
  ] as const)(
    'para com o motivo "%s", o código %i, e não anuncia nada',
    async (reason, code, setup) => {
      const { radio, sync, session } = createSession();
      Object.assign(radio, setup);

      await session.start();

      expect(session.getState()).toMatchObject({ phase: 'blocked', reason, failure: { code } });
      expect(radio.advertising).toBe(false);
      expect(sync.describeLocal).not.toHaveBeenCalled();
    },
  );

  it('com o Bluetooth e a localização ligados, não pede nada ao sistema', async () => {
    const { radio, session } = createSession();

    await session.start();

    expect(radio.requestEnableBluetooth).not.toHaveBeenCalled();
    expect(radio.requestEnableLocation).not.toHaveBeenCalled();
    session.stop();
  });

  it('com o Bluetooth desligado, pede para ligar e procura quando a pessoa permite', async () => {
    const { radio, session } = createSession();
    radio.radio = { bluetooth: false, wifi: true, location: true, sdkVersion: 34 };

    await session.start();

    expect(radio.requestEnableBluetooth).toHaveBeenCalledTimes(1);
    expect(radio.requestEnableLocation).not.toHaveBeenCalled();
    expect(session.getState()).toMatchObject({ phase: 'searching' });
    expect(radio).toMatchObject({ advertising: true, discovering: true });
    session.stop();
  });

  it('com a localização desligada, pede para ligar e procura quando a pessoa permite', async () => {
    const { radio, session } = createSession();
    radio.radio = { bluetooth: true, wifi: true, location: false, sdkVersion: 36 };

    await session.start();

    expect(radio.requestEnableLocation).toHaveBeenCalledTimes(1);
    expect(radio.requestEnableBluetooth).not.toHaveBeenCalled();
    expect(session.getState()).toMatchObject({ phase: 'searching' });
    session.stop();
  });

  it('com os dois desligados, pede o Bluetooth e depois a localização', async () => {
    const { radio, session } = createSession();
    radio.radio = { bluetooth: false, wifi: true, location: false, sdkVersion: 34 };

    await session.start();

    expect(radio.requestEnableBluetooth).toHaveBeenCalledTimes(1);
    expect(radio.requestEnableLocation).toHaveBeenCalledTimes(1);
    expect(radio.requestEnableBluetooth.mock.invocationCallOrder[0]).toBeLessThan(
      radio.requestEnableLocation.mock.invocationCallOrder[0],
    );
    expect(session.getState()).toMatchObject({ phase: 'searching' });
    session.stop();
  });

  it('quando a pessoa nega o Bluetooth, não chega a pedir a localização', async () => {
    const { radio, session } = createSession();
    radio.allowEnabling = false;
    radio.radio = { bluetooth: false, wifi: true, location: false, sdkVersion: 34 };

    await session.start();

    expect(session.getState()).toMatchObject({ phase: 'blocked', reason: 'bluetooth' });
    expect(radio.requestEnableLocation).not.toHaveBeenCalled();
  });

  it('permite o Bluetooth e nega a localização: para com o código 103', async () => {
    const { radio, session } = createSession();
    radio.radio = { bluetooth: false, wifi: true, location: false, sdkVersion: 34 };
    radio.requestEnableLocation.mockResolvedValueOnce(false);

    await session.start();

    expect(session.getState()).toMatchObject({
      phase: 'blocked',
      reason: 'location',
      failure: { code: 103 },
    });
    expect(radio.advertising).toBe(false);
  });

  it.each([
    ['Bluetooth', 'requestEnableBluetooth', 'bluetooth', 102, { bluetooth: false, location: true }],
    ['localização', 'requestEnableLocation', 'location', 103, { bluetooth: true, location: false }],
  ] as const)(
    'se o pedido de ligar o(a) %s falha, mostra o mesmo aviso de quando a pessoa nega',
    async (_name, request, reason, code, radios) => {
      const { radio, session } = createSession();
      radio.radio = { ...radio.radio, ...radios };
      radio[request].mockRejectedValueOnce(new Error('sem tela'));

      await session.start();

      expect(session.getState()).toMatchObject({ phase: 'blocked', reason, failure: { code } });
    },
  );

  it('ao tentar de novo depois de negar, pede outra vez', async () => {
    const { radio, session } = createSession();
    radio.radio = { bluetooth: false, wifi: true, location: true, sdkVersion: 34 };
    radio.requestEnableBluetooth.mockResolvedValueOnce(false);

    await session.start();
    await session.start();

    expect(radio.requestEnableBluetooth).toHaveBeenCalledTimes(2);
    expect(session.getState()).toMatchObject({ phase: 'searching' });
    session.stop();
  });

  describe('quem sai da tela enquanto a busca começa', () => {
    /** Promessa que o teste resolve quando quiser, como a resposta da pessoa. */
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    }

    it.each([
      ['Bluetooth', 'requestEnableBluetooth', { bluetooth: false, location: true }],
      ['localização', 'requestEnableLocation', { bluetooth: true, location: false }],
    ] as const)(
      'durante o pedido de ligar o(a) %s, não começa a procurar depois que a pessoa permite',
      async (_name, request, radios) => {
        const { radio, sync, session } = createSession();
        radio.radio = { ...radio.radio, ...radios };
        const answer = deferred<boolean>();
        radio[request].mockImplementationOnce(() => answer.promise);

        const starting = session.start();
        await until(() => radio[request].mock.calls.length === 1);
        session.stop();
        answer.resolve(true);
        await starting;

        expect(session.getState()).toEqual({ phase: 'idle' });
        expect(radio).toMatchObject({ advertising: false, discovering: false });
        expect(sync.describeLocal).not.toHaveBeenCalled();
      },
    );

    it('durante o pedido de permissões, não segue para os rádios', async () => {
      const { radio, session } = createSession();
      const answer = deferred<boolean>();
      radio.requestPermissions = () => answer.promise;
      const getRadioState = jest.spyOn(radio, 'getRadioState');

      const starting = session.start();
      session.stop();
      answer.resolve(true);
      await starting;

      expect(session.getState()).toEqual({ phase: 'idle' });
      expect(getRadioState).not.toHaveBeenCalled();
    });

    it('durante a leitura dos dados do tablet, não anuncia', async () => {
      const { radio, sync, session } = createSession();
      const read = deferred<{ deviceId: string; schemaVersion: number; vector: object }>();
      sync.describeLocal.mockImplementationOnce(() => read.promise);

      const starting = session.start();
      await until(() => sync.describeLocal.mock.calls.length === 1);
      session.stop();
      read.resolve({ deviceId: DEVICE, schemaVersion: 4, vector: {} });
      await starting;

      expect(session.getState()).toEqual({ phase: 'idle' });
      expect(radio.advertising).toBe(false);
    });

    it('enquanto os rádios ligam, desliga o que acabou de ligar', async () => {
      const { radio, session } = createSession();
      const discovery = deferred<void>();
      const startDiscovery = radio.startDiscovery;
      radio.startDiscovery = async () => {
        await discovery.promise;
        await startDiscovery();
      };

      const starting = session.start();
      await until(() => radio.advertising);
      session.stop();
      const stopsBefore = radio.stopAll.mock.calls.length;
      discovery.resolve();
      await starting;

      expect(session.getState()).toEqual({ phase: 'idle' });
      expect(radio.stopAll.mock.calls.length).toBe(stopsBefore + 1);
      expect(radio).toMatchObject({ advertising: false, discovering: false });
    });

    it('se a falha chega depois de sair, continua parada e sem aviso de erro', async () => {
      const { radio, sync, session } = createSession();
      let failRead!: () => void;
      sync.describeLocal.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            failRead = () => reject(new Error('banco indisponível'));
          }),
      );

      const starting = session.start();
      await until(() => sync.describeLocal.mock.calls.length === 1);
      session.stop();
      failRead();
      await starting;

      expect(session.getState()).toEqual({ phase: 'idle' });
      expect(radio.advertising).toBe(false);
    });

    it('ao voltar e tocar de novo, só a busca nova continua', async () => {
      const { radio, session } = createSession();
      radio.radio = { ...radio.radio, bluetooth: false };
      const first = deferred<boolean>();
      const second = deferred<boolean>();
      radio.requestEnableBluetooth
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise);
      const phases: string[] = [];
      session.subscribe((state) => phases.push(state.phase));

      const firstStart = session.start();
      await until(() => radio.requestEnableBluetooth.mock.calls.length === 1);
      session.stop();
      const secondStart = session.start();
      await until(() => radio.requestEnableBluetooth.mock.calls.length === 2);
      first.resolve(true);
      await firstStart;

      expect(session.getState()).toEqual({ phase: 'starting' });

      second.resolve(true);
      await secondStart;

      expect(session.getState()).toMatchObject({ phase: 'searching' });
      expect(phases.filter((phase) => phase === 'searching')).toHaveLength(1);
      session.stop();
    });
  });

  it('com tudo liberado, anuncia com o nome técnico e procura', async () => {
    const { radio, session } = createSession();

    await session.start();

    expect(session.getState()).toMatchObject({ phase: 'searching', localName: 'Tablet A1B2' });
    expect(radio).toMatchObject({ advertising: true, discovering: true, name: 'Tablet A1B2' });
    session.stop();
  });

  it('avisa os interessados a cada mudança e para de avisar quem saiu', async () => {
    const { session } = createSession();
    const listener = jest.fn();
    const unsubscribe = session.subscribe(listener);

    await session.start();
    unsubscribe();
    session.stop();

    expect(listener.mock.calls.map(([state]) => state.phase)).toEqual(['starting', 'searching']);
  });
});

describe('pedido de conexão', () => {
  /** Chega à espera depois de aceitar, sem o aviso de conexão concluída. */
  async function reachWaiting(session: NearbySession, radio: FakeNearby) {
    radio.acceptConnection = jest.fn(async () => undefined);
    await reachConfirming(session, radio);
    await session.confirm('senha');
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ao começar a conexão, para de anunciar e de procurar sem derrubar a conexão', async () => {
    const { radio, session } = createSession();

    await reachConfirming(session, radio);

    expect(radio.stopSearching).toHaveBeenCalledTimes(1);
    expect(radio).toMatchObject({ advertising: false, discovering: false });
    expect(session.getState()).toMatchObject({ phase: 'confirming', digits: '1234' });
    session.stop();
  });

  it('segue para a senha mesmo se a busca não parar', async () => {
    const { radio, session } = createSession();
    radio.stopSearching.mockImplementationOnce(() => {
      throw new Error('falhou');
    });

    await reachConfirming(session, radio);

    expect(session.getState()).toMatchObject({ phase: 'confirming' });
    session.stop();
  });

  it('o mesmo tablet pedindo de novo não volta à senha nem cancela a conexão', async () => {
    // Os dois tablets tocaram um no outro ao mesmo tempo.
    const { radio, session } = createSession();
    const reject = jest.spyOn(radio, 'rejectConnection');
    await reachWaiting(session, radio);

    radio.emit('onConnectionInitiated', {
      endpointId: PEER,
      name: 'Tablet X',
      digits: '9999',
      incoming: false,
    });

    expect(session.getState()).toEqual({ phase: 'waiting', peerName: 'Tablet X' });
    expect(reject).not.toHaveBeenCalled();
    session.stop();
  });

  it('o mesmo tablet pedindo de novo na senha mantém os dígitos da primeira', async () => {
    const { radio, session } = createSession();
    await reachConfirming(session, radio);

    radio.emit('onConnectionInitiated', {
      endpointId: PEER,
      name: 'Tablet X',
      digits: '9999',
      incoming: false,
    });

    expect(session.getState()).toMatchObject({ phase: 'confirming', digits: '1234' });
    session.stop();
  });

  it('recusa outro tablet que pede a conexão no meio de uma', async () => {
    const { radio, session } = createSession();
    const reject = jest.spyOn(radio, 'rejectConnection').mockResolvedValue(undefined);
    await reachConfirming(session, radio);

    radio.emit('onConnectionInitiated', {
      endpointId: 'tablet-y',
      name: 'Tablet Y',
      digits: '5555',
      incoming: true,
    });

    expect(reject).toHaveBeenCalledWith('tablet-y');
    expect(session.getState()).toMatchObject({ phase: 'confirming', peerName: 'Tablet X' });
    session.stop();
  });

  it('205: sem o aviso de conexão concluída, desiste e volta a procurar', async () => {
    jest.useFakeTimers();
    const { radio, session } = createSession();
    const disconnect = jest.spyOn(radio, 'disconnect');
    await reachWaiting(session, radio);

    await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS - 1);
    expect(session.getState().phase).toBe('waiting');
    await jest.advanceTimersByTimeAsync(1);

    expect(disconnect).toHaveBeenCalledWith(PEER);
    expect(session.getState()).toMatchObject({
      phase: 'searching',
      connecting: null,
      notice: syncFailure(205),
    });
    expect(radio).toMatchObject({ advertising: true, discovering: true });
    session.stop();
  });

  it('depois de desistir, um aviso atrasado da conexão é ignorado', async () => {
    jest.useFakeTimers();
    const { radio, session } = createSession();
    await reachWaiting(session, radio);
    await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS);

    radio.emit('onConnectionResult', { endpointId: PEER, ok: true, statusCode: 0 });

    expect(session.getState()).toMatchObject({ phase: 'searching' });
    session.stop();
  });

  it('o aviso que chega dentro do prazo cancela a contagem', async () => {
    jest.useFakeTimers();
    const { radio, session } = createSession();
    radio.sendMessage = jest.fn(async () => undefined);
    await reachWaiting(session, radio);

    radio.emit('onConnectionResult', { endpointId: PEER, ok: true, statusCode: 0 });
    await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS);

    expect(session.getState().phase).toBe('syncing');
    session.stop();
  });

  it('ao cancelar na senha, volta a anunciar e procurar', async () => {
    const { radio, session } = createSession();
    const reject = jest.spyOn(radio, 'rejectConnection').mockResolvedValue(undefined);
    await reachConfirming(session, radio);

    await session.cancel();

    expect(reject).toHaveBeenCalledWith(PEER);
    expect(session.getState()).toMatchObject({ phase: 'searching', notice: null });
    expect(radio).toMatchObject({ advertising: true, discovering: true });
    session.stop();
  });

  it('se não conseguir voltar a procurar, mostra a falha da busca', async () => {
    const { radio, session } = createSession();
    jest.spyOn(radio, 'rejectConnection').mockResolvedValue(undefined);
    await reachConfirming(session, radio);
    radio.startErrors = [8007];

    await session.cancel();

    expect(session.getState()).toEqual({
      phase: 'failed',
      failure: syncFailure(113, { nearby: 8007 }),
    });
  });
});

describe('código de cada falha', () => {
  it('104: não consegue ler os dados do próprio tablet', async () => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { radio, sync, session } = createSession();
    sync.describeLocal.mockRejectedValueOnce(new Error('banco fechado'));

    await session.start();

    expect(session.getState()).toEqual({ phase: 'failed', failure: syncFailure(104) });
    expect(radio.advertising).toBe(false);
    consoleErro.mockRestore();
  });

  it('119: o pedido de permissão falha, com o código do Nearby', async () => {
    const { radio, session } = createSession();
    radio.requestPermissions = async () => {
      throw Object.assign(new Error('falhou'), { code: 'ERR_NEARBY_13' });
    };

    await session.start();

    expect(session.getState()).toEqual({
      phase: 'failed',
      failure: syncFailure(119, { nearby: 13 }),
    });
  });

  it('207: a conferência da senha falha e a tela pode tentar de novo', async () => {
    const { radio, session } = createSession(async () => {
      throw new Error('banco fechado');
    });
    await reachConfirming(session, radio);

    await session.confirm('senha');

    expect(session.getState()).toMatchObject({
      phase: 'confirming',
      checking: false,
      error: syncFailure(207),
    });
    session.stop();
  });

  it('203: não consegue aceitar a conexão, com o código do Nearby', async () => {
    const { radio, session } = createSession();
    radio.acceptConnection = async () => {
      throw Object.assign(new Error('falhou'), { code: 'ERR_NEARBY_8011' });
    };
    await reachConfirming(session, radio);

    await session.confirm('senha');

    expect(session.getState()).toEqual({
      phase: 'failed',
      failure: syncFailure(203, { nearby: 8011 }),
    });
  });

  it('205: a conexão falha por um motivo que não é a recusa do outro', async () => {
    const { radio, session } = createSession();
    radio.acceptConnection = jest.fn(async () => undefined);
    await reachConfirming(session, radio);
    await session.confirm('senha');

    radio.emit('onConnectionResult', { endpointId: PEER, ok: false, statusCode: 8007 });

    expect(session.getState()).toEqual({
      phase: 'failed',
      failure: syncFailure(205, { nearby: 8007 }),
    });
  });

  it('206: a apresentação não sai porque a conexão caiu, com o código do Nearby', async () => {
    const { radio, session } = createSession();
    await reachSyncing(session, radio);
    // O próximo envio é o da apresentação de novo, numa conexão nova.
    radio.sendMessage = async () => {
      throw Object.assign(new Error('caiu'), { code: 'ERR_NEARBY_8012' });
    };

    radio.emit('onConnectionResult', { endpointId: PEER, ok: true, statusCode: 0 });
    await until(() => session.getState().phase === 'failed');

    expect(session.getState()).toEqual({
      phase: 'failed',
      failure: syncFailure(206, { nearby: 8012 }),
    });
  });

  it('303: o outro tablet se apresenta com o identificador deste', async () => {
    const { radio, session } = createSession();
    await reachSyncing(session, radio);

    deliver(radio, hello({ dispositivo: DEVICE }));
    await until(() => session.getState().phase === 'failed');

    expect(session.getState()).toEqual({ phase: 'failed', failure: syncFailure(303) });
  });

  it('302: o outro tablet avisa que a versão do aplicativo é diferente', async () => {
    const { radio, session } = createSession();
    await reachSyncing(session, radio);

    deliver(radio, { tipo: 'erro', motivo: 'versao_incompativel' });
    await until(() => session.getState().phase === 'failed');

    expect(session.getState()).toEqual({ phase: 'failed', failure: syncFailure(302) });
  });
});
