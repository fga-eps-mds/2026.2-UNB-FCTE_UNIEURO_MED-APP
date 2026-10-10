import { useMemo, useState } from 'react';
import {
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
import { createLoginStyles, getLoginLayout } from '@/features/auth/login.styles';
import { useTheme } from '@/hooks/use-theme';
import { FeedbackMessage } from '@/features/auth/feedback-message';
import { authenticate, type CredentialsRepository } from '@/features/auth/authentication';

type LoginScreenProps = { repository?: CredentialsRepository };

export default function LoginScreen({ repository }: LoginScreenProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const width = viewport.width || windowWidth;
  const height = viewport.height || windowHeight;
  const {
    isTablet,
    horizontalInset,
    cardWidth,
    cardHorizontalPadding,
    cardVerticalPadding,
    logoSize,
    titleFontSize,
  } = getLoginLayout(width, height);
  const theme = useTheme();
  const styles = useMemo(() => createLoginStyles(theme), [theme]);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'info'; message: string } | null>(
    null,
  );

  async function handleLogin() {
    if (loading) return;

    setFeedback(null);

    // Se não houver camada de acesso ao banco fornecida, a funcionalidade
    // de autenticação está pendente.
    if (!repository) {
      setFeedback({ kind: 'info', message: 'O acesso ainda não está disponível.' });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const errors = {
      email: trimmedEmail ? undefined : 'Preencha o e-mail.',
      password: password.length > 0 ? undefined : 'Preencha a senha.',
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      return;
    }

    try {
      setLoading(true);
      const result = await authenticate({ email, password }, repository);

      if (!result.success) {
        setFeedback({ kind: 'error', message: result.message });
        return;
      }

      router.replace('/menu');
    } catch {
      setFeedback({ kind: 'error', message: 'Não foi possível entrar. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

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
              paddingHorizontal: horizontalInset,
              paddingVertical: height < 700 ? 16 : 24,
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <View
            style={[
              styles.card,
              {
                width: cardWidth,
                maxWidth: isTablet ? 560 : 506,
                paddingHorizontal: cardHorizontalPadding,
                paddingVertical: cardVerticalPadding,
                borderRadius: isTablet ? 28 : 24,
              },
            ]}>
            <View
              style={[
                styles.logoPlaceholder,
                {
                  width: logoSize,
                  height: logoSize,
                  borderRadius: isTablet ? 26 : 22,
                },
              ]}
              accessible
              accessibilityLabel="Espaco reservado para o logo">
              <Text style={styles.logoMark} accessibilityElementsHidden>
                M
              </Text>
            </View>
            <Text accessibilityRole="header" style={[styles.title, { fontSize: titleFontSize }]}>
              MNEMA
            </Text>
            <Text style={styles.subtitle}>NOME PROVISORIO - RASTREIO COGNITIVO</Text>

            <View style={styles.form}>
              {feedback && (
                <View style={styles.feedback}>
                  <FeedbackMessage kind={feedback.kind} message={feedback.message} />
                </View>
              )}
              <Text nativeID="email-label" style={styles.label}>
                E-MAIL
              </Text>
              <TextInput
                accessibilityLabel="E-mail"
                accessibilityHint={fieldErrors.email}
                accessibilityLabelledBy={Platform.OS === 'android' ? 'email-label' : undefined}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onBlur={() => setFocused(null)}
                onFocus={() => setFocused('email')}
                onChangeText={(value) => {
                  setEmail(value);
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                  setFeedback(null);
                }}
                placeholder="nome@instituicao.br"
                placeholderTextColor={theme.placeholder}
                returnKeyType="next"
                style={[
                  styles.input,
                  focused === 'email' && styles.inputFocused,
                  fieldErrors.email && styles.inputError,
                ]}
                textContentType="emailAddress"
                value={email}
              />
              {fieldErrors.email && (
                <FeedbackMessage kind="error" inline message={fieldErrors.email} />
              )}

              <Text nativeID="password-label" style={[styles.label, styles.passwordLabel]}>
                SENHA
              </Text>
              <TextInput
                accessibilityLabel="Senha"
                accessibilityHint={fieldErrors.password}
                accessibilityLabelledBy={Platform.OS === 'android' ? 'password-label' : undefined}
                autoCapitalize="none"
                autoComplete="current-password"
                onBlur={() => setFocused(null)}
                onFocus={() => setFocused('password')}
                onChangeText={(value) => {
                  setPassword(value);
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                  setFeedback(null);
                }}
                placeholder="******"
                placeholderTextColor={theme.placeholder}
                secureTextEntry
                style={[
                  styles.input,
                  focused === 'password' && styles.inputFocused,
                  fieldErrors.password && styles.inputError,
                ]}
                textContentType="password"
                value={password}
              />
              {fieldErrors.password && (
                <FeedbackMessage kind="error" inline message={fieldErrors.password} />
              )}

              <Pressable
                accessibilityRole="button"
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}
                accessibilityState={{ busy: loading, disabled: loading }}>
                <Text style={styles.loginText}>{loading ? 'ENTRANDO...' : 'ENTRAR'}</Text>
              </Pressable>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setFeedback({
                      kind: 'info',
                      message: 'A recuperação de senha ainda não está disponível.',
                    })
                  }
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                  <Text style={styles.actionText}>ESQUECI MINHA SENHA</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/register')}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                  <Text style={styles.actionText}>CRIAR CONTA</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.footnote}>ACESSO RESTRITO A PROFISSIONAIS DE SAUDE</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
