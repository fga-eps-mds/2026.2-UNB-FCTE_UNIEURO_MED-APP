import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { formatCrm, returnToLogin, useSession } from '@/features/auth/session';
import ExamStatusChip from '@/features/home/exam-status-chip';
import { createHomeStyles, WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import {
  SEX_LABEL,
  describeAge,
  describeExamForReader,
  describeExams,
  formatDateTime,
  formatSchooling,
  type PatientDetail,
  type PatientExam,
} from '@/features/home/patient-detail';
import {
  createPatientDetailStyles,
  type PatientDetailStyles,
} from '@/features/home/patient-detail.styles';
import { useTheme } from '@/hooks/use-theme';

type PatientDetailScreenProps = {
  /** Paciente e exames que o profissional autenticado aplicou nele, e só esses. */
  patient: PatientDetail | null;
  /** A primeira leitura ainda não terminou. */
  loading?: boolean;
  /** A leitura no banco falhou. */
  loadFailed?: boolean;
  /** O paciente não existe ou não foi atendido por este profissional. */
  notFound?: boolean;
  /** Dia de hoje, para calcular a idade. Os testes fixam a data. */
  today?: Date;
};

export const LOADING_MESSAGE = 'Carregando os dados do paciente.';

export const NOT_FOUND_MESSAGE = 'Paciente não encontrado entre os seus pacientes.';

export const LOAD_FAILED_MESSAGE =
  'Não foi possível carregar o paciente. Volte à lista e abra o paciente de novo.';

/**
 * Tela do paciente (#59): os dados dele e os exames que o profissional aplicou,
 * do mais recente para o mais antigo. A exportação só dos exames do paciente
 * entra com a #22.
 */
export default function PatientDetailScreen({
  patient,
  loading = false,
  loadFailed = false,
  notFound = false,
  today,
}: PatientDetailScreenProps) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const home = useMemo(() => createHomeStyles(theme), [theme]);
  const styles = useMemo(() => createPatientDetailStyles(theme), [theme]);
  const isWide = useWindowDimensions().width >= WIDE_LAYOUT_MIN_WIDTH;

  // Como nas outras telas do profissional: sem sessão, volta ao login.
  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  return (
    <SafeAreaView style={home.safeArea}>
      <View style={[home.topBar, isWide && home.topBarWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para a lista de pacientes"
          onPress={() => router.back()}
          style={({ pressed }) => [home.textButton, pressed && home.pressed]}>
          <Text style={home.textButtonText}>‹ Pacientes</Text>
        </Pressable>
        <View style={home.accountText}>
          <Text style={home.professionalName} numberOfLines={1}>
            {professional.name}
          </Text>
          <Text style={home.professionalCrm}>CRM {formatCrm(professional)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        {loadFailed && <FeedbackMessage kind="error" message={LOAD_FAILED_MESSAGE} />}
        {patient ? (
          <>
            <PatientCard patient={patient} today={today} styles={styles} />
            <ExamsCard exams={patient.exams} professionalName={professional.name} styles={styles} />
          </>
        ) : loading ? (
          <View style={styles.state} accessible accessibilityLabel={LOADING_MESSAGE}>
            <ActivityIndicator color={theme.primary} size="large" />
            <Text style={styles.stateText}>{LOADING_MESSAGE}</Text>
          </View>
        ) : notFound ? (
          <View style={styles.state}>
            <Text accessibilityRole="header" style={styles.stateTitle}>
              Paciente não encontrado
            </Text>
            <Text style={styles.stateText}>{NOT_FOUND_MESSAGE}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PatientCard({
  patient,
  today,
  styles,
}: {
  patient: PatientDetail;
  today?: Date;
  styles: PatientDetailStyles;
}) {
  const facts = [
    ['FICHA', patient.recordNumber],
    ['NASCIMENTO', describeAge(patient.birthDate, today)],
    ['ESCOLARIDADE', formatSchooling(patient.schoolingYears)],
    ['SEXO', SEX_LABEL[patient.sex ?? 'none']],
  ];

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.patientName}>
        {patient.name}
      </Text>
      <View style={styles.facts}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.fact}>
            <Text style={styles.factLabel}>{label}</Text>
            <Text style={styles.factValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ExamsCard({
  exams,
  professionalName,
  styles,
}: {
  exams: PatientExam[];
  professionalName: string;
  styles: PatientDetailStyles;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.examsHeader}>
        <Text accessibilityRole="header" style={styles.examsTitle}>
          Exames
        </Text>
        <Text style={styles.examsSummary}>{describeExams(exams.length)}</Text>
      </View>
      <View>
        {exams.map((exam) => (
          <ExamRow key={exam.id} exam={exam} professionalName={professionalName} styles={styles} />
        ))}
      </View>
    </View>
  );
}

function ExamRow({
  exam,
  professionalName,
  styles,
}: {
  exam: PatientExam;
  professionalName: string;
  styles: PatientDetailStyles;
}) {
  // A linha é um só item para o leitor de tela, com a frase completa.
  return (
    <View
      testID="exame"
      accessible
      accessibilityLabel={describeExamForReader(exam, professionalName)}
      style={styles.exam}>
      <View style={styles.examWhen}>
        <Text style={styles.examDate}>{formatDateTime(exam.startedAt)}</Text>
        <Text style={styles.examBy}>Aplicado por {professionalName}</Text>
      </View>
      <ExamStatusChip tone={exam.tone} label={exam.label} />
    </View>
  );
}
