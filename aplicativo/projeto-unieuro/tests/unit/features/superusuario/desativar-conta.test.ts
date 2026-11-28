import { CONTA_NAO_DESATIVADA, desativarConta } from '@/features/superusuario/desativar-conta';

import {
  abrirTabletComSuperusuario,
  type TabletComSuperusuario,
} from '../../../test-support/tablet';

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const AGORA = new Date('2026-11-26T12:00:00.000Z');

let tablet: TabletComSuperusuario;

beforeEach(async () => {
  tablet = await abrirTabletComSuperusuario();
});

afterEach(async () => {
  await tablet.fechar();
});

const contaDaAna = async () => (await tablet.repository.findById(tablet.anaId))!;

describe('Cenário: desativar a conta de um médico', () => {
  it('desativa a conta e grava a data', async () => {
    await expect(
      desativarConta(tablet.tauilId, tablet.anaId, tablet.repository, AGORA),
    ).resolves.toEqual({ success: true });

    expect(await contaDaAna()).toMatchObject({ active: false, deactivatedAt: AGORA.toISOString() });
  });

  it('um médico comum não desativa ninguém', async () => {
    await expect(
      desativarConta(tablet.anaId, tablet.brunoId, tablet.repository, AGORA),
    ).resolves.toEqual({ success: false, message: CONTA_NAO_DESATIVADA });
    expect((await tablet.repository.findById(tablet.brunoId))!.active).toBe(true);
  });

  it('avisa quando a conta já estava desativada', async () => {
    await tablet.repository.deactivate(tablet.anaId, '2026-11-01T12:00:00.000Z');

    await expect(
      desativarConta(tablet.tauilId, tablet.anaId, tablet.repository, AGORA),
    ).resolves.toEqual({ success: false, message: CONTA_NAO_DESATIVADA });
  });

  it('o superusuário não desativa a própria conta pela tela de superusuário', async () => {
    await expect(
      desativarConta(tablet.tauilId, tablet.tauilId, tablet.repository, AGORA),
    ).resolves.toEqual({ success: false, message: CONTA_NAO_DESATIVADA });
  });
});
