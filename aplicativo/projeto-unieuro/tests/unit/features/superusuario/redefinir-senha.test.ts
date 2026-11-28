import { verifyPassword } from '@/features/auth/password';
import { SENHA_NAO_REDEFINIDA, redefinirSenha } from '@/features/superusuario/redefinir-senha';

import {
  SENHA_DE_TESTE,
  abrirTabletComSuperusuario,
  type TabletComSuperusuario,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const AGORA = new Date('2026-11-26T12:00:00.000Z');
const NOVA_SENHA = 'nova-senha-da-ana';
const pedido = { novaSenha: NOVA_SENHA, confirmacao: NOVA_SENHA };

let tablet: TabletComSuperusuario;

beforeEach(async () => {
  tablet = await abrirTabletComSuperusuario();
});

afterEach(async () => {
  await tablet.fechar();
});

const senhaDaAnaE = async (senha: string) =>
  verifyPassword(senha, (await tablet.repository.findById(tablet.anaId))!.passwordHash);

describe('Cenário: redefinir a senha de um médico', () => {
  it('grava a nova senha com hash, e a antiga deixa de valer', async () => {
    await expect(
      redefinirSenha(tablet.tauilId, tablet.anaId, pedido, tablet.repository, AGORA),
    ).resolves.toEqual({ success: true });

    await expect(senhaDaAnaE(NOVA_SENHA)).resolves.toBe(true);
    await expect(senhaDaAnaE(SENHA_DE_TESTE)).resolves.toBe(false);
    expect((await tablet.repository.findById(tablet.anaId))!.updatedAt).toBe(AGORA.toISOString());
  });

  it('aponta cada campo a corrigir antes de ir ao banco', async () => {
    await expect(
      redefinirSenha(
        tablet.tauilId,
        tablet.anaId,
        { novaSenha: 'curta', confirmacao: 'outra' },
        tablet.repository,
        AGORA,
      ),
    ).resolves.toEqual({
      success: false,
      errors: {
        novaSenha: 'A nova senha precisa ter pelo menos 8 caracteres.',
        confirmacao: 'Confira a nova senha e a confirmação.',
      },
    });
    await expect(senhaDaAnaE(SENHA_DE_TESTE)).resolves.toBe(true);
  });

  it('um médico comum não troca a senha de outro', async () => {
    await expect(
      redefinirSenha(tablet.anaId, tablet.brunoId, pedido, tablet.repository, AGORA),
    ).resolves.toEqual({ success: false, errors: { geral: SENHA_NAO_REDEFINIDA } });
  });

  it('não troca a senha de uma conta desativada', async () => {
    await tablet.repository.deactivate(tablet.anaId, '2026-11-01T12:00:00.000Z');

    await expect(
      redefinirSenha(tablet.tauilId, tablet.anaId, pedido, tablet.repository, AGORA),
    ).resolves.toEqual({ success: false, errors: { geral: SENHA_NAO_REDEFINIDA } });
  });

  it('não troca a senha de um superusuário', async () => {
    await expect(
      redefinirSenha(tablet.tauilId, tablet.tauilId, pedido, tablet.repository, AGORA),
    ).resolves.toEqual({ success: false, errors: { geral: SENHA_NAO_REDEFINIDA } });
  });
});
