import { useEffect, useMemo, useState } from 'react';
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
import {
  formatCrm,
  returnToLogin,
  useSession,
  type SessionProfessional,
} from '@/features/auth/session';
import {
  ROTULO_MARCACAO,
  type ResultadoMarcacao,
  type TipoMarcacao,
} from '@/features/avaliacao/marcacao';
import type { ResultadoExportacao } from '@/features/exportacao/exportacao';
import { ExportarPacienteDialog } from '@/features/exportacao/exportar-paciente-dialog';
import ExamStatusChip from '@/features/home/exam-status-chip';
import { createHomeStyles, WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import { MarcarExameDialog, type MarcacaoPedida } from '@/features/home/marcar-exame-dialog';
import {
  MarcarPacienteDialog,
  type MarcacaoPacientePedida,
} from '@/features/home/marcar-paciente-dialog';
import {
  SEX_LABEL,
  canMarkExam,
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

export type PatientMarking = {
  mark: (
    patientId: number,
    professional: SessionProfessional,
    type: TipoMarcacao | null,
    password: string,
  ) => Promise<ResultadoMarcacao>;
  unmark: (
    patientId: number,
    professional: SessionProfessional,
    password: string,
  ) => Promise<ResultadoMarcacao>;
  onChanged: () => void;
};

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
  /** Marcação do exame como teste ou ensino (#58). Sem ela, a tela não oferece o botão. */
  marking?: ExamMarking;
  /** Marcação dos exames do paciente como teste ou ensino (#47). */
  patientMarking?: PatientMarking;
  /**
   * Exporta em XML os exames que `professional` aplicou em `patientId` (#22). Sem ela,
   * o botão fica desabilitado. Só é chamada depois que o profissional confirma.
   */
  exportPatient?: (
    professional: SessionProfessional,
    patientId: number,
  ) => Promise<ResultadoExportacao>;
};

/** Gravação da marcação, ligada ao banco pela rota, e a releitura depois dela (#58). */
export type ExamMarking = {
  mark: (
    examId: number,
    professional: SessionProfessional,
    type: TipoMarcacao | null,
    password: string,
  ) => Promise<ResultadoMarcacao>;
  unmark: (
    examId: number,
    professional: SessionProfessional,
    password: string,
  ) => Promise<ResultadoMarcacao>;
  /** Lê o paciente de novo, para a lista mostrar a marcação gravada. */
  onChanged: () => void;
};

type MarkingRequest = { exam: PatientExam; request: MarcacaoPedida };

export const savedFileMessage = (arquivo: string) => `Arquivo salvo: ${arquivo}`;

export const NO_OWN_EXAMS_MESSAGE = 'Você não aplicou exames neste paciente.';

export const LOADING_MESSAGE = 'Carregando os dados do paciente.';

export const NOT_FOUND_MESSAGE = 'Paciente não encontrado entre os seus pacientes.';

export const LOAD_FAILED_MESSAGE =
  'Não foi possível carregar o paciente. Volte à lista e abra o paciente de novo.';

/**
 * Tela do paciente (#59): os dados dele e os exames que o profissional aplicou,
 * do mais recente para o mais antigo. O botão "Exportar exames (XML)" (#22) gera,
 * a pedido do profissional e só no tablet, o arquivo dos exames deste paciente.
 */
export default function PatientDetailScreen({
  patient,
  loading = false,
  loadFailed = false,
  notFound = false,
  today,
  marking,
  patientMarking,
  exportPatient,
}: PatientDetailScreenProps) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const home = useMemo(() => createHomeStyles(theme), [theme]);
  const styles = useMemo(() => createPatientDetailStyles(theme), [theme]);
  const isWide = useWindowDimensions().width >= WIDE_LAYOUT_MIN_WIDTH;
  const [markingRequest, setMarkingRequest] = useState<MarkingRequest | null>(null);
  const [patientMarkingRequest, setPatientMarkingRequest] = useState<MarcacaoPacientePedida | null>(
    null,
  );
  const [markingNotice, setMarkingNotice] = useState<string | null>(null);
  const [confirmingExport, setConfirmingExport] = useState(false);
  const [savedFile, setSavedFile] = useState<string | null>(null);

  // Como nas outras telas do profissional: sem sessão, volta ao login.
  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  // O arquivo leva só os exames que o profissional aplicou (#22). O superusuário vê os de
  // outros médicos na tela, mas só exporta os próprios.
  const ownExams = patient?.exams.filter((exam) => canMarkExam(exam, professional.id)) ?? [];
  const hasOwnExams = ownExams.length > 0;
  const allOwnMarked = hasOwnExams && ownExams.every((exam) => exam.marking !== null);
  const ownMarkings = Array.from(
    new Set(ownExams.map((e) => e.marking).filter((m): m is TipoMarcacao => m !== null)),
  );
  const visibleMarkings = Array.from(
    new Set(
      (patient?.exams ?? []).map((e) => e.marking).filter((m): m is TipoMarcacao => m !== null),
    ),
  );
  const canMarkPatient =
    patientMarking !== undefined && hasOwnExams && professional.superuser !== true;
  const exportDisabled = !exportPatient || !hasOwnExams;

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
            <PatientCard
              patient={patient}
              today={today}
              markings={visibleMarkings}
              styles={styles}
            />
            <View style={styles.exportRow}>
              {patient.exams.length > 0 && !hasOwnExams && (
                <Text style={styles.examsSummary}>{NO_OWN_EXAMS_MESSAGE}</Text>
              )}
              {canMarkPatient && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    allOwnMarked
                      ? 'Desfazer marcação do paciente'
                      : 'Marcar paciente como teste ou material de ensino'
                  }
                  onPress={() => {
                    setMarkingNotice(null);
                    setPatientMarkingRequest(
                      allOwnMarked
                        ? { acao: 'desmarcar', marcacoes: ownMarkings }
                        : { acao: 'marcar' },
                    );
                  }}
                  style={({ pressed }) => [home.outlineButton, pressed && home.pressed]}>
                  <Text style={home.outlineButtonText}>
                    {allOwnMarked ? 'Desfazer marcação do paciente' : 'Marcar paciente'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Exportar exames deste paciente (XML)"
                accessibilityState={{ disabled: exportDisabled }}
                disabled={exportDisabled}
                onPress={() => {
                  setSavedFile(null);
                  setConfirmingExport(true);
                }}
                style={({ pressed }) => [
                  home.outlineButton,
                  exportDisabled && home.disabledButton,
                  pressed && home.pressed,
                ]}>
                <Text style={[home.outlineButtonText, exportDisabled && home.disabledButtonText]}>
                  Exportar exames (XML)
                </Text>
              </Pressable>
            </View>
            {markingNotice && <FeedbackMessage kind="success" message={markingNotice} />}
            {savedFile && <FeedbackMessage kind="success" message={savedFileMessage(savedFile)} />}
            <ExamsCard
              exams={patient.exams}
              professional={professional}
              styles={styles}
              onRequestMarking={marking ? setMarkingRequest : undefined}
            />
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

      {patient && exportPatient && (
        <ExportarPacienteDialog
          visible={confirmingExport}
          exportar={() => exportPatient(professional, patient.id)}
          onCancelar={() => setConfirmingExport(false)}
          onSalvo={(arquivo) => {
            setConfirmingExport(false);
            setSavedFile(arquivo);
          }}
        />
      )}

      {patient && patientMarking && patientMarkingRequest && (
        <MarcarPacienteDialog
          visible
          pedido={patientMarkingRequest}
          paciente={patient.name}
          onConfirm={async (type, password) => {
            const result =
              patientMarkingRequest.acao === 'marcar'
                ? await patientMarking.mark(patient.id, professional, type, password)
                : await patientMarking.unmark(patient.id, professional, password);
            if (!result.feito && result.desatualizado) patientMarking.onChanged();
            return result;
          }}
          onCancel={() => setPatientMarkingRequest(null)}
          onDone={() => {
            const mensagem =
              patientMarkingRequest.acao === 'marcar'
                ? 'Marcação aplicada aos seus exames deste paciente.'
                : 'Marcação removida dos seus exames deste paciente.';
            setPatientMarkingRequest(null);
            setMarkingNotice(mensagem);
            patientMarking.onChanged();
          }}
        />
      )}

      {marking && markingRequest && (
        <MarcarExameDialog
          visible
          pedido={markingRequest.request}
          quando={formatDateTime(markingRequest.exam.startedAt)}
          onConfirm={async (type, password) => {
            const result =
              markingRequest.request.acao === 'marcar'
                ? await marking.mark(markingRequest.exam.id, professional, type, password)
                : await marking.unmark(markingRequest.exam.id, professional, password);
            // O exame já tinha mudado: relê o paciente para o botão da linha ficar certo.
            if (!result.feito && result.desatualizado) marking.onChanged();
            return result;
          }}
          onCancel={() => setMarkingRequest(null)}
          onDone={() => {
            setMarkingRequest(null);
            marking.onChanged();
          }}
        />
      )}
    </SafeAreaView>
  );
}

