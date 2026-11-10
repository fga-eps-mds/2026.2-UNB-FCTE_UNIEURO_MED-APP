import { StyleSheet } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import { DESABILITADO, LARANJA_ESCURO } from '@/features/avaliacao/drawing-task.styles';

export const ALTURA_AREA_ASSINATURA = 160;

export function createDecisaoStyles(colors: ThemeColors) {
  const botao = {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 16,
  } as const;

  return StyleSheet.create({
    raiz: { gap: 16 },
    areaAssinatura: { gap: 8 },
    quadroAssinatura: { height: ALTURA_AREA_ASSINATURA },
    botaoLimpar: {
      minHeight: 48,
      alignSelf: 'flex-end',
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    botaoLimparDesabilitado: {
      borderColor: DESABILITADO.fundo,
      backgroundColor: DESABILITADO.fundo,
    },
    botaoLimparTexto: {
      color: colors.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 18,
      lineHeight: 24,
    },
    botaoLimparTextoDesabilitado: { color: DESABILITADO.texto },
    // Moldura pontilhada do protótipo, no lugar da borda contínua do quadro.
    molduraAssinatura: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.textSecondary,
      borderRadius: 16,
      boxShadow: 'none',
    },
    convite: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    conviteTexto: {
      color: colors.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 18,
      lineHeight: 26,
    },
    botoes: { flexDirection: 'row', gap: 16 },
    aviso: {
      padding: 14,
      borderRadius: 12,
      color: colors.error,
      backgroundColor: colors.errorBg,
      fontFamily: FontFamilies.semibold,
      fontSize: 18,
      lineHeight: 26,
    },
    botaoRecusar: {
      ...botao,
      paddingHorizontal: 32,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    botaoRecusarTexto: {
      color: colors.primary,
      fontFamily: FontFamilies.bold,
      fontSize: 24,
      lineHeight: 30,
    },
    botaoPrincipal: { ...botao, flex: 1, backgroundColor: colors.primary },
    botaoPrincipalPressionado: { backgroundColor: LARANJA_ESCURO },
    botaoPrincipalDesabilitado: { backgroundColor: DESABILITADO.fundo },
    botaoPrincipalTexto: {
      color: colors.onPrimary,
      fontFamily: FontFamilies.bold,
      fontSize: 24,
      lineHeight: 30,
    },
    botaoPrincipalTextoDesabilitado: { color: DESABILITADO.texto },
    botaoPressionado: { opacity: 0.85 },
    botaoOcupado: { opacity: 0.6 },

    fundoDialogo: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    dialogo: {
      width: '100%',
      maxWidth: 620,
      gap: 16,
      padding: 36,
      borderRadius: 24,
      backgroundColor: colors.surface,
    },
    dialogoTitulo: {
      color: colors.text,
      fontFamily: FontFamilies.bold,
      fontSize: 28,
      lineHeight: 36,
    },
    dialogoTexto: {
      color: colors.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 22,
      lineHeight: 32,
    },
    dialogoRegistro: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.field,
    },
    dialogoRegistroRotulo: {
      color: colors.primary,
      fontFamily: FontFamilies.bold,
      fontSize: 16,
      lineHeight: 22,
      letterSpacing: 0.5,
    },
    dialogoRegistroTexto: {
      color: colors.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 16,
      lineHeight: 22,
    },
    dialogoBotoes: { flexDirection: 'row', gap: 16 },
    botaoVoltar: {
      ...botao,
      minWidth: 160,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
  });
}

export type DecisaoStyles = ReturnType<typeof createDecisaoStyles>;
