import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import { FeedbackMessage } from '@/features/auth/feedback-message';
import { returnToLogin, useSession } from '@/features/auth/session';
import { useTheme } from '@/hooks/use-theme';

export const DRAWING_PENDING_MESSAGE = 'A área de desenho desta tarefa ainda está em construção.';

/**
 * Destino provisório do botão "Começar" da instrução (#8). As telas de desenho de
 * cada tarefa são histórias à parte. Até elas existirem, esta tela avisa que o
 * desenho ainda não está pronto e leva de volta ao início.
 */
export default function DrawingPlaceholderScreen() {
  const router = useRouter();
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
          Área de desenho
        </Text>
        <FeedbackMessage kind="info" message={DRAWING_PENDING_MESSAGE} />
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
