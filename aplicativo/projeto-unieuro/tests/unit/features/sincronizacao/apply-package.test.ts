import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository } from '@/db/attendance-repository';
import { createConsentRepository } from '@/db/consent-repository';
import { createCpfProtector } from '@/db/cpf-protection';
import { createDrawingRepository } from '@/db/drawing-repository';
import { migrate } from '@/db/database';
import { formatHlc } from '@/db/hlc';
import { createProfessionalRepository } from '@/db/professional-repository';
import {
  createSyncRepository,
  type SyncAttendance,
  type SyncOperations,
  type SyncPatient,
  type SyncProfessional,
} from '@/db/sync-repository';
import { applyPackage, emptySummary } from '@/features/sincronizacao/apply-package';
import type { SyncPackage } from '@/features/sincronizacao/sync-package';

import { createTempDatabase, type TempDatabase } from '../../../test-support/real-sqlite';
import { webCryptoAesGcm } from '../../../test-support/web-crypto-aes-gcm';

// Pacotes montados à mão sobre um banco real, sem precisar de um segundo tablet.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const protector = createCpfProtector(async () => new Uint8Array(32).fill(8), webCryptoAesGcm);
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000000';
const NOW = new Date('2026-10-12T12:00:00.000Z');
const FUTURE = Date.now() + 86_400_000;
const PAST = 1_000;
const DESATIVADA_EM = '2026-11-10T15:00:00.000Z';

let temp: TempDatabase;
let database: SQLiteDatabase;
let operations: SyncOperations;
let ana: SyncProfessional;
let jose: SyncPatient;
let attendance: SyncAttendance;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);
  const professionals = createProfessionalRepository(async () => database, protector);
  await professionals.insert({
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crmNumber: '12345',
    crmState: 'DF',
    cpf: '11144477735',
    passwordHash: 'hash',
    createdAt: '2026-09-26T13:00:00.000Z',
  });
  const saved = await professionals.findByEmail('ana.souza@unieuro.com.br');
  const { attendanceId } = await createAttendanceRepository(
    async () => database,
    protector,
  ).createAttendance({
    patient: {
      name: 'José Alves Martins',
      cpf: '52998224725',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    },
    professionalId: saved!.id,
    startedAt: '2026-10-09T14:32:00.000Z',
  });
  // Só a avaliação finalizada viaja.
  await createConsentRepository(async () => database, protector).salvarDecisao({
    atendimentoId: attendanceId,
    versaoTermo: 'tcle-2026-10',
    quemAssina: 'paciente',
    aceito: true,
    assinaturaPng: new Uint8Array([1, 2, 3]),
    decididoEm: '2026-10-09T14:35:00.000Z',
  });
  await createDrawingRepository(async () => database).salvarDesenho({
    atendimentoId: attendanceId,
    ordem: 1,
    tipo: 'relogio',
    largura: 800,
    altura: 600,
    iniciadoEm: '2026-10-09T14:40:00.000Z',
    confirmadoEm: '2026-10-09T14:42:00.000Z',
    eventos: [{ tipo: 'inicio', ordem: 1, instante: 0, x: 1, y: 2, ponteiro: 'dedo' }],
    imagemPng: new Uint8Array([4, 5, 6]),
  });
  await database.runAsync("UPDATE avaliacao SET estado = 'concluida'");
  operations = await createSyncRepository(async () => database, protector).direct();
  [ana] = await operations.listProfessionals();
  [jose] = await operations.listPatients();
  [attendance] = await operations.listAttendances();
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

const fromOther = (seq: number, millis: number) => ({
  versao_hlc: formatHlc({ millis, counter: 0, node: OTHER }),
  origem_id: OTHER,
  origem_seq: seq,
});

function syncPackage(records: Partial<SyncPackage> = {}): SyncPackage {
  return {
    formato: 'med-sync',
    versao_pacote: 1,
    versao_esquema: 4,
    origem: OTHER,
    gerado_em: NOW.toISOString(),
    vetor: {},
    profissionais: [],
    pacientes: [],
    avaliacoes: [],
    aliases_profissional: [],
    aliases_paciente: [],
    ...records,
  };
}

const apply = (records: Partial<SyncPackage>) =>
  applyPackage(operations, syncPackage(records), NOW);

const conflicts = () =>
  database.getAllAsync<{ tipo: string; tabela: string; motivo: string; dados: string }>(
    'SELECT tipo, tabela, motivo, dados FROM sync_conflito ORDER BY id',
  );

