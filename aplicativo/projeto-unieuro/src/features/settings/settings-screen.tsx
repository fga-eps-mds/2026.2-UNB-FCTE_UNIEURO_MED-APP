import Constants from 'expo-constants';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { formatCrm, returnToLogin, useSession } from '@/features/auth/session';
import { WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import { createSettingsStyles, type SettingsStyles } from '@/features/settings/settings.styles';
import { useTheme } from '@/hooks/use-theme';

/**
 * Configurações do profissional, aberta pela tela inicial (#46): os dados da
 * conta, a versão do aplicativo e a saída da sessão.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { professional, signOut } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createSettingsStyles(theme), [theme]);
  const isWide = useWindowDimensions().width >= WIDE_LAYOUT_MIN_WIDTH;

  // Como na tela inicial: sem sessão, inclusive depois de "Sair", volta ao login.
  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  const version = Constants.expoConfig?.version;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topBar, isWide && styles.topBarWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para o início"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Início</Text>
        </Pressable>
        <View style={styles.accountText}>
          <Text style={styles.professionalName}>{professional.name}</Text>
          <Text style={styles.label}>CRM {formatCrm(professional)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <Text accessibilityRole="header" style={styles.title}>
          Configurações
        </Text>
        <View style={styles.grid}>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Meus dados
            </Text>
            <Field styles={styles} label="NOME" value={professional.name} />
            <Field styles={styles} label="E-MAIL" value={professional.email} />
            <Field styles={styles} label="CRM" value={formatCrm(professional)} />
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Sobre o aplicativo
            </Text>
            {version ? <Text style={styles.value}>Versão {version}</Text> : null}
            <Text style={styles.description}>
              Funciona sem internet. Os dados ficam só neste tablet.
            </Text>
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              Sessão
            </Text>
            <Field styles={styles} label="CONTA EM USO" value={professional.name} />
            <Pressable
              accessibilityRole="button"
              onPress={signOut}
              style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}>
              <Text style={styles.dangerButtonText}>Sair do aplicativo</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ styles, label, value }: { styles: SettingsStyles; label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
