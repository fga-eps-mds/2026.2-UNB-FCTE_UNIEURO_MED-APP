import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { formatCrm, returnToLogin, useSession } from '@/features/auth/session';
import {
  createHomeStyles,
  WIDE_LAYOUT_MIN_WIDTH,
  type HomeStyles,
} from '@/features/home/home.styles';
import {
  EXAM_STATUS_LABEL,
  countExams,
  describeTotals,
  filterPatients,
  formatDate,
  sortByLastExam,
  type ExamStatus,
  type PatientSummary,
} from '@/features/home/patients';
import { useTheme } from '@/hooks/use-theme';

type HomeScreenProps = {
  /** Pacientes atendidos pelo profissional autenticado, e só por ele. */
  patients: readonly PatientSummary[];
  /** A leitura dos pacientes no banco falhou. */
  loadFailed?: boolean;
};

export const LOAD_FAILED_MESSAGE =
  'Não foi possível carregar os seus pacientes. Saia e entre de novo para tentar outra vez.';

// Ações cujo fluxo chega em histórias seguintes. O botão já fica no lugar
// combinado com o PO e avisa o que ainda falta.
const PENDING = {
  export: 'A exportação em XML chega em uma próxima entrega.',
  patient: 'Os exames do paciente aparecem aqui em uma próxima entrega.',
  sync: 'A sincronização entre tablets está em estudo e ainda não está disponível.',
};

/** Tempo que o aviso rápido fica na tela, como pede o guia de identidade visual. */
export const NOTICE_DURATION_MS = 4000;

/**
 * Tela inicial do profissional (#46): os pacientes que ele atendeu e os
 * atalhos para novo exame, exportação, sincronização e configurações.
 */
