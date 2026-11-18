import type { ImportSummary } from '@/features/sincronizacao/apply-package';
import {
  nearbyStatus,
  STATUS_CONNECTION_REJECTED,
  startFailure,
  syncFailure,
  type SyncErrorCode,
  type SyncFailure,
} from '@/features/sincronizacao/error-codes';
import type { NearbyApi, RadioState, Subscription } from '@/features/sincronizacao/nearby-module';
import {
  createAssembler,
  frameMessage,
  PROTOCOL_FORMAT,
  PROTOCOL_VERSION,
  ProtocolError,
  type ProtocolMessage,
} from '@/features/sincronizacao/nearby-protocol';
import type {
  IncomingBatches,
  LocalDescription,
  OutgoingBatches,
  SyncService,
} from '@/features/sincronizacao/sync-service';

export type NearbyEndpoint = { endpointId: string; name: string };

export type BlockReason = 'permissions' | 'bluetooth' | 'location';

export type NearbyState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'blocked'; reason: BlockReason; failure: SyncFailure }
  | {
      phase: 'searching';
      localName: string;
      endpoints: NearbyEndpoint[];
      connecting: string | null;
      wifiOff: boolean;
      notice: SyncFailure | null;
    }
  | {
      phase: 'confirming';
      peerName: string;
      digits: string;
      checking: boolean;
      error: SyncFailure | null;
    }
  | { phase: 'waiting'; peerName: string }
  | ({ phase: 'syncing'; peerName: string } & SyncProgress)
  | {
      phase: 'done';
      peerName: string;
      summary: ImportSummary;
      /** O outro tablet confirmou todos os lotes deste. */
      peerConfirmed: boolean;
      /** A conexão caiu antes de chegarem todos os lotes do outro tablet. */
      partial: boolean;
    }
  | { phase: 'failed'; failure: SyncFailure };

/** Lotes confirmados e gravados. O total fica `null` até se saber. */
export type SyncProgress = {
  sent: number;
  toSend: number | null;
  received: number;
  toReceive: number | null;
};

type Dependencies = {
  api: NearbyApi;
  sync: Pick<SyncService, 'describeLocal' | 'prepareBatchesFor' | 'receiveBatches'>;
  confirmPassword: (password: string) => Promise<boolean>;
  /** Pausa antes de desconectar, para a última mensagem chegar. */
  wait?: (ms: number) => Promise<void>;
};

// Busca anterior ainda ativa.
const ALREADY_RUNNING = new Set([8001, 8002, 8008]);

/**
 * Depois de aceitar, quanto tempo esperar o aviso de conexão concluída. Sem ele
 * (por exemplo, quando os dois tablets pedem a conexão ao mesmo tempo), os dois
 * ficariam esperando um pelo outro.
 */
export const CONNECTION_TIMEOUT_MS = 30_000;

/** Mensagem válida no lugar errado da troca. */
class OrderError extends ProtocolError {
  constructor(
    message: string,
    readonly code: SyncErrorCode,
  ) {
    super(message);
  }
}

/** Falha ao mostrar o pedido conta como negado: a tela orienta a ligar à mão. */
async function askToEnable(request: () => Promise<boolean>): Promise<boolean> {
  try {
    return await request();
  } catch {
    return false;
  }
}

// Mensagem que nem chega a ser lida.
const UNREADABLE_MESSAGE = 304;

/** Sem dado pessoal: só o começo do id do tablet. */
export const tabletName = (deviceId: string) => `Tablet ${deviceId.slice(0, 4).toUpperCase()}`;

