import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { Colors } from '@/constants/theme';
import { createSyncRepository } from '@/db/sync-repository';
import {
  createNearbySession,
  NEARBY_MESSAGES,
  type NearbySession,
} from '@/features/sincronizacao/nearby-session';
import NearbySyncCard from '@/features/sincronizacao/nearby-sync-card';
import { createSyncStyles } from '@/features/sincronizacao/sync.styles';
import { createSyncService } from '@/features/sincronizacao/sync-service';

import { FakeAir, type FakeNearby, until } from '../test-support/fake-nearby';
import { abrirTablet, protetorComChave, type TabletDeTeste } from '../test-support/tablet';

// Cartão do Nearby de ponta a ponta. O outro tablet é conduzido pela sessão dele.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual('node:crypto');
  return {
    getRandomBytesAsync: async (size: number) => new Uint8Array(crypto.randomBytes(size)),
  };
});

const SLOW = { timeout: 5000 };
const styles = createSyncStyles(Colors.light);

const opened: TabletDeTeste[] = [];

async function tabletWith(name: string, crm: string, cpf: string, key: number) {
  const tablet = await abrirTablet(protetorComChave(key));
  opened.push(tablet);
  await tablet.repository.insert({
    name,
    email: `${crm}@unieuro.com.br`,
    crmNumber: crm,
    crmState: 'DF',
    cpf,
    passwordHash: 'hash',
    createdAt: new Date().toISOString(),
  });
  return {
    database: tablet.database,
    service: createSyncService({
      repository: createSyncRepository(async () => tablet.database, tablet.protector),
    }),
  };
}

let air: FakeAir;
let radioA: FakeNearby;
let radioB: FakeNearby;
let databaseA: SQLiteDatabase;
let serviceA: ReturnType<typeof createSyncService>;
let sessionB: NearbySession;
const confirmA = async (password: string) => password === 'senha-da-ana';

beforeEach(async () => {
  air = new FakeAir();
  radioA = air.device('tablet-a');
  radioB = air.device('tablet-b');
  const ana = await tabletWith('Ana Souza', '11111', '11144477735', 1);
  const bruno = await tabletWith('Bruno Lima', '22222', '52998224725', 2);
  databaseA = ana.database;
  serviceA = ana.service;
  sessionB = createNearbySession({
    api: radioB,
    sync: bruno.service,
    confirmPassword: async (password) => password === 'senha-do-bruno',
    wait: async () => undefined,
  });
});

afterEach(async () => {
  sessionB.stop();
  await new Promise((resolve) => setTimeout(resolve, 10));
  for (const tablet of opened.splice(0)) await tablet.fechar();
});

function renderCard({
  onReceived = jest.fn(),
  openLocationSettings = jest.fn(async () => undefined),
} = {}) {
  render(
    <NearbySyncCard
      nearby={radioA}
      service={serviceA}
      confirmPassword={confirmA}
      onReceived={onReceived}
      openLocationSettings={openLocationSettings}
      styles={styles}
      placeholderColor={Colors.light.placeholder}
    />,
  );
  return { onReceived, openLocationSettings };
}

const error = (message: string) => screen.findByLabelText(`Erro. ${message}`, undefined, SLOW);

async function reachConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));
  await screen.findByText(/Este tablet aparece para os outros como/, undefined, SLOW);
  await sessionB.start();
  const connect = await screen.findByRole('button', { name: /^Conectar a Tablet / }, SLOW);
  await user.press(connect);
  await screen.findByText(/mostra o mesmo código/, undefined, SLOW);
}

async function confirmBoth(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Sua senha'), 'senha-da-ana');
  await user.press(screen.getByRole('button', { name: 'Confirmar e sincronizar' }));
  await until(() => sessionB.getState().phase === 'confirming');
  await sessionB.confirm('senha-do-bruno');
}

