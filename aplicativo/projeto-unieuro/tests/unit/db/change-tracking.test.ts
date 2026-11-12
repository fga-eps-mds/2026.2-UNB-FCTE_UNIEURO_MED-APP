import type { SQLiteDatabase } from 'expo-sqlite';

import { getLocalDeviceId, observeRemoteHlc } from '@/db/change-tracking';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { formatHlc, parseHlc } from '@/db/hlc';

import { createTempDatabase, type TempDatabase } from '../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../test-support/web-crypto-aes-gcm';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const protector = createCpfProtector(async () => new Uint8Array(32).fill(4), webCryptoAesGcm);
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000000';

let temp: TempDatabase;
let database: SQLiteDatabase;

const localHlc = async () =>
  (await database.getFirstAsync<{ ultimo_hlc: string }>('SELECT ultimo_hlc FROM sync_contador'))!
    .ultimo_hlc;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

describe('getLocalDeviceId', () => {
  it('devolve a identificação criada pela migração 4', async () => {
    const row = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM dispositivo WHERE local = 1',
    );

    await expect(getLocalDeviceId(database)).resolves.toBe(row!.id);
  });

  it('avisa quando o banco ainda não tem a identificação do tablet', async () => {
    const bare = createTempDatabase();
    const bareDatabase = bare.open();
    await bareDatabase.execAsync(
      'CREATE TABLE dispositivo (id TEXT, local INTEGER); CREATE TABLE sync_contador (origem_id TEXT, ultimo_seq INTEGER, ultimo_hlc TEXT);',
    );

    await expect(getLocalDeviceId(bareDatabase)).rejects.toThrow('migração 4');
    await bareDatabase.closeAsync();
    bare.cleanup();
  });
});

describe('observeRemoteHlc', () => {
  it('leva o relógio local para depois do HLC recebido, que estava adiantado', async () => {
    const deviceId = await getLocalDeviceId(database);
    const remote = formatHlc({ millis: Date.now() + 86_400_000, counter: 4, node: OTHER });

    await observeRemoteHlc(database, remote);

    const advanced = parseHlc(await localHlc());
    expect(advanced).toEqual({ millis: parseHlc(remote)!.millis, counter: 5, node: deviceId });
  });

  it('com um HLC recebido mais antigo, o relógio local continua andando para frente', async () => {
    await observeRemoteHlc(database, formatHlc({ millis: 2_000, counter: 0, node: OTHER }), 5_000);
    const before = await localHlc();

    await observeRemoteHlc(database, formatHlc({ millis: 1, counter: 0, node: OTHER }), 5_000);

    expect((await localHlc()) > before).toBe(true);
  });

  it('ignora um HLC recebido fora do formato', async () => {
    await observeRemoteHlc(database, formatHlc({ millis: 2_000, counter: 0, node: OTHER }), 1);
    const before = await localHlc();

    await observeRemoteHlc(database, 'relogio-quebrado');

    expect(await localHlc()).toBe(before);
  });
});
