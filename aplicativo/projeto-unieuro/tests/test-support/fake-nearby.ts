/// <reference types="node" />
/**
 * Nearby simulado. Os `FakeNearby` de um mesmo `FakeAir` se encontram e trocam
 * mensagens, com eventos assíncronos e limite de 32 KB.
 */
import type {
  NearbyApi,
  NearbyEvents,
  RadioState,
  Subscription,
} from '@/features/sincronizacao/nearby-module';

const MAX_BYTES = 32 * 1024;

type Listener = (event: never) => void;

export class FakeAir {
  readonly devices = new Map<string, FakeNearby>();
  digits = '4821';
  readonly sent: { from: string; to: string; text: string }[] = [];
  /** `true` derruba a conexão em vez de entregar a mensagem. */
  dropWhen: (text: string, from: string) => boolean = () => false;

  device(id: string): FakeNearby {
    const device = new FakeNearby(this, id);
    this.devices.set(id, device);
    return device;
  }
}

const later = (task: () => void) => {
  setTimeout(task, 0);
};

export class FakeNearby implements NearbyApi {
  radio: RadioState = { bluetooth: true, wifi: true, location: true, sdkVersion: 34 };
  permissionsGranted = true;
  failStart = false;
  /** Erros das próximas tentativas de anunciar. */
  startErrors: number[] = [];
  failRequest = false;
  name = '';
  advertising = false;
  discovering = false;
  readonly connected = new Set<string>();
  readonly accepted = new Set<string>();
  readonly stopAll = jest.fn(() => this.stopEverything());
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(
    private readonly air: FakeAir,
    readonly id: string,
  ) {}

  emit<E extends keyof NearbyEvents>(event: E, payload: Parameters<NearbyEvents[E]>[0]) {
    for (const listener of this.listeners.get(event) ?? [])
      (listener as (p: typeof payload) => void)(payload);
  }

  addListener<E extends keyof NearbyEvents>(event: E, listener: NearbyEvents[E]): Subscription {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener as Listener);
    this.listeners.set(event, set);
    return { remove: () => set.delete(listener as Listener) };
  }

  maxMessageBytes = () => MAX_BYTES;

  getRadioState = () => this.radio;

  requestPermissions = async () => this.permissionsGranted;

  private peer(endpointId: string) {
    const peer = this.air.devices.get(endpointId);
    if (!peer) throw new Error(`tablet ${endpointId} não existe`);
    return peer;
  }

  startAdvertising = async (name: string) => {
    if (this.failStart) throw new Error('falha sem código');
    const status = this.startErrors.shift();
    if (status !== undefined) {
      throw Object.assign(new Error(`Nearby recusou: ${status}`), { code: `ERR_NEARBY_${status}` });
    }
    this.name = name;
    this.advertising = true;
    for (const other of this.air.devices.values()) {
      if (other !== this && other.discovering)
        later(() => other.emit('onEndpointFound', { endpointId: this.id, name }));
    }
  };

  startDiscovery = async () => {
    this.discovering = true;
    for (const other of this.air.devices.values()) {
      if (other !== this && other.advertising) {
        later(() => this.emit('onEndpointFound', { endpointId: other.id, name: other.name }));
      }
    }
  };

  requestConnection = async (name: string, endpointId: string) => {
    if (this.failRequest) throw new Error('ERR_NEARBY_8012');
    const peer = this.peer(endpointId);
    const digits = this.air.digits;
    later(() => {
      this.emit('onConnectionInitiated', { endpointId, name: peer.name, digits, incoming: false });
      peer.emit('onConnectionInitiated', { endpointId: this.id, name, digits, incoming: true });
    });
  };

  acceptConnection = async (endpointId: string) => {
    this.accepted.add(endpointId);
    const peer = this.peer(endpointId);
    if (peer.accepted.has(this.id)) {
      this.connected.add(endpointId);
      peer.connected.add(this.id);
      later(() => {
        this.emit('onConnectionResult', { endpointId, ok: true, statusCode: 0 });
        peer.emit('onConnectionResult', { endpointId: this.id, ok: true, statusCode: 0 });
      });
    }
  };

  rejectConnection = async (endpointId: string) => {
    const peer = this.air.devices.get(endpointId);
    this.accepted.delete(endpointId);
    later(() => {
      this.emit('onConnectionResult', { endpointId, ok: false, statusCode: 8004 });
      peer?.emit('onConnectionResult', { endpointId: this.id, ok: false, statusCode: 8004 });
    });
  };

  sendMessage = async (endpointId: string, text: string) => {
    if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) throw new Error('mensagem maior que 32 KB');
    if (!this.connected.has(endpointId)) throw new Error('sem conexão');
    if (this.air.dropWhen(text, this.id)) {
      this.disconnect(endpointId);
      return;
    }
    this.air.sent.push({ from: this.id, to: endpointId, text });
    const peer = this.peer(endpointId);
    later(() => peer.emit('onMessage', { endpointId: this.id, text }));
  };

  disconnect = (endpointId: string) => {
    if (!this.connected.delete(endpointId)) return;
    const peer = this.air.devices.get(endpointId);
    peer?.connected.delete(this.id);
    later(() => {
      this.emit('onDisconnected', { endpointId });
      peer?.emit('onDisconnected', { endpointId: this.id });
    });
  };

  private stopEverything() {
    this.advertising = false;
    this.discovering = false;
    this.accepted.clear();
    for (const endpointId of [...this.connected]) this.disconnect(endpointId);
  }
}

export async function until(condition: () => boolean, timeout = 15_000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error('Condição não aconteceu a tempo.');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
