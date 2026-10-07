import {
  WRONG_PASSWORD_MESSAGE,
  changePassword,
  deactivateAccount,
  updateProfile,
  validateProfile,
} from '@/features/auth/account';
import { verifyPassword } from '@/features/auth/password';
import {
  ANA,
  SENHA_DE_TESTE as SENHA,
  abrirTabletComAnaEBruno,
  hashDaSenhaDeTeste,
  type TabletDeTeste,
} from '@/test-utils/professionals';

// Testes de integração: a regra grava e lê de um SQLite de verdade, com as
// mesmas migrations do tablet.

const AGORA = new Date('2026-10-07T12:00:00.000Z');
const dadosDaAna = ANA;

let hashDaSenha: string;
let database: TabletDeTeste['database'];
let repository: TabletDeTeste['repository'];
let anaId: number;

beforeAll(async () => {
  hashDaSenha = await hashDaSenhaDeTeste();
});

beforeEach(async () => {
  ({ database, repository, anaId } = await abrirTabletComAnaEBruno());
});

afterEach(async () => {
  await database.closeAsync();
});

const contaDaAna = () => repository.findById(anaId);

describe('consulta dos meus dados', () => {
  it('lê o nome, o e-mail e o CRM gravados no tablet', async () => {
    await expect(contaDaAna()).resolves.toMatchObject(dadosDaAna);
  });
});

describe('dados atualizados', () => {
  it('grava os novos dados na mesma conta, mantendo o vínculo dos exames pelo id', async () => {
    const novos = {
      name: ' Ana Souza ',
      email: 'ANA@unieuro.com.br',
      crmNumber: '67890',
      crmState: 'sp',
    };

    const resultado = await updateProfile(anaId, novos, SENHA, repository, AGORA);

    const esperado = {
      name: 'Ana Souza',
      email: 'ana@unieuro.com.br',
      crmNumber: '67890',
      crmState: 'SP',
    };
    expect(resultado).toEqual({ success: true, profile: { id: anaId, ...esperado } });
    await expect(contaDaAna()).resolves.toMatchObject({
      id: anaId,
      ...esperado,
      updatedAt: AGORA.toISOString(),
    });
  });

  it('aceita salvar sem mudar o e-mail e o CRM da própria conta', async () => {
    const resultado = await updateProfile(anaId, dadosDaAna, SENHA, repository, AGORA);

    expect(resultado.success).toBe(true);
  });
});

describe('dado já usado por outra conta', () => {
  it('recusa o e-mail de outra conta, sem diferenciar maiúsculas, e não altera nada', async () => {
    const resultado = await updateProfile(
      anaId,
      { ...dadosDaAna, name: 'Outro Nome', email: 'Bruno.Lima@unieuro.com.br' },
      SENHA,
      repository,
    );

    expect(resultado).toEqual({
      success: false,
      errors: { email: 'Este e-mail já está em uso por outra conta.' },
    });
    await expect(contaDaAna()).resolves.toMatchObject(dadosDaAna);
  });

  it('recusa o CRM de outra conta e não altera nada', async () => {
    const resultado = await updateProfile(
      anaId,
      { ...dadosDaAna, crmNumber: '54321', crmState: 'GO' },
      SENHA,
      repository,
    );

    expect(resultado).toEqual({
      success: false,
      errors: { crmNumber: 'Este CRM já está em uso por outra conta.' },
    });
    await expect(contaDaAna()).resolves.toMatchObject(dadosDaAna);
  });
});

describe('campo inválido na edição', () => {
  it('indica cada campo a corrigir e não altera o cadastro', async () => {
    const resultado = await updateProfile(
      anaId,
      { name: '  ', email: 'ana@', crmNumber: '12A45', crmState: 'XX' },
      SENHA,
      repository,
    );

    expect(resultado).toEqual({
      success: false,
      errors: {
        name: 'Preencha o nome.',
        email: 'Informe um e-mail válido.',
        crmNumber: 'O CRM tem só números.',
        crmState: 'Informe a UF do CRM, por exemplo DF.',
      },
    });
    await expect(contaDaAna()).resolves.toMatchObject(dadosDaAna);
  });

  it('pede o e-mail e o CRM quando ficam vazios', () => {
    expect(validateProfile({ ...dadosDaAna, email: '', crmNumber: '' })).toEqual({
      valid: false,
      errors: { email: 'Preencha o e-mail.', crmNumber: 'Preencha o CRM.' },
    });
  });

  it('pede a senha atual junto com os outros campos', async () => {
    const resultado = await updateProfile(anaId, { ...dadosDaAna, name: '' }, '', repository);

    expect(resultado).toEqual({
      success: false,
      errors: { name: 'Preencha o nome.', currentPassword: 'Confirme com a sua senha atual.' },
    });
  });
});

