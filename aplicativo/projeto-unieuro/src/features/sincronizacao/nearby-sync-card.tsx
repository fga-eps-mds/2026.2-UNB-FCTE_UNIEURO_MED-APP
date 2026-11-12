import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import {
  openLocationSettings as openSystemLocationSettings,
  type NearbyApi,
} from '@/features/sincronizacao/nearby-module';
import { createNearbySession, type NearbyState } from '@/features/sincronizacao/nearby-session';
import { describeSummary } from '@/features/sincronizacao/summary-text';
import { ActionButton, LabeledInput } from '@/features/sincronizacao/sync-controls';
import type { SyncStyles } from '@/features/sincronizacao/sync.styles';
import type { SyncService } from '@/features/sincronizacao/sync-service';

type NearbySyncCardProps = {
  /** `null` no Expo Go. */
  nearby: NearbyApi | null;
  service: Pick<SyncService, 'describeLocal' | 'preparePackageFor' | 'applyPackageJson'>;
  confirmPassword: (password: string) => Promise<boolean>;
  /** Chamado depois de gravar os dados recebidos. */
  onReceived?: () => void;
  openLocationSettings?: () => Promise<void>;
  styles: SyncStyles;
  placeholderColor: string;
};

const TITLE = 'Sincronizar com tablet próximo';

export default function NearbySyncCard({ nearby, styles, ...props }: NearbySyncCardProps) {
  if (!nearby) {
    return (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {TITLE}
        </Text>
        <Text style={styles.text}>
          Esta forma de sincronizar precisa do aplicativo instalado pelo APK. Nesta versão, use a
          troca por arquivo.
        </Text>
      </View>
    );
  }
  return <NearbySession nearby={nearby} styles={styles} {...props} />;
}

type SessionProps = Omit<NearbySyncCardProps, 'nearby'> & { nearby: NearbyApi };

