import {
  registerAttendance,
  type AttendanceRepository,
  type ExistingPatient,
  type PatientForm,
} from '@/features/avaliacao/attendance';

const NOW = new Date(2026, 9, 9, 10, 30);
const PROFESSIONAL_ID = 7;

const validForm: PatientForm = {
  name: 'José Alves Martins',
  cpf: '123.456.789-09',
  birthDate: '14/03/1948',
  schooling: '5',
  sex: 'masculino',
};

const normalizedPatient = {
  name: 'José Alves Martins',
  cpf: '12345678909',
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
};

const JOSE_CADASTRADO: ExistingPatient = {
  id: 4,
  name: 'José Alves Martins',
  recordNumber: '0004',
};

function createRepository(existingPatient: ExistingPatient | null = null) {
  return {
    findPatientByCpfForProfessional: jest.fn(async () => existingPatient),
    createAttendance: jest.fn(async () => ({ attendanceId: 31 })),
  } satisfies AttendanceRepository;
}

const register = (
  repository: AttendanceRepository,
  change: Partial<PatientForm> = {},
  professionalId = PROFESSIONAL_ID,
  confirmedPatientId?: number,
) =>
  registerAttendance(
    { ...validForm, ...change },
    { repository, professionalId, confirmedPatientId, now: () => NOW },
  );

describe('Cenário: atendimento registrado', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('vincula o atendimento ao médico logado, ao paciente e à data e hora do tablet', async () => {
    const repository = createRepository();

    const result = await register(repository);

    expect(result).toEqual({ success: true, attendanceId: 31 });
    expect(repository.createAttendance).toHaveBeenCalledTimes(1);
    expect(repository.createAttendance).toHaveBeenCalledWith({
      patient: normalizedPatient,
      professionalId: PROFESSIONAL_ID,
      startedAt: NOW.toISOString(),
    });
  });

  it('vincula o atendimento somente ao médico que registrou', async () => {
    const repository = createRepository();

    await register(repository, {}, 12);

    expect(repository.createAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ professionalId: 12 }),
    );
  });

  it('usa o relógio do tablet quando nenhum relógio é informado', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-09T13:30:00.000Z') });
    const repository = createRepository();

    await registerAttendance(validForm, { repository, professionalId: PROFESSIONAL_ID });

    expect(repository.createAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: '2026-10-09T13:30:00.000Z' }),
    );
  });

  it('procura o paciente pelo CPF só com dígitos e pelo profissional logado', async () => {
    const repository = createRepository();

    await register(repository);

    expect(repository.findPatientByCpfForProfessional).toHaveBeenCalledWith(
      '12345678909',
      PROFESSIONAL_ID,
    );
  });

  it('reaproveita o paciente que volta, sem cadastrar de novo, depois da confirmação', async () => {
    const repository = createRepository(JOSE_CADASTRADO);

    const result = await register(repository, {}, PROFESSIONAL_ID, JOSE_CADASTRADO.id);

    expect(result).toEqual({ success: true, attendanceId: 31 });
    expect(repository.createAttendance).toHaveBeenCalledWith({
      patient: { id: 4 },
      professionalId: PROFESSIONAL_ID,
      startedAt: NOW.toISOString(),
    });
  });

  it('deixa passar a falha do banco, para a tela avisar o médico', async () => {
    const repository = createRepository();
    repository.createAttendance.mockRejectedValueOnce(new Error('banco indisponível'));

    await expect(register(repository)).rejects.toThrow('banco indisponível');
  });
});

describe('CPF já cadastrado (#140)', () => {
  it('CPF novo cria o paciente sem aviso', async () => {
    const repository = createRepository(null);

    const result = await register(repository);

    expect(result).toEqual({ success: true, attendanceId: 31 });
    expect(repository.createAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ patient: normalizedPatient }),
    );
  });

  it('CPF já cadastrado: devolve o nome e a ficha do paciente e não grava o exame', async () => {
    const repository = createRepository(JOSE_CADASTRADO);

    const result = await register(repository, { name: 'Outro Nome Digitado' });

    expect(result).toEqual({ success: false, existingPatient: JOSE_CADASTRADO });
    expect(repository.createAttendance).not.toHaveBeenCalled();
  });

  it('confirmado o paciente, o exame entra na ficha dele e os dados digitados não mudam o cadastro', async () => {
    const repository = createRepository(JOSE_CADASTRADO);

    const result = await register(
      repository,
      { name: 'Outro Nome Digitado', schooling: '12' },
      PROFESSIONAL_ID,
      JOSE_CADASTRADO.id,
    );

    expect(result).toEqual({ success: true, attendanceId: 31 });
    expect(repository.createAttendance).toHaveBeenCalledWith({
      patient: { id: JOSE_CADASTRADO.id },
      professionalId: PROFESSIONAL_ID,
      startedAt: NOW.toISOString(),
    });
  });

  it('a confirmação de outro paciente não vale: o aviso volta com o paciente deste CPF', async () => {
    const repository = createRepository(JOSE_CADASTRADO);

    const result = await register(repository, {}, PROFESSIONAL_ID, 99);

    expect(result).toEqual({ success: false, existingPatient: JOSE_CADASTRADO });
    expect(repository.createAttendance).not.toHaveBeenCalled();
  });
});

describe('dados inválidos não chegam ao banco', () => {
  it.each([
    ['Cenário: campo obrigatório vazio', { name: '' }, { name: 'Preencha o nome completo.' }],
    [
      'Cenário: escolaridade do paciente',
      { schooling: '' },
      { schooling: 'Preencha a escolaridade, em anos de estudo.' },
    ],
    ['Cenário: CPF inválido', { cpf: '123.456.789-00' }, { cpf: 'Informe um CPF válido.' }],
    [
      'Cenário: data de nascimento inválida',
      { birthDate: '31/02/1950' },
      { birthDate: 'Informe uma data que exista, no formato DD/MM/AAAA.' },
    ],
  ])(
    '%s: devolve o erro do campo e não registra o atendimento',
    async (_scenario, change, errors) => {
      const repository = createRepository();

      const result = await register(repository, change);

      expect(result).toEqual({ success: false, errors });
      expect(repository.findPatientByCpfForProfessional).not.toHaveBeenCalled();
      expect(repository.createAttendance).not.toHaveBeenCalled();
    },
  );

  it('Cenário: data de nascimento inválida: compara a data com o relógio do tablet', async () => {
    const repository = createRepository();

    const result = await register(repository, { birthDate: '10/10/2026' });

    expect(result).toEqual({
      success: false,
      errors: { birthDate: 'A data de nascimento não pode ser depois de hoje.' },
    });
    expect(repository.createAttendance).not.toHaveBeenCalled();
  });
});
