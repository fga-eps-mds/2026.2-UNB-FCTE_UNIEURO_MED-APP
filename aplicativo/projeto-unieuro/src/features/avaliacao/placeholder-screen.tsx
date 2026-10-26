import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import { FeedbackMessage } from '@/features/auth/feedback-message';
import { returnToLogin, useSession } from '@/features/auth/session';
import { useTheme } from '@/hooks/use-theme';

export type PlaceholderAction = {
  label: string;
  onPress: () => void;
};

export type PlaceholderScreenProps = {
  title: string;
  message: string;
  /** Botão provisório extra, mostrado antes de "Voltar ao início". */
  action?: PlaceholderAction;
};

/**
 * Base das telas provisórias de histórias que ainda não existem (o termo, #21, e as
 * áreas de desenho). Mostra um título e um aviso de que a etapa está em construção,
 * oferece um botão provisório opcional e sempre leva de volta ao início. Sem médico
 * logado, volta ao login.
 */
export default function PlaceholderScreen({
  title,
  message,
  action,
}: Readonly<PlaceholderScreenProps>) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  const acoes: PlaceholderAction[] = [
    ...(action ? [action] : []),
    { label: 'Voltar ao início', onPress: () => router.replace('/menu') },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <FeedbackMessage kind="info" message={message} />
        {acoes.map((acao) => (
          <Pressable
            key={acao.label}
            accessibilityRole="button"
            onPress={acao.onPress}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>{acao.label}</Text>
          </Pressable>
        ))}
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
