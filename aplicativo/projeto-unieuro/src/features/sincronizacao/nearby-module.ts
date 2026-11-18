import { requireOptionalNativeModule } from 'expo';
import { Linking, PermissionsAndroid, type Permission } from 'react-native';

// Módulo nativo em modules/med-nearby. Não existe no Expo Go: `loadNearby` devolve `null`.

export type RadioState = {
  bluetooth: boolean | null;
  wifi: boolean | null;
  location: boolean | null;
  sdkVersion: number;
};

export type NearbyEvents = {
  onEndpointFound: (event: { endpointId: string; name: string }) => void;
  onEndpointLost: (event: { endpointId: string }) => void;
  onConnectionInitiated: (event: {
    endpointId: string;
    name: string;
    digits: string;
    incoming: boolean;
  }) => void;
  onConnectionResult: (event: { endpointId: string; ok: boolean; statusCode: number }) => void;
  onDisconnected: (event: { endpointId: string }) => void;
  onMessage: (event: { endpointId: string; text: string }) => void;
};

export type Subscription = { remove(): void };

/** Igual ao declarado no Kotlin. */
export type NativeNearby = {
  maxMessageBytes(): number;
  getRadioState(): RadioState;
  /**
   * Pedido do sistema para ligar o Bluetooth, sem sair do app. `true` quando ele
   * fica ligado; `false` quando a pessoa nega.
   */
  requestEnableBluetooth(): Promise<boolean>;
  /** Pedido do Google Play Services para ligar a localização, como nos apps de mapa. */
  requestEnableLocation(): Promise<boolean>;
  startAdvertising(name: string): Promise<void>;
  startDiscovery(): Promise<void>;
  requestConnection(name: string, endpointId: string): Promise<void>;
  acceptConnection(endpointId: string): Promise<void>;
  rejectConnection(endpointId: string): Promise<void>;
  sendMessage(endpointId: string, text: string): Promise<void>;
  disconnect(endpointId: string): void;
  /** Para de anunciar e de procurar, sem derrubar a conexão em andamento. */
  stopSearching(): void;
  stopAll(): void;
  addListener<E extends keyof NearbyEvents>(event: E, listener: NearbyEvents[E]): Subscription;
};

export type NearbyApi = NativeNearby & {
  requestPermissions(): Promise<boolean>;
};

// O Nearby 19.3.0 exige a localização ligada em qualquer versão (erro 8034).
export function openLocationSettings(): Promise<void> {
  return Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
}

const LOCATION: Permission[] = [
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
];

/**
 * Precisa bater com o AndroidManifest.xml do módulo. A localização entra em
 * todas as versões porque o Nearby 19.3.0 a exige (erro 8034).
 */
export function permissionsFor(sdkVersion: number): Permission[] {
  const { PERMISSIONS } = PermissionsAndroid;
  const bluetooth = [
    PERMISSIONS.BLUETOOTH_SCAN,
    PERMISSIONS.BLUETOOTH_ADVERTISE,
    PERMISSIONS.BLUETOOTH_CONNECT,
  ];
  if (sdkVersion >= 33) return [...bluetooth, PERMISSIONS.NEARBY_WIFI_DEVICES, ...LOCATION];
  if (sdkVersion >= 31) return [...bluetooth, ...LOCATION];
  return LOCATION;
}

/** A localização aproximada basta. */
export async function requestNearbyPermissions(sdkVersion: number): Promise<boolean> {
  const wanted = permissionsFor(sdkVersion);
  const results = await PermissionsAndroid.requestMultiple(wanted);
  const granted = (permission: Permission) =>
    results[permission] === PermissionsAndroid.RESULTS.GRANTED;

  const others = wanted.filter((permission) => !LOCATION.includes(permission));
  return others.every(granted) && LOCATION.some(granted);
}

export function loadNearby(
  load: () => NativeNearby | null = () => requireOptionalNativeModule<NativeNearby>('MedNearby'),
): NearbyApi | null {
  const native = load();
  if (!native) return null;

  // O objeto nativo não aceita ser chamado com outro `this`.
  return {
    maxMessageBytes: () => native.maxMessageBytes(),
    getRadioState: () => native.getRadioState(),
    requestEnableBluetooth: () => native.requestEnableBluetooth(),
    requestEnableLocation: () => native.requestEnableLocation(),
    startAdvertising: (name) => native.startAdvertising(name),
    startDiscovery: () => native.startDiscovery(),
    requestConnection: (name, endpointId) => native.requestConnection(name, endpointId),
    acceptConnection: (endpointId) => native.acceptConnection(endpointId),
    rejectConnection: (endpointId) => native.rejectConnection(endpointId),
    sendMessage: (endpointId, text) => native.sendMessage(endpointId, text),
    disconnect: (endpointId) => native.disconnect(endpointId),
    stopSearching: () => native.stopSearching(),
    stopAll: () => native.stopAll(),
    addListener: (event, listener) => native.addListener(event, listener),
    requestPermissions: () => requestNearbyPermissions(native.getRadioState().sdkVersion),
  };
}
