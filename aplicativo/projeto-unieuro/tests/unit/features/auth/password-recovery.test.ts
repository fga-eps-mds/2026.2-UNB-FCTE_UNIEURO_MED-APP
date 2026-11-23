import { authenticate } from '@/features/auth/authentication';
import {
  BLOCK_MINUTES,
  IDENTITY_NOT_CONFIRMED_MESSAGE,
  MAX_FAILED_ATTEMPTS,
  NO_FAILED_ATTEMPTS,
  attemptsAfterFailure,
  isBlocked,
  recoverPassword,
  validateRecovery,
  type PasswordRecoveryInput,
  type RecoveryAttempts,
  type RecoveryAttemptsStore,
} from '@/features/auth/password-recovery';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/registration';
import {
  ANA,
  BRUNO,
  CPF_DA_ANA,
  SENHA_DE_TESTE,
  abrirTabletComAnaEBruno,
  type TabletComAnaEBruno,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const AGORA = new Date('2026-11-15T12:00:00.000Z');
const MINUTO = 60_000;
const NOVA_SENHA = 'nova-senha-da-ana';

const PEDIDO_DA_ANA: PasswordRecoveryInput = {
  cpf: '111.444.777-35',
  crm: `${ANA.crmNumber}/${ANA.crmState}`,
  newPassword: NOVA_SENHA,
  confirmation: NOVA_SENHA,
};

const DADOS_ERRADOS: PasswordRecoveryInput = {
  ...PEDIDO_DA_ANA,
  crm: `${BRUNO.crmNumber}/${BRUNO.crmState}`,
};

const minutosDepois = (minutos: number) => new Date(AGORA.getTime() + minutos * MINUTO);

function cofreDeTentativas(inicial: RecoveryAttempts = NO_FAILED_ATTEMPTS) {
  let guardado = inicial;
  return {
    read: jest.fn(async () => guardado),
    write: jest.fn(async (tentativas: RecoveryAttempts) => {
      guardado = tentativas;
    }),
    atual: () => guardado,
  } satisfies RecoveryAttemptsStore & { atual(): RecoveryAttempts };
}

let tablet: TabletComAnaEBruno;

beforeEach(async () => {
  tablet = await abrirTabletComAnaEBruno();
});

afterEach(async () => {
  await tablet.fechar();
});

const entrarComoAna = (senha: string) =>
  authenticate({ email: ANA.email, password: senha }, tablet.repository);

const hashDaAna = async () => (await tablet.repository.findById(tablet.anaId))?.passwordHash;

describe('Cenário: nova senha com os dados do cadastro', () => {
  it('entra com a nova senha, e a senha antiga deixa de valer', async () => {
    const resultado = await recoverPassword(
      PEDIDO_DA_ANA,
      tablet.repository,
      cofreDeTentativas(),
      AGORA,
    );

    expect(resultado).toEqual({ success: true });
    await expect(entrarComoAna(NOVA_SENHA)).resolves.toMatchObject({ success: true });
    await expect(entrarComoAna(SENHA_DE_TESTE)).resolves.toMatchObject({ success: false });
  });

  it('aceita o CPF sem pontuação e a UF em minúsculas', async () => {
    const pedido = { ...PEDIDO_DA_ANA, cpf: CPF_DA_ANA, crm: ` ${ANA.crmNumber} / df ` };

    await expect(
      recoverPassword(pedido, tablet.repository, cofreDeTentativas(), AGORA),
    ).resolves.toEqual({ success: true });
  });

  it('zera as tentativas erradas anteriores', async () => {
    const cofre = cofreDeTentativas({ failures: MAX_FAILED_ATTEMPTS - 1, blockedUntil: null });

    await recoverPassword(PEDIDO_DA_ANA, tablet.repository, cofre, AGORA);

    expect(cofre.atual()).toEqual(NO_FAILED_ATTEMPTS);
  });

  it('grava a data da troca na conta', async () => {
    await recoverPassword(PEDIDO_DA_ANA, tablet.repository, cofreDeTentativas(), AGORA);

    await expect(tablet.repository.findById(tablet.anaId)).resolves.toMatchObject({
      updatedAt: AGORA.toISOString(),
    });
  });
});

describe('Cenário: dados que não conferem', () => {
  it.each([
    ['o CRM é de outra conta', DADOS_ERRADOS],
    ['a UF não é a do cadastro', { ...PEDIDO_DA_ANA, crm: `${ANA.crmNumber}/GO` }],
    ['o CPF não está cadastrado', { ...PEDIDO_DA_ANA, cpf: '390.533.447-05' }],
  ])('não diz qual dado está errado quando %s, e a senha não muda', async (_caso, pedido) => {
    const hashAntes = await hashDaAna();

    const resultado = await recoverPassword(pedido, tablet.repository, cofreDeTentativas(), AGORA);

    expect(resultado).toEqual({
      success: false,
      reason: 'identity-not-confirmed',
      message: IDENTITY_NOT_CONFIRMED_MESSAGE,
    });
    await expect(hashDaAna()).resolves.toBe(hashAntes);
  });

  it('trata a conta desativada como dado que não confere', async () => {
    await tablet.repository.deactivate(tablet.anaId, AGORA.toISOString());

    await expect(
      recoverPassword(PEDIDO_DA_ANA, tablet.repository, cofreDeTentativas(), AGORA),
    ).resolves.toMatchObject({ reason: 'identity-not-confirmed' });
    await expect(entrarComoAna(NOVA_SENHA)).resolves.toMatchObject({ success: false });
  });

  it('conta a tentativa errada', async () => {
    const cofre = cofreDeTentativas();

    await recoverPassword(DADOS_ERRADOS, tablet.repository, cofre, AGORA);

    expect(cofre.atual()).toEqual({ failures: 1, blockedUntil: null });
  });
});

describe('Cenário: nova senha fora das regras', () => {
  it('indica a regra do cadastro que falta, e a senha não muda', async () => {
    const curta = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    const hashAntes = await hashDaAna();

    const resultado = await recoverPassword(
      { ...PEDIDO_DA_ANA, newPassword: curta, confirmation: curta },
      tablet.repository,
      cofreDeTentativas(),
      AGORA,
    );

    expect(resultado).toEqual({
      success: false,
      reason: 'invalid-fields',
      errors: {
        newPassword: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      },
    });
    await expect(hashDaAna()).resolves.toBe(hashAntes);
  });

  it('não gasta tentativa com campo preenchido errado', async () => {
    const cofre = cofreDeTentativas();

    await recoverPassword({ ...PEDIDO_DA_ANA, cpf: '' }, tablet.repository, cofre, AGORA);

    expect(cofre.write).not.toHaveBeenCalled();
  });
});

describe('Cenário: sem internet', () => {
  it('confere os dados e troca a senha só com o banco do tablet', async () => {
    const cofre = cofreDeTentativas();

    await recoverPassword(PEDIDO_DA_ANA, tablet.repository, cofre, AGORA);

    await expect(entrarComoAna(NOVA_SENHA)).resolves.toMatchObject({ success: true });
    expect(cofre.read).toHaveBeenCalledTimes(1);
  });
});

describe('limite de tentativas seguidas', () => {
  it(`bloqueia por ${BLOCK_MINUTES} min na tentativa errada de número ${MAX_FAILED_ATTEMPTS}`, async () => {
    const cofre = cofreDeTentativas({ failures: MAX_FAILED_ATTEMPTS - 1, blockedUntil: null });

    const resultado = await recoverPassword(DADOS_ERRADOS, tablet.repository, cofre, AGORA);

    expect(resultado).toMatchObject({ success: false, reason: 'blocked' });
    expect(resultado).toHaveProperty('message', expect.stringContaining(`${BLOCK_MINUTES} min`));
    expect(cofre.atual().blockedUntil).toBe(minutosDepois(BLOCK_MINUTES).toISOString());
  });

  it('durante o bloqueio, nem os dados certos trocam a senha', async () => {
    const cofre = cofreDeTentativas({
      failures: MAX_FAILED_ATTEMPTS,
      blockedUntil: minutosDepois(BLOCK_MINUTES).toISOString(),
    });
    const hashAntes = await hashDaAna();

    const resultado = await recoverPassword(
      PEDIDO_DA_ANA,
      tablet.repository,
      cofre,
      minutosDepois(BLOCK_MINUTES - 1),
    );

    expect(resultado).toMatchObject({
      reason: 'blocked',
      message: expect.stringContaining('1 min'),
    });
    await expect(hashDaAna()).resolves.toBe(hashAntes);
  });

  it('libera a recuperação quando o bloqueio termina', async () => {
    const cofre = cofreDeTentativas({
      failures: MAX_FAILED_ATTEMPTS,
      blockedUntil: AGORA.toISOString(),
    });

    await expect(recoverPassword(PEDIDO_DA_ANA, tablet.repository, cofre, AGORA)).resolves.toEqual({
      success: true,
    });
  });
});

describe('validateRecovery', () => {
  it.each([
    ['CPF vazio', { cpf: ' ' }, { cpf: 'Preencha o CPF.' }],
    ['CPF inválido', { cpf: '111.111.111-11' }, { cpf: 'Informe um CPF válido.' }],
    ['CRM vazio', { crm: '' }, { crm: 'Preencha o CRM e a UF.' }],
    ['CRM sem UF', { crm: '12345' }, { crm: 'Informe o CRM e a UF, por exemplo 12345/DF.' }],
    [
      'UF que não existe',
      { crm: '12345/XX' },
      { crm: 'Informe o CRM e a UF, por exemplo 12345/DF.' },
    ],
    [
      'confirmação diferente',
      { confirmation: 'outra-senha-qualquer' },
      { confirmation: 'Confira a nova senha e a confirmação.' },
    ],
  ])('aponta %s', (_caso, mudanca, erros) => {
    expect(validateRecovery({ ...PEDIDO_DA_ANA, ...mudanca })).toEqual({
      valid: false,
      errors: erros,
    });
  });

  it('separa o número e a UF do CRM e deixa o CPF só com dígitos', () => {
    expect(validateRecovery(PEDIDO_DA_ANA)).toEqual({
      valid: true,
      recovery: {
        cpf: CPF_DA_ANA,
        crmNumber: ANA.crmNumber,
        crmState: ANA.crmState,
        newPassword: NOVA_SENHA,
      },
    });
  });
});

describe('contagem das tentativas', () => {
  it('soma uma falha sem bloquear antes do limite', () => {
    expect(attemptsAfterFailure({ failures: 1, blockedUntil: null }, AGORA)).toEqual({
      failures: 2,
      blockedUntil: null,
    });
  });

  it('recomeça do zero quando o bloqueio anterior já terminou', () => {
    const vencido = { failures: MAX_FAILED_ATTEMPTS, blockedUntil: AGORA.toISOString() };

    expect(attemptsAfterFailure(vencido, minutosDepois(1))).toEqual({
      failures: 1,
      blockedUntil: null,
    });
  });

  it.each([
    ['sem bloqueio', NO_FAILED_ATTEMPTS, false],
    ['antes do fim', { failures: 5, blockedUntil: minutosDepois(1).toISOString() }, true],
    ['no fim', { failures: 5, blockedUntil: AGORA.toISOString() }, false],
  ])('informa se está bloqueado %s', (_caso, tentativas, esperado) => {
    expect(isBlocked(tentativas, AGORA)).toBe(esperado);
  });
});
