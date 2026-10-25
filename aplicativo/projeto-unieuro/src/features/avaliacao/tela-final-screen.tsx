import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import type { CredentialsRepository } from '@/features/auth/authentication';
import { FeedbackMessage } from '@/features/auth/feedback-message';
import { returnToLogin, useSession } from '@/features/auth/session';
import { confirmarProfissional } from '@/features/avaliacao/confirmacao-profissional';
import { CORES_DA_TAREFA, FUNDO_ACOLHEDOR } from '@/features/avaliacao/drawing-task.styles';
import { useSemVoltar } from '@/features/avaliacao/use-sem-voltar';

export const AGRADECIMENTO = 'Muito obrigado pela sua participação!';
export const ORIENTACAO = 'O teste terminou. Por favor, devolva o tablet ao profissional de saúde.';
export const BOTAO_PROFISSIONAL = 'Sou o profissional de saúde';
export const FALHA_NA_CONFERENCIA = 'Não foi possível conferir a senha agora. Tente novamente.';

type TelaFinalScreenProps = {
  repository: CredentialsRepository;
};

/**
 * Tela final do paciente (#11). Mostra só o agradecimento, sem escore, faixa ou
 * resultado. Para sair dela, o profissional confirma a própria senha: o paciente
 * não chega à área do profissional nem ao resultado. O voltar do Android não sai
 * da tela, como nas tarefas, e a tela é sempre clara, como as outras do paciente.
 */
export default function TelaFinalScreen({ repository }: Readonly<TelaFinalScreenProps>) {
  const router = useRouter();
  const { professional } = useSession();
  const [confirmando, setConfirmando] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  useSemVoltar();

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
    try {
      setConferindo(true);
      const resultado = await confirmarProfissional(senha, professional, repository);
      if (resultado.confirmado) {
        // Volta à tela inicial que já está embaixo na pilha, sem abrir outra.
        router.dismissTo('/menu');
        return;
      }
      setSenha('');
      setErro(resultado.mensagem);
    } catch {
      // Falha do banco: avisa e libera o botão, para o profissional não ficar preso.
      setErro(FALHA_NA_CONFERENCIA);
    } finally {
      setConferindo(false);
    }
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

const styles = createStyles(CORES_DA_TAREFA);

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
    safeArea: { flex: 1, backgroundColor: FUNDO_ACOLHEDOR },
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
