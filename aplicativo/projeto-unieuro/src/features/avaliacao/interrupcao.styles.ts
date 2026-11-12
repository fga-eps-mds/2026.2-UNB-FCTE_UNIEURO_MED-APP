import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies } from '@/constants/theme';
import { CORES_DA_TAREFA, FUNDO_ACOLHEDOR } from '@/features/avaliacao/drawing-task.styles';

/**
 * Diálogo de desistência e tela do exame interrompido (#25). São telas que o
 * paciente vê, então seguem as cores fixas das tarefas e textos de no mínimo 18.
 */
export function createInterrupcaoStyles() {
  const cores = CORES_DA_TAREFA;
  const botao = {
    minHeight: 64,
    flexGrow: 1,
    flexBasis: 220,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
    borderRadius: 16,
  };
  const textoBotao = { fontFamily: FontFamilies.semibold, fontSize: 20, lineHeight: 26 };

  return StyleSheet.create({
    desistir: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: BrandPalette.deepWine,
    },
    desistirTexto: { ...textoBotao, fontSize: 18, color: BrandPalette.deepWine },
    fundo: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
    fundoConteudo: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    dialogo: {
      width: '100%',
      maxWidth: 680,
      gap: 20,
      padding: 24,
      borderRadius: 24,
      backgroundColor: cores.surface,
    },
    titulo: { color: cores.text, fontFamily: FontFamilies.bold, fontSize: 30, lineHeight: 38 },
    texto: {
      color: cores.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 20,
      lineHeight: 30,
    },
    parada: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: BrandPalette.lightPeach,
    },
    paradaRotulo: {
      color: cores.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 16,
      letterSpacing: 0.64,
    },
    paradaTexto: {
      flexShrink: 1,
      color: cores.primary,
      fontFamily: FontFamilies.regular,
      fontSize: 18,
    },
    rotulo: {
      color: cores.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 16,
      letterSpacing: 0.64,
    },
    motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    motivo: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 20,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: cores.border,
      backgroundColor: cores.field,
    },
    motivoEscolhido: { borderColor: cores.primary, backgroundColor: BrandPalette.lightPeach },
    motivoTexto: { color: cores.text, fontFamily: FontFamilies.semibold, fontSize: 18 },
    motivoTextoEscolhido: { color: cores.primary },
    acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    botaoSecundario: { ...botao, borderWidth: 1.5, borderColor: BrandPalette.deepWine },
    botaoSecundarioTexto: { ...textoBotao, color: BrandPalette.deepWine },
    botaoPrincipal: { ...botao, backgroundColor: cores.primary },
    botaoPrincipalTexto: { ...textoBotao, color: cores.onPrimary },
    pressionado: { opacity: 0.82 },
    desabilitado: { opacity: 0.5 },

    tela: { flex: 1, backgroundColor: FUNDO_ACOLHEDOR },
    barra: {
      minHeight: 72,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 32,
      paddingVertical: 12,
      backgroundColor: cores.surface,
    },
    barraPaciente: {
      flexShrink: 1,
      color: cores.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 18,
    },
    barraEstado: { color: cores.primary, fontFamily: FontFamilies.semibold, fontSize: 18 },
    conteudo: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    cartao: {
      width: '100%',
      maxWidth: 840,
      gap: 16,
      padding: 24,
      borderRadius: 32,
      backgroundColor: cores.surface,
    },
    cartaoTitulo: {
      color: cores.text,
      fontFamily: FontFamilies.bold,
      fontSize: 34,
      lineHeight: 42,
      textAlign: 'center',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      borderRadius: 14,
      backgroundColor: cores.field,
    },
    itemTexto: { flexShrink: 1, color: cores.text, fontFamily: FontFamilies.regular, fontSize: 18 },
    aviso: {
      padding: 18,
      borderRadius: 14,
      backgroundColor: BrandPalette.lightPeach,
      color: cores.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 18,
      textAlign: 'center',
    },
    campo: {
      minHeight: 60,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: cores.border,
      backgroundColor: cores.field,
      paddingHorizontal: 14,
      color: cores.text,
      fontFamily: FontFamilies.regular,
      fontSize: 18,
    },
  });
}

export type InterrupcaoStyles = ReturnType<typeof createInterrupcaoStyles>;
