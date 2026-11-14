import { formatHlc } from '@/db/hlc';
import type {
  SyncAttendance,
  SyncConsent,
  SyncPatient,
  SyncProfessional,
  SyncTask,
} from '@/db/sync-repository';
import {
  BATCH_MAX_BYTES,
  buildPackage,
  countRecords,
  estimateAttendanceSize,
  isCovered,
  planBatches,
  splitPackage,
  type BatchEntry,
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
    desativacao: null,
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
    ativo: 1,
    exclusao: null,
    ...stamp(2),
    ...overrides,
  };
}

function consent(overrides: Partial<SyncConsent> = {}): SyncConsent {
  return {
    versao_tcle: 'tcle-2026-10',
    aceito: 1,
    assinado_por: 'responsavel_legal',
    assinatura_png: 'iVBORw==',
    data_hora: '2026-10-09T14:35:00.000Z',
    autoriza_imagens_pesquisa: 1,
    autoriza_dados_pesquisa_futura: null,
    cpf_responsavel: '39053344705',
    ...overrides,
  };
}

function task(overrides: Partial<SyncTask> = {}): SyncTask {
  return {
    tipo: 'relogio',
    ordem: 1,
    largura: 800,
    altura: 600,
    data_hora_inicio: '2026-10-09T14:40:00.000Z',
    data_hora_termino: '2026-10-09T14:42:00.000Z',
    desenho: { imagem_final: 'iVBORw==', data_hora_confirmacao: '2026-10-09T14:42:00.000Z' },
    eventos: [
      [1, 'inicio', 'caneta', 10, 20, 0, 0.6, 12, -3],
      [2, 'ponto', 'caneta', 11, 21, 16, null, null, null],
      [3, 'desfazer', null, null, null, 900, null, null, null],
    ],
    ...overrides,
  };
}

