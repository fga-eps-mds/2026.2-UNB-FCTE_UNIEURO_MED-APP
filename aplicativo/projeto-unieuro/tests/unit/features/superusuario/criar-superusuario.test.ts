import { verifyPassword } from '@/features/auth/password';
import {
  CONFIRME_COM_A_SUA_SENHA,
  SENHA_DO_SUPERUSUARIO_ERRADA,
} from '@/features/superusuario/confirmacao';
import {
  SUPERUSUARIO_NAO_CRIADO,
  criarSuperusuario,
  type NovoSuperusuarioInput,
} from '@/features/superusuario/criar-superusuario';

import {
  ANA,
  CPF_DA_ANA,
  SENHA_DE_TESTE,
  SENHA_DO_TAUIL,
  abrirTabletComSuperusuario,
  type TabletComSuperusuario,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const SENHA_DA_JULIANA = 'senha-da-juliana';

const juliana = (dados: Partial<NovoSuperusuarioInput> = {}): NovoSuperusuarioInput => ({
  name: 'Juliana Mendes Costa',
  email: 'Juliana.Costa@unieuro.com.br',
  crm: '34567/go',
  cpf: '153.509.460-56',
  password: SENHA_DA_JULIANA,
  passwordConfirmation: SENHA_DA_JULIANA,
  senhaDoSuperusuario: SENHA_DO_TAUIL,
  ...dados,
});

let tablet: TabletComSuperusuario;

beforeEach(async () => {
  tablet = await abrirTabletComSuperusuario();
});

afterEach(async () => {
  await tablet.fechar();
});

const contaDaJuliana = () => tablet.repository.findByEmail('juliana.costa@unieuro.com.br');

describe('Cenário: criar outro superusuário', () => {
  it('cria a conta como superusuário, com o registro de quem a criou', async () => {
    await expect(criarSuperusuario(tablet.tauilId, juliana(), tablet.repository)).resolves.toEqual({
      success: true,
    });

    const conta = (await contaDaJuliana())!;
    expect(conta).toMatchObject({
      name: 'Juliana Mendes Costa',
      email: 'juliana.costa@unieuro.com.br',
      crmNumber: '34567',
      crmState: 'GO',
      active: true,
      superuser: true,
      superuserGrantedBy: tablet.tauilId,
    });
    await expect(verifyPassword(SENHA_DA_JULIANA, conta.passwordHash)).resolves.toBe(true);
    await expect(tablet.repository.getCpf(conta.id)).resolves.toBe('15350946056');
  });

  it('aponta cada campo a corrigir, e a senha do superusuário que falta', async () => {
    const resultado = await criarSuperusuario(
      tablet.tauilId,
      juliana({ name: '', email: 'sem-arroba', crm: '34567', cpf: '111', senhaDoSuperusuario: '' }),
      tablet.repository,
    );

    expect(resultado).toEqual({
      success: false,
      errors: {
        name: 'Preencha o nome.',
        email: 'Informe um e-mail válido.',
        crm: 'Informe o CRM no formato 12345/DF.',
        cpf: 'Informe um CPF válido.',
        senhaDoSuperusuario: CONFIRME_COM_A_SUA_SENHA,
      },
    });
    await expect(contaDaJuliana()).resolves.toBeNull();
  });

  it('recusa uma senha só de espaços, como o cadastro comum', async () => {
    const espacos = ' '.repeat(8);

    await expect(
      criarSuperusuario(
        tablet.tauilId,
        juliana({ password: espacos, passwordConfirmation: espacos }),
        tablet.repository,
      ),
    ).resolves.toEqual({
      success: false,
      errors: { geral: 'Preencha todos os campos para continuar.' },
    });
  });

  it('não aceita a senha de um médico no lugar da senha do superusuário', async () => {
    await expect(
      criarSuperusuario(
        tablet.tauilId,
        juliana({ senhaDoSuperusuario: SENHA_DE_TESTE }),
        tablet.repository,
      ),
    ).resolves.toEqual({
      success: false,
      errors: { senhaDoSuperusuario: SENHA_DO_SUPERUSUARIO_ERRADA },
    });
    await expect(contaDaJuliana()).resolves.toBeNull();
  });

  it('com a senha errada, não conta se o e-mail já está cadastrado', async () => {
    await expect(
      criarSuperusuario(
        tablet.tauilId,
        juliana({ email: ANA.email, senhaDoSuperusuario: 'errada-123' }),
        tablet.repository,
      ),
    ).resolves.toEqual({
      success: false,
      errors: { senhaDoSuperusuario: SENHA_DO_SUPERUSUARIO_ERRADA },
    });
  });

  it.each([
    [
      'e-mail',
      { email: ANA.email },
      'email',
      'Já existe um profissional cadastrado com este e-mail.',
    ],
    ['CRM', { crm: '12345/DF' }, 'crm', 'Já existe um profissional cadastrado com este CRM.'],
    ['CPF', { cpf: CPF_DA_ANA }, 'cpf', 'Já existe um profissional cadastrado com este CPF.'],
  ])('avisa o %s que já é de outra conta', async (_caso, dados, campo, mensagem) => {
    await expect(
      criarSuperusuario(tablet.tauilId, juliana(dados), tablet.repository),
    ).resolves.toEqual({ success: false, errors: { [campo]: mensagem } });
  });

  it('um médico comum não cria superusuário, nem com a própria senha', async () => {
    await expect(
      criarSuperusuario(
        tablet.anaId,
        juliana({ senhaDoSuperusuario: SENHA_DE_TESTE }),
        tablet.repository,
      ),
    ).resolves.toEqual({ success: false, errors: { geral: SUPERUSUARIO_NAO_CRIADO } });
    await expect(contaDaJuliana()).resolves.toBeNull();
  });
});
