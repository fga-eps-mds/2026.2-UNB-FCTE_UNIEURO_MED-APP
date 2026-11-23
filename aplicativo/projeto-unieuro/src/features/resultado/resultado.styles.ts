import { StyleSheet } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';

/** Altura da imagem de cada desenho no cartão. A imagem se ajusta sem distorcer. */
export const ALTURA_DESENHO = 260;

/**
 * Cores de "puxou para CCL" e "puxou para sem CCL", iguais no mapa, na legenda e na barra de peso.
 * São mais vivas que as do tema porque a mancha do mapa é translúcida e desfocada e perderia a cor
 * sobre o fundo branco.
 */
export const COR_PUXA_CCL = '#DC2626';
export const COR_PUXA_SEM_CCL = '#2563EB';

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
    // O PNG do desenho tem fundo branco; a caixa branca não deixa faixas dos lados da imagem.
    imagem: {
      width: '100%',
      height: ALTURA_DESENHO,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderDecorative,
      overflow: 'hidden',
      backgroundColor: '#ffffff',
    },
    imagemCheia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendaCor: { width: 16, height: 16, borderRadius: 4 },
    legendaTexto: { ...corpo, fontSize: 16, lineHeight: 22, color: theme.text },
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
    modelo: { gap: 16 },
    faixaDiagnostico: { padding: 14, borderRadius: 14, backgroundColor: theme.errorBg },
    faixaDiagnosticoTexto: {
      ...corpo,
      color: theme.error,
      fontFamily: FontFamilies.bold,
      textAlign: 'center',
    },
    escore: { gap: 4 },
    escoreRotulo: rotulo,
    escoreValor: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 56, lineHeight: 64 },
    escoreClasse: { ...corpo, color: theme.text, fontFamily: FontFamilies.semibold },
    rodape: { ...corpo, fontSize: 16, lineHeight: 22, color: theme.textSecondary },
    botao: {
      alignSelf: 'flex-start',
      minHeight: 56,
      paddingHorizontal: 28,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
    },
    botaoTexto: { color: theme.onPrimary, fontFamily: FontFamilies.semibold, fontSize: 18 },
    influencia: { gap: 8 },
    influenciaTitulo: rotulo,
    barra: { height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: theme.field },
    barraValor: { height: '100%', borderRadius: 6 },
    barraCcl: { backgroundColor: COR_PUXA_CCL },
    barraSemCcl: { backgroundColor: COR_PUXA_SEM_CCL },
    influenciaTexto: { ...corpo, fontSize: 16, lineHeight: 22, color: theme.text },
    estado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    estadoTexto: { ...corpo, color: theme.textSecondary, textAlign: 'center' },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 8,
    },
    exportButton: {
      minHeight: 48,
      paddingHorizontal: 24,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.primary,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exportButtonText: {
      color: theme.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 16,
    },
    pressed: { opacity: 0.82 },
  });
}

export type ResultadoStyles = ReturnType<typeof createResultadoStyles>;
