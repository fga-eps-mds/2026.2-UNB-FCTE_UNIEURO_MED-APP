import { syncFailure } from '@/features/sincronizacao/error-codes';
import {
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
    ['bluetooth', 102, { radio: { bluetooth: false, wifi: true, location: true, sdkVersion: 34 } }],
    ['location', 103, { radio: { bluetooth: true, wifi: true, location: false, sdkVersion: 36 } }],
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