/**
 * Procura, conecta, confere os 4 dígitos e a senha e troca os dados nos dois
 * sentidos, em lotes. Cada lote é gravado numa transação e confirmado com
 * `lote_ok`, que libera o seguinte.
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
  // O que chega do outro tablet.
  let incoming: IncomingBatches | null = null;
  let toReceive: number | null = null;
  let incomingDone = false;
  // O que este tablet manda.
  let outgoing: OutgoingBatches | null = null;
  let acknowledged = 0;
  let outgoingDone = false;
  let outgoingLogged = false;
  // A mensagem fica a cargo do aviso de desconexão, que vem em seguida.
  let connectionLost = false;
  let connectionTimer: ReturnType<typeof setTimeout> | null = null;
  // Muda a cada início e a cada `stop`: um início antigo que volta de uma espera
  // (por exemplo, do pedido de ligar o Bluetooth) sabe que foi encerrado.
  let startRun = 0;

  function setState(next: NearbyState) {
    state = next;
    for (const listener of listeners) listener(state);
  }

  // Evita o estreitamento de tipo de antes de um `await`.
  const phase = (): NearbyState['phase'] => state.phase;

  function searching(notice: SyncFailure | null = null): NearbyState {
    return { phase: 'searching', localName, endpoints: found, connecting: null, wifiOff, notice };
  }

  function clearConnectionTimer() {
    if (connectionTimer !== null) clearTimeout(connectionTimer);
    connectionTimer = null;
  }

  function resetConnection() {
    clearConnectionTimer();
    endpointId = null;
    peerName = '';
    assembler = createAssembler();
    queue = Promise.resolve();
    incoming = null;
    toReceive = null;
    incomingDone = false;
    outgoing = null;
    acknowledged = 0;
    outgoingDone = false;
    outgoingLogged = false;
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

  function fail(failure: SyncFailure) {
    release();
    setState({ phase: 'failed', failure });
  }

  /**
   * Larga a conexão em andamento e volta a anunciar e procurar. A lista fica: o
   * outro tablet pode ainda não ter voltado a anunciar.
   */
  async function searchAgain(notice: SyncFailure | null) {
    resetConnection();
    setState(searching(notice));
    try {
      await startRadios();
    } catch (error) {
      fail(startFailure(nearbyStatus(error)));
    }
  }

  /** Aceitou e o aviso de conexão concluída não veio. */
  async function giveUpWaiting() {
    connectionTimer = null;
    if (phase() !== 'waiting' || !endpointId) return;
    // Cancela o pedido pendente, para o outro tablet também sair da espera.
    api.disconnect(endpointId);
    await searchAgain(syncFailure(205));
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

  const appliedBatches = () => incoming?.applied() ?? 0;

  function showProgress() {
    setState({
      phase: 'syncing',
      peerName,
      sent: acknowledged,
      toSend: outgoing?.total ?? null,
      received: appliedBatches(),
      toReceive,
    });
  }

  // Um registro de envio e um de recebimento por troca, mesmo quando ela para no
  // meio. `code` vai para o motivo do registro que não terminou.
  async function writeLogs(code?: SyncErrorCode) {
    const pending = outgoing;
    if (pending && !outgoingLogged) {
      outgoingLogged = true;
      await pending.finish(acknowledged, code).catch(() => undefined);
    }
    await incoming?.finish(incomingDone, code).catch(() => undefined);
  }

  /** Para a troca com `code`. A mensagem avisa se os lotes já gravados ficam. */
  async function stop(code: SyncErrorCode) {
    const kept = appliedBatches() > 0;
    await writeLogs(code);
    fail(syncFailure(code, { kept }));
  }

  async function sendBatch(index: number) {
    if (!outgoing) return;
    const { pacote, cobertura } = await outgoing.read(index);
    await send({ tipo: 'lote', indice: index, total: outgoing.total, cobertura, pacote });
  }

  async function finishIfComplete() {
    if (!incoming || !incomingDone || !outgoingDone) return;
    const finished = endpointId;
    const summary = incoming.summary();
    await writeLogs();
    setState({ phase: 'done', peerName, summary, peerConfirmed: true, partial: false });
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
          fail(syncFailure(301));
          return;
        }
        if (message.dispositivo === local.deviceId) {
          fail(syncFailure(303));
          return;
        }
        if (outgoing) throw new OrderError('Apresentação repetida.', 307);
        outgoing = await sync.prepareBatchesFor(message.vetor, message.dispositivo);
        showProgress();
        await sendBatch(0);
        return;
      }
      case 'lote': {
        if (
          !incoming ||
          message.indice !== appliedBatches() ||
          (toReceive !== null && message.total !== toReceive)
        ) {
          throw new OrderError('Lote fora de ordem.', 305);
        }
        toReceive = message.total;
        const result = await incoming.apply(message.pacote, message.cobertura);
        if (!result.ok) {
          await sendError(result.reason);
          await stop(result.failure.code);
          return;
        }
        // Já está gravado, mesmo que a confirmação não chegue ao outro lado.
        incomingDone = appliedBatches() === toReceive;
        showProgress();
        await send({ tipo: 'lote_ok', indice: message.indice });
        await finishIfComplete();
        return;
      }
      case 'lote_ok': {
        if (!outgoing || message.indice !== acknowledged || outgoingDone) {
          throw new OrderError('Confirmação fora de ordem.', 306);
        }
        acknowledged += 1;
        outgoingDone = acknowledged === outgoing.total;
        showProgress();
        if (outgoingDone) {
          await finishIfComplete();
        } else {
          await sendBatch(acknowledged);
        }
        return;
      }
      case 'erro':
        await stop(message.motivo === 'versao_incompativel' ? 302 : 320);
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
          await stop(error instanceof OrderError ? error.code : UNREADABLE_MESSAGE);
        } else if (!connectionLost) {
          // Ler o banco para montar o lote seguinte é o que sobra aqui.
          await stop(330);
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
    if (endpointId) {
      // Outro tablet no meio de uma conexão: recusa. O mesmo tablet de novo (os dois
      // tocaram um no outro ao mesmo tempo): fica a conexão que já está em
      // andamento, sem voltar à senha. Recusar este cancelaria as duas.
      if (endpointId !== event.endpointId) {
        api.rejectConnection(event.endpointId).catch(() => undefined);
      }
      return;
    }
    endpointId = event.endpointId;
    peerName = event.name;
    setState({ phase: 'confirming', peerName, digits: event.digits, checking: false, error: null });
    // Procurar pesa no rádio e deixa a conexão instável.
    try {
      api.stopSearching();
    } catch {
      // Se não parar, a conexão segue mesmo assim.
    }
  }

  function onConnectionResult(event: { endpointId: string; ok: boolean; statusCode: number }) {
    if (event.endpointId !== endpointId) return;
    clearConnectionTimer();
    if (!event.ok) {
      const code = event.statusCode === STATUS_CONNECTION_REJECTED ? 204 : 205;
      fail(syncFailure(code, { nearby: event.statusCode }));
      return;
    }
    if (!local) return;
    incoming = sync.receiveBatches();
    showProgress();
    const hello: ProtocolMessage = {
      tipo: 'ola',
      formato: PROTOCOL_FORMAT,
      versao: PROTOCOL_VERSION,
      dispositivo: local.deviceId,
      versao_esquema: local.schemaVersion,
      vetor: local.vector,
    };
    queue = queue
      .then(() => send(hello))
      .catch((error: unknown) => fail(syncFailure(206, { nearby: nearbyStatus(error) })));
  }

  function onDisconnected(event: { endpointId: string }) {
    if (event.endpointId !== endpointId) return;
    // Na fila, para tratar antes as mensagens que chegaram antes da queda.
    queue = queue.then(() => handleDisconnect(event.endpointId));
  }

  async function handleDisconnect(disconnected: string) {
    if (disconnected !== endpointId) return;
    if (state.phase === 'done') return;
    if (!incoming || appliedBatches() === 0) {
      await writeLogs(206);
      fail(syncFailure(206));
      return;
    }
    // Os lotes gravados ficam. A próxima troca manda só o que faltou.
    const confirmed = outgoingDone;
    const partial = !incomingDone;
    await writeLogs(partial ? 340 : 341);
    const summary = incoming.summary();
    const name = peerName;
    release();
    setState({ phase: 'done', peerName: name, summary, peerConfirmed: confirmed, partial });
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
      const run = ++startRun;
      const cancelled = () => run !== startRun;
      setState({ phase: 'starting' });

      let radios: RadioState;
      try {
        const granted = await api.requestPermissions();
        if (cancelled()) return;
        if (!granted) {
          setState({ phase: 'blocked', reason: 'permissions', failure: syncFailure(101) });
          return;
        }
        radios = api.getRadioState();
      } catch (error) {
        if (!cancelled()) fail(startFailure(nearbyStatus(error)));
        return;
      }
      // Pede ao sistema para ligar o que falta. Se a pessoa negar, a tela explica.
      if (radios.bluetooth === false) {
        const enabled = await askToEnable(api.requestEnableBluetooth);
        if (cancelled()) return;
        if (!enabled) {
          setState({ phase: 'blocked', reason: 'bluetooth', failure: syncFailure(102) });
          return;
        }
      }
      if (radios.location === false) {
        const enabled = await askToEnable(api.requestEnableLocation);
        if (cancelled()) return;
        if (!enabled) {
          setState({ phase: 'blocked', reason: 'location', failure: syncFailure(103) });
          return;
        }
      }
      wifiOff = radios.wifi === false;

      try {
        local = await sync.describeLocal();
      } catch (error) {
        if (cancelled()) return;
        if (__DEV__) {
          console.error('Falha ao ler os dados do tablet', error);
        }
        fail(syncFailure(104));
        return;
      }
      if (cancelled()) return;
      localName = tabletName(local.deviceId);

      try {
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
        if (cancelled()) return;
        if (__DEV__) {
          console.error('Falha ao começar a procurar tablets', error);
        }
        fail(startFailure(nearbyStatus(error)));
        return;
      }
      if (cancelled()) {
        // A tela saiu enquanto os rádios ligavam: desliga o que acabou de ligar.
        api.stopAll();
        return;
      }

      setState(searching());
    },

    async connect(target: string) {
      if (state.phase !== 'searching' || state.connecting) return;
      setState({ ...state, connecting: target, notice: null });
      try {
        await api.requestConnection(localName, target);
      } catch (error) {
        if (phase() === 'searching') {
          setState(searching(syncFailure(201, { nearby: nearbyStatus(error) })));
        }
      }
    },

    async confirm(password: string) {
      if (state.phase !== 'confirming' || state.checking || !endpointId) return;
      setState({ ...state, checking: true, error: null });

      let failure: SyncFailure | null = null;
      try {
        if (!(await confirmPassword(password))) failure = syncFailure(202);
      } catch {
        failure = syncFailure(207);
      }
      // O outro pode ter cancelado durante a conferência.
      if (state.phase !== 'confirming') return;
      if (failure) {
        setState({ ...state, checking: false, error: failure });
        return;
      }
      setState({ phase: 'waiting', peerName });
      connectionTimer = setTimeout(() => void giveUpWaiting(), CONNECTION_TIMEOUT_MS);
      try {
        await api.acceptConnection(endpointId);
      } catch (error) {
        fail(syncFailure(203, { nearby: nearbyStatus(error) }));
      }
    },

    /** Na confirmação, recusa e volta a procurar. Nas outras fases, encerra. */
    async cancel() {
      if (state.phase === 'confirming' && endpointId) {
        const rejected = endpointId;
        resetConnection();
        await api.rejectConnection(rejected).catch(() => undefined);
        await searchAgain(null);
        return;
      }
      release();
      setState({ phase: 'idle' });
    },

    stop() {
      startRun += 1;
      release();
      setState({ phase: 'idle' });
    },
  };
}

export type NearbySession = ReturnType<typeof createNearbySession>;
