import type { ImportSummary } from '@/features/sincronizacao/apply-package';
import type { NearbyApi, Subscription } from '@/features/sincronizacao/nearby-module';
import {
  createAssembler,
  frameMessage,
  PROTOCOL_FORMAT,
  PROTOCOL_VERSION,
  ProtocolError,
  type ProtocolMessage,
} from '@/features/sincronizacao/nearby-protocol';
import {
  REFUSAL_MESSAGES,
  type LocalDescription,
  type SyncService,
} from '@/features/sincronizacao/sync-service';

export type NearbyEndpoint = { endpointId: string; name: string };

export type BlockReason = 'permissions' | 'bluetooth' | 'location';

export type NearbyState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'blocked'; reason: BlockReason; message: string }
  | {
      phase: 'searching';
      localName: string;
      endpoints: NearbyEndpoint[];
      connecting: string | null;
      wifiOff: boolean;
      notice: string | null;
    }
  | {
      phase: 'confirming';
      peerName: string;
      digits: string;
      checking: boolean;
      error: string | null;
    }
  | { phase: 'waiting'; peerName: string }
  | { phase: 'syncing'; peerName: string }
  | { phase: 'done'; peerName: string; summary: ImportSummary; peerConfirmed: boolean }
  | { phase: 'failed'; message: string };

type Dependencies = {
  api: NearbyApi;
  sync: Pick<SyncService, 'describeLocal' | 'preparePackageFor' | 'applyPackageJson'>;
  confirmPassword: (password: string) => Promise<boolean>;
  /** Pausa antes de desconectar, para a última mensagem chegar. */
  wait?: (ms: number) => Promise<void>;
};

export const NEARBY_MESSAGES = {
  permissions:
    'Permita o acesso a dispositivos próximos para sincronizar. Se negou antes, libere nas configurações do Android, em Apps → MED → Permissões.',
  bluetooth: 'Ative o Bluetooth para sincronizar com um tablet próximo.',
  location: 'Ative a localização do tablet. Ela é necessária para encontrar tablets próximos.',
  start: 'Não foi possível começar a procurar tablets. Confira o Bluetooth e tente de novo.',
  connect:
    'Não foi possível conectar a este tablet. Confira se ele está com a tela de sincronização aberta e tente de novo.',
  wrongPassword: 'Senha incorreta. Digite a senha com que você entrou no aplicativo.',
  rejected: 'A conexão não foi concluída. O outro tablet cancelou ou ainda não confirmou.',
  protocol:
    'O outro tablet mandou dados que este não reconhece. Atualize o aplicativo nos dois tablets.',
  peerFailed: 'O outro tablet não conseguiu importar os dados. Nada foi alterado nele.',
  droppedBefore: 'A conexão caiu antes de terminar. Nada foi alterado neste tablet.',
} as const;

/** Código de `ERR_NEARBY_<código>`, ou `null` se o erro não veio do Nearby. */
export function nearbyStatus(error: unknown): number | null {
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  const match = typeof code === 'string' ? /^ERR_NEARBY_(-?\d+)$/.exec(code) : null;
  return match ? Number(match[1]) : null;
}

// Busca anterior ainda ativa.
const ALREADY_RUNNING = new Set([8001, 8002, 8008]);

const START_FAILURES: { codes: number[]; message: string }[] = [
  {
    codes: [8029, 8030, 8031, 8037, 8038, 8039],
    message:
      'O Android não liberou a permissão de "Dispositivos próximos" para o aplicativo. Libere em Configurações → Apps → MED → Permissões e tente de novo.',
  },
  {
    codes: [8034, 8036],
    message:
      'O Android não liberou a permissão de localização, que esta versão exige para procurar tablets. Libere em Configurações → Apps → MED → Permissões e tente de novo.',
  },
  {
    codes: [8025],
    message:
      'Ative a localização do tablet nas configurações rápidas. Ela é necessária para procurar tablets por Bluetooth.',
  },
  {
    codes: [8007],
    message:
      'O Bluetooth ou o Wi-Fi do tablet não respondeu. Desligue e ligue os dois e tente de novo.',
  },
  {
    codes: [8032, 8033],
    message:
      'Falta ao aplicativo uma permissão de Wi-Fi. Instale a versão mais recente do aplicativo.',
  },
  {
    codes: [8050],
    message:
      'Outro aplicativo está usando a busca por aparelhos próximos, como o Compartilhamento por proximidade. Feche-o e tente de novo.',
  },
  {
    codes: [2],
    message:
      'O Google Play Services deste tablet está desatualizado. Atualize-o pela Play Store e tente de novo.',
  },
  {
    codes: [3],
    message:
      'O Google Play Services está desativado neste tablet. Ative-o em Configurações → Apps e tente de novo.',
  },
];

/** Sempre mostra o código, para o suporte. */
export function startFailureMessage(status: number | null): string {
  const known = START_FAILURES.find(({ codes }) => status !== null && codes.includes(status));
  const message = known?.message ?? NEARBY_MESSAGES.start;
  return status === null ? message : `${message} (código ${status})`;
}

