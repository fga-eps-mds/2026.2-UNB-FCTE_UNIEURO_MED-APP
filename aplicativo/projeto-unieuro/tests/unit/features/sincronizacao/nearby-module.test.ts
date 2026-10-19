import { Linking, PermissionsAndroid } from 'react-native';

import {
  loadNearby,
  openLocationSettings,
  permissionsFor,
  requestNearbyPermissions,
  type NativeNearby,
} from '@/features/sincronizacao/nearby-module';

const { PERMISSIONS, RESULTS } = PermissionsAndroid;
const BLUETOOTH = [
  PERMISSIONS.BLUETOOTH_SCAN,
  PERMISSIONS.BLUETOOTH_ADVERTISE,
  PERMISSIONS.BLUETOOTH_CONNECT,
];
const LOCATION = [PERMISSIONS.ACCESS_FINE_LOCATION, PERMISSIONS.ACCESS_COARSE_LOCATION];

describe('permissões por versão do Android', () => {
  it.each([
    [34, [...BLUETOOTH, PERMISSIONS.NEARBY_WIFI_DEVICES, ...LOCATION]],
    [33, [...BLUETOOTH, PERMISSIONS.NEARBY_WIFI_DEVICES, ...LOCATION]],
    [32, [...BLUETOOTH, ...LOCATION]],
    [31, [...BLUETOOTH, ...LOCATION]],
    [30, LOCATION],
    [29, LOCATION],
    [28, LOCATION],
  ])('no Android de API %i pede as permissões do manifesto', (sdkVersion, expected) => {
    expect(permissionsFor(sdkVersion)).toEqual(expected);
  });

  it('pede a localização em todas as versões, porque o Nearby 19.3.0 a confere (código 8034)', () => {
    for (const sdkVersion of [28, 31, 33, 35]) {
      expect(permissionsFor(sdkVersion)).toEqual(expect.arrayContaining(LOCATION));
    }
  });

  it('aceita só a localização aproximada, que o Android 12 ou mais novo deixa escolher', async () => {
    const request = jest.spyOn(PermissionsAndroid, 'requestMultiple');
    const all = Object.fromEntries(permissionsFor(33).map((p) => [p, RESULTS.GRANTED]));
    request.mockResolvedValueOnce({
      ...all,
      [PERMISSIONS.ACCESS_FINE_LOCATION]: RESULTS.DENIED,
    } as never);
    request.mockResolvedValueOnce({
      ...all,
      [PERMISSIONS.ACCESS_FINE_LOCATION]: RESULTS.DENIED,
      [PERMISSIONS.ACCESS_COARSE_LOCATION]: RESULTS.DENIED,
    } as never);

    await expect(requestNearbyPermissions(33)).resolves.toBe(true);
    await expect(requestNearbyPermissions(33)).resolves.toBe(false);
    request.mockRestore();
  });

  it('abre a configuração de localização do Android', async () => {
    const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValueOnce(undefined);

    await openLocationSettings();

    expect(sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
    sendIntent.mockRestore();
  });

  it('só libera quando todas as permissões foram concedidas', async () => {
    const request = jest.spyOn(PermissionsAndroid, 'requestMultiple');
    const all = Object.fromEntries(permissionsFor(33).map((p) => [p, RESULTS.GRANTED]));
    request.mockResolvedValueOnce(all as never);
    request.mockResolvedValueOnce({
      ...all,
      [PERMISSIONS.BLUETOOTH_SCAN]: RESULTS.DENIED,
    } as never);

    await expect(requestNearbyPermissions(33)).resolves.toBe(true);
    await expect(requestNearbyPermissions(33)).resolves.toBe(false);
    expect(request).toHaveBeenCalledWith(permissionsFor(33));
    request.mockRestore();
  });
});

describe('carregamento do módulo nativo', () => {
  it('devolve null quando o módulo não existe, como no Expo Go', () => {
    expect(loadNearby(() => null)).toBeNull();
  });

  it('usa o módulo de verdade quando nenhum é passado', () => {
    // No Jest não há módulo nativo, como no Expo Go.
    expect(loadNearby()).toBeNull();
  });

  it('repassa cada chamada ao módulo nativo', async () => {
    const subscription = { remove: jest.fn() };
    const native = {
      maxMessageBytes: jest.fn(() => 32768),
      getRadioState: jest.fn(() => ({
        bluetooth: true,
        wifi: true,
        location: true,
        sdkVersion: 30,
      })),
      startAdvertising: jest.fn(async () => undefined),
      startDiscovery: jest.fn(async () => undefined),
      requestConnection: jest.fn(async () => undefined),
      acceptConnection: jest.fn(async () => undefined),
      rejectConnection: jest.fn(async () => undefined),
      sendMessage: jest.fn(async () => undefined),
      disconnect: jest.fn(),
      stopAll: jest.fn(),
      addListener: jest.fn(() => subscription),
    };
    const api = loadNearby(() => native as unknown as NativeNearby);
    if (!api) throw new Error('módulo não carregado');
    const listener = jest.fn();

    expect(api.maxMessageBytes()).toBe(32768);
    expect(api.getRadioState().sdkVersion).toBe(30);
    await api.startAdvertising('Tablet A1B2');
    await api.startDiscovery();
    await api.requestConnection('Tablet A1B2', 'e1');
    await api.acceptConnection('e1');
    await api.rejectConnection('e2');
    await api.sendMessage('e1', 'oi');
    api.disconnect('e1');
    api.stopAll();
    expect(api.addListener('onMessage', listener)).toBe(subscription);

    expect(native.startAdvertising).toHaveBeenCalledWith('Tablet A1B2');
    expect(native.requestConnection).toHaveBeenCalledWith('Tablet A1B2', 'e1');
    expect(native.acceptConnection).toHaveBeenCalledWith('e1');
    expect(native.rejectConnection).toHaveBeenCalledWith('e2');
    expect(native.sendMessage).toHaveBeenCalledWith('e1', 'oi');
    expect(native.disconnect).toHaveBeenCalledWith('e1');
    expect(native.stopAll).toHaveBeenCalled();
    expect(native.addListener).toHaveBeenCalledWith('onMessage', listener);

    const request = jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValueOnce({
      [PERMISSIONS.ACCESS_FINE_LOCATION]: RESULTS.GRANTED,
      [PERMISSIONS.ACCESS_COARSE_LOCATION]: RESULTS.GRANTED,
    } as never);
    await expect(api.requestPermissions()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(LOCATION);
    request.mockRestore();
  });
});
