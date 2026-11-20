import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/features/auth/session';
import { createHomeStyles, WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import { createSettingsStyles } from '@/features/settings/settings.styles';
import { useSomenteSuperusuario } from '@/features/superusuario/acesso';
import { useTheme } from '@/hooks/use-theme';

export const TITULO_AREA = 'Área do superusuário';
export const SUBTITULO_AREA =
  'Gerencie as contas dos médicos e veja os exames de todos. Tudo funciona neste tablet, sem internet.';
export const PERFIL_SUPERUSUARIO = 'Superusuário';
export const BOTAO_EXAMES_DE_TODOS = 'Ver exames de todos';

type AreaSuperusuarioScreenProps = {
  /**
   * Contas dos médicos: listar, criar, desativar e redefinir a senha (#119, parte do Lucas).
   * A conta é desativada, nunca removida, e os exames dela ficam no tablet (cliente, 16/11).
   */
  children?: ReactNode;
};

/**
 * Área do superusuário (#119), protótipo 31: o lugar das funcionalidades exclusivas do
 * responsável pela pesquisa. Um médico comum não chega aqui, nem pela rota.
 */
export default function AreaSuperusuarioScreen({
  children,
}: Readonly<AreaSuperusuarioScreenProps>) {
  const router = useRouter();
  const { signOut } = useSession();
  const profissional = useSomenteSuperusuario();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const isWide = (measuredWidth || width) >= WIDE_LAYOUT_MIN_WIDTH;
  const home = useMemo(() => createHomeStyles(theme), [theme]);
  const settings = useMemo(() => createSettingsStyles(theme), [theme]);

  if (!profissional) return null;

  return (
    <SafeAreaView
      testID="area-superusuario"
      style={home.safeArea}
      onLayout={({ nativeEvent }) => setMeasuredWidth(nativeEvent.layout.width)}>
      <View style={[home.topBar, isWide && home.topBarWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início"
          onPress={() => router.back()}
          style={({ pressed }) => [settings.back, pressed && home.pressed]}>
          <Text style={settings.backText}>‹ Início</Text>
        </Pressable>
        <View style={home.account}>
          <View style={home.accountText}>
            <Text style={home.professionalName} numberOfLines={1}>
              {profissional.name}
            </Text>
            <Text style={home.professionalCrm}>{PERFIL_SUPERUSUARIO}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [home.outlineButton, pressed && home.pressed]}>
            <Text style={home.outlineButtonText}>Configurações</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            style={({ pressed }) => [home.textButton, pressed && home.pressed]}>
            <Text style={home.textButtonText}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[home.body, isWide && home.bodyWide]}>
        <View style={home.titleRow}>
          <View style={home.titleBlock}>
            <Text accessibilityRole="header" style={home.title}>
              {TITULO_AREA}
            </Text>
            <Text style={home.subtitle}>{SUBTITULO_AREA}</Text>
          </View>
        </View>

        <View style={home.toolbarActions}>
          {/* A tela inicial do superusuário já lista os pacientes de todos os médicos (#49). */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.dismissTo('/menu')}
            style={({ pressed }) => [home.outlineButton, pressed && home.pressed]}>
            <Text style={home.outlineButtonText}>{BOTAO_EXAMES_DE_TODOS}</Text>
          </Pressable>
        </View>

        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
