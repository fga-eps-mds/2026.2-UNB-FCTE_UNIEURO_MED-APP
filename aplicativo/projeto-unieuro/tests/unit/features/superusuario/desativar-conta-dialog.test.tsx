import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import type { LinhaConta } from '@/features/superusuario/contas';
import {
  CONTA_NAO_DESATIVADA,
  type DesativacaoRepository,
} from '@/features/superusuario/desativar-conta';
import {
  DesativarContaDialog,
  FALHA_AO_DESATIVAR,
} from '@/features/superusuario/desativar-conta-dialog';

import {
  abrirTabletComSuperusuario,
  type TabletComSuperusuario,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

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

function abrir(conta: LinhaConta | null, repository: DesativacaoRepository = tablet.repository) {
  const onCancel = jest.fn();
  const onDesativada = jest.fn();
  render(
    <DesativarContaDialog
      conta={conta}
      superusuarioId={tablet.tauilId}
      repository={repository}
      onCancel={onCancel}
      onDesativada={onDesativada}
    />,
  );
  return { onCancel, onDesativada };
}

const desativar = () =>
  userEvent.setup().press(screen.getByRole('button', { name: 'Desativar conta' }));
const contaDaAnaAtiva = async () => (await tablet.repository.findById(tablet.anaId))!.active;

describe('Cenário: desativar a conta de um médico', () => {
  it('fica fechado sem uma conta escolhida', () => {
    abrir(null);

    expect(screen.queryByRole('header')).toBeNull();
  });

  it('pergunta pelo nome do médico e explica que os exames ficam no tablet', () => {
    abrir(ana);

    expect(
      screen.getByRole('header', { name: 'Desativar a conta de Ana Carolina Souza?' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/continuam salvos para a pesquisa/)).toBeOnTheScreen();
  });

  it('desativa a conta e avisa quem abriu', async () => {
    const { onDesativada } = abrir(ana);

    await desativar();

    await waitFor(() => expect(onDesativada).toHaveBeenCalledWith(ana));
    await expect(contaDaAnaAtiva()).resolves.toBe(false);
  });

  it('avisa quando o banco recusa, como numa conta que já estava desativada', async () => {
    await tablet.repository.deactivate(tablet.anaId, '2026-11-01T12:00:00.000Z');
    const { onDesativada } = abrir(ana);

    await desativar();

    expect(await screen.findByText(CONTA_NAO_DESATIVADA)).toBeOnTheScreen();
    expect(onDesativada).not.toHaveBeenCalled();
  });

  it('cancelar fecha sem desativar', async () => {
    const { onCancel } = abrir(ana);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalled();
    await expect(contaDaAnaAtiva()).resolves.toBe(true);
  });

  it('avisa quando o banco falha', async () => {
    const quebrado: DesativacaoRepository = {
      deactivateDoctor: jest.fn().mockRejectedValue(new Error('banco indisponível')),
    };
    abrir(ana, quebrado);

    await desativar();

    expect(await screen.findByText(FALHA_AO_DESATIVAR)).toBeOnTheScreen();
  });
});
