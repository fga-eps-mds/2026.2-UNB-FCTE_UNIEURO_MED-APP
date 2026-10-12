import { render, screen, userEvent } from '@testing-library/react-native';

import { verifyPassword } from '@/features/auth/password';
import RegisterScreen from '../../src/features/auth/register-screen';

import {
  ANA,
  CPF_DA_ANA,
  abrirTablet,
  abrirTabletComAnaEBruno,
  type TabletDeTeste,
} from '../test-support/tablet';

/**
 * Integração do cadastro: tela → regras de validação → repositório → SQLite real.
 * Nada do caminho é simulado, nem o banco, nem a senha (o PBKDF2 roda de verdade),
 */

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let tablet: TabletDeTeste;

afterEach(async () => {
  await tablet.fechar();
});

type Cadastro = {
  nome: string;
  email: string;
  crm: string;
  cpf: string;
  senha: string;
  confirmacao: string;
};

const DADOS_DA_ANA: Cadastro = {
  nome: 'Ana Carolina Souza',
  email: 'ana.souza@unieuro.com.br',
  crm: '12345/DF',
  cpf: '111.444.777-35',
  senha: 'senha-da-ana',
  confirmacao: 'senha-da-ana',
};

async function cadastrar(dados: Cadastro) {
  const user = userEvent.setup();
  const tela = render(<RegisterScreen repository={tablet.repository} />);

  await user.type(screen.getByLabelText('NOME COMPLETO'), dados.nome);
  await user.type(screen.getByLabelText('E-MAIL'), dados.email);
  await user.type(screen.getByLabelText('CRM'), dados.crm);
  await user.type(screen.getByLabelText('CPF'), dados.cpf);
  await user.type(screen.getByLabelText('SENHA'), dados.senha);
  await user.type(screen.getByLabelText('CONFIRMAR SENHA'), dados.confirmacao);
  await user.press(screen.getByRole('button', { name: 'CRIAR CONTA' }));
  return tela;
}

async function contarProfissionais(): Promise<number> {
  const linha = await tablet.database.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM profissional',
  );
  return linha!.total;
}

const MENSAGEM_DE_SUCESSO = 'Conta criada. Entre com o e-mail e a senha cadastrados.';

describe('cadastro com SQLite real', () => {
  beforeEach(async () => {
    tablet = await abrirTablet();
  });

  it('cadastro válido: confirma na tela e grava o profissional ativo no banco', async () => {
    await cadastrar(DADOS_DA_ANA);

    expect(await screen.findByText(MENSAGEM_DE_SUCESSO)).toBeOnTheScreen();
    const linha = await tablet.database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM profissional',
    );
    expect(linha).toMatchObject({
      nome: 'Ana Carolina Souza',
      email: 'ana.souza@unieuro.com.br',
      crm_numero: '12345',
      uf_crm: 'DF',
      ativo: 1,
    });
    expect(new Date(linha!.criacao as string).toISOString()).toBe(linha!.criacao);
    expect(linha!.last_update).toBe(linha!.criacao);
  });

  it('cadastro válido: grava só o hash da senha, nunca a senha em texto', async () => {
    await cadastrar(DADOS_DA_ANA);

    const salvo = await tablet.repository.findByEmail(ANA.email);
    expect(salvo!.passwordHash).toMatch(/^pbkdf2-sha256\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(salvo!.passwordHash).not.toContain(DADOS_DA_ANA.senha);
    await expect(verifyPassword(DADOS_DA_ANA.senha, salvo!.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword('outra-senha', salvo!.passwordHash)).resolves.toBe(false);
  });

  it('cadastro válido: o CPF vai cifrado para o banco e volta igual', async () => {
    await cadastrar(DADOS_DA_ANA);

    const salvo = await tablet.repository.findByEmail(ANA.email);
    await expect(tablet.repository.getCpf(salvo!.id)).resolves.toBe(CPF_DA_ANA);
    await tablet.encerrar();
    expect(tablet.temp.rawContains('Ana Carolina Souza')).toBe(true);
    expect(tablet.temp.rawContains(CPF_DA_ANA)).toBe(false);
  });

  it('cadastro válido: normaliza o e-mail para minúsculas e a UF do CRM para maiúsculas', async () => {
    await cadastrar({ ...DADOS_DA_ANA, email: 'Ana.Souza@UniEuro.com.br', crm: '12345 / df' });

    const linha = await tablet.database.getFirstAsync<{ email: string; uf_crm: string }>(
      'SELECT email, uf_crm FROM profissional',
    );
    expect(linha).toEqual({ email: 'ana.souza@unieuro.com.br', uf_crm: 'DF' });
  });

  it('dois profissionais com dados diferentes: os dois ficam gravados', async () => {
    const primeira = await cadastrar(DADOS_DA_ANA);
    primeira.unmount();

    await cadastrar({
      nome: 'Bruno Lima',
      email: 'bruno.lima@unieuro.com.br',
      crm: '54321/GO',
      cpf: '529.982.247-25',
      senha: 'senha-do-bruno',
      confirmacao: 'senha-do-bruno',
    });

    expect(await screen.findByText(MENSAGEM_DE_SUCESSO)).toBeOnTheScreen();
    await expect(contarProfissionais()).resolves.toBe(2);
  });

  it('dados inválidos: mostram o erro e não gravam nada', async () => {
    await cadastrar({ ...DADOS_DA_ANA, cpf: '111.444.777-00' });

    expect(await screen.findByText('Informe um CPF válido.')).toBeOnTheScreen();
    await expect(contarProfissionais()).resolves.toBe(0);
  });
});

describe('cadastro de quem já está no banco', () => {
  beforeEach(async () => {
    tablet = await abrirTabletComAnaEBruno();
  });

  const NOVO: Cadastro = {
    ...DADOS_DA_ANA,
    email: 'carla.dias@unieuro.com.br',
    crm: '99999/SP',
    cpf: '390.533.447-05',
  };

  it.each([
    [
      'e-mail',
      { email: 'ana.souza@unieuro.com.br' },
      'Já existe um profissional cadastrado com este e-mail.',
    ],
    [
      'e-mail com outra caixa de letras',
      { email: 'ANA.SOUZA@unieuro.com.br' },
      'Já existe um profissional cadastrado com este e-mail.',
    ],
    ['CRM', { crm: '12345/DF' }, 'Já existe um profissional cadastrado com este CRM.'],
    ['CPF', { cpf: '111.444.777-35' }, 'Já existe um profissional cadastrado com este CPF.'],
  ])(
    'mesmo %s: avisa na tela e não grava um terceiro cadastro',
    async (_campo, repetido, mensagem) => {
      await cadastrar({ ...NOVO, ...repetido });

      expect(await screen.findByText(mensagem)).toBeOnTheScreen();
      await expect(contarProfissionais()).resolves.toBe(2);
    },
  );

  it('dados todos novos: o cadastro entra ao lado dos que já existiam', async () => {
    await cadastrar(NOVO);

    expect(await screen.findByText(MENSAGEM_DE_SUCESSO)).toBeOnTheScreen();
    await expect(contarProfissionais()).resolves.toBe(3);
  });
});