describe('registros já recebidos', () => {
  it('ignora o que o vetor deste tablet já cobre', async () => {
    const local = await operations.getLocalDeviceId();

    const summary = await apply({ profissionais: [{ ...ana, nome: 'Outra versão' }] });

    expect(summary).toEqual({ ...emptySummary(), skipped: 1 });
    expect((await operations.listProfessionals())[0]).toMatchObject({
      nome: 'Ana Carolina Souza',
      origem_id: local,
    });
  });

  it('a mesma versão exata não muda nada', async () => {
    const summary = await apply({ profissionais: [{ ...ana, origem_seq: 50 }] });

    expect(summary.professionals).toEqual({ inserted: 0, updated: 0, unified: 0 });
    expect(await conflicts()).toEqual([]);
  });
});

describe('registros inválidos', () => {
  it.each([
    ['profissional', { profissionais: [{ uuid: 'x' }] }],
    ['paciente', { pacientes: [{ ...jose, cpf: '123' }] }],
    ['avaliacao', { avaliacoes: ['texto'] }],
  ])('recusa um registro de %s sem parar o pacote', async (tabela, records) => {
    const summary = await apply(records as Partial<SyncPackage>);

    expect(summary.quarantined).toBe(1);
    expect(await conflicts()).toEqual([
      expect.objectContaining({ tipo: 'quarentena', tabela, motivo: 'registro_invalido' }),
    ]);
  });
});

describe('profissional', () => {
  it('mesmo uuid com o CRM corrigido é uma edição comum', async () => {
    const summary = await apply({
      profissionais: [{ ...ana, crm_numero: '99999', uf_crm: 'GO', ...fromOther(1, FUTURE) }],
    });

    expect(summary).toMatchObject({ quarantined: 0, professionals: { updated: 1 } });
    expect((await operations.listProfessionals())[0]).toMatchObject({
      crm_numero: '99999',
      uf_crm: 'GO',
    });
  });

  it('mesmo uuid com outro CPF vai para a quarentena', async () => {
    const summary = await apply({
      profissionais: [{ ...ana, cpf: '52998224725', ...fromOther(1, FUTURE) }],
    });

    expect(summary.quarantined).toBe(1);
    expect(await conflicts()).toEqual([
      expect.objectContaining({ motivo: 'identidade_divergente', tabela: 'profissional' }),
    ]);
  });

  it('CRM corrigido que já é de outro profissional daqui vai para a quarentena', async () => {
    await createProfessionalRepository(async () => database, protector).insert({
      name: 'Bruno Lima',
      email: 'bruno@unieuro.com.br',
      crmNumber: '54321',
      crmState: 'GO',
      cpf: '52998224725',
      passwordHash: 'hash',
      createdAt: '2026-09-26T13:00:00.000Z',
    });

    const summary = await apply({
      profissionais: [{ ...ana, crm_numero: '54321', uf_crm: 'GO', ...fromOther(1, FUTURE) }],
    });

    expect(summary).toMatchObject({ quarantined: 1, professionals: { updated: 0 } });
    const [entry] = await conflicts();
    expect(entry).toMatchObject({ motivo: 'crm_em_uso' });
    expect(entry.dados).not.toContain(ana.cpf);
    expect((await operations.findProfessionalByUuid(ana.uuid))!.crm_numero).toBe('12345');
  });

  it('CRM de outro profissional numa versão mais antiga não muda nada', async () => {
    const summary = await apply({
      profissionais: [{ ...ana, crm_numero: '99999', ...fromOther(1, PAST) }],
    });

    expect(summary).toMatchObject({ quarantined: 0, conflicts: 1 });
    expect((await operations.listProfessionals())[0].crm_numero).toBe('12345');
  });

  it('versão mais nova desativada desativa aqui, com a data da desativação', async () => {
    const summary = await apply({
      profissionais: [{ ...ana, ativo: 0, desativacao: DESATIVADA_EM, ...fromOther(1, FUTURE) }],
    });

    expect(summary.professionals.updated).toBe(1);
    expect((await operations.listProfessionals())[0]).toMatchObject({
      ativo: 0,
      desativacao: DESATIVADA_EM,
      origem_id: OTHER,
    });
  });

  it('versão mais antiga desativada também desativa, como gravação nova deste tablet', async () => {
    const local = await operations.getLocalDeviceId();

    const summary = await apply({
      profissionais: [{ ...ana, ativo: 0, desativacao: DESATIVADA_EM, ...fromOther(1, PAST) }],
    });

    expect(summary.professionals.updated).toBe(1);
    const [result] = await operations.listProfessionals();
    expect(result).toMatchObject({ ativo: 0, desativacao: DESATIVADA_EM, origem_id: local });
    expect(result.versao_hlc > ana.versao_hlc).toBe(true);
    expect(result.versao_hlc > formatHlc({ millis: PAST, counter: 0, node: OTHER })).toBe(true);
  });

  it('versão mais nova ativa não reativa quem foi desativado aqui, nem troca a data', async () => {
    await database.runAsync('UPDATE profissional SET ativo = 0, desativacao = ?', [DESATIVADA_EM]);
    [ana] = await operations.listProfessionals();

    await apply({
      profissionais: [
        { ...ana, ativo: 1, desativacao: null, nome: 'Ana editada', ...fromOther(1, FUTURE) },
      ],
    });

    expect((await operations.listProfessionals())[0]).toMatchObject({
      nome: 'Ana editada',
      ativo: 0,
      desativacao: DESATIVADA_EM,
    });
  });

  it('desativação sem data, de um banco anterior à #5, recebe a data da sincronização', async () => {
    await apply({
      profissionais: [{ ...ana, ativo: 0, desativacao: null, ...fromOther(1, PAST) }],
    });

    expect((await operations.listProfessionals())[0]).toMatchObject({
      ativo: 0,
      desativacao: NOW.toISOString(),
    });
  });

  it('a versão perdedora fica registrada sem CPF nem hash da senha', async () => {
    await apply({
      profissionais: [{ ...ana, nome: 'Versão antiga', ...fromOther(1, PAST) }],
    });

    const [entry] = await conflicts();
    expect(entry).toMatchObject({ tipo: 'versao_perdedora', motivo: 'edicao_concorrente' });
    expect(entry.dados).toContain('Versão antiga');
    expect(entry.dados).not.toContain(ana.cpf);
    expect(entry.dados).not.toContain(ana.senha_hash);
  });

  it('a unificação recebida vale antes dos registros do pacote', async () => {
    const smaller = '00000000-0000-4000-8000-000000000001';

    await apply({ aliases_profissional: [{ uuid_alias: ana.uuid, uuid_principal: smaller }] });

    expect((await operations.listProfessionals())[0].uuid).toBe(smaller);
  });
});

