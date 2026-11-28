import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { verifyPassword } from '@/features/auth/password';
import type { LinhaConta } from '@/features/superusuario/contas';
import type { RedefinicaoRepository } from '@/features/superusuario/redefinir-senha';
import {
  FALHA_AO_REDEFINIR,
  RedefinirSenhaDialog,
} from '@/features/superusuario/redefinir-senha-dialog';

import {
  abrirTabletComSuperusuario,
  type TabletComSuperusuario,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const NOVA_SENHA = 'nova-senha-da-ana';

let tablet: TabletComSuperusuario;
let ana: LinhaConta;

beforeEach(async () => {
  tablet = await abrirTabletComSuperusuario();
  ana = {
    id: tablet.anaId,
    nome: 'Ana Carolina Souza',
    email: 'ana.souza@unieuro.com.br',
    crm: '12345/DF',
    situacao: 'ativa',
    exames: 0,
    podeDesativar: true,
    podeRedefinirSenha: true,
  };
});

afterEach(async () => {
  await tablet.fechar();
});

function abrir(conta: LinhaConta | null, repository: RedefinicaoRepository = tablet.repository) {
  const onCancel = jest.fn();
  const onRedefinida = jest.fn();
  render(
    <RedefinirSenhaDialog
      conta={conta}
      superusuarioId={tablet.tauilId}
      repository={repository}
      onCancel={onCancel}
      onRedefinida={onRedefinida}
    />,
  );
  return { onCancel, onRedefinida };
}

async function preencher(novaSenha: string, confirmacao: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('NOVA SENHA'), novaSenha);
  await user.type(screen.getByLabelText('CONFIRMAR NOVA SENHA'), confirmacao);
  await user.press(screen.getByRole('button', { name: 'Salvar nova senha' }));
}

const senhaDaAnaE = async (senha: string) =>
  verifyPassword(senha, (await tablet.repository.findById(tablet.anaId))!.passwordHash);

describe('Cenário: redefinir a senha de um médico', () => {
  it('fica fechado sem uma conta escolhida', () => {
    abrir(null);

    expect(screen.queryByRole('header')).toBeNull();
  });

  it('pergunta pelo nome do médico', () => {
    abrir(ana);

    expect(
      screen.getByRole('header', { name: 'Redefinir a senha de Ana Carolina Souza?' }),
    ).toBeOnTheScreen();
  });

  it('grava a nova senha e avisa quem abriu', async () => {
    const { onRedefinida } = abrir(ana);

    await preencher(NOVA_SENHA, NOVA_SENHA);

    await waitFor(() => expect(onRedefinida).toHaveBeenCalledWith(ana));
    await expect(senhaDaAnaE(NOVA_SENHA)).resolves.toBe(true);
  });

  it('mostra o erro de cada campo', async () => {
    const { onRedefinida } = abrir(ana);

    await preencher('curta', 'outra');

    expect(
      await screen.findByText('A nova senha precisa ter pelo menos 8 caracteres.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Confira a nova senha e a confirmação.')).toBeOnTheScreen();
    expect(onRedefinida).not.toHaveBeenCalled();
  });

  it('avisa quando o banco recusa a troca', async () => {
    await tablet.repository.deactivate(tablet.anaId, '2026-11-26T12:00:00.000Z');
    abrir(ana);

    await preencher(NOVA_SENHA, NOVA_SENHA);

    expect(await screen.findByText(/não pode ser redefinida/)).toBeOnTheScreen();
  });

  it('cancelar fecha e limpa o que foi digitado', async () => {
    const user = userEvent.setup();
    const { onCancel } = abrir(ana);
    await user.type(screen.getByLabelText('NOVA SENHA'), 'meio-digitada');

    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByLabelText('NOVA SENHA')).toHaveDisplayValue('');
  });

  it('avisa quando o banco falha', async () => {
    const quebrado: RedefinicaoRepository = {
      resetDoctorPassword: jest.fn().mockRejectedValue(new Error('banco indisponível')),
    };
    abrir(ana, quebrado);

    await preencher(NOVA_SENHA, NOVA_SENHA);

    expect(await screen.findByText(FALHA_AO_REDEFINIR)).toBeOnTheScreen();
  });
});
