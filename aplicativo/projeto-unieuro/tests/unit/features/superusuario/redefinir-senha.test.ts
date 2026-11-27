import { verifyPassword } from '@/features/auth/password';
import {
  CONFIRME_COM_A_SUA_SENHA,
  SENHA_DO_SUPERUSUARIO_ERRADA,
} from '@/features/superusuario/confirmacao';
import { SENHA_NAO_REDEFINIDA, redefinirSenha } from '@/features/superusuario/redefinir-senha';

import {
  SENHA_DE_TESTE,
  SENHA_DO_TAUIL,
  abrirTabletComSuperusuario,
  type TabletComSuperusuario,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const AGORA = new Date('2026-11-26T12:00:00.000Z');
const NOVA_SENHA = 'nova-senha-da-ana';

let tablet: TabletComSuperusuario;

beforeEach(async () => {
  tablet = await abrirTabletComSuperusuario();
});

afterEach(async () => {
  await tablet.fechar();
});

const pedido = (dados: Partial<Parameters<typeof redefinirSenha>[2]> = {}) => ({
  novaSenha: NOVA_SENHA,
  confirmacao: NOVA_SENHA,
  senhaDoSuperusuario: SENHA_DO_TAUIL,
  ...dados,
});

const senhaDaAnaE = async (senha: string) =>
  verifyPassword(senha, (await tablet.repository.findById(tablet.anaId))!.passwordHash);

describe('Cenário: redefinir a senha de um médico', () => {
  it('grava a nova senha com hash, e a antiga deixa de valer', async () => {
    await expect(
      redefinirSenha(tablet.tauilId, tablet.anaId, pedido(), tablet.repository, AGORA),
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
        { novaSenha: 'curta', confirmacao: 'outra', senhaDoSuperusuario: '' },
        tablet.repository,
        AGORA,
      ),
    ).resolves.toEqual({
      success: false,
      errors: {
        novaSenha: 'A nova senha precisa ter pelo menos 8 caracteres.',
        confirmacao: 'Confira a nova senha e a confirmação.',
        senhaDoSuperusuario: CONFIRME_COM_A_SUA_SENHA,
      },
    });
    await expect(senhaDaAnaE(SENHA_DE_TESTE)).resolves.toBe(true);
  });

  it('não aceita a senha do médico no lugar da senha do superusuário', async () => {
    await expect(
      redefinirSenha(
        tablet.tauilId,
        tablet.anaId,
        pedido({ senhaDoSuperusuario: SENHA_DE_TESTE }),
        tablet.repository,
        AGORA,
      ),
    ).resolves.toEqual({
      success: false,
      errors: { senhaDoSuperusuario: SENHA_DO_SUPERUSUARIO_ERRADA },
    });
    await expect(senhaDaAnaE(SENHA_DE_TESTE)).resolves.toBe(true);
  });

  it('um médico comum não troca a senha de outro, nem com a própria senha', async () => {
    await expect(
      redefinirSenha(
        tablet.anaId,
        tablet.brunoId,
        pedido({ senhaDoSuperusuario: SENHA_DE_TESTE }),
        tablet.repository,
        AGORA,
      ),
    ).resolves.toEqual({ success: false, errors: { geral: SENHA_NAO_REDEFINIDA } });
  });

  it('não troca a senha de uma conta desativada', async () => {
    await tablet.repository.deactivate(tablet.anaId, '2026-11-01T12:00:00.000Z');

    await expect(
      redefinirSenha(tablet.tauilId, tablet.anaId, pedido(), tablet.repository, AGORA),
    ).resolves.toEqual({ success: false, errors: { geral: SENHA_NAO_REDEFINIDA } });
  });
});
