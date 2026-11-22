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
import { getRegisterLayout } from '@/features/auth/register.styles';
import { createRecoveryStyles } from '@/features/auth/recovery.styles';
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
    { name: 'newPassword', label: 'NOVA SENHA', placeholder: '••••••••' },
    { name: 'confirmation', label: 'CONFIRMAR NOVA SENHA', placeholder: '••••••••' },
  ],
] as const;

export default function RecoveryScreen({ repository, attemptsStore }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createRecoveryStyles(theme), [theme]);
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
            <Text
              accessibilityRole="header"
              style={[styles.title, { fontSize: layout.titleFontSize }]}>
              Criar uma nova senha
            </Text>
            <Text style={styles.subtitle}>
              Sem internet, a sua identidade é confirmada pelos dados do seu cadastro. A senha
              antiga não é mostrada em nenhum momento.
            </Text>
            {completed ? (
              <FeedbackMessage kind="success" message="Senha alterada. Entre com sua nova senha." />
            ) : (
              <View style={styles.form}>
                {message && (
                  <View
                    accessible
                    accessibilityRole="alert"
                    accessibilityLabel={`Erro. ${message}`}
                    style={styles.banner}>
                    <Text style={styles.bannerText}>{message}</Text>
                  </View>
                )}
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
                            <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>
                              {errors[field.name]}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
                <Text style={styles.help}>
                  {errors.newPassword
                    ? 'A senha ainda não mudou.'
                    : 'A nova senha precisa ter pelo menos 8 caracteres, como no cadastro.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Criar nova senha"
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
                    <Text style={styles.submitText}>Criar nova senha</Text>
                  )}
                </Pressable>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backText}>Voltar para o login</Text>
            </Pressable>
            <Text style={styles.help}>Tudo acontece no tablet, sem internet.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
