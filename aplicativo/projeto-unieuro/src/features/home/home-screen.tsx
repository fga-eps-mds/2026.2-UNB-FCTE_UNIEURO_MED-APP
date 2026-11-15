import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
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
  EXAM_STATUS_TONE,
  countExams,
  cpfDigitsOf,
  describeTotals,
  filterPatients,
  formatDate,
  sortByLastExam,
  type PatientCpf,
  type PatientSummary,
} from '@/features/home/patients';
import ExamStatusChip from '@/features/home/exam-status-chip';
import { usePatientCpfs } from '@/features/home/use-patient-cpfs';
import { useTheme } from '@/hooks/use-theme';

type HomeScreenProps = {
  /**
   * Pacientes atendidos pelo profissional autenticado, e só por ele. Para o
   * superusuário, os de todos os profissionais, cada um com quem atendeu (#49).
   */
  patients: readonly PatientSummary[];
  /** A leitura dos pacientes no banco falhou. */
  loadFailed?: boolean;
  /** A primeira leitura dos pacientes ainda não terminou. */
  loading?: boolean;
  /** Lê os CPFs dos pacientes da lista, quando a busca tem dígitos de CPF. */
  loadPatientCpfs?: () => Promise<PatientCpf[]>;
};

const NO_PATIENT_CPFS = () => Promise.resolve([]);

export const LOADING_MESSAGE = 'Carregando os seus pacientes.';

export const LOAD_FAILED_MESSAGE =
  'Não foi possível carregar os seus pacientes. Saia e entre de novo para tentar outra vez.';

export const CPF_SEARCH_FAILED_MESSAGE =
  'Não foi possível buscar pelo CPF agora. Busque pelo nome ou pelo número da ficha.';

// Ações cujo fluxo chega em histórias seguintes. O botão já fica no lugar
// combinado com o PO e avisa o que ainda falta.
const PENDING = {
  export: 'A exportação em XML chega em uma próxima entrega.',
  sync: 'A sincronização entre tablets está em estudo e ainda não está disponível.',
  superuserArea: 'A área do superusuário chega em uma próxima entrega.',
};

/** Tempo que o aviso rápido fica na tela, como pede o guia de identidade visual. */
export const NOTICE_DURATION_MS = 4000;

/**
 * Tela inicial do profissional (#46): os pacientes que ele atendeu e os
 * atalhos para novo exame, exportação, sincronização e configurações.
 */