function NearbySession({
  nearby,
  service,
  confirmPassword,
  onReceived,
  openLocationSettings = openSystemLocationSettings,
  styles,
  placeholderColor,
}: SessionProps) {
  const session = useMemo(
    () => createNearbySession({ api: nearby, sync: service, confirmPassword }),
    [nearby, service, confirmPassword],
  );
  const [state, setState] = useState<NearbyState>(session.getState());

  useEffect(() => {
    const unsubscribe = session.subscribe(setState);
    return () => {
      unsubscribe();
      session.stop();
    };
  }, [session]);

  useEffect(() => {
    if (state.phase === 'done') onReceived?.();
  }, [state.phase, onReceived]);

  const start = () => {
    session.start().catch(() => undefined);
  };
  const cancel = () => {
    session.cancel().catch(() => undefined);
  };

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {TITLE}
      </Text>

      {state.phase === 'idle' && (
        <>
          <Text style={styles.text}>
            Abra esta mesma tela no outro tablet. Os dois precisam estar perto, com o Bluetooth e a
            localização ligados. Não precisa de internet.
          </Text>
          <ActionButton label="Procurar tablets próximos" onPress={start} styles={styles} />
        </>
      )}

      {state.phase === 'starting' && <Text style={styles.text}>Preparando a busca...</Text>}

      {state.phase === 'blocked' && (
        <>
          <FeedbackMessage kind="error" message={state.message} />
          <View style={styles.actions}>
            {state.reason === 'location' && (
              <ActionButton
                label="Abrir configurações de localização"
                onPress={() => {
                  openLocationSettings().catch(() => undefined);
                }}
                variant="outline"
                styles={styles}
              />
            )}
            <ActionButton label="Tentar de novo" onPress={start} styles={styles} />
          </View>
        </>
      )}

      {state.phase === 'searching' && (
        <>
          <Text style={styles.text}>
            Este tablet aparece para os outros como{' '}
            <Text style={styles.strong}>{state.localName}</Text>.
          </Text>
          {state.wifiOff && (
            <Text style={styles.hint}>
              O Wi-Fi está desligado. A sincronização funciona, mas fica mais rápida com ele ligado.
            </Text>
          )}
          <View accessibilityLiveRegion="polite" style={styles.endpoints}>
            {state.endpoints.length === 0 ? (
              <Text style={styles.hint}>
                Procurando tablets próximos... Deixe esta tela aberta também no outro tablet.
              </Text>
            ) : (
              state.endpoints.map((endpoint) => (
                <ActionButton
                  key={endpoint.endpointId}
                  label={
                    state.connecting === endpoint.endpointId
                      ? `Conectando a ${endpoint.name}...`
                      : `Conectar a ${endpoint.name}`
                  }
                  onPress={() => {
                    session.connect(endpoint.endpointId).catch(() => undefined);
                  }}
                  busy={state.connecting !== null}
                  styles={styles}
                />
              ))
            )}
          </View>
          {state.notice && <FeedbackMessage kind="error" message={state.notice} />}
          <View style={styles.actions}>
            <ActionButton
              label="Parar de procurar"
              onPress={() => session.stop()}
              variant="outline"
              styles={styles}
            />
          </View>
        </>
      )}

      {state.phase === 'confirming' && (
        <ConfirmStep
          state={state}
          onConfirm={(password) => {
            session.confirm(password).catch(() => undefined);
          }}
          onCancel={cancel}
          styles={styles}
          placeholderColor={placeholderColor}
        />
      )}

      {state.phase === 'waiting' && (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            Aguardando a confirmação no {state.peerName}...
          </Text>
          <View style={styles.actions}>
            <ActionButton label="Cancelar" onPress={cancel} variant="outline" styles={styles} />
          </View>
        </>
      )}

      {state.phase === 'syncing' && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          Sincronizando com o {state.peerName}... Mantenha os dois tablets perto.
        </Text>
      )}

      {state.phase === 'done' && (
        <>
          <FeedbackMessage
            kind="success"
            message={`Sincronização concluída com o ${state.peerName}.`}
          />
          {describeSummary(state.summary).map((line) => (
            <Text key={line} style={styles.text}>
              {line}
            </Text>
          ))}
          {!state.peerConfirmed && (
            <Text style={styles.hint}>
              A conexão caiu antes da confirmação do outro tablet. Os dados recebidos aqui foram
              salvos; confira no outro tablet se ele também terminou.
            </Text>
          )}
          <ActionButton label="Sincronizar de novo" onPress={start} styles={styles} />
        </>
      )}

      {state.phase === 'failed' && (
        <>
          <FeedbackMessage kind="error" message={state.message} />
          <ActionButton label="Tentar de novo" onPress={start} styles={styles} />
        </>
      )}
    </View>
  );
}

type ConfirmStepProps = {
  state: Extract<NearbyState, { phase: 'confirming' }>;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  styles: SyncStyles;
  placeholderColor: string;
};

// A senha digitada some junto com esta etapa.
function ConfirmStep({ state, onConfirm, onCancel, styles, placeholderColor }: ConfirmStepProps) {
  const [password, setPassword] = useState('');

  return (
    <>
      <Text style={styles.text}>Confira se o {state.peerName} mostra o mesmo código:</Text>
      <View style={styles.codeBox}>
        <Text
          style={styles.digits}
          accessibilityLabel={`Código de conferência: ${state.digits.split('').join(' ')}`}>
          {state.digits}
        </Text>
      </View>
      <Text style={styles.text}>Se for igual, confirme com a sua senha.</Text>
      <LabeledInput
        label="CONFIRME COM A SUA SENHA"
        accessibilityLabel="Sua senha"
        autoCapitalize="none"
        onChangeText={setPassword}
        placeholder="Senha de acesso ao aplicativo"
        placeholderColor={placeholderColor}
        secureTextEntry
        styles={styles}
        value={password}
      />
      {state.error && <FeedbackMessage kind="error" message={state.error} />}
      <View style={styles.actions}>
        <ActionButton
          label="O código é diferente: cancelar"
          onPress={onCancel}
          variant="outline"
          styles={styles}
        />
        <ActionButton
          label={state.checking ? 'Conferindo...' : 'Confirmar e sincronizar'}
          onPress={() => onConfirm(password)}
          busy={state.checking}
          styles={styles}
        />
      </View>
    </>
  );
}