describe('paciente', () => {
  it('mesmo uuid com outro CPF vai para a quarentena, sem dado do paciente', async () => {
    const summary = await apply({
      pacientes: [{ ...jose, cpf: '39053344705', ...fromOther(1, FUTURE) }],
    });

    expect(summary.quarantined).toBe(1);
    const [entry] = await conflicts();
    expect(entry).toMatchObject({ motivo: 'identidade_divergente', tabela: 'paciente' });
    expect(entry.dados).not.toContain(jose.nome);
    expect(entry.dados).not.toContain(jose.numero_ficha);
  });

  it('versão mais nova atualiza os dados, mas não a ficha deste tablet', async () => {
    const summary = await apply({
      pacientes: [
        { ...jose, escolaridade_anos: 9, numero_ficha: '2026-0500', ...fromOther(1, FUTURE) },
      ],
    });

    expect(summary.patients.updated).toBe(1);
    expect((await operations.listPatients())[0]).toMatchObject({
      escolaridade_anos: 9,
      numero_ficha: jose.numero_ficha,
    });
  });

  it('versão mais antiga não muda nada e fica registrada', async () => {
    const summary = await apply({
      pacientes: [{ ...jose, escolaridade_anos: 1, ...fromOther(1, PAST) }],
    });

    expect(summary.patients.updated).toBe(0);
    expect(summary.conflicts).toBe(1);
    expect((await operations.listPatients())[0].escolaridade_anos).toBe(5);
  });

  it('exclusão mais nova exclui aqui, com a data de quem excluiu', async () => {
    const summary = await apply({
      pacientes: [{ ...jose, ativo: 0, exclusao: DESATIVADA_EM, ...fromOther(1, FUTURE) }],
    });

    expect(summary.patients.updated).toBe(1);
    expect((await operations.listPatients())[0]).toMatchObject({
      ativo: 0,
      exclusao: DESATIVADA_EM,
      origem_id: OTHER,
    });
  });

  it('exclusão mais antiga também exclui, como gravação nova deste tablet', async () => {
    const local = await operations.getLocalDeviceId();

    const summary = await apply({
      pacientes: [{ ...jose, ativo: 0, exclusao: DESATIVADA_EM, ...fromOther(1, PAST) }],
    });

    expect(summary.patients.updated).toBe(1);
    expect((await operations.listPatients())[0]).toMatchObject({
      ativo: 0,
      exclusao: DESATIVADA_EM,
      origem_id: local,
    });
  });

  it('versão mais nova ativa não traz de volta o paciente excluído aqui', async () => {
    await database.runAsync('UPDATE paciente SET ativo = 0, exclusao = ?', [DESATIVADA_EM]);
    [jose] = await operations.listPatients();

    await apply({
      pacientes: [
        { ...jose, ativo: 1, exclusao: null, escolaridade_anos: 12, ...fromOther(1, FUTURE) },
      ],
    });

    expect((await operations.listPatients())[0]).toMatchObject({
      escolaridade_anos: 12,
      ativo: 0,
      exclusao: DESATIVADA_EM,
    });
  });

  it('exclusão sem data recebe a data da sincronização', async () => {
    await apply({ pacientes: [{ ...jose, ativo: 0, exclusao: null, ...fromOther(1, PAST) }] });

    expect((await operations.listPatients())[0]).toMatchObject({
      ativo: 0,
      exclusao: NOW.toISOString(),
    });
  });
});

