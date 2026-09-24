import { useMemo, useState } from 'react';
import {
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
import { createLoginStyles, getLoginLayout } from '@/features/auth/login.styles';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
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

  const showPending = (action: string) =>
    Alert.alert(action, 'Esta funcionalidade sera conectada em uma proxima etapa.');

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
              <Text style={styles.logoMark} accessibilityElementsHidden>M</Text>
            </View>
            <Text accessibilityRole="header" style={[styles.title, { fontSize: titleFontSize }]}>MNEMA</Text>
            <Text style={styles.subtitle}>NOME PROVISORIO - RASTREIO COGNITIVO</Text>

            <View style={styles.form}>
              <Text nativeID="email-label" style={styles.label}>E-MAIL</Text>
              <TextInput
                accessibilityLabel="E-mail"
                accessibilityLabelledBy={Platform.OS === 'android' ? 'email-label' : undefined}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onBlur={() => setFocused(null)}
                onFocus={() => setFocused('email')}
                onChangeText={setEmail}
                placeholder="nome@instituicao.br"
                placeholderTextColor={theme.placeholder}
                returnKeyType="next"
                style={[styles.input, focused === 'email' && styles.inputFocused]}
                textContentType="emailAddress"
                value={email}
              />

              <Text nativeID="password-label" style={[styles.label, styles.passwordLabel]}>SENHA</Text>
              <TextInput
                accessibilityLabel="Senha"
                accessibilityLabelledBy={Platform.OS === 'android' ? 'password-label' : undefined}
                autoCapitalize="none"
                autoComplete="current-password"
                onBlur={() => setFocused(null)}
                onFocus={() => setFocused('password')}
                onChangeText={setPassword}
                placeholder="******"
                placeholderTextColor={theme.placeholder}
                secureTextEntry
                style={[styles.input, focused === 'password' && styles.inputFocused]}
                textContentType="password"
                value={password}
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => showPending('Entrar')}
                style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}>
                <Text style={styles.loginText}>ENTRAR</Text>
              </Pressable>

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => showPending('Esqueci minha senha')}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                  <Text style={styles.actionText}>ESQUECI MINHA SENHA</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => showPending('Criar conta')}
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


