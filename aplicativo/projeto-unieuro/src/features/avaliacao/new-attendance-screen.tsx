import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  registerAttendance,
  type NewAttendanceScreenProps,
  type PatientErrors,
  type PatientField,
  type PatientForm,
  type Sex,
} from '@/features/avaliacao/attendance';
import { formatCpfInput, formatDateInput } from '@/features/avaliacao/masks';
import {
  createNewAttendanceStyles,
  getNewAttendanceLayout,
  type NewAttendanceStyles,
} from '@/features/avaliacao/new-attendance.styles';
import {
  formatCrm,
  returnToLogin,
  useSession,
  type SessionProfessional,
} from '@/features/auth/session';
import { useTheme } from '@/hooks/use-theme';

type TextField = Exclude<PatientField, 'sex'>;

type TextFieldConfig = {
  name: TextField;
  label: string;
  placeholder: string;
  numeric?: boolean;
  autoCapitalize?: 'none' | 'words';
  maxLength?: number;
  // Formata o texto a cada digitação, como a máscara do CPF e da data.
  mask?: (text: string) => string;
};

const initialForm: PatientForm = {
  name: '',
  cpf: '',
  recordNumber: '',
  birthDate: '',
  schooling: '',
  sex: null,
};

const identificationFields: TextFieldConfig[] = [
  {
    name: 'name',
    label: 'Nome completo',
    placeholder: 'Nome do paciente',
    autoCapitalize: 'words',
  },
  {
    name: 'cpf',
    label: 'CPF',
    placeholder: '000.000.000-00',
    numeric: true,
    maxLength: 14,
    mask: formatCpfInput,
  },
  { name: 'recordNumber', label: 'Número da ficha', placeholder: 'Ex.: 2026-0184' },
];

const profileFields: TextFieldConfig[] = [
  {
    name: 'birthDate',
    label: 'Data de nascimento',
    placeholder: 'DD/MM/AAAA',
    numeric: true,
    maxLength: 10,
    mask: formatDateInput,
  },
  {
    name: 'schooling',
    label: 'Escolaridade (anos)',
    placeholder: 'Ex.: 5',
    numeric: true,
    maxLength: 2,
  },
];

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
];

const SUBMIT_LABEL = 'Ir para o termo de consentimento';

const sexLabel = (sex: Sex | null) => SEX_OPTIONS.find((option) => option.value === sex)?.label;

const describeProfessional = (professional: SessionProfessional, separator: string) =>
  [professional.name, `CRM ${formatCrm(professional)}`, professional.email].join(separator);

// o médico informa os dados do paciente e avisa a rota pelo `onRegistered`.

