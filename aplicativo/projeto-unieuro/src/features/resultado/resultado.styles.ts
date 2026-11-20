import { StyleSheet } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';

/** Altura da imagem de cada desenho no cartão. A imagem se ajusta sem distorcer. */
export const ALTURA_DESENHO = 260;

/** Estilos da tela de resultado do exame (#14), uma tela do médico. */
export function createResultadoStyles(theme: ThemeColors) {
  const rotulo = {
    color: theme.textSecondary,
    fontFamily: FontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.64,
  };
  const corpo = { fontFamily: FontFamilies.regular, fontSize: 18, lineHeight: 26 };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    topBarWide: { paddingHorizontal: 40 },
    back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
    backText: { color: theme.primary, fontFamily: FontFamilies.semibold, fontSize: 18 },
    content: { gap: 24, padding: 24, paddingBottom: 48 },
    contentWide: { paddingHorizontal: 40, paddingTop: 32 },
    titulo: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 34, lineHeight: 42 },
    cabecalho: { gap: 6 },
    paciente: { ...corpo, color: theme.text, fontFamily: FontFamilies.semibold },
    detalhe: { ...corpo, color: theme.textSecondary },
    card: { gap: 16, padding: 28, borderRadius: 24, backgroundColor: theme.surface },
    cardTitulo: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    aviso: { ...corpo, color: theme.textSecondary },
    desenhos: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
    desenho: {
      flexGrow: 1,
      flexBasis: 280,
      gap: 12,
      padding: 20,
      borderRadius: 24,
      backgroundColor: theme.surface,
    },
    desenhoTitulo: rotulo,
    imagem: {
      width: '100%',
      height: ALTURA_DESENHO,
      borderRadius: 12,
      backgroundColor: theme.field,
    },
    semDesenho: {
      height: ALTURA_DESENHO,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
    },
    semDesenhoTexto: { ...corpo, color: theme.textSecondary, textAlign: 'center' },
    estado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    estadoTexto: { ...corpo, color: theme.textSecondary, textAlign: 'center' },
    pressed: { opacity: 0.82 },
  });
}

export type ResultadoStyles = ReturnType<typeof createResultadoStyles>;
