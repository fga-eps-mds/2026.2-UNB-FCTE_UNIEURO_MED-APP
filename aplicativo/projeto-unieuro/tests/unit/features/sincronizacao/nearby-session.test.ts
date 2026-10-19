import {
  createNearbySession,
  NEARBY_MESSAGES,
  nearbyStatus,
  startFailureMessage,
  tabletName,
} from '@/features/sincronizacao/nearby-session';

import { FakeAir } from '../../../test-support/fake-nearby';

// Sem banco. A troca completa está em sincronizacao-nearby.integration.test.ts.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const DEVICE = 'a1b2c3d4-0000-4000-8000-000000000000';

function createSession() {
  const radio = new FakeAir().device('tablet-a');
  const sync = {
    describeLocal: jest.fn(async () => ({ deviceId: DEVICE, schemaVersion: 4, vector: {} })),
    preparePackageFor: jest.fn(async () => '{}'),
    applyPackageJson: jest.fn(),
  };
  const session = createNearbySession({
    api: radio,
    sync,
    confirmPassword: async () => true,
    wait: async () => undefined,
  });
  return { radio, sync, session };
}

describe('nome do tablet', () => {
  it('usa só o começo do identificador do tablet, sem dado de pessoa', () => {
    expect(tabletName(DEVICE)).toBe('Tablet A1B2');
  });
});

describe('nearbyStatus', () => {
  it('lê o código do erro do módulo nativo', () => {
    expect(nearbyStatus({ code: 'ERR_NEARBY_8034' })).toBe(8034);
    expect(nearbyStatus({ code: 'ERR_NEARBY_-1' })).toBe(-1);
  });

  it('devolve null quando o erro não veio do Nearby', () => {
    expect(nearbyStatus(new Error('outro'))).toBeNull();
    expect(nearbyStatus({ code: 'ERR_OUTRO' })).toBeNull();
    expect(nearbyStatus(null)).toBeNull();
  });
});

describe('startFailureMessage', () => {
  it.each([
    [8034, /permissão de localização/],
    [8025, /Ative a localização/],
    [8031, /Dispositivos próximos/],
    [8050, /Outro aplicativo/],
    [2, /desatualizado/],
  ])('explica o código %i e mostra o número para o suporte', (status, message) => {
    const text = startFailureMessage(status);

    expect(text).toMatch(message);
    expect(text).toContain(`(código ${status})`);
  });

  it('mostra a mensagem geral, com o código, quando a causa não é conhecida', () => {
    expect(startFailureMessage(9999)).toBe(`${NEARBY_MESSAGES.start} (código 9999)`);
  });

  it('sem código, mostra só a mensagem geral', () => {
    expect(startFailureMessage(null)).toBe(NEARBY_MESSAGES.start);
  });
});

describe('antes de procurar', () => {
  it('começa parada', () => {
    expect(createSession().session.getState()).toEqual({ phase: 'idle' });
  });

  it.each([
    ['permissions', { permissionsGranted: false }],
    ['bluetooth', { radio: { bluetooth: false, wifi: true, location: true, sdkVersion: 34 } }],
    ['location', { radio: { bluetooth: true, wifi: true, location: false, sdkVersion: 36 } }],
  ] as const)('para com o motivo "%s" e não anuncia nada', async (reason, setup) => {
    const { radio, sync, session } = createSession();
    Object.assign(radio, setup);

    await session.start();

    expect(session.getState()).toMatchObject({ phase: 'blocked', reason });
    expect(radio.advertising).toBe(false);
    expect(sync.describeLocal).not.toHaveBeenCalled();
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
