import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { formatCrm, returnToLogin, useSession } from '@/features/auth/session';
import { WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import { fileTransport, type PackageTransport } from '@/features/sincronizacao/file-transport';
import type { NearbyApi } from '@/features/sincronizacao/nearby-module';
import { NEARBY_MESSAGES } from '@/features/sincronizacao/nearby-session';
import NearbySyncCard from '@/features/sincronizacao/nearby-sync-card';
import { normalizeTransferCode } from '@/features/sincronizacao/package-crypto';
import type { ConfirmPassword } from '@/features/sincronizacao/password-confirmation';
import { describeSummary, plural } from '@/features/sincronizacao/summary-text';
import { ActionButton, LabeledInput } from '@/features/sincronizacao/sync-controls';
import { createSyncStyles } from '@/features/sincronizacao/sync.styles';
import {
  REFUSAL_MESSAGES,
  type ImportResult,
  type SyncService,
} from '@/features/sincronizacao/sync-service';
import { useTheme } from '@/hooks/use-theme';

type SyncScreenProps = {
  service: Pick<
    SyncService,
    | 'exportPackage'
    | 'importPackage'
    | 'lastReceivedAt'
    | 'describeLocal'
    | 'preparePackageFor'
    | 'applyPackageJson'
  >;
  /** `null` no Expo Go. */
  nearby: NearbyApi | null;
  confirmPassword: ConfirmPassword;
  transport?: PackageTransport;
};

type TaskState<T> =
  | { status: 'idle' }
  | { status: 'working' }
  | ({ status: 'done' } & T)
  | { status: 'failed'; message: string };

const MESSAGES = {
  missingPassword: 'Digite a sua senha para continuar.',
  wrongPassword: NEARBY_MESSAGES.wrongPassword,
  invalidCode: 'Digite o código de 12 caracteres exibido no outro tablet.',
  exportFailed: 'Não foi possível gerar ou enviar o pacote.',
  readFailed: 'Não foi possível ler o arquivo escolhido.',
};

const pad = (value: number) => String(value).padStart(2, '0');

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

// Só em desenvolvimento.
function logFailure(step: string, error: unknown) {
  if (__DEV__) {
    console.error(`Falha ao ${step}`, error);
  }
}

/** Toda troca pede a senha do profissional logado. */
export default function SyncScreen({
  service,
  nearby,
  confirmPassword,
  transport = fileTransport,
}: SyncScreenProps) {
  const router = useRouter();
  const { professional, signOut } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createSyncStyles(theme), [theme]);
  const isWide = useWindowDimensions().width >= WIDE_LAYOUT_MIN_WIDTH;

  const [exportState, setExportState] = useState<TaskState<{ code: string; sent: number }>>({
    status: 'idle',
  });
  const [importState, setImportState] = useState<TaskState<{ lines: string[] }>>({
    status: 'idle',
  });
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [code, setCode] = useState('');
  const [lastReceivedAt, setLastReceivedAt] = useState<string | null>(null);

  // Sem sessão, volta ao login.
  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  const refreshLastReceived = useCallback(() => {
    service
      .lastReceivedAt()
      .then(setLastReceivedAt)
      .catch((error: unknown) => logFailure('ler o último recebimento', error));
  }, [service]);

  useEffect(refreshLastReceived, [refreshLastReceived]);

  const email = professional?.email ?? '';
  const confirmForSession = useCallback(
    (password: string) => confirmPassword(email, password),
    [confirmPassword, email],
  );

  if (!professional) return null;

  /** Mensagem de erro, ou `null` se a senha confere. */
  async function checkPassword(password: string): Promise<string | null> {
    if (password.length === 0) return MESSAGES.missingPassword;
    return (await confirmForSession(password)) ? null : MESSAGES.wrongPassword;
  }

  async function handleExport() {
    if (exportState.status === 'working') return;
    setExportState({ status: 'working' });
    try {
      const passwordError = await checkPassword(exportPassword);
      if (passwordError) {
        setExportState({ status: 'failed', message: passwordError });
        return;
      }
      const result = await service.exportPackage();
      setExportPassword('');
      setExportState({ status: 'done', code: result.code, sent: result.sent });
      await transport.send(result.fileName, result.contents);
    } catch (error) {
      logFailure('gerar ou enviar o pacote', error);
      setExportState({ status: 'failed', message: MESSAGES.exportFailed });
    }
  }

  async function handleImport() {
    if (importState.status === 'working') return;
    if (!normalizeTransferCode(code)) {
      setImportState({ status: 'failed', message: MESSAGES.invalidCode });
      return;
    }
    setImportState({ status: 'working' });

    let contents: string | null;
    try {
      const passwordError = await checkPassword(importPassword);
      if (passwordError) {
        setImportState({ status: 'failed', message: passwordError });
        return;
      }
      contents = await transport.receive();
    } catch (error) {
      logFailure('ler o arquivo escolhido', error);
      setImportState({ status: 'failed', message: MESSAGES.readFailed });
      return;
    }
    if (contents === null) {
      setImportState({ status: 'idle' });
      return;
    }

    let result: ImportResult;
    try {
      result = await service.importPackage(contents, code);
    } catch (error) {
      logFailure('importar o pacote', error);
      setImportState({ status: 'failed', message: REFUSAL_MESSAGES.erro });
      return;
    }
    if (!result.ok) {
      setImportState({ status: 'failed', message: result.message });
      return;
    }
    setImportState({ status: 'done', lines: describeSummary(result.summary) });
    setCode('');
    setImportPassword('');
    refreshLastReceived();
  }

  const exporting = exportState.status === 'working';
  const importing = importState.status === 'working';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topBar, isWide && styles.topBarWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para o início"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Início</Text>
        </Pressable>
        <View style={styles.account}>
          <View style={styles.accountText}>
            <Text style={styles.professionalName}>{professional.name}</Text>
            <Text style={styles.professionalCrm}>CRM {formatCrm(professional)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <Text style={styles.textButtonText}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={styles.title}>
            Sincronizar tablets
          </Text>
          <Text style={styles.subtitle}>
            Leve os profissionais, os pacientes e os atendimentos deste tablet para outro, sem
            internet. Depois da troca, os dois tablets ficam com os mesmos dados.
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.mainColumn}>
            <NearbySyncCard
              nearby={nearby}
              service={service}
              confirmPassword={confirmForSession}
              onReceived={refreshLastReceived}
              styles={styles}
              placeholderColor={theme.placeholder}
            />
          </View>

          <View style={styles.sideColumn}>
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Enviar por arquivo
              </Text>
              <Text style={styles.text}>
                Gere o pacote e passe o arquivo para o outro tablet por cabo USB ou pelo gerenciador
                de arquivos. Depois, digite lá o código que aparecer aqui.
              </Text>
              <Text style={styles.hint}>
                Evite aplicativos de mensagem e serviços de nuvem. O pacote é cifrado, mas contém
                dados dos profissionais e dos pacientes.
              </Text>
              <LabeledInput
                label="CONFIRME COM A SUA SENHA"
                accessibilityLabel="Senha para gerar o pacote"
                autoCapitalize="none"
                onChangeText={setExportPassword}
                placeholder="Senha de acesso ao aplicativo"
                placeholderColor={theme.placeholder}
                secureTextEntry
                styles={styles}
                value={exportPassword}
              />
              <ActionButton
                label={exporting ? 'Gerando pacote...' : 'Gerar e enviar pacote'}
                onPress={handleExport}
                busy={exporting}
                styles={styles}
              />
              {exportState.status === 'done' && (
                <View style={styles.codeBox} accessibilityLiveRegion="polite">
                  <Text style={styles.fieldLabel}>CÓDIGO DO PACOTE</Text>
                  <Text
                    selectable
                    style={styles.code}
                    accessibilityLabel={`Código do pacote: ${exportState.code}`}>
                    {exportState.code}
                  </Text>
                  <Text style={styles.hint}>
                    {plural(exportState.sent, 'registro no pacote', 'registros no pacote')}. O
                    código vale só para este pacote.
                  </Text>
                </View>
              )}
              {exportState.status === 'failed' && (
                <FeedbackMessage kind="error" message={exportState.message} />
              )}
            </View>

            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Receber arquivo
              </Text>
              <LabeledInput
                label="CÓDIGO DO PACOTE"
                accessibilityLabel="Código do pacote"
                autoCapitalize="characters"
                onChangeText={setCode}
                placeholder="ABCD-EFGH-JKLM"
                placeholderColor={theme.placeholder}
                styles={styles}
                value={code}
              />
              <LabeledInput
                label="CONFIRME COM A SUA SENHA"
                accessibilityLabel="Senha para importar o pacote"
                autoCapitalize="none"
                onChangeText={setImportPassword}
                placeholder="Senha de acesso ao aplicativo"
                placeholderColor={theme.placeholder}
                secureTextEntry
                styles={styles}
                value={importPassword}
              />
              <ActionButton
                label={importing ? 'Importando...' : 'Escolher pacote e importar'}
                onPress={handleImport}
                busy={importing}
                styles={styles}
              />
              {importState.status === 'done' && (
                <View style={styles.field} accessibilityLiveRegion="polite">
                  <FeedbackMessage kind="success" message="Pacote importado." />
                  {importState.lines.map((line) => (
                    <Text key={line} style={styles.text}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}
              {importState.status === 'failed' && (
                <FeedbackMessage kind="error" message={importState.message} />
              )}
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          {lastReceivedAt
            ? `Último recebimento de dados: ${formatDateTime(lastReceivedAt)}.`
            : 'Este tablet ainda não recebeu dados de outro.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
