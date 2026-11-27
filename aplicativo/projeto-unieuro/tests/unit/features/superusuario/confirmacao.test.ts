import { senhaDoSuperusuarioConfere } from '@/features/superusuario/confirmacao';

import {
  SENHA_DE_TESTE,
  SENHA_DO_TAUIL,
  abrirTabletComSuperusuario,
  type TabletComSuperusuario,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

let tablet: TabletComSuperusuario;

beforeEach(async () => {
  tablet = await abrirTabletComSuperusuario();
});

afterEach(async () => {
  await tablet.fechar();
});

const confere = (id: number, senha: string) =>
  senhaDoSuperusuarioConfere(id, senha, tablet.repository);

describe('senha de quem confirma uma ação da área do superusuário', () => {
  it('confere a senha do superusuário', async () => {
    await expect(confere(tablet.tauilId, SENHA_DO_TAUIL)).resolves.toBe(true);
  });

  it('recusa a senha de outra conta', async () => {
    await expect(confere(tablet.tauilId, SENHA_DE_TESTE)).resolves.toBe(false);
  });

  it('recusa a conta desativada, mesmo com a senha certa', async () => {
    await tablet.repository.deactivate(tablet.tauilId, '2026-11-26T12:00:00.000Z');

    await expect(confere(tablet.tauilId, SENHA_DO_TAUIL)).resolves.toBe(false);
  });

  it('recusa quem não existe', async () => {
    await expect(confere(9999, SENHA_DO_TAUIL)).resolves.toBe(false);
  });
});