describe('atendimento', () => {
  const NEW_UUID = '44444444-4444-4444-8444-444444444444';
  const count = (table: string) =>
    database
      .getFirstAsync<{ total: number }>(`SELECT count(*) AS total FROM ${table}`)
      .then((row) => row!.total);

  it('avaliação nova entra com o consentimento, as tarefas, o desenho e o traçado', async () => {
    const summary = await apply({
      avaliacoes: [{ ...attendance, uuid: NEW_UUID, ...fromOther(1, FUTURE) }],
    });

    expect(summary.attendances.inserted).toBe(1);
    const copy = (await operations.listAttendances()).find((row) => row.uuid === NEW_UUID);
    expect(copy).toEqual({ ...attendance, uuid: NEW_UUID, ...fromOther(1, FUTURE) });
    await expect(count('desenho')).resolves.toBe(2);
    await expect(count('evento_tracado')).resolves.toBe(2);
  });

  it('avaliação que já existe aqui não muda, e outra versão dela fica para análise', async () => {
    const summary = await apply({
      avaliacoes: [{ ...attendance, estado: 'interrompida', ...fromOther(1, FUTURE) }],
    });

    expect(summary).toMatchObject({ quarantined: 1, attendances: { updated: 0 } });
    expect(await conflicts()).toEqual([
      expect.objectContaining({ tabela: 'avaliacao', motivo: 'avaliacao_finalizada' }),
    ]);
    expect((await operations.listAttendances())[0].estado).toBe('concluida');
  });

  it('a mesma avaliação recebida de novo não muda nada', async () => {
    const summary = await apply({ avaliacoes: [{ ...attendance, ...fromOther(1, FUTURE) }] });

    expect(summary).toMatchObject({ quarantined: 0, attendances: { inserted: 0, updated: 0 } });
    expect(await conflicts()).toEqual([]);
  });

  it('a exclusão da avaliação é aplicada com a marca de quem excluiu', async () => {
    const summary = await apply({
      avaliacoes: [{ ...attendance, ativo: 0, exclusao: DESATIVADA_EM, ...fromOther(1, FUTURE) }],
    });

    expect(summary.attendances.updated).toBe(1);
    expect((await operations.listAttendances())[0]).toMatchObject({
      ativo: 0,
      exclusao: DESATIVADA_EM,
      origem_id: OTHER,
    });
  });

  it('a exclusão sem data fica com a data da última alteração', async () => {
    await apply({
      avaliacoes: [{ ...attendance, ativo: 0, exclusao: null, ...fromOther(1, FUTURE) }],
    });

    expect((await operations.listAttendances())[0].exclusao).toBe(attendance.last_update);
  });

  it('a versão ativa não desfaz a exclusão feita aqui', async () => {
    await database.runAsync('UPDATE avaliacao SET ativo = 0, exclusao = ?', [DESATIVADA_EM]);

    const summary = await apply({ avaliacoes: [{ ...attendance, ...fromOther(1, FUTURE) }] });

    expect(summary.attendances.updated).toBe(0);
    expect((await operations.listAttendances())[0].ativo).toBe(0);
  });

  it('o profissional ou o paciente que viajam pelo uuid antigo são encontrados pelo alias', async () => {
    const old = '99999999-9999-4999-8999-999999999999';
    await operations.unify('paciente', 1, jose.uuid, old);

    const summary = await apply({
      avaliacoes: [{ ...attendance, uuid: NEW_UUID, paciente_uuid: old, ...fromOther(1, FUTURE) }],
    });

    expect(summary.attendances.inserted).toBe(1);
    const attendances = await operations.listAttendances();
    expect(attendances.map((row) => row.paciente_uuid)).toEqual([jose.uuid, jose.uuid]);
  });
});

describe('fim da importação', () => {
  it('guarda o vetor recebido e leva o relógio para depois do mais novo', async () => {
    await apply({
      vetor: { [OTHER]: 3 },
      profissionais: [{ ...ana, nome: 'Ana nova', ...fromOther(3, FUTURE) }],
    });

    await expect(operations.readVector()).resolves.toMatchObject({ [OTHER]: 3 });
    const counter = await database.getFirstAsync<{ ultimo_hlc: string }>(
      'SELECT ultimo_hlc FROM sync_contador',
    );
    expect(counter!.ultimo_hlc > formatHlc({ millis: FUTURE, counter: 0, node: OTHER })).toBe(true);
  });
});
