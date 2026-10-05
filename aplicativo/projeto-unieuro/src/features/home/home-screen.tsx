import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { formatCrm, useSession } from '@/features/auth/session';
import {
  createHomeStyles,
  WIDE_LAYOUT_MIN_WIDTH,
  type HomeStyles,
} from '@/features/home/home.styles';
import {
  EXAM_STATUS_LABEL,
  ageOn,
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
};

// Ações cujo fluxo chega em histórias seguintes. O botão já fica no lugar
// combinado com o PO e avisa o que ainda falta.
const PENDING = {
  newExam: 'O registro do atendimento chega na próxima entrega.',
  export: 'A exportação em XML chega em uma próxima entrega.',
  patient: 'Os exames do paciente aparecem aqui em uma próxima entrega.',
  sync: 'A sincronização entre tablets está em estudo e ainda não está disponível.',
};

/**
 * Tela inicial do profissional (#46): os pacientes que ele atendeu e os
 * atalhos para novo exame, exportação, sincronização e configurações.
 */
export default function HomeScreen({ patients }: HomeScreenProps) {
  const router = useRouter();
  const { professional, signOut } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createHomeStyles(theme), [theme]);
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const isWide = (measuredWidth || windowWidth) >= WIDE_LAYOUT_MIN_WIDTH;
  const [query, setQuery] = useState('');

  // Sem profissional autenticado a tela não abre. Isso também cobre o "Sair":
  // ao encerrar a sessão, o aplicativo volta para o login por aqui.
  useEffect(() => {
    if (!professional) router.replace('/');
  }, [professional, router]);

  const ordered = useMemo(() => sortByLastExam(patients), [patients]);
  const visible = useMemo(() => filterPatients(ordered, query), [ordered, query]);
  const hasExams = countExams(patients) > 0;

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
            onPress={() => Alert.alert('Novo exame', PENDING.newExam)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>+ Novo exame</Text>
          </Pressable>
        </View>

        <View style={styles.toolbar}>
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
          <View style={styles.toolbarActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasExams }}
              disabled={!hasExams}
              onPress={() => Alert.alert('Exportar todos (XML)', PENDING.export)}
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
              onPress={() => Alert.alert('Sincronizar tablets', PENDING.sync)}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
              <Text style={styles.outlineButtonText}>Sincronizar tablets</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.listCard}>
          {patients.length === 0 ? (
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
                />
              )}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ColumnHeader({ styles }: { styles: HomeStyles }) {
  return (
    <View style={styles.columnHeader}>
      <Text style={[styles.columnLabel, styles.colName]}>PACIENTE</Text>
      <Text style={[styles.columnLabel, styles.colRecord]}>FICHA</Text>
      <Text style={[styles.columnLabel, styles.colBirth]}>NASCIMENTO</Text>
      <Text style={[styles.columnLabel, styles.colLastExam]}>ÚLTIMO EXAME</Text>
      <Text style={[styles.columnLabel, styles.colCount]}>EXAMES</Text>
      <View style={styles.colAction} />
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
};

function PatientRow({ patient, isWide, showDivider, styles }: PatientRowProps) {
  const lastExam = patient.lastExamAt ? formatDate(patient.lastExamAt) : 'Sem exame';
  const status = patient.lastExamStatus;
  const statusLabel = status ? EXAM_STATUS_LABEL[status] : null;
  const canExport = patient.examCount > 0;
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
          onPress={() => Alert.alert(patient.name, PENDING.patient)}
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
          <View style={styles.colName}>
            <Text style={styles.patientName}>{patient.name}</Text>
            {!isWide && <Text style={styles.cellSecondary}>Ficha {patient.recordNumber}</Text>}
          </View>
          {isWide && <Text style={[styles.record, styles.colRecord]}>{patient.recordNumber}</Text>}
          {isWide && (
            <View style={styles.colBirth}>
              <Text style={styles.cell}>{formatDate(patient.birthDate)}</Text>
              <Text style={styles.cellSecondary}>{ageOn(patient.birthDate)} anos</Text>
            </View>
          )}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Exportar os exames de ${patient.name}`}
          accessibilityState={{ disabled: !canExport }}
          disabled={!canExport}
          onPress={() => Alert.alert('Exportar XML do paciente', PENDING.export)}
          style={({ pressed }) => [
            styles.outlineButton,
            styles.rowExport,
            styles.colAction,
            !canExport && styles.disabledButton,
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.outlineButtonText, !canExport && styles.disabledButtonText]}>
            Exportar
          </Text>
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