export default function HomeScreen({
  patients,
  loadFailed = false,
  loading = false,
  loadPatientCpfs = NO_PATIENT_CPFS,
}: HomeScreenProps) {
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

  const searchesByCpf = cpfDigitsOf(query) !== null;
  const { cpfs, failed: cpfSearchFailed } = usePatientCpfs(
    loadPatientCpfs,
    patients,
    searchesByCpf,
  );
  const ordered = useMemo(() => sortByLastExam(patients), [patients]);
  const visible = useMemo(() => filterPatients(ordered, query, cpfs), [ordered, query, cpfs]);
  const hasExams = countExams(patients) > 0;
  const hasPatients = patients.length > 0;
  // O superusuário vê os pacientes de todos os profissionais, com quem atendeu (#49).
  const allProfessionals = professional?.superuser === true;

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
            <Text style={styles.professionalName} numberOfLines={1}>
              {professional.name}
            </Text>
            <Text style={styles.professionalCrm}>
              {allProfessionals ? 'Responsável pela pesquisa' : `CRM ${formatCrm(professional)}`}
            </Text>
          </View>
          {allProfessionals && (
            <HeaderLink
              label="Área do superusuário"
              onPress={() => showNotice(PENDING.superuserArea)}
              styles={styles}
            />
          )}
          <HeaderLink
            icon="cog-outline"
            label="Configurações"
            onPress={() => router.push('/settings')}
            styles={styles}
            color={theme.primary}
          />
          <HeaderLink
            icon="logout"
            label="Sair"
            onPress={signOut}
            styles={styles}
            color={theme.primary}
          />
        </View>
      </View>

      <View style={[styles.body, isWide && styles.bodyWide]}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.title}>
              {allProfessionals ? 'Todos os pacientes' : 'Seus pacientes'}
            </Text>
            {/* Enquanto carrega, o aviso fica só no cartão da lista, para não ser lido duas vezes. */}
            {!loading && (
              <Text style={styles.subtitle}>{describeTotals(patients, allProfessionals)}</Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Novo exame"
            onPress={() => router.push('/novo-exame')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ButtonIcon name="plus" color={theme.onPrimary} />
            <Text style={styles.primaryButtonText}>Novo exame</Text>
          </Pressable>
        </View>

        <View style={styles.toolbarBlock}>
          {hasPatients && (
            <Text style={styles.searchLabel} accessibilityElementsHidden>
              {allProfessionals ? 'BUSCAR PACIENTE OU PROFISSIONAL' : 'BUSCAR PACIENTE'}
            </Text>
          )}
          <View style={styles.toolbar}>
            {/* Sem pacientes não há o que buscar: a busca só aparece com a lista. */}
            {hasPatients && (
              <View style={styles.search}>
                <MaterialCommunityIcons
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  name="magnify"
                  size={24}
                  color={theme.placeholder}
                />
                <TextInput
                  accessibilityLabel={
                    allProfessionals ? 'Buscar paciente ou profissional' : 'Buscar paciente'
                  }
                  placeholder={
                    allProfessionals
                      ? 'Nome, ficha ou profissional'
                      : 'Buscar por nome, ficha ou CPF'
                  }
                  placeholderTextColor={theme.placeholder}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
              </View>
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
                <ButtonIcon
                  name="tray-arrow-down"
                  color={hasExams ? theme.primary : theme.textSecondary}
                />
                <Text style={[styles.outlineButtonText, !hasExams && styles.disabledButtonText]}>
                  {allProfessionals ? 'Exportar a coleta inteira (XML)' : 'Exportar todos (XML)'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => showNotice(PENDING.sync)}
                style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
                <ButtonIcon name="sync" color={theme.primary} />
                <Text style={styles.outlineButtonText}>Sincronizar tablets</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {loadFailed && <FeedbackMessage kind="error" message={LOAD_FAILED_MESSAGE} />}
        {searchesByCpf && cpfSearchFailed && (
          <FeedbackMessage kind="error" message={CPF_SEARCH_FAILED_MESSAGE} />
        )}

        <View style={styles.listCard}>
          {loading && !hasPatients ? (
            <Loading styles={styles} color={theme.primary} />
          ) : !hasPatients ? (
            <EmptyState styles={styles} />
          ) : (
            <FlatList
              data={visible}
              keyExtractor={(patient) => String(patient.id)}
              ListHeaderComponent={
                isWide ? <ColumnHeader styles={styles} showAttendedBy={allProfessionals} /> : null
              }
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
                  chevronColor={theme.textSecondary}
                  showDivider={index > 0}
                  styles={styles}
                  onOpen={() =>
                    router.push({ pathname: '/paciente/[id]', params: { id: String(item.id) } })
                  }
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

type ColumnHeaderProps = {
  styles: HomeStyles;
  /** Coluna de quem atendeu, só na lista do superusuário (#49). */
  showAttendedBy: boolean;
};

function ColumnHeader({ styles, showAttendedBy }: ColumnHeaderProps) {
  return (
    <View style={styles.columnHeader}>
      <Text style={[styles.columnLabel, styles.colName]}>PACIENTE</Text>
      <Text style={[styles.columnLabel, styles.colRecord]}>FICHA</Text>
      {showAttendedBy && (
        <Text style={[styles.columnLabel, styles.colAttendedBy]}>ATENDIDO POR</Text>
      )}
      <Text style={[styles.columnLabel, styles.colLastExam, styles.colLastExamWide]}>
        ÚLTIMO EXAME
      </Text>
      <Text style={[styles.columnLabel, styles.colCount]}>EXAMES</Text>
      <View style={styles.chevron} />
    </View>
  );
}

type PatientRowProps = {
  patient: PatientSummary;
  isWide: boolean;
  chevronColor: string;
  showDivider: boolean;
  styles: HomeStyles;
  onOpen: () => void;
};

function PatientRow({
  patient,
  isWide,
  chevronColor,
  showDivider,
  styles,
  onOpen,
}: PatientRowProps) {
  const lastExam = patient.lastExamAt ? formatDate(patient.lastExamAt) : 'Sem exame';
  const status = patient.lastExamStatus;
  const statusLabel = status ? EXAM_STATUS_LABEL[status] : null;
  const description = [
    patient.name,
    `ficha ${patient.recordNumber}`,
    `último exame ${lastExam}`,
    statusLabel,
    patient.attendedBy && `atendido por ${patient.attendedBy}`,
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
          {/* No tablet deitado, quem atendeu tem coluna própria, como no protótipo (#49). */}
          {isWide && patient.attendedBy !== undefined && (
            <Text style={[styles.record, styles.colAttendedBy]}>{patient.attendedBy}</Text>
          )}
          <View style={[styles.colLastExam, isWide && styles.colLastExamWide]}>
            <Text style={styles.cell}>{lastExam}</Text>
            {status && (
              <ExamStatusChip tone={EXAM_STATUS_TONE[status]} label={EXAM_STATUS_LABEL[status]} />
            )}
            {!isWide && patient.attendedBy ? (
              <Text style={styles.cellSecondary}>Atendido por {patient.attendedBy}</Text>
            ) : null}
          </View>
          <Text style={[styles.count, styles.colCount]}>{patient.examCount}</Text>
          <MaterialCommunityIcons
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            name="chevron-right"
            size={24}
            color={chevronColor}
            style={styles.chevron}
          />
        </Pressable>
      </View>
    </View>
  );
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Ícone de um botão. Fica oculto para o leitor de tela, que lê só o texto. */
function ButtonIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <MaterialCommunityIcons
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      name={name}
      size={24}
      color={color}
    />
  );
}

type HeaderLinkProps = {
  label: string;
  onPress: () => void;
  styles: HomeStyles;
  icon?: IconName;
  color?: string;
};

/** Ação do cabeçalho em forma de link, com ícone opcional, como no protótipo. */
function HeaderLink({ label, onPress, styles, icon, color }: HeaderLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
      {icon && color ? <ButtonIcon name={icon} color={color} /> : null}
      <Text style={styles.textButtonText}>{label}</Text>
    </Pressable>
  );
}

function Loading({ styles, color }: { styles: HomeStyles; color: string }) {
  return (
    <View style={styles.empty} accessible accessibilityLabel={LOADING_MESSAGE}>
      <ActivityIndicator color={color} size="large" />
      <Text style={styles.emptyText}>{LOADING_MESSAGE}</Text>
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
