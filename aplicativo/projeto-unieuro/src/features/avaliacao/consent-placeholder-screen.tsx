import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import { FeedbackMessage } from '@/features/auth/feedback-message';
import { returnToLogin, useSession } from '@/features/auth/session';
import { valorDoParametro, type ParametroDeRota } from '@/features/avaliacao/tarefas';
import { useTheme } from '@/hooks/use-theme';

export const CONSENT_PENDING_MESSAGE =
  'Atendimento registrado. A apresentação e o aceite do termo de consentimento ainda estão em construção.';

/**
 * Destino provisório do registro do atendimento (#7). A tela do termo de
 * consentimento é a história #21. Até ela existir, esta tela confirma que o
 * atendimento foi gravado e leva de volta ao início. Também oferece o botão
 * provisório "Iniciar as tarefas", que abre a instrução da tarefa 1 (#8) para o
 * atendimento recebido; a #21 passa a abri-la depois do aceite do termo.
 */
export default function ConsentPlaceholderScreen({
  atendimento,
}: {
  atendimento?: ParametroDeRota;
}) {
  const router = useRouter();
  const atendimentoId = valorDoParametro(atendimento);
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Termo de consentimento
        </Text>
        <FeedbackMessage kind="info" message={CONSENT_PENDING_MESSAGE} />
        {atendimentoId && (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: '/instrucao',
                params: { atendimento: atendimentoId, tarefa: '1' },
              })
            }
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Iniciar as tarefas</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/menu')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Voltar ao início</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
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
    },
    button: {
      alignSelf: 'flex-start',
      minHeight: 64,
      justifyContent: 'center',
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: colors.onPrimary,
      fontFamily: FontFamilies.semibold,
      fontSize: 20,
      lineHeight: 26,
    },
    pressed: { opacity: 0.85 },
  });
}