export default function NewAttendanceScreen({
  repository,
  onRegistered,
}: NewAttendanceScreenProps) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createNewAttendanceStyles(theme), [theme]);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const layout = getNewAttendanceLayout(
    viewport.width || windowWidth,
    viewport.height || windowHeight,
  );
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<PatientErrors>({});
  const [focusedField, setFocusedField] = useState<TextField | null>(null);
  const [pickingSex, setPickingSex] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Sem médico autenticado não há a quem vincular o atendimento.
  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  const updateField = (field: PatientField, value: PatientForm[PatientField]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await registerAttendance(form, {
        repository,
        professionalId: professional.id,
      });
      if (!result.success) {
        setErrors(result.errors);
        return;
      }
      onRegistered(result.attendanceId);
    } catch {
      Alert.alert(
        'Atendimento não registrado',
        'Não foi possível salvar o atendimento. Tente novamente.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const rowStyle = [styles.fieldRow, layout.isWide ? styles.fieldRowWide : styles.fieldRowNarrow];

  const renderTextField = (field: TextFieldConfig) => (
    <FieldBox
      key={field.name}
      name={field.name}
      label={field.label}
      error={errors[field.name]}
      styles={styles}
      style={layout.isWide && (field.name === 'name' ? styles.fieldWideName : styles.fieldWide)}>
      <TextInput
        accessibilityLabel={field.label}
        autoCapitalize={field.autoCapitalize ?? 'none'}
        autoComplete="off"
        autoCorrect={false}
        // Dado de paciente não vai para o serviço de preenchimento automático.
        importantForAutofill="no"
        keyboardType={field.numeric ? 'number-pad' : 'default'}
        maxLength={field.maxLength}
        onBlur={() => setFocusedField(null)}
        onChangeText={(text) => updateField(field.name, field.mask ? field.mask(text) : text)}
        onFocus={() => setFocusedField(field.name)}
        placeholder={field.placeholder}
        placeholderTextColor={theme.placeholder}
        style={[
          styles.input,
          focusedField === field.name && styles.inputFocused,
          errors[field.name] && styles.inputInvalid,
        ]}
        value={form[field.name]}
      />
    </FieldBox>
  );

  const selectedSex = sexLabel(form.sex);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          onLayout={({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            setViewport((current) =>
              current.width === width && current.height === height ? current : { width, height },
            );
          }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: layout.horizontalInset, paddingVertical: layout.verticalInset },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.content, { width: layout.contentWidth }]}>
            <View style={styles.header}>
              <Text
                accessibilityRole="header"
                style={[
                  styles.title,
                  { fontSize: layout.titleFontSize, lineHeight: layout.titleFontSize + 8 },
                ]}>
                Novo exame
              </Text>
              <Text style={styles.subtitle}>
                Preencha os dados do paciente para iniciar a avaliação.
              </Text>
            </View>

            <View style={[styles.card, { padding: layout.cardPadding }]}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Dados do paciente
              </Text>

              <View testID="linha-identificacao" style={rowStyle}>
                {identificationFields.map(renderTextField)}
              </View>

              <View testID="linha-perfil" style={rowStyle}>
                {profileFields.map(renderTextField)}
                <FieldBox
                  name="sex"
                  label="Sexo"
                  error={errors.sex}
                  styles={styles}
                  style={layout.isWide && styles.fieldWide}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sexo"
                    accessibilityValue={{ text: selectedSex ?? 'Não informado' }}
                    accessibilityHint="Abre as opções Feminino e Masculino."
                    onPress={() => setPickingSex(true)}
                    style={({ pressed }) => [
                      styles.select,
                      errors.sex && styles.inputInvalid,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.selectText, !selectedSex && styles.selectPlaceholder]}>
                      {selectedSex ?? 'Selecionar'}
                    </Text>
                    <Text style={styles.selectChevron} accessibilityElementsHidden>
                      ▾
                    </Text>
                  </Pressable>
                </FieldBox>
              </View>

              <View style={[styles.professional, layout.isWide && styles.professionalWide]}>
                <Text style={styles.label}>Profissional responsável</Text>
                <Text
                  accessibilityLabel={describeProfessional(professional, ', ')}
                  style={styles.professionalText}>
                  {describeProfessional(professional, ' · ')}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityLabel={SUBMIT_LABEL}
              accessibilityRole="button"
              accessibilityState={{ busy: submitting, disabled: submitting }}
              disabled={submitting}
              onPress={submit}
              style={({ pressed }) => [
                styles.submitButton,
                layout.isWide ? styles.submitButtonWide : styles.submitButtonNarrow,
                (pressed || submitting) && styles.pressed,
              ]}>
              {submitting ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={styles.submitText}>{SUBMIT_LABEL}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SexPicker
        visible={pickingSex}
        selected={form.sex}
        styles={styles}
        onClose={() => setPickingSex(false)}
        onSelect={(sex) => {
          updateField('sex', sex);
          setPickingSex(false);
        }}
      />
    </SafeAreaView>
  );
}

type FieldBoxProps = {
  name: PatientField;
  label: string;
  error?: string;
  styles: NewAttendanceStyles;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
};

function FieldBox({ name, label, error, styles, style, children }: FieldBoxProps) {
  return (
    <View testID={`campo-${name}`} style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type SexPickerProps = {
  visible: boolean;
  selected: Sex | null;
  styles: NewAttendanceStyles;
  onClose: () => void;
  onSelect: (sex: Sex) => void;
};

function SexPicker({ visible, selected, styles, onClose, onSelect }: SexPickerProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text accessibilityRole="header" style={styles.modalTitle}>
            Sexo do paciente
          </Text>
          {SEX_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: option.value === selected }}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.option,
                option.value === selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.optionText}>{option.label}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
