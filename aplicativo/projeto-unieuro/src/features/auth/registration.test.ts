import {
  parseCpf,
  parseCrm,
  registerProfessional,
  validateRegistration,
  type ProfessionalRepository,
  type RegistrationInput,
  type ValidRegistration,
} from '@/features/auth/registration';

jest.mock('@/features/auth/password', () => ({
  hashPassword: jest.fn(async () => 'hash-da-senha'),
}));

const validInput: RegistrationInput = {
  name: '  Ana Carolina Souza ',
  email: ' Ana.Souza@Unieuro.com.br ',
  crm: '12345/df',
  cpf: '111.444.777-35',
  password: 'senhaForte123',
  passwordConfirmation: 'senhaForte123',
};

function createRepository(existing: { email?: boolean; crm?: boolean; cpf?: boolean } = {}) {
  return {
    emailExists: jest.fn(async () => existing.email ?? false),
    crmExists: jest.fn(async () => existing.crm ?? false),
    cpfExists: jest.fn(async () => existing.cpf ?? false),
    insert: jest.fn(async () => undefined),
  } satisfies ProfessionalRepository;
}

describe('parseCrm', () => {
  it.each([
    ['12345/DF', { number: '12345', state: 'DF' }],
    ['12345 / sp', { number: '12345', state: 'SP' }],
    ['  987654/RJ  ', { number: '987654', state: 'RJ' }],
    ['12345DF', null],
    ['12a45/DF', null],
    ['12345/XX', null],
    ['/DF', null],
    ['12345/', null],
  ])('interpreta "%s"', (input, expected) => {
    expect(parseCrm(input)).toEqual(expected);
  });
});

describe('parseCpf', () => {
  it.each([
    ['111.444.777-35', '11144477735'],
    ['11144477735', '11144477735'],
    ['  111.444.777-35  ', '11144477735'],
  ])('aceita "%s"', (input, expected) => {
    expect(parseCpf(input)).toBe(expected);
  });

  it.each([
    ['111.444.777-30', 'dígito verificador errado'],
    ['111.444.777', 'quantidade de dígitos errada'],
    ['000.000.000-00', 'todos os dígitos iguais'],
    ['', 'vazio'],
  ])('recusa "%s" (%s)', (input) => {
    expect(parseCpf(input)).toBeNull();
  });
});

describe('validateRegistration', () => {
  it('normaliza nome, e-mail, CRM e CPF de um cadastro válido', () => {
    expect(validateRegistration(validInput)).toEqual({
      valid: true,
      registration: {
        name: 'Ana Carolina Souza',
        email: 'ana.souza@unieuro.com.br',
        crm: { number: '12345', state: 'DF' },
        cpf: '11144477735',
        password: 'senhaForte123',
      },
    });
  });

  it.each([
    ['nome vazio', { name: '   ' }, 'Preencha todos os campos para continuar.'],
    ['e-mail sem domínio', { email: 'ana.souza' }, 'Informe um e-mail válido.'],
    ['CRM sem UF', { crm: '12345' }, 'Informe o CRM no formato 12345/DF.'],
    ['CPF com dígito verificador errado', { cpf: '111.444.777-30' }, 'Informe um CPF válido.'],
    [
      'senha curta',
      { password: 'curta', passwordConfirmation: 'curta' },
      'A senha precisa ter pelo menos 8 caracteres.',
    ],
    [
      'confirmação diferente',
      { passwordConfirmation: 'outraSenha1' },
      'Confira a senha e a confirmação.',
    ],
  ])('recusa %s', (_case, change, message) => {
    expect(validateRegistration({ ...validInput, ...change })).toEqual({ valid: false, message });
  });
});

describe('registerProfessional', () => {
  const validRegistration: ValidRegistration = {
    name: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crm: { number: '12345', state: 'DF' },
    cpf: '11144477735',
    password: 'senhaForte123',
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-26T13:00:00.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('insere o profissional com a senha em hash e a data de criação', async () => {
    const repository = createRepository();

    await expect(registerProfessional(validRegistration, repository)).resolves.toEqual({
      success: true,
    });
    expect(repository.emailExists).toHaveBeenCalledWith('ana.souza@unieuro.com.br');
    expect(repository.crmExists).toHaveBeenCalledWith('12345', 'DF');
    expect(repository.cpfExists).toHaveBeenCalledWith('11144477735');
    expect(repository.insert).toHaveBeenCalledWith({
      name: 'Ana Carolina Souza',
      email: 'ana.souza@unieuro.com.br',
      crmNumber: '12345',
      crmState: 'DF',
      cpf: '11144477735',
      passwordHash: 'hash-da-senha',
      createdAt: '2026-09-26T13:00:00.000Z',
    });
  });

  it.each([
    [
      'e-mail já cadastrado',
      { email: true },
      'Já existe um profissional cadastrado com este e-mail.',
      'email',
    ],
    [
      'CRM já cadastrado',
      { crm: true },
      'Já existe um profissional cadastrado com este CRM.',
      'crm',
    ],
    [
      'CPF já cadastrado',
      { cpf: true },
      'Já existe um profissional cadastrado com este CPF.',
      'cpf',
    ],
  ])('não insere quando há %s', async (_case, existing, message, field) => {
    const repository = createRepository(existing);

    await expect(registerProfessional(validRegistration, repository)).resolves.toEqual({
      success: false,
      message,
      field,
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });
});