function PatientCard({
  patient,
  today,
  markings = [],
  styles,
}: {
  patient: PatientDetail;
  today?: Date;
  markings?: readonly TipoMarcacao[];
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
      <View style={styles.patientHeaderRow}>
        <Text accessibilityRole="header" style={styles.patientName}>
          {patient.name}
        </Text>
        {markings.length > 0 && (
          <View style={styles.examChips}>
            {markings.map((marking) => (
              <View key={marking} testID="marcacao-paciente" style={styles.markingChip}>
                <Text style={styles.markingText}>{ROTULO_MARCACAO[marking]}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
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
  professional,
  styles,
  onRequestMarking,
}: {
  exams: PatientExam[];
  professional: SessionProfessional;
  styles: PatientDetailStyles;
  onRequestMarking?: (request: MarkingRequest) => void;
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
          <ExamRow
            key={exam.id}
            exam={exam}
            professional={professional}
            styles={styles}
            onRequestMarking={onRequestMarking}
          />
        ))}
      </View>
    </View>
  );
}

function ExamRow({
  exam,
  professional,
  styles,
  onRequestMarking,
}: {
  exam: PatientExam;
  professional: SessionProfessional;
  styles: PatientDetailStyles;
  onRequestMarking?: (request: MarkingRequest) => void;
}) {
  const router = useRouter();
  // Para o superusuário, o exame pode ser de outro médico (#49); para o médico
  // comum, todos os exames da tela foram aplicados por ele.
  const appliedBy = exam.appliedBy ?? professional.name;
  // Só quem aplicou marca ou desmarca; o superusuário vê a marcação dos outros (#58).
  const canMark = onRequestMarking !== undefined && canMarkExam(exam, professional.id);
  const when = formatDateTime(exam.startedAt);
  const conteudo = (
    <>
      <View style={styles.examWhen}>
        <Text style={styles.examDate}>{when}</Text>
        <Text style={styles.examBy}>Aplicado por {appliedBy}</Text>
      </View>
      <View style={styles.examChips}>
        <ExamStatusChip tone={exam.tone} label={exam.label} />
        {exam.marking && (
          <View testID="marcacao" style={styles.markingChip}>
            <Text style={styles.markingText}>{ROTULO_MARCACAO[exam.marking]}</Text>
          </View>
        )}
      </View>
    </>
  );
  return (
    <View style={styles.examRow}>
      {/* A parte do exame é um só item para o leitor de tela, com a frase completa. O
          exame com os três desenhos vira botão e abre o resultado (#14). O botão de
          marcar fica fora dela (#58). */}
      {exam.hasResult ? (
        <Pressable
          testID="exame"
          accessibilityRole="button"
          accessibilityLabel={describeExamForReader(exam, appliedBy)}
          accessibilityHint="Abre o resultado do exame"
          onPress={() =>
            router.push({ pathname: '/resultado/[id]', params: { id: String(exam.id) } })
          }
          style={({ pressed }) => [styles.exam, pressed && styles.pressed]}>
          {conteudo}
        </Pressable>
      ) : (
        <View
          testID="exame"
          accessible
          accessibilityLabel={describeExamForReader(exam, appliedBy)}
          style={styles.exam}>
          {conteudo}
        </View>
      )}
      {canMark && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            exam.marking
              ? `Desfazer a marcação do exame de ${when}`
              : `Marcar o exame de ${when} como teste ou material de ensino`
          }
          onPress={() =>
            onRequestMarking({
              exam,
              request: exam.marking
                ? { acao: 'desmarcar', marcacao: exam.marking }
                : { acao: 'marcar' },
            })
          }
          style={({ pressed }) => [styles.markButton, pressed && styles.pressed]}>
          <Text style={styles.markButtonText}>{exam.marking ? 'Desfazer marcação' : 'Marcar'}</Text>
        </Pressable>
      )}
    </View>
  );
}
