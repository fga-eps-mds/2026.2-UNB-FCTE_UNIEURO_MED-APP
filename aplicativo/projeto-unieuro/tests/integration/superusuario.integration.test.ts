import type { SQLiteDatabase } from 'expo-sqlite';

import { createAttendanceRepository, type PatientRecord } from '@/db/attendance-repository';
import { createCpfProtector } from '@/db/cpf-protection';
import { migrate } from '@/db/database';
import { createProfessionalRepository } from '@/db/professional-repository';
import { MIGRATIONS, SCHEMA_VERSION } from '@/db/schema';
import {
  listPatientCpfsFor,
  listPatientsFor,
  type PatientListRepository,
} from '@/features/home/patients';

import { createTempDatabase, type TempDatabase } from '../test-support/real-sqlite';
import { webCryptoAesGcm } from '../test-support/web-crypto-aes-gcm';

// Testes de integração da #49 com SQLite de verdade: rodam as migrations reais,
// gravam pelos repositórios e passam pela regra da lista de pacientes, que decide
// o que cada profissional pode ver.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const protector = createCpfProtector(async () => new Uint8Array(32).fill(9), webCryptoAesGcm);

const CRIADO_EM = '2026-09-26T13:00:00.000Z';
const AGORA = '2026-11-13T10:00:00.000Z';

const TAUIL = {
  name: 'Carlos Bernardo Tauil',
  email: 'tauil@unieuro.com.br',
  crmNumber: '12771',
  crmState: 'DF',
  cpf: '11144477735',
};
const ANA = {
  name: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crmNumber: '12345',
  crmState: 'DF',
  cpf: '52998224725',
};
const PAULO = {
  name: 'Paulo Henrique Rocha',
  email: 'paulo.rocha@unieuro.com.br',
  crmNumber: '23456',
  crmState: 'DF',
  cpf: '39053344705',
};

const paciente = (name: string, cpf: string): PatientRecord => ({
  name,
  cpf,
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
});
const JOSE = paciente('José Alves Martins', '86288366757');
const MARIA = paciente('Maria das Graças Lima', '15350946056');

let temp: TempDatabase;
let database: SQLiteDatabase;
let professionals: ReturnType<typeof createProfessionalRepository>;
let attendances: ReturnType<typeof createAttendanceRepository>;

const conta = (dados: typeof TAUIL) => ({
  ...dados,
  passwordHash: 'hash-da-senha',
  createdAt: CRIADO_EM,
});

async function cadastrar(dados: typeof TAUIL) {
  await professionals.insert(conta(dados));
  return (await professionals.findByEmail(dados.email))!;
}

/** Cria a conta do administrador, o primeiro superusuário do tablet. */
async function criarAdministrador(dados: typeof TAUIL = TAUIL) {
  await professionals.insertSuperuser(conta(dados), null);
  return (await professionals.findByEmail(dados.email))!;
}

const perfilDe = async (id: number) => (await professionals.findById(id))!.superuser;

beforeEach(async () => {
  temp = createTempDatabase();
  database = temp.open();
  await migrate(database, protector);
  professionals = createProfessionalRepository(async () => database, protector);
  attendances = createAttendanceRepository(async () => database, protector);
});

afterEach(async () => {
  await database.closeAsync();
  temp.cleanup();
});

describe('conta do administrador', () => {
  it('o tablet começa sem superusuário', async () => {
    await expect(professionals.hasSuperuser()).resolves.toBe(false);
  });

  it('o cadastro comum cria médico, mesmo sendo a primeira conta do tablet', async () => {
    const ana = await cadastrar(ANA);

    expect(ana.superuser).toBe(false);
    await expect(professionals.hasSuperuser()).resolves.toBe(false);
  });

  it('cria a conta do administrador quando o tablet não tem superusuário', async () => {
    await cadastrar(ANA);

    await expect(professionals.insertSuperuser(conta(TAUIL), null)).resolves.toBe(true);

    expect((await professionals.findByEmail(TAUIL.email))!.superuser).toBe(true);
    await expect(professionals.hasSuperuser()).resolves.toBe(true);
  });

  it('não cria um segundo administrador sem um superusuário pedir', async () => {
    await criarAdministrador();

    await expect(professionals.insertSuperuser(conta(ANA), null)).resolves.toBe(false);
    await expect(professionals.findByEmail(ANA.email)).resolves.toBeNull();
  });

  it('não cria administrador de novo se o único superusuário foi desativado', async () => {
    const tauil = await criarAdministrador();
    await professionals.deactivate(tauil.id, AGORA);

    await expect(professionals.insertSuperuser(conta(ANA), null)).resolves.toBe(false);
  });

  it('guarda o CPF do administrador cifrado, como o de qualquer conta', async () => {
    const tauil = await criarAdministrador();
    await database.closeAsync();

    expect(temp.rawContains(TAUIL.cpf)).toBe(false);
    database = temp.open();
    await expect(professionals.getCpf(tauil.id)).resolves.toBe(TAUIL.cpf);
  });
});