export default function HomeScreen({ patients, loadFailed = false }: HomeScreenProps) {
  const router = useRouter();
  const { professional, signOut } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createHomeStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const isWide = (measuredWidth || windowWidth) >= WIDE_LAYOUT_MIN_WIDTH;
  const [query, setQuery] = useState('');
  // O id muda a cada toque, para o aviso reiniciar a contagem mesmo quando o
  // texto se repete.
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);
  const showNotice = (message: string) =>
    setNotice((current) => ({ id: (current?.id ?? 0) + 1, message }));

  // Sem profissional autenticado a tela não abre. Isso também cobre o "Sair":
  // ao encerrar a sessão, o aplicativo volta para o login por aqui.
  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const ordered = useMemo(() => sortByLastExam(patients), [patients]);
  const visible = useMemo(() => filterPatients(ordered, query), [ordered, query]);
  const hasExams = countExams(patients) > 0;
  const hasPatients = patients.length > 0;

  if (!professional) return null;

  return (
    <SafeAreaView
      testID="tela-inicial"
      style={styles.safeArea}
      onLayout={({ nativeEvent }) => setMeasuredWidth(nativeEvent.layout.width)}>
      <View style={[styles.topBar, isWide && styles.topBarWide]}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText} accessibilityElementsHidden>
              M
            </Text>
          </View>
          <View>
            <Text style={styles.brandName}>MNEMA</Text>
            <Text style={styles.brandCaption}>RASTREIO COGNITIVO</Text>
          </View>
        </View>
        <View style={styles.account}>
          <View style={styles.accountText}>
            <Text style={styles.professionalName}>{professional.name}</Text>
            <Text style={styles.professionalCrm}>CRM {formatCrm(professional)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
            <Text style={styles.outlineButtonText}>Configurações</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <Text style={styles.textButtonText}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.body, isWide && styles.bodyWide]}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.title}>
              Seus pacientes
            </Text>
            <Text style={styles.subtitle}>{describeTotals(patients)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Novo exame"
            onPress={() => router.push('/novo-exame')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>+ Novo exame</Text>
          </Pressable>
        </View>

        <View style={styles.toolbar}>
          {/* Sem pacientes não há o que buscar: a busca só aparece com a lista. */}
          {hasPatients && (
            <TextInput
              accessibilityLabel="Buscar paciente"
              placeholder="Buscar por nome ou número da ficha"
              placeholderTextColor={theme.placeholder}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              style={styles.search}
            />
          )}
          <View style={styles.toolbarActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasExams }}
              disabled={!hasExams}
              onPress={() => showNotice(PENDING.export)}
              style={({ pressed }) => [
                styles.outlineButton,
                !hasExams && styles.disabledButton,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.outlineButtonText, !hasExams && styles.disabledButtonText]}>
                Exportar todos (XML)
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => showNotice(PENDING.sync)}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
              <Text style={styles.outlineButtonText}>Sincronizar tablets</Text>
            </Pressable>
          </View>
        </View>

        {loadFailed && <FeedbackMessage kind="error" message={LOAD_FAILED_MESSAGE} />}

        <View style={styles.listCard}>
          {!hasPatients ? (
            <EmptyState styles={styles} />
          ) : (
            <FlatList
              data={visible}
              keyExtractor={(patient) => String(patient.id)}
              ListHeaderComponent={isWide ? <ColumnHeader styles={styles} /> : null}
              ListEmptyComponent={
                <Text style={styles.noResults}>
                  Nenhum paciente encontrado para “{query.trim()}”.
                </Text>
              }
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <PatientRow
                  patient={item}
                  isWide={isWide}
                  showDivider={index > 0}
                  styles={styles}
                  onOpen={() => showNotice(PENDING.patient)}
                />
              )}
            />
          )}
        </View>
      </View>

      {notice && (
        <View pointerEvents="none" style={styles.noticePosition} testID="aviso-rapido">
          <View style={styles.noticeBody}>
            <FeedbackMessage key={notice.id} kind="info" message={notice.message} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function ColumnHeader({ styles }: { styles: HomeStyles }) {
  return (
    <View style={styles.columnHeader}>
      <Text style={[styles.columnLabel, styles.colName]}>PACIENTE</Text>
      <Text style={[styles.columnLabel, styles.colRecord]}>FICHA</Text>
      <Text style={[styles.columnLabel, styles.colLastExam]}>ÚLTIMO EXAME</Text>
      <Text style={[styles.columnLabel, styles.colCount]}>EXAMES</Text>
    </View>
  );
}

const CHIP_STYLES = {
  concluido: { box: 'chipConcluido', text: 'chipConcluidoText' },
  interrompido: { box: 'chipInterrompido', text: 'chipInterrompidoText' },
  recusado: { box: 'chipRecusado', text: 'chipRecusadoText' },
} as const satisfies Record<ExamStatus, { box: keyof HomeStyles; text: keyof HomeStyles }>;

type PatientRowProps = {
  patient: PatientSummary;
  isWide: boolean;
  showDivider: boolean;
  styles: HomeStyles;
  onOpen: () => void;
};

function PatientRow({ patient, isWide, showDivider, styles, onOpen }: PatientRowProps) {
  const lastExam = patient.lastExamAt ? formatDate(patient.lastExamAt) : 'Sem exame';
  const status = patient.lastExamStatus;
  const statusLabel = status ? EXAM_STATUS_LABEL[status] : null;
  const description = [
    patient.name,
    `ficha ${patient.recordNumber}`,
    `último exame ${lastExam}`,
    statusLabel,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View>
      {showDivider && <View style={styles.separator} />}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={description}
          onPress={onOpen}
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
          <View style={styles.colName}>
            <Text style={styles.patientName}>{patient.name}</Text>
            {!isWide && <Text style={styles.cellSecondary}>Ficha {patient.recordNumber}</Text>}
          </View>
          {isWide && <Text style={[styles.record, styles.colRecord]}>{patient.recordNumber}</Text>}
          <View style={styles.colLastExam}>
            <Text style={styles.cell}>{lastExam}</Text>
            {status && (
              <View style={[styles.chip, styles[CHIP_STYLES[status].box]]}>
                <Text style={[styles.chipText, styles[CHIP_STYLES[status].text]]}>
                  {statusLabel}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.count, styles.colCount]}>{patient.examCount}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmptyState({ styles }: { styles: HomeStyles }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText} accessibilityElementsHidden>
          +
        </Text>
      </View>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        Nenhum paciente ainda
      </Text>
      <Text style={styles.emptyText}>
        Os pacientes aparecem aqui depois do primeiro exame. Comece pelo botão Novo exame.
      </Text>
    </View>
  );
}