/** Sem dado pessoal: só o começo do id do tablet. */
export const tabletName = (deviceId: string) => `Tablet ${deviceId.slice(0, 4).toUpperCase()}`;

/**
 * Procura, conecta, confere os 4 dígitos e a senha e troca os dados nos dois
 * sentidos. Cada lado aplica o que recebe numa transação.
 */
export function createNearbySession({
  api,
  sync,
  confirmPassword,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: Dependencies) {
  let state: NearbyState = { phase: 'idle' };
  const listeners = new Set<(state: NearbyState) => void>();
  let subscriptions: Subscription[] = [];

  let local: LocalDescription | null = null;
  let localName = '';
  let wifiOff = false;
  // Fora do estado da tela: o Nearby não avisa de novo sobre quem já achou.
  let found: NearbyEndpoint[] = [];
  let endpointId: string | null = null;
  let peerName = '';
  let assembler = createAssembler();
  let messageCount = 0;
  let queue: Promise<void> = Promise.resolve();
  let received: ImportSummary | null = null;
  let peerDone = false;
  // A mensagem fica a cargo do aviso de desconexão, que vem em seguida.
  let connectionLost = false;

  function setState(next: NearbyState) {
    state = next;
    for (const listener of listeners) listener(state);
  }

  // Evita o estreitamento de tipo de antes de um `await`.
  const phase = (): NearbyState['phase'] => state.phase;

  function searching(notice: string | null = null): NearbyState {
    return { phase: 'searching', localName, endpoints: found, connecting: null, wifiOff, notice };
  }

  function resetConnection() {
    endpointId = null;
    peerName = '';
    assembler = createAssembler();
    queue = Promise.resolve();
    received = null;
    peerDone = false;
    connectionLost = false;
  }

  function release() {
    for (const subscription of subscriptions) subscription.remove();
    subscriptions = [];
    api.stopAll();
    resetConnection();
    found = [];
  }

  // Se sobrou uma busca anterior (app fechado sem encerrar), para tudo e tenta de novo.
  async function startRadios() {
    try {
      await api.startAdvertising(localName);
      await api.startDiscovery();
    } catch (error) {
      if (!ALREADY_RUNNING.has(nearbyStatus(error) ?? -1)) throw error;
      api.stopAll();
      await api.startAdvertising(localName);
      await api.startDiscovery();
    }
  }

  function fail(message: string) {
    release();
    setState({ phase: 'failed', message });
  }

  async function send(message: ProtocolMessage) {
    if (!endpointId) return;
    messageCount += 1;
    try {
      for (const frame of frameMessage(message, `${messageCount}`)) {
        await api.sendMessage(endpointId, frame);
      }
    } catch (error) {
      connectionLost = true;
      throw error;
    }
  }

  const sendError = (motivo: string) => send({ tipo: 'erro', motivo }).catch(() => undefined);

  async function finishIfComplete() {
    if (!received || !peerDone) return;
    const finished = endpointId;
    setState({ phase: 'done', peerName, summary: received, peerConfirmed: true });
    await wait(1500);
    // Não encerra uma sincronização nova que já começou.
    if (phase() === 'done' && endpointId === finished) release();
  }

  async function handle(message: ProtocolMessage) {
    switch (message.tipo) {
      case 'ola': {
        if (!local) return;
        if (message.versao_esquema !== local.schemaVersion) {
          await sendError('versao_incompativel');
          fail(REFUSAL_MESSAGES.versao_incompativel);
          return;
        }
        if (message.dispositivo === local.deviceId) {
          fail(REFUSAL_MESSAGES.mesmo_tablet);
          return;
        }
        const pacote = await sync.preparePackageFor(message.vetor, message.dispositivo);
        await send({ tipo: 'pacote', pacote });
        return;
      }
      case 'pacote': {
        const result = await sync.applyPackageJson(message.pacote);
        if (!result.ok) {
          await sendError(result.reason);
          fail(result.message);
          return;
        }
        received = result.summary;
        await send({ tipo: 'concluido' });
        await finishIfComplete();
        return;
      }
      case 'concluido':
        peerDone = true;
        await finishIfComplete();
        return;
      case 'erro':
        fail(
          message.motivo === 'versao_incompativel'
            ? REFUSAL_MESSAGES.versao_incompativel
            : NEARBY_MESSAGES.peerFailed,
        );
        return;
    }
  }

  function onMessage(event: { endpointId: string; text: string }) {
    if (event.endpointId !== endpointId) return;
    // Uma por vez: o `concluido` do outro não pode passar na frente da importação.
    queue = queue.then(async () => {
      if (event.endpointId !== endpointId) return;
      try {
        const message = assembler.push(event.text);
        if (message) await handle(message);
      } catch (error) {
        if (error instanceof ProtocolError) {
          await sendError('mensagem_invalida');
          fail(NEARBY_MESSAGES.protocol);
        } else if (!connectionLost) {
          fail(REFUSAL_MESSAGES.erro);
        }
      }
    });
  }

  function onEndpointFound(event: NearbyEndpoint) {
    if (found.some((endpoint) => endpoint.endpointId === event.endpointId)) return;
    found = [...found, { endpointId: event.endpointId, name: event.name }];
    if (state.phase === 'searching') setState({ ...state, endpoints: found });
  }

  function onEndpointLost(event: { endpointId: string }) {
    found = found.filter((endpoint) => endpoint.endpointId !== event.endpointId);
    if (state.phase === 'searching') setState({ ...state, endpoints: found });
  }

  function onConnectionInitiated(event: { endpointId: string; name: string; digits: string }) {
    if (endpointId && endpointId !== event.endpointId) {
      api.rejectConnection(event.endpointId).catch(() => undefined);
      return;
    }
    endpointId = event.endpointId;
    peerName = event.name;
    setState({ phase: 'confirming', peerName, digits: event.digits, checking: false, error: null });
  }

  function onConnectionResult(event: { endpointId: string; ok: boolean }) {
    if (event.endpointId !== endpointId) return;
    if (!event.ok) {
      fail(NEARBY_MESSAGES.rejected);
      return;
    }
    if (!local) return;
    setState({ phase: 'syncing', peerName });
    const hello: ProtocolMessage = {
      tipo: 'ola',
      formato: PROTOCOL_FORMAT,
      versao: PROTOCOL_VERSION,
      dispositivo: local.deviceId,
      versao_esquema: local.schemaVersion,
      vetor: local.vector,
    };
    queue = queue.then(() => send(hello)).catch(() => fail(NEARBY_MESSAGES.droppedBefore));
  }

  function onDisconnected(event: { endpointId: string }) {
    if (event.endpointId !== endpointId) return;
    // Na fila, para tratar antes as mensagens que chegaram antes da queda.
    queue = queue.then(() => handleDisconnect(event.endpointId));
  }

  function handleDisconnect(disconnected: string) {
    if (disconnected !== endpointId) return;
    if (state.phase === 'done') return;
    if (received) {
      // Já gravou o que recebeu; só falta a confirmação do outro lado.
      const summary = received;
      const name = peerName;
      release();
      setState({ phase: 'done', peerName: name, summary, peerConfirmed: false });
      return;
    }
    fail(NEARBY_MESSAGES.droppedBefore);
  }

  return {
    getState: () => state,

    subscribe(listener: (state: NearbyState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async start() {
      if (
        state.phase !== 'idle' &&
        state.phase !== 'failed' &&
        state.phase !== 'blocked' &&
        state.phase !== 'done'
      ) {
        return;
      }
      release();
      setState({ phase: 'starting' });

      if (!(await api.requestPermissions())) {
        setState({ phase: 'blocked', reason: 'permissions', message: NEARBY_MESSAGES.permissions });
        return;
      }
      const radios = api.getRadioState();
      if (radios.bluetooth === false) {
        setState({ phase: 'blocked', reason: 'bluetooth', message: NEARBY_MESSAGES.bluetooth });
        return;
      }
      if (radios.location === false) {
        setState({ phase: 'blocked', reason: 'location', message: NEARBY_MESSAGES.location });
        return;
      }
      wifiOff = radios.wifi === false;

      try {
        local = await sync.describeLocal();
        localName = tabletName(local.deviceId);
        subscriptions = [
          api.addListener('onEndpointFound', onEndpointFound),
          api.addListener('onEndpointLost', onEndpointLost),
          api.addListener('onConnectionInitiated', onConnectionInitiated),
          api.addListener('onConnectionResult', onConnectionResult),
          api.addListener('onDisconnected', onDisconnected),
          api.addListener('onMessage', onMessage),
        ];
        await startRadios();
      } catch (error) {
        if (__DEV__) {
          console.error('Falha ao começar a procurar tablets', error);
        }
        fail(startFailureMessage(nearbyStatus(error)));
        return;
      }

      setState(searching());
    },

    async connect(target: string) {
      if (state.phase !== 'searching' || state.connecting) return;
      setState({ ...state, connecting: target, notice: null });
      try {
        await api.requestConnection(localName, target);
      } catch {
        if (phase() === 'searching') setState(searching(NEARBY_MESSAGES.connect));
      }
    },

    async confirm(password: string) {
      if (state.phase !== 'confirming' || state.checking || !endpointId) return;
      setState({ ...state, checking: true, error: null });

      const confirmed = await confirmPassword(password);
      // O outro pode ter cancelado durante a conferência.
      if (state.phase !== 'confirming') return;
      if (!confirmed) {
        setState({ ...state, checking: false, error: NEARBY_MESSAGES.wrongPassword });
        return;
      }
      setState({ phase: 'waiting', peerName });
      try {
        await api.acceptConnection(endpointId);
      } catch {
        fail(NEARBY_MESSAGES.rejected);
      }
    },

    /** Na confirmação, recusa e volta a procurar. Nas outras fases, encerra. */
    async cancel() {
      if (state.phase === 'confirming' && endpointId) {
        const rejected = endpointId;
        resetConnection();
        await api.rejectConnection(rejected).catch(() => undefined);
        setState(searching());
        return;
      }
      release();
      setState({ phase: 'idle' });
    },

    stop() {
      release();
      setState({ phase: 'idle' });
    },
  };
}

export type NearbySession = ReturnType<typeof createNearbySession>;