describe('superusuário só nasce de superusuário', () => {
  it('o superusuário cria outra conta de superusuário', async () => {
    const tauil = await criarAdministrador();

    await expect(professionals.insertSuperuser(conta(ANA), tauil.id)).resolves.toBe(true);
    expect((await professionals.findByEmail(ANA.email))!.superuser).toBe(true);
  });

  it('um médico comum não cria superusuário', async () => {
    await criarAdministrador();
    const paulo = await cadastrar(PAULO);

    await expect(professionals.insertSuperuser(conta(ANA), paulo.id)).resolves.toBe(false);
    await expect(professionals.findByEmail(ANA.email)).resolves.toBeNull();
  });

  it('um superusuário com a conta desativada não cria superusuário', async () => {
    const tauil = await criarAdministrador();
    await professionals.deactivate(tauil.id, AGORA);

    await expect(professionals.insertSuperuser(conta(ANA), tauil.id)).resolves.toBe(false);
  });

  it('o superusuário torna outro médico superusuário', async () => {
    const tauil = await criarAdministrador();
    const ana = await cadastrar(ANA);

    await expect(professionals.promoteToSuperuser(ana.id, tauil.id, AGORA)).resolves.toBe(true);

    expect(await perfilDe(ana.id)).toBe(true);
    expect((await professionals.findById(ana.id))!.updatedAt).toBe(AGORA);
  });

  it('um médico comum não promove ninguém, nem a si mesmo', async () => {
    await criarAdministrador();
    const ana = await cadastrar(ANA);
    const paulo = await cadastrar(PAULO);

    await expect(professionals.promoteToSuperuser(paulo.id, ana.id, AGORA)).resolves.toBe(false);
    await expect(professionals.promoteToSuperuser(ana.id, ana.id, AGORA)).resolves.toBe(false);

    expect(await perfilDe(ana.id)).toBe(false);
    expect(await perfilDe(paulo.id)).toBe(false);
  });

  it('um superusuário com a conta desativada não promove ninguém', async () => {
    const tauil = await criarAdministrador();
    const ana = await cadastrar(ANA);
    await professionals.deactivate(tauil.id, AGORA);

    await expect(professionals.promoteToSuperuser(ana.id, tauil.id, AGORA)).resolves.toBe(false);
    expect(await perfilDe(ana.id)).toBe(false);
  });

  it('não promove uma conta desativada', async () => {
    const tauil = await criarAdministrador();
    const ana = await cadastrar(ANA);
    await professionals.deactivate(ana.id, AGORA);

    await expect(professionals.promoteToSuperuser(ana.id, tauil.id, AGORA)).resolves.toBe(false);
    expect(await perfilDe(ana.id)).toBe(false);
  });

  it('o banco recusa um perfil que não existe', async () => {
    const tauil = await criarAdministrador();

    await expect(
      database.runAsync("UPDATE profissional SET perfil = 'administrador' WHERE id = ?", [
        tauil.id,
      ]),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe('banco da versão 8, de antes do perfil', () => {
  it('chega à versão atual com todas as contas como médico', async () => {
    const legacyTemp = createTempDatabase();
    const legacy = legacyTemp.open();
    await legacy.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    for (const step of MIGRATIONS.slice(0, 8)) {
      if (typeof step === 'string') await legacy.execAsync(step);
      else await step(legacy, protector);
    }
    await legacy.execAsync('PRAGMA user_version = 8');
    for (const dados of [TAUIL, ANA]) {
      await legacy.runAsync(
        `INSERT INTO profissional (nome, email, crm_numero, uf_crm, cpf_cifrado, cpf_indice, senha_hash, criacao, last_update)
         VALUES (?, ?, ?, ?, ?, ?, 'hash-da-senha', ?, ?)`,
        [
          dados.name,
          dados.email,
          dados.crmNumber,
          dados.crmState,
          await protector.encrypt(dados.cpf),
          await protector.blindIndex(dados.cpf),
          CRIADO_EM,
          CRIADO_EM,
        ],
      );
    }

    await migrate(legacy, protector);

    await expect(legacy.getFirstAsync('PRAGMA user_version')).resolves.toEqual({
      user_version: SCHEMA_VERSION,
    });
    await expect(
      legacy.getAllAsync('SELECT nome, perfil FROM profissional ORDER BY id'),
    ).resolves.toEqual([
      { nome: TAUIL.name, perfil: 'medico' },
      { nome: ANA.name, perfil: 'medico' },
    ]);
    // Sem superusuário, o tablet atualizado pode criar a conta do administrador.
    const contas = createProfessionalRepository(async () => legacy, protector);
    await expect(
      contas.insertSuperuser({ ...conta(PAULO), email: 'admin@unieuro.com.br' }, null),
    ).resolves.toBe(true);
    await legacy.closeAsync();
    legacyTemp.cleanup();
  });
});

describe('atendimentos de todos os profissionais', () => {
  let tauil: { id: number; superuser: boolean };
  let ana: { id: number; superuser: boolean };
  let paulo: { id: number; superuser: boolean };
  // O repositório do atendimento atende ao contrato da lista de pacientes.
  let lista: PatientListRepository;

  async function estado(attendanceId: number, novo: string) {
    await database.runAsync('UPDATE avaliacao SET estado = ? WHERE id = ?', [novo, attendanceId]);
  }

  beforeEach(async () => {
    tauil = await criarAdministrador();
    ana = await cadastrar(ANA);
    paulo = await cadastrar(PAULO);
    lista = attendances;

    // José: atendido pela Ana e, depois, pelo Paulo. Maria: só pelo Paulo.
    await attendances.createAttendance({
      patient: JOSE,
      professionalId: ana.id,
      startedAt: '2026-10-02T12:00:00.000Z',
    });
    const jose = (await attendances.findPatientByCpf(JOSE.cpf))!;
    const { attendanceId: doPaulo } = await attendances.createAttendance({
      patient: { id: jose.id },
      professionalId: paulo.id,
      startedAt: '2026-10-05T17:32:00.000Z',
    });
    await estado(doPaulo, 'concluida');
    await attendances.createAttendance({
      patient: MARIA,
      professionalId: paulo.id,
      startedAt: '2026-10-03T13:00:00.000Z',
    });
  });

  it('Cenário: responsável vê todos os atendimentos', async () => {
    const pacientes = await listPatientsFor(tauil, lista);

    expect(pacientes.map((p) => [p.name, p.attendedBy])).toEqual(
      expect.arrayContaining([
        [JOSE.name, PAULO.name],
        [MARIA.name, PAULO.name],
      ]),
    );
    expect(pacientes).toHaveLength(2);
  });

  it('resume os atendimentos de todos e mostra quem fez o mais recente', async () => {
    const pacientes = await listPatientsFor(tauil, lista);
    const jose = pacientes.find((p) => p.name === JOSE.name);

    expect(jose).toEqual({
      id: expect.any(Number),
      name: JOSE.name,
      recordNumber: '2026-0001',
      attendanceCount: 2,
      lastStartedAt: '2026-10-05T17:32:00.000Z',
      lastState: 'concluida',
      attendedBy: PAULO.name,
    });
  });

  it('Cenário: médico comum não vê o que outro coletou', async () => {
    const daAna = await listPatientsFor(ana, lista);
    const doPaulo = await listPatientsFor(paulo, lista);

    expect(daAna.map((p) => p.name)).toEqual([JOSE.name]);
    expect(daAna[0]).toMatchObject({ attendanceCount: 1 });
    expect(daAna[0]).not.toHaveProperty('attendedBy');
    expect(doPaulo.map((p) => p.name).sort()).toEqual([JOSE.name, MARIA.name].sort());
  });

  it('a consulta de todos não responde a um médico comum, nem chamada direto', async () => {
    await expect(attendances.listAllAttendedPatients(ana.id)).resolves.toEqual([]);
    await expect(attendances.listAllAttendedPatientCpfs(ana.id)).resolves.toEqual([]);
  });

  it('a consulta de todos não responde a quem não existe', async () => {
    await expect(attendances.listAllAttendedPatients(9999)).resolves.toEqual([]);
  });

  it('a consulta de todos não responde a um superusuário com a conta desativada', async () => {
    await professionals.deactivate(tauil.id, AGORA);

    await expect(attendances.listAllAttendedPatients(tauil.id)).resolves.toEqual([]);
    await expect(attendances.listAllAttendedPatientCpfs(tauil.id)).resolves.toEqual([]);
  });

  it('quem foi promovido passa a ver os atendimentos de todos', async () => {
    await professionals.promoteToSuperuser(ana.id, tauil.id, AGORA);
    const promovida = (await professionals.findById(ana.id))!;

    const pacientes = await listPatientsFor(promovida, lista);

    expect(pacientes.map((p) => p.name).sort()).toEqual([JOSE.name, MARIA.name].sort());
  });

  it('o superusuário busca pelo CPF os pacientes de todos; o médico, só os dele', async () => {
    const doTauil = await listPatientCpfsFor(tauil, lista);
    const daAna = await listPatientCpfsFor(ana, lista);

    expect(doTauil.map((p) => p.cpf).sort()).toEqual([JOSE.cpf, MARIA.cpf].sort());
    expect(daAna.map((p) => p.cpf)).toEqual([JOSE.cpf]);
  });

  it('não deixa o CPF dos pacientes legível no arquivo do banco', async () => {
    await listPatientCpfsFor(tauil, lista);
    await database.closeAsync();

    expect(temp.rawContains(JOSE.cpf)).toBe(false);
    expect(temp.rawContains(MARIA.cpf)).toBe(false);
    database = temp.open();
  });
});