function attendance(overrides: Partial<SyncAttendance> = {}): SyncAttendance {
  return {
    uuid: '33333333-3333-4333-8333-333333333333',
    profissional_uuid: PROFESSIONAL_UUID,
    paciente_uuid: PATIENT_UUID,
    data_hora_inicio: '2026-10-09T14:32:00.000Z',
    estado: 'concluida',
    ativo: 1,
    exclusao: null,
    last_update: '2026-10-09T14:32:00.000Z',
    consentimento: consent(),
    tarefas: [task(), task({ tipo: 'cubo', ordem: 2, desenho: null, eventos: [] })],
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

describe('estimateAttendanceSize', () => {
  it('conta as imagens em base64 e o traçado, com uma base para o resto', () => {
    expect(estimateAttendanceSize(0, 0)).toBe(2048);
    expect(estimateAttendanceSize(3000, 0)).toBe(2048 + 4000);
    expect(estimateAttendanceSize(0, 10)).toBe(2048 + 700);
  });
});

describe('planBatches', () => {
  const entry = (
    table: BatchEntry<string>['table'],
    seq: number,
    size: number,
    origin = TABLET_A,
  ): BatchEntry<string> => ({
    table,
    value: `${table}-${origin.slice(0, 1)}-${seq}`,
    stamp: { origem_id: origin, origem_seq: seq },
    size,
  });
  const values = (batches: { entries: BatchEntry<string>[] }[]) =>
    batches.map((batch) => batch.entries.map((item) => item.value));

  it('sem nada a enviar, devolve um lote vazio com o vetor de quem envia', () => {
    expect(planBatches([], { [TABLET_A]: 7 })).toEqual([
      { entries: [], cobertura: { [TABLET_A]: 7 } },
    ]);
  });

  it('o limite padrão é de 512 KB', () => {
    expect(BATCH_MAX_BYTES).toBe(512 * 1024);
  });

  it('respeita o limite de tamanho, e a avaliação maior que o limite vai sozinha', () => {
    const batches = planBatches(
      [
        entry('avaliacoes', 1, 60),
        entry('avaliacoes', 2, 30),
        entry('avaliacoes', 3, 500),
        entry('avaliacoes', 4, 10),
      ],
      { [TABLET_A]: 4 },
      100,
    );

    expect(values(batches)).toEqual([
      ['avaliacoes-a-1', 'avaliacoes-a-2'],
      ['avaliacoes-a-3'],
      ['avaliacoes-a-4'],
    ]);
  });

  it('manda os cadastros antes das avaliações, e as avaliações pelo contador', () => {
    const batches = planBatches(
      [
        entry('avaliacoes', 9, 50),
        entry('profissionais', 8, 50),
        entry('avaliacoes', 3, 50),
        entry('pacientes', 5, 50),
      ],
      { [TABLET_A]: 9 },
      100,
    );

    expect(values(batches)).toEqual([
      ['profissionais-a-8', 'pacientes-a-5'],
      ['avaliacoes-a-3', 'avaliacoes-a-9'],
    ]);
  });

  it('a cobertura de cada lote para antes do menor contador que ainda falta', () => {
    // O paciente (contador 60) vai antes, mas as avaliações 40 e 55 ficam para depois.
    const batches = planBatches(
      [entry('pacientes', 60, 100), entry('avaliacoes', 40, 100), entry('avaliacoes', 55, 100)],
      { [TABLET_A]: 60 },
      100,
    );

    expect(batches.map((batch) => batch.cobertura)).toEqual([
      { [TABLET_A]: 39 },
      { [TABLET_A]: 54 },
      { [TABLET_A]: 60 },
    ]);
  });

  it('calcula a cobertura de cada tablet de origem separadamente', () => {
    const batches = planBatches(
      [entry('avaliacoes', 1, 100, TABLET_A), entry('avaliacoes', 2, 100, TABLET_B)],
      { [TABLET_A]: 5, [TABLET_B]: 2 },
      100,
    );

    expect(batches.map((batch) => batch.cobertura)).toEqual([
      { [TABLET_A]: 5, [TABLET_B]: 1 },
      { [TABLET_A]: 5, [TABLET_B]: 2 },
    ]);
  });

  it('não promete o que falta logo no primeiro contador, nem tablet fora do vetor', () => {
    const batches = planBatches(
      [entry('pacientes', 1, 100), entry('avaliacoes', 1, 100, TABLET_B)],
      { [TABLET_A]: 1, [TABLET_B]: 1 },
      100,
    );

    expect(batches[0].cobertura).toEqual({ [TABLET_A]: 1 });
  });

  it('um registro sem carimbo vai no lote, mas não muda a cobertura', () => {
    const batches = planBatches(
      [{ table: 'pacientes', value: 'sem carimbo', stamp: null, size: 10 }],
      { [TABLET_A]: 3 },
    );

    expect(batches).toEqual([
      {
        entries: [expect.objectContaining({ value: 'sem carimbo' })],
        cobertura: { [TABLET_A]: 3 },
      },
    ]);
  });
});

describe('splitPackage', () => {
  it('a soma dos lotes é o pacote inteiro, sem perder nem repetir registro', () => {
    const syncPackage = buildPackage({
      ...header,
      vector: { [TABLET_A]: 5 },
      professionalAliases: [{ uuid_alias: TABLET_B, uuid_principal: PROFESSIONAL_UUID }],
      professionals: [professional()],
      patients: [patient()],
      attendances: [
        attendance({ ...stamp(3) }),
        attendance({ uuid: '44444444-4444-4444-8444-444444444444', ...stamp(4) }),
      ],
    });

    const batches = splitPackage(syncPackage, 1500);

    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flatMap(({ pacote }) => pacote.profissionais)).toEqual(
      syncPackage.profissionais,
    );
    expect(batches.flatMap(({ pacote }) => pacote.pacientes)).toEqual(syncPackage.pacientes);
    expect(batches.flatMap(({ pacote }) => pacote.avaliacoes)).toEqual(syncPackage.avaliacoes);
    // Os aliases só no primeiro; o cabeçalho em todos.
    expect(batches[0].pacote.aliases_profissional).toHaveLength(1);
    for (const { pacote } of batches.slice(1)) expect(pacote.aliases_profissional).toEqual([]);
    for (const { pacote } of batches) {
      expect(pacote).toMatchObject({ origem: TABLET_A, vetor: { [TABLET_A]: 5 } });
    }
    expect(batches.at(-1)!.cobertura).toEqual({ [TABLET_A]: 5 });
  });

  it('um registro inválido, sem carimbo, também vai, para a quarentena de quem recebe', () => {
    const syncPackage = { ...fullPackage(), pacientes: [{ lixo: true }] };

    const batches = splitPackage(syncPackage);

    expect(batches).toHaveLength(1);
    expect(batches[0].pacote.pacientes).toEqual([{ lixo: true }]);
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

  it('aceita a conta desativada com a data da desativação', () => {
    const desativada = professional({ ativo: 0, desativacao: '2026-11-10T15:00:00.000Z' });

    expect(validateProfessional(desativada)).toEqual(desativada);
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
    ['sem a data da desativação', { ...professional(), desativacao: undefined }],
    ['com a data da desativação vazia', { ...professional(), desativacao: ' ' }],
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
    ['com situação inválida', { ...patient(), ativo: 2 }],
    ['sem a data da exclusão', { ...patient(), exclusao: undefined }],
    ['com a data da exclusão vazia', { ...patient(), exclusao: '' }],
  ])('recusa um registro %s', (_case, value) => {
    expect(validatePatient(value)).toBeNull();
  });

  it('aceita o paciente excluído com a data da exclusão', () => {
    const excluido = patient({ ativo: 0, exclusao: '2026-11-11T09:00:00.000Z' });

    expect(validatePatient(excluido)).toEqual(excluido);
  });
});

describe('validateAttendance', () => {
  it('aceita a avaliação finalizada inteira e devolve só os campos conhecidos', () => {
    for (const estado of ['concluida', 'interrompida', 'cancelada'] as const) {
      expect(validateAttendance({ ...attendance({ estado }), extra: 'x' })).toEqual(
        attendance({ estado }),
      );
    }
  });

  it('aceita a recusa do TCLE, sem assinatura, e a avaliação sem consentimento', () => {
    const recusa = attendance({
      estado: 'cancelada',
      consentimento: consent({
        aceito: 0,
        assinado_por: 'paciente',
        assinatura_png: null,
        cpf_responsavel: null,
      }),
      tarefas: [],
    });

    expect(validateAttendance(recusa)).toEqual(recusa);
    expect(validateAttendance(attendance({ consentimento: null }))).toEqual(
      attendance({ consentimento: null }),
    );
  });

  it.each(['aguardando_consentimento', 'em_andamento', 'processando_resultado', 'erro_inferencia'])(
    'recusa a avaliação %s, que ainda pode mudar',
    (estado) => {
      expect(validateAttendance({ ...attendance(), estado })).toBeNull();
    },
  );

  const withConsent = (overrides: Record<string, unknown>) => ({
    ...attendance(),
    consentimento: { ...consent(), ...overrides },
  });
  const withTask = (overrides: Record<string, unknown>) => ({
    ...attendance(),
    tarefas: [{ ...task(), ...overrides }],
  });
  const withEvent = (event: unknown[]) => withTask({ eventos: [event] });

  it.each([
    ['que não é objeto', []],
    ['sem uuid do profissional', { ...attendance(), profissional_uuid: '7' }],
    ['sem uuid do paciente', { ...attendance(), paciente_uuid: undefined }],
    ['sem início', { ...attendance(), data_hora_inicio: '' }],
    ['com estado desconhecido', { ...attendance(), estado: 'apagado' }],
    ['com contador inválido', { ...attendance(), origem_seq: 1.5 }],
    ['com situação inválida', { ...attendance(), ativo: '1' }],
    ['sem a data da exclusão', { ...attendance(), exclusao: undefined }],
    ['sem a lista de tarefas', { ...attendance(), tarefas: undefined }],
    [
      'com tarefas fora de ordem',
      { ...attendance(), tarefas: [task({ tipo: 'cubo', ordem: 2 }), task()] },
    ],
    ['com tarefa repetida', { ...attendance(), tarefas: [task(), task()] }],
    ['com consentimento que não é objeto', { ...attendance(), consentimento: 'sim' }],
    ['com consentimento sem versão do termo', withConsent({ versao_tcle: ' ' })],
    ['com aceite sem assinatura', withConsent({ assinatura_png: null })],
    ['com assinatura fora do base64', withConsent({ assinatura_png: 'não é base64' })],
    ['com recusa com assinatura', withConsent({ aceito: 0, cpf_responsavel: null })],
    ['com quem assina desconhecido', withConsent({ assinado_por: 'vizinho' })],
    ['com autorização inválida', withConsent({ autoriza_imagens_pesquisa: true })],
    ['com CPF do responsável num aceite do paciente', withConsent({ assinado_por: 'paciente' })],
    ['com CPF do responsável com máscara', withConsent({ cpf_responsavel: '390.533.447-05' })],
    ['com consentimento sem data', withConsent({ data_hora: undefined })],
    ['com tarefa que não é objeto', { ...attendance(), tarefas: [null] }],
    ['com tarefa na ordem de outra', withTask({ ordem: 2 })],
    ['com tarefa de tipo desconhecido', withTask({ tipo: 'casa' })],
    ['com quadro sem largura', withTask({ largura: 0 })],
    ['com quadro sem altura', withTask({ altura: Number.NaN })],
    ['com tarefa sem início', withTask({ data_hora_inicio: '' })],
    ['com término vazio', withTask({ data_hora_termino: ' ' })],
    ['com desenho sem imagem', withTask({ desenho: { data_hora_confirmacao: 'x' } })],
    ['com desenho sem confirmação', withTask({ desenho: { imagem_final: 'iVBORw==' } })],
    ['com eventos fora de uma lista', withTask({ eventos: {} })],
    ['com eventos fora de ordem', withTask({ eventos: [...task().eventos].reverse() })],
    ['com evento incompleto', withEvent([1, 'ponto', 'caneta', 1, 2, 0])],
    [
      'com evento de tipo desconhecido',
      withEvent([1, 'rabisco', null, null, null, 0, null, null, null]),
    ],
    ['com ponto sem ponteiro', withEvent([1, 'ponto', 'pé', 1, 2, 0, null, null, null])],
    ['com ponto sem posição', withEvent([1, 'inicio', 'dedo', null, 2, 0, null, null, null])],
    ['com pressão negativa', withEvent([1, 'ponto', 'caneta', 1, 2, 0, -1, null, null])],
    ['com inclinação que não é número', withEvent([1, 'ponto', 'caneta', 1, 2, 0, 1, 'x', null])],
    ['com desfazer com posição', withEvent([1, 'desfazer', null, 1, 2, 0, null, null, null])],
    ['com evento de ordem zero', withEvent([0, 'limpar', null, null, null, 0, null, null, null])],
    ['com instante negativo', withEvent([1, 'limpar', null, null, null, -5, null, null, null])],
  ])('recusa a avaliação inteira %s', (_case, value) => {
    expect(validateAttendance(value)).toBeNull();
  });
});