describe('troca de senha', () => {
  it('passa a valer a nova senha, e a antiga deixa de valer', async () => {
    const resultado = await changePassword(
      anaId,
      { currentPassword: SENHA, newPassword: 'nova-senha-123', confirmation: 'nova-senha-123' },
      repository,
      AGORA,
    );

    expect(resultado).toEqual({ success: true });
    const conta = await contaDaAna();
    await expect(verifyPassword('nova-senha-123', conta!.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword(SENHA, conta!.passwordHash)).resolves.toBe(false);
    expect(conta!.updatedAt).toBe(AGORA.toISOString());
  });

  it('segue as regras do cadastro para a nova senha e a confirmação', async () => {
    const resultado = await changePassword(
      anaId,
      { currentPassword: '', newPassword: 'curta', confirmation: 'outra' },
      repository,
    );

    expect(resultado).toEqual({
      success: false,
      errors: {
        currentPassword: 'Informe a senha atual.',
        newPassword: 'A nova senha precisa ter pelo menos 8 caracteres.',
        confirmation: 'Confira a nova senha e a confirmação.',
      },
    });
    await expect(contaDaAna()).resolves.toMatchObject({ passwordHash: hashDaSenha });
  });
});

describe('conta desativada', () => {
  it('desativa a conta e registra a data e a hora', async () => {
    const resultado = await deactivateAccount(anaId, SENHA, repository, AGORA);

    expect(resultado).toEqual({ success: true });
    await expect(contaDaAna()).resolves.toMatchObject({
      active: false,
      deactivatedAt: AGORA.toISOString(),
    });
  });

  it('não deixa editar nem trocar a senha de uma conta já desativada', async () => {
    await deactivateAccount(anaId, SENHA, repository, AGORA);

    await expect(updateProfile(anaId, dadosDaAna, SENHA, repository)).resolves.toEqual({
      success: false,
      errors: { currentPassword: WRONG_PASSWORD_MESSAGE },
    });
    await expect(deactivateAccount(anaId, SENHA, repository)).resolves.toEqual({
      success: false,
      message: WRONG_PASSWORD_MESSAGE,
    });
  });

  it('pede a senha antes de desativar', async () => {
    await expect(deactivateAccount(anaId, '', repository)).resolves.toEqual({
      success: false,
      message: 'Confirme com a sua senha atual.',
    });
  });
});

describe('exames preservados', () => {
  it('mantém o registro do profissional no tablet depois da desativação', async () => {
    await deactivateAccount(anaId, SENHA, repository, AGORA);

    await expect(contaDaAna()).resolves.toMatchObject({ id: anaId, ...dadosDaAna });
    const total = await database.getFirstAsync<{ total: number }>(
      'SELECT count(*) AS total FROM profissional',
    );
    expect(total?.total).toBe(2);
  });
});

describe('senha atual incorreta', () => {
  it('não altera os dados', async () => {
    const resultado = await updateProfile(
      anaId,
      { ...dadosDaAna, name: 'Outro Nome' },
      'senha-errada',
      repository,
    );

    expect(resultado).toEqual({
      success: false,
      errors: { currentPassword: WRONG_PASSWORD_MESSAGE },
    });
    await expect(contaDaAna()).resolves.toMatchObject(dadosDaAna);
  });

  it('não troca a senha', async () => {
    const resultado = await changePassword(
      anaId,
      {
        currentPassword: 'senha-errada',
        newPassword: 'nova-senha-123',
        confirmation: 'nova-senha-123',
      },
      repository,
    );

    expect(resultado).toEqual({
      success: false,
      errors: { currentPassword: WRONG_PASSWORD_MESSAGE },
    });
    await expect(contaDaAna()).resolves.toMatchObject({ passwordHash: hashDaSenha });
  });

  it('não desativa a conta', async () => {
    const resultado = await deactivateAccount(anaId, 'senha-errada', repository);

    expect(resultado).toEqual({ success: false, message: WRONG_PASSWORD_MESSAGE });
    await expect(contaDaAna()).resolves.toMatchObject({ active: true, deactivatedAt: null });
  });
});
