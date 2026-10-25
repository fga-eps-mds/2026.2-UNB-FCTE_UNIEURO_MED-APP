import { StyleSheet } from 'react-native';

import { FontFamilies, type ThemeColors } from '@/constants/theme';

const fonts = FontFamilies;

/** Largura a partir da qual o termo e o painel da decisão ficam lado a lado, como no protótipo. */
export const DUAS_COLUNAS_MIN_LARGURA = 900;

/** Margem lateral: maior no tablet, e menor só em telas muito estreitas. */
function margemDaTela(largura: number, duasColunas: boolean) {
  if (duasColunas) return 40;
  return largura < 360 ? 16 : 20;
}

export function getTermoLayout(largura: number) {
  const duasColunas = largura >= DUAS_COLUNAS_MIN_LARGURA;
  return { duasColunas, margem: margemDaTela(largura, duasColunas) };
}

// O público tem 60 anos ou mais: o corpo do termo tem 20, e nada fica abaixo de 16.
export function createTermoStyles(colors: ThemeColors) {
  const cartao = {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    cabecalho: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    paciente: {
      color: colors.textSecondary,
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 22,
    },
    etapa: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
    corpo: { flex: 1, gap: 24, paddingVertical: 24 },
    corpoDuasColunas: { flexDirection: 'row' },
    colunaTermo: { flex: 1, minHeight: 0, gap: 8 },
    colunaDecisao: { gap: 16 },
    colunaDecisaoLateral: { flex: 1 },
    cartaoTermo: { ...cartao, flex: 1, overflow: 'hidden' },
    rolagem: { padding: 28, gap: 16 },
    titulo: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 26,
      lineHeight: 34,
    },
    pesquisa: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 20,
      lineHeight: 30,
    },
    responsavel: {
      backgroundColor: colors.field,
      borderRadius: 16,
      padding: 16,
      gap: 4,
    },
    responsavelTexto: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 18,
      lineHeight: 26,
    },
    instituicao: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 24,
    },
    secaoTitulo: {
      color: colors.primary,
      fontFamily: fonts.semibold,
      fontSize: 18,
      lineHeight: 26,
      marginTop: 8,
    },
    paragrafo: { color: colors.text, fontFamily: fonts.regular, fontSize: 20, lineHeight: 30 },
    versao: {
      color: colors.textSecondary,
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 22,
      marginTop: 8,
    },
    avisoRolagem: {
      color: colors.primary,
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 22,
    },
    cartaoDecisao: { ...cartao, padding: 20, gap: 14 },
    declaracaoTitulo: {
      color: colors.primary,
      fontFamily: fonts.semibold,
      fontSize: 18,
      lineHeight: 26,
    },
    declaracao: { color: colors.text, fontFamily: fonts.regular, fontSize: 18, lineHeight: 26 },
    quemAssina: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
    quemAssinaRotulo: {
      color: colors.textSecondary,
      fontFamily: fonts.semibold,
      fontSize: 16,
      lineHeight: 22,
    },
    opcao: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 18,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.field,
    },
    opcaoMarcada: { borderColor: colors.primary },
    opcaoPressionada: { opacity: 0.85 },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioMarcado: { borderColor: colors.primary },
    radioPonto: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
    opcaoTexto: { color: colors.text, fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 },
  });
}

export type TermoStyles = ReturnType<typeof createTermoStyles>;
