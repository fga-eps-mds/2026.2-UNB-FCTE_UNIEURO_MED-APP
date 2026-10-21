import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import type { CredentialsRepository } from '@/features/auth/authentication';
import { FeedbackMessage } from '@/features/auth/feedback-message';
import { returnToLogin, useSession } from '@/features/auth/session';
import { confirmarProfissional } from '@/features/avaliacao/confirmacao-profissional';
import { useTheme } from '@/hooks/use-theme';

export const AGRADECIMENTO = 'Muito obrigado pela sua participação!';
export const ORIENTACAO = 'O teste terminou. Por favor, devolva o tablet ao profissional de saúde.';
export const BOTAO_PROFISSIONAL = 'Sou o profissional de saúde';

type TelaFinalScreenProps = {
  repository: CredentialsRepository;
};

/**
 * Tela final do paciente (#11). Mostra só o agradecimento, sem escore, faixa ou
 * resultado. Para sair dela, o profissional confirma a própria senha: o paciente
 * não chega à área do profissional nem ao resultado.
 */
export default function TelaFinalScreen({ repository }: TelaFinalScreenProps) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [confirmando, setConfirmando] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);

  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  function cancelar() {
    setConfirmando(false);
    setSenha('');
    setErro(null);
  }

  async function confirmar() {
    if (!professional || conferindo) return;
    setConferindo(true);
    const resultado = await confirmarProfissional(senha, professional, repository);
    setConferindo(false);
    if (resultado.confirmado) {
      router.replace('/menu');
      return;
    }
    setSenha('');
    setErro(resultado.mensagem);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {AGRADECIMENTO}
        </Text>
        <Text style={styles.body}>{ORIENTACAO}</Text>

        {!confirmando ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmando(true)}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>{BOTAO_PROFISSIONAL}</Text>
          </Pressable>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label} nativeID="senha-profissional">
              Senha do profissional
            </Text>
            <TextInput
              accessibilityLabel="Senha do profissional"
              accessibilityLabelledBy="senha-profissional"
              autoFocus
              onChangeText={(texto) => {
                setSenha(texto);
                setErro(null);
              }}
              onSubmitEditing={confirmar}
              secureTextEntry
              style={styles.input}
              value={senha}
            />
            {erro && <FeedbackMessage kind="error" message={erro} />}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={cancelar}
                style={({ pressed }) => [
                  styles.secondary,
                  styles.action,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.secondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: conferindo, disabled: conferindo }}
                disabled={conferindo}
                onPress={confirmar}
                style={({ pressed }) => [styles.primary, styles.action, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>{conferindo ? 'Conferindo...' : 'Confirmar'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  const button = {
    minHeight: 64,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    borderRadius: 16,
  };
  const buttonText = { fontFamily: FontFamilies.semibold, fontSize: 20, lineHeight: 26 };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      alignSelf: 'center',
      justifyContent: 'center',
      width: '100%',
      maxWidth: 720,
      paddingHorizontal: 24,
      gap: 24,
    },
    title: {
      color: colors.text,
      fontFamily: FontFamilies.bold,
      fontSize: 34,
      lineHeight: 42,
      textAlign: 'center',
    },
    body: {
      color: colors.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 22,
      lineHeight: 32,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      gap: 16,
    },
    label: {
      color: colors.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 16,
      lineHeight: 22,
    },
    input: {
      minHeight: 60,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.field,
      paddingHorizontal: 14,
      color: colors.text,
      fontFamily: FontFamilies.regular,
      fontSize: 18,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    action: { flexGrow: 1 },
    primary: { ...button, backgroundColor: colors.primary },
    primaryText: { ...buttonText, color: colors.onPrimary },
    secondary: {
      ...button,
      alignSelf: 'center',
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    secondaryText: { ...buttonText, color: colors.primary },
    pressed: { opacity: 0.85 },
  });
}
