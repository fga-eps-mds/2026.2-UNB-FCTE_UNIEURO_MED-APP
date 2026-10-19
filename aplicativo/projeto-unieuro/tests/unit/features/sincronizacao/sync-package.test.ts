import { formatHlc } from '@/db/hlc';
import type { SyncAttendance, SyncPatient, SyncProfessional } from '@/db/sync-repository';
import {
  buildPackage,
  countRecords,
  isCovered,
  PackageRefusedError,
  parsePackage,
  validateAttendance,
  validatePatient,
  validateProfessional,
} from '@/features/sincronizacao/sync-package';

const TABLET_A = 'aaaaaaaa-0000-4000-8000-000000000000';
const TABLET_B = 'bbbbbbbb-0000-4000-8000-000000000000';
const PROFESSIONAL_UUID = '11111111-1111-4111-8111-111111111111';
const PATIENT_UUID = '22222222-2222-4222-8222-222222222222';

const stamp = (seq: number) => ({
  versao_hlc: formatHlc({ millis: seq, counter: 0, node: TABLET_A }),
  origem_id: TABLET_A,
  origem_seq: seq,
});

function professional(overrides: Partial<SyncProfessional> = {}): SyncProfessional {
  return {
    uuid: PROFESSIONAL_UUID,
    nome: 'Ana Souza',
    email: 'ana@unieuro.com.br',
    crm_numero: '12345',
    uf_crm: 'DF',
    cpf: '11144477735',
    senha_hash: 'hash',
    criacao: '2026-10-05T12:00:00.000Z',
    last_update: '2026-10-05T12:00:00.000Z',
    ativo: 1,
    ...stamp(1),
    ...overrides,
  };
}

function patient(overrides: Partial<SyncPatient> = {}): SyncPatient {
  return {
    uuid: PATIENT_UUID,
    nome: 'José Alves Martins',
    cpf: '52998224725',
    numero_ficha: '2026-0001',
    data_nascimento: '1948-03-14',
    escolaridade_anos: 5,
    sexo: 'masculino',
    criacao: '2026-10-09T14:32:00.000Z',
    last_update: '2026-10-09T14:32:00.000Z',
    ...stamp(2),
    ...overrides,
  };
}

function attendance(overrides: Partial<SyncAttendance> = {}): SyncAttendance {
  return {
    uuid: '33333333-3333-4333-8333-333333333333',
    profissional_uuid: PROFESSIONAL_UUID,
    paciente_uuid: PATIENT_UUID,
    data_hora_inicio: '2026-10-09T14:32:00.000Z',
    estado: 'aguardando_consentimento',
    last_update: '2026-10-09T14:32:00.000Z',
    ...stamp(3),
    ...overrides,
  };
}

const header = {
  origin: TABLET_A,
  schemaVersion: 4,
  generatedAt: '2026-10-05T12:00:00.000Z',
  vector: { [TABLET_A]: 3 },
  professionalAliases: [],
  patientAliases: [],
};

const fullPackage = () =>
  buildPackage({
    ...header,
    professionals: [professional()],
    patients: [patient()],
    attendances: [attendance()],
  });

describe('buildPackage', () => {
  it('leva todos os registros quando não conhece o outro tablet', () => {
    const syncPackage = fullPackage();

    expect(syncPackage).toMatchObject({
      formato: 'med-sync',
      versao_pacote: 1,
      versao_esquema: 4,
      origem: TABLET_A,
      vetor: { [TABLET_A]: 3 },
    });
    expect(countRecords(syncPackage)).toBe(3);
  });

  it('leva só o que o outro tablet ainda não tem quando conhece o vetor dele', () => {
    const syncPackage = buildPackage({
      ...header,
      professionals: [professional()],
      patients: [patient()],
      attendances: [attendance()],
      peerVector: { [TABLET_A]: 2 },
    });

    expect(syncPackage.profissionais).toEqual([]);
    expect(syncPackage.pacientes).toEqual([]);
    expect(syncPackage.avaliacoes).toEqual([attendance()]);
  });
});

describe('isCovered', () => {
  it('compara o contador do registro com o do vetor', () => {
    expect(isCovered({ [TABLET_A]: 3 }, TABLET_A, 3)).toBe(true);
    expect(isCovered({ [TABLET_A]: 3 }, TABLET_A, 4)).toBe(false);
    expect(isCovered({}, TABLET_B, 1)).toBe(false);
  });
});

