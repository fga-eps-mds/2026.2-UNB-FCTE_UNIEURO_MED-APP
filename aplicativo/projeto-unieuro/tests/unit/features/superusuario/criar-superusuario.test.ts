import { verifyPassword } from '@/features/auth/password';
import {
  SUPERUSUARIO_NAO_CRIADO,
  criarSuperusuario,
  type NovoSuperusuarioInput,
} from '@/features/superusuario/criar-superusuario';

import {
  ANA,
  CPF_DA_ANA,
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

  it('aponta cada campo a corrigir', async () => {
    const resultado = await criarSuperusuario(
      tablet.tauilId,
      juliana({ name: '', email: 'sem-arroba', crm: '34567', cpf: '111' }),
      tablet.repository,
    );

    expect(resultado).toEqual({
      success: false,
      errors: {
        name: 'Preencha o nome.',
        email: 'Informe um e-mail válido.',
        crm: 'Informe o CRM no formato 12345/DF.',
        cpf: 'Informe um CPF válido.',
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

  it('um médico comum não cria superusuário', async () => {
    await expect(criarSuperusuario(tablet.anaId, juliana(), tablet.repository)).resolves.toEqual({
      success: false,
      errors: { geral: SUPERUSUARIO_NAO_CRIADO },
    });
    await expect(contaDaJuliana()).resolves.toBeNull();
  });
});