describe('sincronizar com tablet próximo', () => {
  it('explica o que fazer antes de procurar', () => {
    renderCard();

    expect(
      screen.getByRole('header', { name: 'Sincronizar com tablet próximo' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Abra esta mesma tela no outro tablet/)).toBeOnTheScreen();
  });

  it('sincroniza com o tablet próximo depois de conferir o código e a senha', async () => {
    const user = userEvent.setup();
    const { onReceived } = renderCard();

    await reachConfirmation(user);
    expect(screen.getByLabelText('Código de conferência: 4 8 2 1')).toBeOnTheScreen();
    await confirmBoth(user);

    expect(
      await screen.findByText(/Sincronização concluída com o Tablet /, undefined, SLOW),
    ).toBeOnTheScreen();
    expect(screen.getByText('Recebidos: 1 profissional novo.')).toBeOnTheScreen();
    expect(onReceived).toHaveBeenCalled();
    await expect(
      databaseA.getAllAsync('SELECT nome FROM profissional ORDER BY nome'),
    ).resolves.toEqual([{ nome: 'Ana Souza' }, { nome: 'Bruno Lima' }]);
  });

  it('avisa quando a senha está errada e não conecta', async () => {
    const user = userEvent.setup();
    renderCard();
    await reachConfirmation(user);

    await user.type(screen.getByLabelText('Sua senha'), 'senha-errada');
    await user.press(screen.getByRole('button', { name: 'Confirmar e sincronizar' }));

    expect(await error(NEARBY_MESSAGES.wrongPassword)).toBeOnTheScreen();
    expect(radioA.accepted.size).toBe(0);
  });

  it('volta para a lista quando o código é diferente', async () => {
    const user = userEvent.setup();
    renderCard();
    await reachConfirmation(user);

    await user.press(screen.getByRole('button', { name: 'O código é diferente: cancelar' }));

    expect(
      await screen.findByRole('button', { name: /^Conectar a Tablet / }, SLOW),
    ).toBeOnTheScreen();
  });

  it('mostra a espera pelo outro tablet e permite cancelar', async () => {
    const user = userEvent.setup();
    renderCard();
    await reachConfirmation(user);
    await user.type(screen.getByLabelText('Sua senha'), 'senha-da-ana');
    await user.press(screen.getByRole('button', { name: 'Confirmar e sincronizar' }));

    expect(
      await screen.findByText(/Aguardando a confirmação no Tablet /, undefined, SLOW),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      await screen.findByRole('button', { name: 'Procurar tablets próximos' }),
    ).toBeOnTheScreen();
  });

  it('pede as permissões e oferece tentar de novo', async () => {
    const user = userEvent.setup();
    radioA.permissionsGranted = false;
    renderCard();

    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));

    expect(await error(NEARBY_MESSAGES.permissions)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Abrir configurações de localização' })).toBeNull();
    radioA.permissionsGranted = true;
    await user.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(
      await screen.findByText(/Este tablet aparece para os outros como/, undefined, SLOW),
    ).toBeOnTheScreen();
  });

  it('com a localização desligada, oferece abrir a configuração dela', async () => {
    const user = userEvent.setup();
    radioA.radio = { ...radioA.radio, location: false, sdkVersion: 36 };
    const { openLocationSettings } = renderCard();

    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));
    expect(await error(NEARBY_MESSAGES.location)).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Abrir configurações de localização' }));

    expect(openLocationSettings).toHaveBeenCalled();
    expect(radioA.advertising).toBe(false);
  });

  it('avisa que o Wi-Fi desligado deixa a troca mais lenta', async () => {
    const user = userEvent.setup();
    radioA.radio = { ...radioA.radio, wifi: false };
    renderCard();

    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));

    expect(await screen.findByText(/O Wi-Fi está desligado/, undefined, SLOW)).toBeOnTheScreen();
  });

  it('para de procurar quando o profissional pede', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));
    await screen.findByText(/Procurando tablets próximos/, undefined, SLOW);

    await user.press(screen.getByRole('button', { name: 'Parar de procurar' }));

    expect(
      await screen.findByRole('button', { name: 'Procurar tablets próximos' }),
    ).toBeOnTheScreen();
    expect(radioA.advertising).toBe(false);
  });

  it('mostra o erro e oferece tentar de novo quando não consegue começar', async () => {
    const consoleErro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    radioA.failStart = true;
    renderCard();

    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));

    expect(await error(NEARBY_MESSAGES.start)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen();
    consoleErro.mockRestore();
  });

  it('avisa para conferir o outro tablet quando a conexão cai depois de receber', async () => {
    air.dropWhen = (text, from) => from === 'tablet-b' && text.includes('"tipo":"concluido"');
    const user = userEvent.setup();
    renderCard();
    await reachConfirmation(user);
    await confirmBoth(user);

    expect(
      await screen.findByText(/confira no outro tablet se ele também terminou/, undefined, SLOW),
    ).toBeOnTheScreen();
  });

  it('encerra a busca ao sair da tela', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <NearbySyncCard
        nearby={radioA}
        service={serviceA}
        confirmPassword={confirmA}
        styles={styles}
        placeholderColor={Colors.light.placeholder}
      />,
    );
    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));
    await screen.findByText(/Este tablet aparece para os outros como/, undefined, SLOW);

    unmount();

    await waitFor(() => expect(radioA.advertising).toBe(false));
  });
});
