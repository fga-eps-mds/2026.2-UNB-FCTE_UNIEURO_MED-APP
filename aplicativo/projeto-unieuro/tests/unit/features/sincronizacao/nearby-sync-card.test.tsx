import { render, screen, userEvent } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import { describeFailure, syncFailure } from '@/features/sincronizacao/error-codes';
import NearbySyncCard, { describeProgress } from '@/features/sincronizacao/nearby-sync-card';
import { createSyncStyles } from '@/features/sincronizacao/sync.styles';

const spokenError = (code: 102 | 103) => `Erro. ${describeFailure(syncFailure(code)).spoken}`;

import { FakeAir, type FakeNearby } from '../../../test-support/fake-nearby';

// Sem banco. A troca completa está em sincronizacao-tablet-proximo.integration.test.tsx.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

const styles = createSyncStyles(Colors.light);
const service = {
  describeLocal: jest.fn(async () => ({
    deviceId: 'a1b2c3d4-0000-4000-8000-000000000000',
    schemaVersion: 4,
    vector: {},
  })),
  prepareBatchesFor: jest.fn(),
  receiveBatches: jest.fn(),
};

function renderCard(nearby: FakeNearby | null, openLocationSettings = jest.fn(async () => {})) {
  render(
    <NearbySyncCard
      nearby={nearby}
      service={service}
      confirmPassword={async () => true}
      openLocationSettings={openLocationSettings}
      styles={styles}
      placeholderColor={Colors.light.placeholder}
    />,
  );
  return openLocationSettings;
}

describe('NearbySyncCard', () => {
  it('sem o módulo do Nearby, como no Expo Go, explica que precisa do APK e não oferece busca', () => {
    renderCard(null);

    expect(
      screen.getByRole('header', { name: 'Sincronizar com tablet próximo' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/precisa do aplicativo instalado pelo APK/)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('antes de procurar, explica o que os dois tablets precisam', () => {
    renderCard(new FakeAir().device('tablet-a'));

    expect(screen.getByText(/Bluetooth e a localização ligados/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Procurar tablets próximos' })).toBeOnTheScreen();
  });

  it('quando a pessoa não liga a localização, oferece o atalho para ligá-la', async () => {
    const user = userEvent.setup();
    const radio = new FakeAir().device('tablet-a');
    radio.radio = { bluetooth: true, wifi: true, location: false, sdkVersion: 36 };
    radio.allowEnabling = false;
    const openLocationSettings = renderCard(radio);

    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));
    expect(await screen.findByLabelText(spokenError(103))).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Abrir configurações de localização' }));

    expect(openLocationSettings).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen();
  });

  it('quando a pessoa não liga o Bluetooth, pede para ligar, sem o atalho da localização', async () => {
    const user = userEvent.setup();
    const radio = new FakeAir().device('tablet-a');
    radio.radio = { ...radio.radio, bluetooth: false };
    radio.allowEnabling = false;
    renderCard(radio);

    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));

    expect(await screen.findByLabelText(spokenError(102))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Abrir configurações de localização' })).toBeNull();
  });

  it('não trava quando o atalho da localização falha', async () => {
    const user = userEvent.setup();
    const radio = new FakeAir().device('tablet-a');
    radio.radio = { ...radio.radio, location: false };
    radio.allowEnabling = false;
    renderCard(
      radio,
      jest.fn(async () => {
        throw new Error('sem configuração');
      }),
    );

    await user.press(screen.getByRole('button', { name: 'Procurar tablets próximos' }));
    await user.press(
      await screen.findByRole('button', { name: 'Abrir configurações de localização' }),
    );

    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen();
  });
});

describe('describeProgress', () => {
  it('mostra o lote em andamento nos dois sentidos', () => {
    expect(describeProgress({ sent: 2, toSend: 7, received: 1, toReceive: 4 })).toBe(
      'Enviando 3 de 7 · Recebendo 2 de 4',
    );
  });

  it('não passa do total quando o último lote já foi', () => {
    expect(describeProgress({ sent: 3, toSend: 3, received: 0, toReceive: null })).toBe(
      'Enviando 3 de 3',
    );
  });

  it('sem os totais ainda, não mostra nada', () => {
    expect(describeProgress({ sent: 0, toSend: null, received: 0, toReceive: null })).toBe('');
  });
});