describe('parsePackage', () => {
  it('aceita um pacote bem formado da mesma versão de esquema', () => {
    expect(parsePackage(JSON.stringify(fullPackage()), 4)).toEqual(fullPackage());
  });

  it.each([
    ['texto que não é JSON', 'não é json'],
    ['outro formato', JSON.stringify({ ...fullPackage(), formato: 'outro' })],
    ['origem sem uuid', JSON.stringify({ ...fullPackage(), origem: 'tablet' })],
    [
      'vetor com contador negativo',
      JSON.stringify({ ...fullPackage(), vetor: { [TABLET_A]: -1 } }),
    ],
    ['profissionais fora de uma lista', JSON.stringify({ ...fullPackage(), profissionais: {} })],
    ['pacientes ausentes', JSON.stringify({ ...fullPackage(), pacientes: undefined })],
    ['avaliações fora de uma lista', JSON.stringify({ ...fullPackage(), avaliacoes: 'x' })],
    [
      'alias de profissional sem uuid',
      JSON.stringify({ ...fullPackage(), aliases_profissional: [{ uuid_alias: 'x' }] }),
    ],
    ['aliases de paciente ausentes', JSON.stringify({ ...fullPackage(), aliases_paciente: null })],
    ['JSON nulo', 'null'],
  ])('recusa %s', (_case, json) => {
    expect(() => parsePackage(json, 4)).toThrow(new PackageRefusedError('arquivo_invalido'));
  });

  it('recusa um pacote de outra versão de esquema', () => {
    expect(() => parsePackage(JSON.stringify(fullPackage()), 5)).toThrow(
      expect.objectContaining({ reason: 'versao_incompativel' }),
    );
  });
});

describe('validateProfessional', () => {
  it('devolve só os campos conhecidos de um registro válido', () => {
    expect(validateProfessional({ ...professional(), extra: 'x' })).toEqual(professional());
  });

  it.each([
    ['que não é objeto', 'texto'],
    ['sem uuid', { ...professional(), uuid: 'x' }],
    ['com nome vazio', { ...professional(), nome: '  ' }],
    ['com e-mail inválido', { ...professional(), email: 'ana' }],
    ['com CRM com letras', { ...professional(), crm_numero: '12a' }],
    ['com UF minúscula', { ...professional(), uf_crm: 'df' }],
    ['com CPF curto', { ...professional(), cpf: '123' }],
    ['sem hash de senha', { ...professional(), senha_hash: '' }],
    ['com situação inválida', { ...professional(), ativo: 2 }],
    ['com relógio fora do formato', { ...professional(), versao_hlc: '1-2-3' }],
    ['com contador zero', { ...professional(), origem_seq: 0 }],
  ])('recusa um registro %s', (_case, value) => {
    expect(validateProfessional(value)).toBeNull();
  });
});

describe('validatePatient', () => {
  it('devolve só os campos conhecidos de um registro válido, inclusive sem sexo', () => {
    expect(validatePatient({ ...patient(), extra: 'x' })).toEqual(patient());
    expect(validatePatient(patient({ sexo: null }))).toEqual(patient({ sexo: null }));
  });

  it.each([
    ['que não é objeto', null],
    ['sem uuid', { ...patient(), uuid: 'x' }],
    ['com nome vazio', { ...patient(), nome: '' }],
    ['com CPF com máscara', { ...patient(), cpf: '529.982.247-25' }],
    ['com ficha fora do formato', { ...patient(), numero_ficha: 'ficha 1' }],
    ['com nascimento fora do formato', { ...patient(), data_nascimento: '14/03/1948' }],
    ['com escolaridade negativa', { ...patient(), escolaridade_anos: -1 }],
    ['com sexo fora das opções', { ...patient(), sexo: 'outro' }],
    ['sem origem', { ...patient(), origem_id: undefined }],
  ])('recusa um registro %s', (_case, value) => {
    expect(validatePatient(value)).toBeNull();
  });
});

describe('validateAttendance', () => {
  it('aceita qualquer estado do atendimento', () => {
    for (const estado of ['aguardando_consentimento', 'em_andamento', 'concluida', 'cancelada']) {
      expect(validateAttendance(attendance({ estado }))).toEqual(attendance({ estado }));
    }
  });

  it.each([
    ['que não é objeto', []],
    ['sem uuid do profissional', { ...attendance(), profissional_uuid: '7' }],
    ['sem uuid do paciente', { ...attendance(), paciente_uuid: undefined }],
    ['sem início', { ...attendance(), data_hora_inicio: '' }],
    ['com estado desconhecido', { ...attendance(), estado: 'apagado' }],
    ['com contador inválido', { ...attendance(), origem_seq: 1.5 }],
  ])('recusa um registro %s', (_case, value) => {
    expect(validateAttendance(value)).toBeNull();
  });
});
