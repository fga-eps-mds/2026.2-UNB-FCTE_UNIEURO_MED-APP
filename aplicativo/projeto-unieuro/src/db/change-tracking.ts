import type { SQLiteDatabase } from 'expo-sqlite';

import { compareHlc, receiveHlc } from '@/db/hlc';

// As gravações locais são marcadas pelos gatilhos de `sync-migration.ts`.

type CounterRow = { origem_id: string; ultimo_seq: number; ultimo_hlc: string };

const SELECT_LOCAL_COUNTER = `SELECT c.origem_id, c.ultimo_seq, c.ultimo_hlc
  FROM sync_contador c JOIN dispositivo d ON d.id = c.origem_id
  WHERE d.local = 1`;

async function readLocalCounter(database: SQLiteDatabase): Promise<CounterRow> {
  const counter = await database.getFirstAsync<CounterRow>(SELECT_LOCAL_COUNTER);
  if (!counter) throw new Error('Tablet sem identificação local. A migração 4 não foi aplicada.');
  return counter;
}

export async function getLocalDeviceId(database: SQLiteDatabase): Promise<string> {
  return (await readLocalCounter(database)).origem_id;
}

/** Avança o relógio local para depois de um HLC recebido de outro tablet. */
export async function observeRemoteHlc(
  database: SQLiteDatabase,
  remoteHlc: string,
  now: number = Date.now(),
): Promise<void> {
  const counter = await readLocalCounter(database);
  const advanced = receiveHlc(counter.ultimo_hlc, remoteHlc, now, counter.origem_id);
  if (compareHlc(advanced, counter.ultimo_hlc) === 0) return;
  await database.runAsync('UPDATE sync_contador SET ultimo_hlc = ? WHERE origem_id = ?', [
    advanced,
    counter.origem_id,
  ]);
}
