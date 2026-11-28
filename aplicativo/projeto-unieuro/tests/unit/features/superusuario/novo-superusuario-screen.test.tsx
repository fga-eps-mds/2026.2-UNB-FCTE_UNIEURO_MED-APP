import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { verifyPassword } from '@/features/auth/password';
import { SessionProvider, type SessionProfessional } from '@/features/auth/session';
import type { CriacaoRepository } from '@/features/superusuario/criar-superusuario';
import NovoSuperusuarioScreen, {
  FALHA_AO_CRIAR,
  SUPERUSUARIO_CRIADO,
} from '@/features/superusuario/novo-superusuario-screen';

import {
  ANA,
  TAUIL,
  abrirTabletComSuperusuario,
  type TabletComSuperusuario,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const SENHA_DA_JULIANA = 'senha-da-juliana';

let tablet: TabletComSuperusuario;

beforeEach(async () => {
  tablet = await abrirTabletComSuperusuario();
});

afterEach(async () => {
  await tablet.fechar();
});

const sessao = (id: number, dados: typeof TAUIL, superuser: boolean): SessionProfessional => ({
  id,
  ...dados,
  superuser,
});

function abrir(
  profissional = sessao(tablet.tauilId, TAUIL, true),
  repository: CriacaoRepository = tablet.repository,
) {
  render(
    <SessionProvider initialProfessional={profissional}>
      <NovoSuperusuarioScreen repository={repository} />
    </SessionProvider>,
  );
}

function preencher(dados: Partial<Record<string, string>> = {}) {
  const campos = {
    'NOME COMPLETO': 'Juliana Mendes Costa',
    'E-MAIL': 'juliana.costa@unieuro.com.br',
    CRM: '34567/GO',
    CPF: '15350946056',
    SENHA: SENHA_DA_JULIANA,
    'CONFIRMAR SENHA': SENHA_DA_JULIANA,
    ...dados,
  };
  for (const [rotulo, valor] of Object.entries(campos)) {
    fireEvent.changeText(screen.getByLabelText(rotulo), valor);
  }
}

const criar = () =>
  userEvent.setup().press(screen.getByRole('button', { name: 'Criar superusuário' }));

const contaDaJuliana = () => tablet.repository.findByEmail('juliana.costa@unieuro.com.br');

describe('Cenário: criar outro superusuário', () => {
  it('o superusuário vê o cadastro, com os campos do cadastro comum', () => {
    abrir();

    expect(screen.getByRole('header', { name: 'Novo superusuário' })).toBeOnTheScreen();
    expect(screen.getByLabelText('CRM')).toBeOnTheScreen();
  });

  it('cria a conta de superusuário, avisa e limpa o formulário', async () => {
    abrir();
    preencher();

    await criar();

    expect(await screen.findByText(SUPERUSUARIO_CRIADO)).toBeOnTheScreen();
    expect(screen.getByLabelText('NOME COMPLETO')).toHaveDisplayValue('');
    const conta = (await contaDaJuliana())!;
    expect(conta).toMatchObject({ superuser: true, superuserGrantedBy: tablet.tauilId });
    await expect(verifyPassword(SENHA_DA_JULIANA, conta.passwordHash)).resolves.toBe(true);
  });

  it('formata o CPF enquanto digita', () => {
    abrir();

    fireEvent.changeText(screen.getByLabelText('CPF'), '15350946056');

    expect(screen.getByLabelText('CPF')).toHaveDisplayValue('153.509.460-56');
  });

  it('mostra o erro embaixo de cada campo e some quando o campo muda', async () => {
    abrir();

    await criar();

    expect(await screen.findByText('Preencha o nome.')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('NOME COMPLETO'), 'Juliana');
    expect(screen.queryByText('Preencha o nome.')).toBeNull();
  });

  it('avisa no campo o e-mail que já é de outra conta', async () => {
    abrir();
    preencher({ 'E-MAIL': ANA.email });

    await criar();

    expect(
      await screen.findByText('Já existe um profissional cadastrado com este e-mail.'),
    ).toBeOnTheScreen();
  });

  it('mostra embaixo do formulário o erro que não é de um campo só', async () => {
    abrir();
    preencher({ SENHA: ' '.repeat(8), 'CONFIRMAR SENHA': ' '.repeat(8) });

    await criar();

    expect(await screen.findByText('Preencha todos os campos para continuar.')).toBeOnTheScreen();
  });

  it('avisa quando o banco falha', async () => {
    const quebrado: CriacaoRepository = {
      emailExists: jest.fn().mockRejectedValue(new Error('banco indisponível')),
      crmExists: jest.fn(),
      cpfExists: jest.fn(),
      insertSuperuser: jest.fn(),
    };
    abrir(undefined, quebrado);
    preencher();

    await criar();

    expect(await screen.findByText(FALHA_AO_CRIAR)).toBeOnTheScreen();
  });

  it('voltar e cancelar levam de volta à área do superusuário', async () => {
    const user = userEvent.setup();
    abrir();

    await user.press(screen.getByRole('button', { name: 'Voltar para a área do superusuário' }));
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(useRouter().back).toHaveBeenCalledTimes(2);
  });
});

describe('Cenário: acesso de um profissional comum', () => {
  it('um médico comum que chega pela rota volta ao início sem ver o cadastro', () => {
    abrir(sessao(tablet.anaId, ANA, false));

    expect(screen.queryByRole('header', { name: 'Novo superusuário' })).toBeNull();
    expect(useRouter().replace).toHaveBeenCalledWith('/menu');
  });
});
