import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamilies } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const shortcuts = [
  {
    title: 'Relatórios',
    description: 'Consulte os resultados das avaliações.',
    icon: '▤',
  },
  {
    title: 'Editar dados',
    description: 'Atualize seus dados profissionais.',
    icon: '✎',
  },
  {
    title: 'Configurações',
    description: 'Personalize suas preferências.',
    icon: '⚙',
  },
];

function showComingSoon(title: string) {
  Alert.alert(title, 'Esta seção está em desenvolvimento.');
}

export default function MainMenuScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.wideContent]}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: colors.primary }]}>
              <Text style={[styles.logoText, { color: colors.onPrimary }]}>M</Text>
            </View>
            <View>
              <Text style={[styles.brandName, { color: colors.text }]}>MNEMA</Text>
              <Text style={[styles.brandCaption, { color: colors.textSecondary }]}>RASTREAMENTO COGNITIVO</Text>
            </View>
          </View>
          <Text style={[styles.role, { color: colors.textSecondary }]}>Área do profissional</Text>
        </View>

        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <Text style={styles.eyebrow}>BEM-VINDO(A)</Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>Vamos começar?</Text>
          <Text style={styles.heroDescription}>
            Inicie uma nova avaliação cognitiva com seu paciente.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => showComingSoon('Realizar novo teste')}
            style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
            <Text style={[styles.primaryActionText, { color: colors.primary }]}>Realizar novo teste</Text>
            <Text style={[styles.primaryActionArrow, { color: colors.primary }]} accessibilityElementsHidden>
              →
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Acesso rápido</Text>
          <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>O que você deseja fazer?</Text>
        </View>

        <View style={[styles.shortcutGrid, isWide && styles.shortcutGridWide]}>
          {shortcuts.map((shortcut) => (
            <Pressable
              key={shortcut.title}
              accessibilityRole="button"
              accessibilityLabel={`${shortcut.title}. ${shortcut.description}`}
              onPress={() => showComingSoon(shortcut.title)}
              style={({ pressed }) => [
                styles.shortcutCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isWide && styles.shortcutCardWide,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.shortcutIcon, { backgroundColor: colors.field }]}>
                <Text style={[styles.shortcutIconText, { color: colors.primary }]} accessibilityElementsHidden>
                  {shortcut.icon}
                </Text>
              </View>
              <View style={styles.shortcutCopy}>
                <Text style={[styles.shortcutTitle, { color: colors.text }]}>{shortcut.title}</Text>
                <Text style={[styles.shortcutDescription, { color: colors.textSecondary }]}>
                  {shortcut.description}
                </Text>
              </View>
              <Text style={[styles.shortcutArrow, { color: colors.primary }]} accessibilityElementsHidden>
                ›
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 24,
  },
  wideContent: { paddingHorizontal: 40, paddingTop: 32, gap: 28 },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: FontFamilies.bold, fontSize: 23, fontWeight: '700' },
  brandName: { fontFamily: FontFamilies.bold, fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  brandCaption: { marginTop: 2, fontFamily: FontFamilies.semibold, fontSize: 9, fontWeight: '600', letterSpacing: 0.7 },
  role: { fontFamily: FontFamilies.semibold, fontSize: 14, fontWeight: '600' },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    padding: 26,
    paddingTop: 30,
    minHeight: 270,
    justifyContent: 'center',
  },
  eyebrow: { color: '#FDE8D7', fontFamily: FontFamilies.semibold, fontSize: 12, fontWeight: '600', letterSpacing: 1.2 },
  heroTitle: {
    maxWidth: 600,
    marginTop: 8,
    color: '#FFFFFF',
    fontFamily: FontFamilies.bold,
    fontSize: 32,
    fontWeight: '700',
  },
  heroDescription: {
    maxWidth: 460,
    marginTop: 8,
    color: '#FFF7F2',
    fontFamily: FontFamilies.regular,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  primaryAction: {
    minHeight: 52,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 20,
    paddingHorizontal: 18,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  primaryActionText: { fontFamily: FontFamilies.semibold, fontSize: 15, fontWeight: '600' },
  primaryActionArrow: { fontFamily: FontFamilies.semibold, fontSize: 20, fontWeight: '600' },
  sectionHeader: { gap: 4 },
  sectionTitle: { fontFamily: FontFamilies.bold, fontSize: 21, fontWeight: '700' },
  sectionCaption: { fontFamily: FontFamilies.regular, fontSize: 14, fontWeight: '400' },
  shortcutGrid: { gap: 12 },
  shortcutGridWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  shortcutCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderRadius: 22,
    boxShadow: '0px 6px 16px rgba(15, 23, 42, 0.05)',
  },
  shortcutCardWide: { width: '48%', flexGrow: 1 },
  shortcutIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  shortcutIconText: { fontSize: 23, fontWeight: '600' },
  shortcutCopy: { flex: 1, gap: 4 },
  shortcutTitle: { fontFamily: FontFamilies.semibold, fontSize: 16, fontWeight: '600' },
  shortcutDescription: { fontFamily: FontFamilies.regular, fontSize: 13, fontWeight: '400', lineHeight: 19 },
  shortcutArrow: { fontFamily: FontFamilies.regular, fontSize: 28, fontWeight: '400' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});