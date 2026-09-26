import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useRouter } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import {
  registerProfessional,
  validateRegistration,
  type ProfessionalRepository,
  type RegistrationInput,
} from '@/features/auth/registration';
import { createRegisterStyles, getRegisterLayout } from '@/features/auth/register.styles';

type RegisterValues = {
  fullName: string;
  email: string;
  crm: string;
  cpf: string;
  password: string;
  confirmPassword: string;
};

const initialValues: RegisterValues = {
  fullName: '',
  email: '',
  crm: '',
  cpf: '',
  password: '',
  confirmPassword: '',
};

const fieldRows: {
  label: string;
  name: keyof RegisterValues;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words' | 'characters';
  autoComplete?: 'name' | 'email' | 'off' | 'new-password';
  textContentType?: 'name' | 'emailAddress' | 'newPassword';
  maxLength?: number;
}[][] = [
  [
    {
      label: 'NOME COMPLETO',
      name: 'fullName',
      placeholder: 'Ana Carolina Souza',
      autoCapitalize: 'words',
      autoComplete: 'name',
      textContentType: 'name',
    },
    {
      label: 'E-MAIL',
      name: 'email',
      placeholder: 'ana.souza@unieuro.com.br',
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      autoComplete: 'email',
      textContentType: 'emailAddress',
    },
  ],
  [
    {
      label: 'CRM',
      name: 'crm',
      placeholder: '12345/DF',
      autoCapitalize: 'characters',
      autoComplete: 'off',
      maxLength: 20,
    },
    {
      label: 'CPF',
      name: 'cpf',
      placeholder: '000.000.000-00',
      keyboardType: 'numeric',
      autoComplete: 'off',
      maxLength: 14,
    },
  ],
  [
    {
      label: 'SENHA',
      name: 'password',
      placeholder: '******',
      secureTextEntry: true,
      autoCapitalize: 'none',
      autoComplete: 'new-password',
      textContentType: 'newPassword',
    },
    {
      label: 'CONFIRMAR SENHA',
      name: 'confirmPassword',
      placeholder: '******',
      secureTextEntry: true,
      autoCapitalize: 'none',
      autoComplete: 'new-password',
      textContentType: 'newPassword',
    },
  ],
];

const toRegistrationInput = (formValues: RegisterValues): RegistrationInput => ({
  name: formValues.fullName,
  email: formValues.email,
  crm: formValues.crm,
  password: formValues.password,
  passwordConfirmation: formValues.confirmPassword,
});

const showFailure = (message: string) => Alert.alert('Cadastro não concluído', message);

type RegisterScreenProps = {
  repository?: ProfessionalRepository;
};

export default function RegisterScreen({ repository }: RegisterScreenProps) {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createRegisterStyles(theme), [theme]);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const width = viewport.width || windowWidth;
  const height = viewport.height || windowHeight;
  const layout = getRegisterLayout(width, height);
  const [values, setValues] = useState(initialValues);
  const [focusedField, setFocusedField] = useState<keyof RegisterValues | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateValue = (name: keyof RegisterValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const submitRegistration = async () => {
    if (values.cpf.trim().length === 0) return showFailure('Preencha todos os campos para continuar.');

    const validation = validateRegistration(toRegistrationInput(values));
    if (!validation.valid) return showFailure(validation.message);

    if (!repository) {
      Alert.alert('Cadastro', 'O cadastro será conectado ao banco de dados em uma próxima etapa.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerProfessional(validation.registration, repository);
      if (!result.success) return showFailure(result.message);

      Alert.alert('Cadastro concluído', 'Entre com o e-mail e a senha cadastrados.');
      router.replace('/');
    } catch {
      showFailure('Não foi possível salvar o cadastro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          onLayout={({ nativeEvent }) => {
            const { width: measuredWidth, height: measuredHeight } = nativeEvent.layout;
            setViewport((current) =>
              current.width === measuredWidth && current.height === measuredHeight
                ? current
                : { width: measuredWidth, height: measuredHeight },
            );
          }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: layout.horizontalInset,
              paddingVertical: height < 700 ? 16 : 24,
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <View
            style={[
              styles.card,
              {
                width: layout.cardWidth,
                maxWidth: layout.isTablet ? 720 : 506,
                paddingHorizontal: layout.cardHorizontalPadding,
                paddingVertical: layout.cardVerticalPadding,
                borderRadius: layout.isTablet ? 28 : 24,
              },
            ]}>
            <View
              style={[
                styles.logoPlaceholder,
                {
                  width: layout.logoSize,
                  height: layout.logoSize,
                  borderRadius: layout.isTablet ? 22 : 20,
                },
              ]}
              accessible
              accessibilityLabel="Espaco reservado para o logo">
              <Text style={styles.logoMark} accessibilityElementsHidden>
                M
              </Text>
            </View>

            <Text
              accessibilityRole="header"
              style={[styles.title, { fontSize: layout.titleFontSize }]}>
              CRIAR CONTA
            </Text>
            <Text style={styles.subtitle}>
              {'Cadastro do profissional de sa\u00fade que vai aplicar o teste.'}
            </Text>

            <View style={styles.form}>
              {fieldRows.map((row, rowIndex) => (
                <View
                  key={rowIndex}
                  style={[
                    styles.fieldRow,
                    layout.isTablet ? styles.fieldRowTablet : styles.fieldRowPhone,
                  ]}>
                  {row.map((field) => (
                    <View key={field.name} style={styles.field}>
                      <Text style={styles.label}>{field.label}</Text>
                      <TextInput
                        accessibilityLabel={field.label}
                        autoCapitalize={field.autoCapitalize ?? 'none'}
                        autoComplete={field.autoComplete}
                        keyboardType={field.keyboardType ?? 'default'}
                        maxLength={field.maxLength}
                        onBlur={() => setFocusedField(null)}
                        onChangeText={(value) => updateValue(field.name, value)}
                        onFocus={() => setFocusedField(field.name)}
                        placeholder={field.placeholder}
                        placeholderTextColor={theme.placeholder}
                        returnKeyType={rowIndex === fieldRows.length - 1 ? 'done' : 'next'}
                        secureTextEntry={field.secureTextEntry}
                        style={[
                          styles.input,
                          focusedField === field.name && styles.inputFocused,
                        ]}
                        textContentType={field.textContentType}
                        value={values[field.name]}
                      />
                    </View>
                  ))}
                </View>
              ))}

              <Pressable
                accessibilityLabel="CRIAR CONTA"
                accessibilityRole="button"
                accessibilityState={{ busy: submitting, disabled: submitting }}
                disabled={submitting}
                onPress={submitRegistration}
                style={({ pressed }) => [
                  styles.submitButton,
                  (pressed || submitting) && styles.pressed,
                ]}>
                {submitting ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>CRIAR CONTA</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backText}>
                {'J\u00e1 tenho conta? ENTRAR'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}