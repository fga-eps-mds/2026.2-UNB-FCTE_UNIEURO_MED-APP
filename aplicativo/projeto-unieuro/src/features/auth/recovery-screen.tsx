import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import {
  recoverPassword,
  type PasswordRecoveryInput,
  type PasswordRecoveryRepository,
  type RecoveryAttemptsStore,
  type RecoveryErrors,
} from '@/features/auth/password-recovery';
import { createRegisterStyles, getRegisterLayout } from '@/features/auth/register.styles';
import { formatCpfInput } from '@/features/shared/cpf';
import { useTheme } from '@/hooks/use-theme';

type Props = { repository: PasswordRecoveryRepository; attemptsStore: RecoveryAttemptsStore };
const initialValues: PasswordRecoveryInput = {
  cpf: '',
  crm: '',
  newPassword: '',
  confirmation: '',
};
const rows = [
  [
    { name: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
    { name: 'crm', label: 'CRM COM UF', placeholder: '12345/DF' },
  ],
  [
    { name: 'newPassword', label: 'NOVA SENHA', placeholder: 'Pelo menos 8 caracteres' },
    { name: 'confirmation', label: 'CONFIRMAR NOVA SENHA', placeholder: 'Repita a nova senha' },
  ],
] as const;

export default function RecoveryScreen({ repository, attemptsStore }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createRegisterStyles(theme), [theme]);
  const { width, height } = useWindowDimensions();
  const layout = getRegisterLayout(width, height);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<RecoveryErrors>({});
  const [focused, setFocused] = useState<keyof PasswordRecoveryInput | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit() {
    if (submitting || completed) return;
    setSubmitting(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await recoverPassword(values, repository, attemptsStore);
      if (result.success) {
        Keyboard.dismiss();
        setValues(initialValues);
        setCompleted(true);
      } else if (result.reason === 'invalid-fields') {
        setErrors(result.errors);
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage('Não foi possível recuperar a senha. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: layout.horizontalInset, paddingVertical: 24 },
          ]}>
          <View
            style={[
              styles.card,
              {
                width: layout.cardWidth,
                paddingHorizontal: layout.cardHorizontalPadding,
                paddingVertical: layout.cardVerticalPadding,
                borderRadius: 24,
              },
            ]}>
            <View
              style={[
                styles.logoPlaceholder,
                { width: layout.logoSize, height: layout.logoSize, borderRadius: 22 },
              ]}
              accessible
              accessibilityLabel="Espaço reservado para o logo">
              <Text style={styles.logoMark} accessibilityElementsHidden>
                M
              </Text>
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.title, { fontSize: layout.titleFontSize }]}>
              RECUPERAR SENHA
            </Text>
            <Text style={styles.subtitle}>
              Informe os dados do seu cadastro e crie uma nova senha. A recuperação funciona sem
              internet.
            </Text>
            {completed ? (
              <FeedbackMessage kind="success" message="Senha alterada. Entre com sua nova senha." />
            ) : (
              <View style={styles.form}>
                {message && <FeedbackMessage kind="error" message={message} />}
                {rows.map((row, index) => (
                  <View
                    key={index}
                    style={[
                      styles.fieldRow,
                      layout.isTablet ? styles.fieldRowTablet : styles.fieldRowPhone,
                    ]}>
                    {row.map((field) => {
                      const secure = field.name === 'newPassword' || field.name === 'confirmation';
                      return (
                        <View key={field.name} style={styles.field}>
                          <Text style={styles.label}>{field.label}</Text>
                          <TextInput
                            accessibilityLabel={field.label}
                            accessibilityHint={errors[field.name]}
                            autoCapitalize={field.name === 'crm' ? 'characters' : 'none'}
                            autoComplete={secure ? 'new-password' : 'off'}
                            keyboardType={field.name === 'cpf' ? 'numeric' : 'default'}
                            maxLength={
                              field.name === 'cpf' ? 14 : field.name === 'crm' ? 20 : undefined
                            }
                            onBlur={() => setFocused(null)}
                            onFocus={() => setFocused(field.name)}
                            onChangeText={(value) => {
                              setValues((current) => ({
                                ...current,
                                [field.name]: field.name === 'cpf' ? formatCpfInput(value) : value,
                              }));
                              setErrors((current) => ({ ...current, [field.name]: undefined }));
                              setMessage(null);
                            }}
                            placeholder={field.placeholder}
                            placeholderTextColor={theme.placeholder}
                            secureTextEntry={secure}
                            style={[
                              styles.input,
                              focused === field.name && styles.inputFocused,
                              errors[field.name] && styles.inputError,
                            ]}
                            value={values[field.name]}
                          />
                          {errors[field.name] && (
                            <FeedbackMessage kind="error" inline message={errors[field.name]!} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="SALVAR NOVA SENHA"
                  accessibilityState={{ busy: submitting, disabled: submitting }}
                  disabled={submitting}
                  onPress={submit}
                  style={({ pressed }) => [
                    styles.submitButton,
                    (pressed || submitting) && styles.pressed,
                  ]}>
                  {submitting ? (
                    <ActivityIndicator color={theme.onPrimary} />
                  ) : (
                    <Text style={styles.submitText}>SALVAR NOVA SENHA</Text>
                  )}
                </Pressable>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backText}>VOLTAR PARA O LOGIN</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
